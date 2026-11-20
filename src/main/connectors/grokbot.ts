// Conector do Grok Bot: os agentes vivem na nuvem; o app guarda neste computador um cache (pasta
// sand-client-persistence, um arquivo .blob em JSON por chave, nome = chave em base32). Lemos SÓ ESSE CACHE:
//   …roster.last-roster        lista de agentes (nome, título, cor, aguardando resposta, última atividade)
//   …sidebar.last-sections     seções da barra lateral → departamentos
//   …transcript.replicas.<id>  últimas mensagens de cada agente
// O cache só é atualizado com o Grok Bot aberto; com ele fechado, a sala mostra o último estado conhecido.
// "Trabalhando" = resposta sendo escrita (isStreaming) num cache gravado há menos de 2 min.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ChatItem, ConnectorSnapshot, SnapshotAgent } from '@shared/types';
import { decideStatus } from '@shared/status';
import type { ConnectorFactory } from './types';
import { clean, cleanChat } from './openmausbot';
import { LocalReadConnector, namedColor } from './localReader';

export const DEFAULT_GROKBOT_DIR = join(homedir(), 'Library', 'Application Support', 'Grok Bot');
const CACHE = 'sand-client-persistence';
const STREAM_FRESH_MS = 2 * 60 * 1000;

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** base32 (RFC 4648, minúsculo, sem preenchimento) → texto. */
export function b32decode(s: string): string {
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of s.toLowerCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out).toString('utf8');
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

interface RosterRow {
  id: string; name: string; title?: string; description?: string; avatarColor?: string;
  lastActivityAt?: number; awaitingUserResponse?: unknown; isHiddenFromSidebar?: boolean; isRemovedFromSidebar?: boolean;
}

export class GrokBotReader {
  private cache = new Map<string, { mtime: number; size: number; data: unknown }>();
  constructor(readonly home: string) {}

  private load(file: string): { data: unknown; mtime: number } | null {
    const p = join(this.home, CACHE, file);
    try {
      const st = statSync(p);
      const c = this.cache.get(file);
      if (c && c.mtime === st.mtimeMs && c.size === st.size) return { data: c.data, mtime: c.mtime };
      const data = JSON.parse(readFileSync(p, 'utf8'));
      this.cache.set(file, { mtime: st.mtimeMs, size: st.size, data });
      return { data, mtime: st.mtimeMs };
    } catch { return null; }
  }

  snapshot(now = Date.now()): ConnectorSnapshot {
    // chaves por conta: "sand.client.slice.account.<conta>.<resto>"; usa a conta com a lista de agentes mais recente
    const byKey = new Map<string, string>();
    for (const f of readdirSync(join(this.home, CACHE))) if (f.endsWith('.blob')) byKey.set(b32decode(f.slice(0, -5)), f);
    let account = '', rosterFile = '', best = -1;
    for (const [k, f] of byKey) {
      const m = /^sand\.client\.slice\.account\.([^.]+)\.roster\.last-roster$/.exec(k);
      if (!m) continue;
      const t = statSync(join(this.home, CACHE, f)).mtimeMs;
      if (t > best) { best = t; account = m[1]; rosterFile = f; }
    }
    if (!rosterFile) throw new Error('O Grok Bot ainda não guardou a lista de agentes neste computador (abra o app uma vez).');
    const key = (rest: string) => byKey.get(`sand.client.slice.account.${account}.${rest}`);
    const value = (rest: string) => { const f = key(rest); const r = f ? this.load(f) : null; return r ? ((r.data as Record<string, unknown>)?.value as Record<string, unknown> | undefined) : undefined; };

    const rows = ((value('roster.last-roster')?.rows as RosterRow[]) || []).filter((r) => r && r.id && str(r.name).trim() && !r.isRemovedFromSidebar && !r.isHiddenFromSidebar);
    const sections = ((value('sidebar.last-sections')?.sections as { name?: string; agentIds?: string[] }[]) || []).filter((s) => s && str(s.name).trim());
    const deptOf = new Map<string, string>();
    for (const s of sections) for (const id of s.agentIds || []) if (!deptOf.has(id)) deptOf.set(id, clean(s.name, 40));
    const order = [...sections.map((s) => clean(s.name, 40))];
    if (rows.some((r) => !deptOf.has(r.id)) && !order.includes('Geral')) order.unshift('Geral');

    const agents: SnapshotAgent[] = rows.map((r) => {
      const f = key(`transcript.replicas.${r.id}`);
      const tr = f ? this.load(f) : null;
      const val = (tr?.data as Record<string, unknown> | undefined)?.value as Record<string, unknown> | undefined;
      const entries = (Array.isArray(val?.entries) ? val!.entries : []) as Record<string, unknown>[];
      const chat: ChatItem[] = [];
      let lastSpokeAt = 0, streaming = false;
      for (const e of entries) {
        if (e.kind !== 'message') continue;
        const t = cleanChat(str(e.content), 1500);
        const at = num(e.timestampMs);
        if (e.role === 'assistant') { streaming = !!e.isStreaming; if (t.trim()) { chat.push({ r: 'b', t, at }); lastSpokeAt = Math.max(lastSpokeAt, at); } }
        else if (e.role === 'user' && t.trim()) { streaming = false; chat.push({ r: 'u', t, at }); }
      }
      const fresh = !!tr && Math.max(num(val?.persistedAt), tr.mtime) > now - STREAM_FRESH_MS;
      const aw = r.awaitingUserResponse;
      const need = aw == null ? '' : clean(typeof aw === 'string' ? aw : str((aw as Record<string, unknown>).text) || str((aw as Record<string, unknown>).question) || 'Esperando sua resposta', 140);
      const st = decideStatus({
        now,
        ask: aw != null ? { kind: 'question', need } : null,
        running: streaming && fresh,
        doing: 'Respondendo',
        failure: null,
        lastSpokeAt,
      });
      const dept = deptOf.get(r.id) || 'Geral';
      return {
        id: r.id, name: clean(r.name, 60), role: clean(r.title, 60) || clean(r.description, 60) || dept, department: dept,
        color: namedColor(r.avatarColor), chief: false,
        status: st.status, need: st.need, ask: st.ask, doing: st.doing, chat: chat.slice(-12),
      };
    });
    return { agents, groups: [], events: [], departments: order };
  }
}

export const grokBotFactory = (log?: (m: string) => void): ConnectorFactory => ({
  kind: 'grokbot',
  label: 'Grok Bot',
  description: 'Lê, só para leitura, o cache que o Grok Bot guarda neste computador (agentes, seções e conversas recentes). Atualiza só com o Grok Bot aberto. Ainda não envia mensagens.',
  multiple: false,
  fields: [
    { key: 'dataDir', label: 'Pasta de dados', type: 'text', placeholder: '~/Library/Application Support/Grok Bot', default: '~/Library/Application Support/Grok Bot' },
    { key: 'pollMs', label: 'Intervalo de leitura (ms)', type: 'number', default: 3000 },
  ],
  create: () => new LocalReadConnector({
    kind: 'grokbot', label: 'Grok Bot', defaultDir: DEFAULT_GROKBOT_DIR, mustHave: [CACHE],
    read: (home) => new GrokBotReader(home).snapshot(),
    sendError: 'O Grok Bot ainda não aceita mensagens vindas da sala. Responda pelo próprio Grok Bot.',
  }, log),
});
