// Conector do Tucano: lê, SOMENTE PARA LEITURA, o banco local do app (tucano.db do espaço de trabalho escolhido).
// Formato interno (conferido em 20/11/2026, esquema 38): agents, conversations (dm/channel) + members, messages,
// questions (perguntas abertas), approvals (pedidos de aprovação), delegations (pedidos entre agentes), routines.
// O Tucano não grava "está rodando agora" no banco (a execução só é salva quando termina), então "trabalhando" usa a
// regra de reserva: o agente falou no último minuto. "Esperando você" só com pergunta/aprovação aberta de verdade.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ChatItem, ConnectorSnapshot, NextRoutine, RoomEvent, SnapshotAgent, SnapshotGroup } from '@shared/types';
import { decideStatus } from '@shared/status';
import type { ConnectorFactory } from './types';
import { clean, cleanChat } from './openmausbot';
import { expandHome, LocalReadConnector, namedColor } from './localReader';

const RECENT_MS = 30 * 60 * 1000;
const MEET_MS = 4 * 60 * 1000;
const SPOKE_MS = 60 * 1000;
export const DEFAULT_TUCANO_DIR = join(homedir(), 'Library', 'Application Support', 'Tucano');

const obj = (j: unknown): Record<string, unknown> => {
  try { const o = JSON.parse(String(j ?? '{}')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Pasta do espaço de trabalho escolhido no Tucano (workspaces.json → selected); sem ele, a própria pasta do app. */
export function tucanoDataDir(home: string): string {
  try {
    const w = JSON.parse(readFileSync(join(home, 'workspaces.json'), 'utf8')) as { selected?: string; workspaces?: { id: string; dataDir?: string; isDefault?: boolean }[] };
    const list = Array.isArray(w.workspaces) ? w.workspaces : [];
    const sel = list.find((x) => x.id === w.selected) || list.find((x) => x.isDefault);
    if (sel?.dataDir) return expandHome(sel.dataDir);
  } catch { /* sem workspaces.json: banco na raiz */ }
  return home;
}

interface MsgRow { id: string; conversation_id: string; author_kind: string; author_id: string | null; text: string; at: number; run: string | null }

export class TucanoReader {
  constructor(readonly home: string) {}

  snapshot(now = Date.now()): ConnectorSnapshot {
    const dir = tucanoDataDir(this.home);
    const db = new DatabaseSync(join(dir, 'tucano.db'), { readOnly: true, timeout: 2000 });
    try {
      let ws = '';
      try {
        const r = db.prepare("select value from settings where key='workspaceName'").get() as { value: string } | undefined;
        if (r) { try { const v = JSON.parse(r.value); ws = typeof v === 'string' ? v : ''; } catch { ws = r.value; } }
      } catch { /* versão sem settings */ }
      const dept = clean(ws, 40) || 'Tucano';

      const raw = db.prepare('select id, name, role, color from agents where archived=0 order by created_at, id').all() as { id: string; name: string; role: string; color: string }[];
      const nameOf = new Map(raw.map((a) => [a.id, a.name.trim() || 'Agente']));

      const convs = db.prepare('select id, kind, name from conversations').all() as { id: string; kind: string; name: string }[];
      const members = new Map<string, string[]>();
      for (const m of db.prepare('select conversation_id, agent_id from members').all() as { conversation_id: string; agent_id: string }[]) {
        if (!members.has(m.conversation_id)) members.set(m.conversation_id, []);
        members.get(m.conversation_id)!.push(m.agent_id);
      }
      const dmOf = new Map<string, string>();
      for (const c of convs) if (c.kind === 'dm') for (const a of members.get(c.id) || []) if (!dmOf.has(a)) dmOf.set(a, c.id);

      // pedidos que só o dono resolve
      const asks = new Map<string, { need: string; at: number }>();
      const addAsk = (agent: string, need: string, at: number) => { if (!asks.has(agent) || at > asks.get(agent)!.at) asks.set(agent, { need, at }); };
      for (const q of db.prepare("select agent_id, text, created_at from questions where state='open'").all() as { agent_id: string; text: string; created_at: number }[]) addAsk(q.agent_id, clean(q.text, 140) || 'Tem uma pergunta para você', q.created_at);
      for (const a of db.prepare("select agent_id, tool, connector_name, created_at, expires_at from approvals where state='pending'").all() as { agent_id: string; tool: string; connector_name: string; created_at: number; expires_at: number }[]) {
        if (a.expires_at && a.expires_at < now) continue;
        addAsk(a.agent_id, clean(`Pede aprovação: ${a.tool} (${a.connector_name})`, 140), a.created_at);
      }

      // última fala de cada agente e última execução com erro
      const lastSpoke = new Map<string, number>();
      for (const r of db.prepare("select author_id, max(at) at from messages where author_kind='agent' group by 1").all() as { author_id: string; at: number }[]) lastSpoke.set(r.author_id, r.at);
      const failure = new Map<string, { at: number; reason?: string }>();
      const lastRun = db.prepare("select at, run from messages where author_kind='agent' and author_id=? and run is not null order by at desc limit 1");

      const next = new Map<string, NextRoutine>();
      for (const r of db.prepare('select agent_id, name, next_at from routines where enabled=1 and next_at is not null').all() as { agent_id: string; name: string; next_at: number }[]) {
        if (r.next_at > now && (!next.has(r.agent_id) || r.next_at < next.get(r.agent_id)!.at)) next.set(r.agent_id, { name: clean(r.name, 60), at: r.next_at });
      }

      const chatQ = db.prepare('select id, conversation_id, author_kind, author_id, text, at, run from messages where conversation_id=? order by at desc limit 40');
      const agents: SnapshotAgent[] = raw.map((a) => {
        const lr = lastRun.get(a.id) as { at: number; run: string } | undefined;
        let failedMsgAt = -1;
        if (lr) {
          const run = obj(lr.run);
          if (run.error || run.status === 'failed') {
            failure.set(a.id, { at: Math.max(Number(run.endedAt) || 0, lr.at), reason: clean(str(run.errorDetail) || str(run.error), 120) || undefined });
            failedMsgAt = lr.at;
          }
        }
        const conv = dmOf.get(a.id);
        const chat: ChatItem[] = [];
        if (conv) {
          for (const m of (chatQ.all(conv) as unknown as MsgRow[]).reverse()) {
            const t = cleanChat(m.text, 1500);
            if (!t.trim()) continue;
            if (m.author_kind === 'person') chat.push({ r: 'u', t, at: m.at });
            else if (m.author_kind === 'agent' && m.author_id === a.id) chat.push({ r: 'b', t, at: m.at });
            else if (m.author_kind === 'agent' && m.author_id) chat.push({ r: 'o', t, at: m.at, w: nameOf.get(m.author_id) || 'Outro agente', from: nameOf.has(m.author_id) ? m.author_id : undefined });
          }
        }
        // a mensagem de erro da execução que falhou conta como a falha, não como "falou depois dela"
        const spokeAny = lastSpoke.get(a.id) ?? 0;
        const spoke = spokeAny === failedMsgAt ? spokeAny - 1 : spokeAny;
        const ask = asks.get(a.id);
        const st = decideStatus({
          now,
          ask: ask ? { kind: 'question', need: ask.need } : null,
          running: spoke > now - SPOKE_MS,
          doing: 'Respondendo',
          failure: failure.get(a.id) || null,
          lastSpokeAt: spoke,
        });
        return {
          id: a.id, name: nameOf.get(a.id)!, role: clean(a.role, 60) || dept, department: dept, color: namedColor(a.color), chief: false,
          status: st.status, need: st.need, ask: st.ask, doing: st.doing, next: next.get(a.id), chat: chat.slice(-12),
        };
      });

      // canais = grupos; eventos = pedidos entre agentes e falas em canais (últimos 30 min)
      const events: RoomEvent[] = [];
      const groups: SnapshotGroup[] = [];
      const recentQ = db.prepare("select id, author_id, text, at from messages where conversation_id=? and author_kind='agent' and at>? order by at");
      const anyQ = db.prepare('select 1 from messages where conversation_id=? and at>? limit 1');
      for (const c of convs) {
        if (c.kind !== 'channel') continue;
        const ms = (members.get(c.id) || []).filter((id) => nameOf.has(id));
        groups.push({ id: c.id, name: clean(c.name, 60) || 'Canal', members: ms, active: ms.length >= 2 && !!anyQ.get(c.id, now - MEET_MS) });
        for (const m of recentQ.all(c.id, now - RECENT_MS) as { id: string; author_id: string; text: string; at: number }[]) {
          if (nameOf.has(m.author_id) && m.text.trim()) events.push({ id: 'c-' + m.id, at: m.at, from: m.author_id, groupId: c.id, text: clean(m.text, 230) });
        }
      }
      for (const d of db.prepare('select id, from_agent, to_agent, text, created_at from delegations where created_at>? order by created_at').all(now - RECENT_MS) as { id: string; from_agent: string; to_agent: string; text: string; created_at: number }[]) {
        if (nameOf.has(d.from_agent) && nameOf.has(d.to_agent) && d.from_agent !== d.to_agent) events.push({ id: 'd-' + d.id, at: d.created_at, from: d.from_agent, to: d.to_agent, text: clean(d.text, 170) });
      }
      events.sort((x, y) => x.at - y.at);
      return { agents, groups, events: events.slice(-25), departments: [dept] };
    } finally {
      db.close();
    }
  }
}

export const tucanoFactory = (log?: (m: string) => void): ConnectorFactory => ({
  kind: 'tucano',
  label: 'Tucano',
  description: 'Lê, só para leitura, os agentes, conversas e canais do Tucano neste computador (espaço de trabalho escolhido no app). Ainda não envia mensagens.',
  multiple: false,
  fields: [
    { key: 'dataDir', label: 'Pasta de dados', type: 'text', placeholder: '~/Library/Application Support/Tucano', default: '~/Library/Application Support/Tucano' },
    { key: 'pollMs', label: 'Intervalo de leitura (ms)', type: 'number', default: 3000 },
  ],
  create: () => new LocalReadConnector({
    kind: 'tucano', label: 'Tucano', defaultDir: DEFAULT_TUCANO_DIR, mustHave: ['workspaces.json', 'tucano.db'],
    read: (home) => new TucanoReader(home).snapshot(),
    sendError: 'O Tucano ainda não aceita mensagens vindas da sala. Responda pelo próprio Tucano.',
  }, log),
});
