// Conector do OpenBot: lê, SOMENTE PARA LEITURA, o banco local do app (openbot.db) e o layout da barra lateral.
// Não há API pública do OpenBot para isso (conferido em 20/11/2026): o formato do banco é interno e pode mudar,
// então toda leitura é defensiva — campo ausente vira valor neutro, nunca status inventado.
// Envio de mensagens: não suportado (o OpenBot não expõe entrada local documentada).

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ChatItem, CommandResult, ConnectorSnapshot, NextRoutine, RoomCommand, RoomEvent, SnapshotAgent, SnapshotGroup } from '@shared/types';
import { decideStatus } from '@shared/status';
import { clean, cleanChat } from './openmausbot';
import { ReaderThread } from './readerThread';
import type { AgentConnector, ConnectorFactory } from './types';

const RECENT_MS = 30 * 60 * 1000;
const MEET_MS = 4 * 60 * 1000;
export const DEFAULT_OPENBOT_DIR = join(homedir(), 'Library', 'Application Support', 'OpenBot');

const ms = (s: unknown): number => { const n = typeof s === 'number' ? s : Date.parse(String(s ?? '')); return Number.isFinite(n) ? n : 0; };
const obj = (j: unknown): Record<string, unknown> => {
  try { const o = JSON.parse(String(j ?? '{}')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Cor do avatar do OpenBot (matiz 0–360) → cor nomeada da sala. */
export function hueToColor(h: unknown): string {
  if (typeof h !== 'number' || !Number.isFinite(h)) return 'silver';
  const x = ((h % 360) + 360) % 360;
  const table: [number, string][] = [[0, 'red'], [30, 'orange'], [52, 'yellow'], [130, 'green'], [175, 'teal'], [215, 'blue'], [275, 'purple'], [325, 'pink'], [360, 'red']];
  let best = 'silver', d = 999;
  for (const [hh, c] of table) { const dd = Math.abs(hh - x); if (dd < d) { d = dd; best = c; } }
  return best;
}

interface ThreadRow { thread_id: string; agent_id: string; active_turn_id: string | null; updated_at: string }
interface MsgRow { thread_id: string; author: string; item_type: string | null; status: string; created_at: string; message_json: string }

export class OpenBotReader {
  constructor(readonly home: string) {}

  private sidebar(): { order: string[]; byAgent: Map<string, string> } {
    const byAgent = new Map<string, string>();
    let o: Record<string, unknown> = {};
    try { o = JSON.parse(readFileSync(join(this.home, 'openbot-sidebar-layout-v1.json'), 'utf8')); } catch { /* sem layout: tudo em Geral */ }
    const sections = Array.isArray(o.sections) ? (o.sections as Record<string, unknown>[]) : [];
    const name = new Map(sections.map((s) => [str(s.id), str(s.name).trim()]));
    const order = ['Geral'];
    const ord = Array.isArray(o.order) ? (o.order as unknown[]).map(str) : sections.map((s) => str(s.id));
    for (const id of ord) { const n = name.get(id); if (n && !order.includes(n)) order.push(n); }
    for (const n of name.values()) if (n && !order.includes(n)) order.push(n);
    const asg = (o.agentAssignments && typeof o.agentAssignments === 'object' ? o.agentAssignments : {}) as Record<string, unknown>;
    for (const [agent, sec] of Object.entries(asg)) { const n = name.get(str(sec)); if (n) byAgent.set(agent, n); }
    return { order, byAgent };
  }

  snapshot(now = Date.now()): ConnectorSnapshot {
    const { order, byAgent } = this.sidebar();
    const db = new DatabaseSync(join(this.home, 'openbot.db'), { readOnly: true, timeout: 2000 });
    try {
      // ---------- agentes ----------
      const raw = (db.prepare('select agent_id, agent_json from projection_agents order by sort_order, agent_id').all() as { agent_id: string; agent_json: string }[])
        .map((r) => ({ id: r.agent_id, j: obj(r.agent_json) }))
        .filter((a) => str(a.j.name).trim());
      const nameOf = new Map(raw.map((a) => [a.id, str(a.j.name).trim()]));

      const threads = db.prepare('select thread_id, agent_id, active_turn_id, updated_at from projection_threads').all() as unknown as ThreadRow[];
      const byAgentThreads = new Map<string, ThreadRow[]>();
      for (const t of threads) { if (!byAgentThreads.has(t.agent_id)) byAgentThreads.set(t.agent_id, []); byAgentThreads.get(t.agent_id)!.push(t); }
      const thread2agent = new Map(threads.map((t) => [t.thread_id, t.agent_id]));

      // execução aberta = turno marcado como ativo na conversa e ainda "running"
      const runningTurn = db.prepare("select 1 from projection_turns where turn_id=? and status='running'");
      // perguntas que só o dono responde: cartão de pergunta sem resolução
      const pending = new Map<string, { need: string; at: number }>();
      for (const r of db.prepare("select thread_id, created_at, message_json from projection_thread_messages where item_type='question_prompt'").all() as { thread_id: string; created_at: string; message_json: string }[]) {
        const qp = obj(r.message_json).questionPrompt as Record<string, unknown> | undefined;
        if (!qp || qp.resolution) continue;
        const a = thread2agent.get(r.thread_id);
        if (!a) continue;
        const qs = Array.isArray(qp.questions) ? (qp.questions as Record<string, unknown>[]) : [];
        const need = clean(str(qs[0]?.question) || str(qs[0]?.header) || 'Tem uma pergunta para você', 140);
        const at = ms(r.created_at);
        if (!pending.has(a) || at > pending.get(a)!.at) pending.set(a, { need, at });
      }
      // falha: conversa de tarefa encerrada com "failed"
      const failure = new Map<string, { at: number; reason?: string }>();
      for (const r of db.prepare("select agent_id, error, updated_at from projection_agent_threads where outcome='failed' and archived_at is null").all() as { agent_id: string; error: string | null; updated_at: string }[]) {
        const at = ms(r.updated_at);
        if (!failure.has(r.agent_id) || at > failure.get(r.agent_id)!.at) failure.set(r.agent_id, { at, reason: r.error ? clean(r.error, 120) : undefined });
      }
      // rotinas
      const next = new Map<string, NextRoutine>();
      for (const r of db.prepare('select r.agent_id, r.name, t.next_run_at from projection_agent_routines r join projection_routine_triggers t on t.routine_id=r.routine_id where r.active=1').all() as { agent_id: string; name: string; next_run_at: unknown }[]) {
        const at = ms(r.next_run_at);
        if (at > now && (!next.has(r.agent_id) || at < next.get(r.agent_id)!.at)) next.set(r.agent_id, { name: clean(r.name, 60), at });
      }

      const lastMsgs = db.prepare('select thread_id, author, item_type, status, created_at, message_json from projection_thread_messages where thread_id=? order by created_at desc, ordinal desc limit 80');
      const events: RoomEvent[] = [];
      const seenEx = new Set<string>();

      const agents: SnapshotAgent[] = raw.map((a) => {
        const ths = (byAgentThreads.get(a.id) || []).slice().sort((x, y) => ms(y.updated_at) - ms(x.updated_at));
        const running = ths.some((t) => t.active_turn_id && runningTurn.get(t.active_turn_id));
        const main = ths[0];
        const rows = main ? (lastMsgs.all(main.thread_id) as unknown as MsgRow[]) : [];
        const chat: ChatItem[] = [];
        let lastSpokeAt = 0;
        let doing = '';
        for (const r of rows.slice().reverse()) {
          const m = obj(r.message_json);
          const at = ms(r.created_at);
          const text = str(m.text).trim();
          if (r.author === 'user' && !r.item_type && text) chat.push({ r: 'u', t: cleanChat(text, 1500), at });
          else if (r.author === 'assistant' && (r.item_type === 'final_answer' || r.item_type === 'agentMessage') && text) {
            chat.push({ r: 'b', t: cleanChat(text, 1500), at });
            lastSpokeAt = Math.max(lastSpokeAt, at);
          } else if (r.author === 'assistant' && r.item_type === 'commentary' && text) doing = clean(text, 80);
          else if (r.item_type === 'agent-exchange') {
            const ex = (m.exchange || {}) as Record<string, unknown>;
            const from = str(ex.senderAgentId) || str(m.senderAgentId);
            if (ex.direction === 'incoming' && from && from !== a.id && text) {
              chat.push({ r: 'o', t: cleanChat(text, 1500), at, w: nameOf.get(from) || 'Outro agente', from: nameOf.has(from) ? from : undefined });
              const key = str(ex.messageId) || str(m.id);
              if (at > now - RECENT_MS && nameOf.has(from) && !seenEx.has(key)) {
                seenEx.add(key);
                events.push({ id: 'x-' + key, at, from, to: a.id, text: clean(text, 170) });
              }
            }
          }
        }
        const p = pending.get(a.id);
        const st = decideStatus({
          now,
          ask: p ? { kind: 'question', need: p.need } : null,
          running,
          doing: running ? doing || undefined : undefined,
          failure: failure.get(a.id) || null,
          lastSpokeAt,
        });
        const title = clean(a.j.title, 60);
        const department = byAgent.get(a.id) || 'Geral';
        return {
          id: a.id, name: nameOf.get(a.id)!, role: title || department, department, color: hueToColor(a.j.avatarHue), chief: false,
          status: st.status, need: st.need, ask: st.ask, doing: st.doing, next: next.get(a.id), chat: chat.slice(-12),
        };
      });

      // ---------- canais = grupos ----------
      const groups: SnapshotGroup[] = [];
      const chanLast = db.prepare('select message_json from projection_channel_messages where channel_id=? order by sequence desc limit 40');
      for (const r of db.prepare('select channel_id, channel_json from projection_channels').all() as { channel_id: string; channel_json: string }[]) {
        const c = obj(r.channel_json);
        if (c.archived) continue;
        const members = (Array.isArray(c.members) ? (c.members as Record<string, unknown>[]) : []).map((x) => str(x.agentId)).filter((id) => nameOf.has(id));
        let active = false;
        for (const mr of chanLast.all(r.channel_id) as { message_json: string }[]) {
          const m = obj(mr.message_json);
          const inner = (m.message || {}) as Record<string, unknown>;
          const at = ms(inner.createdAt ?? m.createdAt);
          const au = (m.author || {}) as Record<string, unknown>;
          if (at > now - MEET_MS) active = true;
          const text = str(inner.text ?? m.text).trim();
          const done = !inner.itemType || inner.itemType === 'final_answer' || inner.itemType === 'agentMessage';
          if (au.kind === 'agent' && nameOf.has(str(au.id)) && text && done && at > now - RECENT_MS && !m.superseded) {
            events.push({ id: 'c-' + str(m.id), at, from: str(au.id), groupId: r.channel_id, text: clean(text, 230) });
          }
        }
        groups.push({ id: r.channel_id, name: clean(c.name, 60) || 'Canal', members, active: active && members.length >= 2 });
      }

      events.sort((x, y) => x.at - y.at);
      return { agents, groups, events: events.slice(-25), departments: order };
    } finally {
      db.close();
    }
  }
}

export class OpenBotConnector implements AgentConnector {
  readonly kind = 'openbot';
  readonly label = 'OpenBot';
  readonly capabilities = { sendToAgent: false, sendToGroup: false, retryTask: false, groups: true, departments: true, chatHistory: true, transport: 'poll' as const };
  private home = DEFAULT_OPENBOT_DIR;
  private poll = 3000;
  private thread = new ReaderThread('openbot');
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private log: (m: string) => void = () => {}) {}

  async connect(config: Record<string, unknown>): Promise<void> {
    const dir = String(config.dataDir || '').trim() || DEFAULT_OPENBOT_DIR;
    this.home = dir.replace(/^~(?=\/|$)/, homedir());
    this.poll = Math.max(1000, Number(config.pollMs) || 3000);
    if (!existsSync(join(this.home, 'openbot.db'))) throw new Error('Não achei openbot.db em ' + this.home);
    this.thread.reset();
    this.stopped = false;
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.thread.stop();
  }

  subscribe(onSnapshot: (s: ConnectorSnapshot) => void, onError: (e: Error) => void): () => void {
    let alive = true;
    let fails = 0;
    const loop = async () => {
      if (!alive || this.stopped) return;
      let wait = this.poll;
      try {
        const s = await this.thread.read(this.home, () => new OpenBotReader(this.home).snapshot());
        if (!alive || this.stopped) return;
        fails = 0;
        if (s) onSnapshot(s);
      } catch (e) {
        if (!alive || this.stopped) return;
        fails++;
        wait = Math.min(30000, this.poll * Math.min(10, fails));
        this.log('openbot: leitura falhou: ' + (e as Error).message);
        onError(e as Error);
      }
      this.timer = setTimeout(() => void loop(), wait);
    };
    void loop();
    return () => { alive = false; if (this.timer) clearTimeout(this.timer); this.timer = null; this.thread.stop(); };
  }

  async send(_cmd: RoomCommand): Promise<CommandResult> {
    return { ok: false, error: 'O OpenBot ainda não aceita mensagens vindas da sala. Responda pelo próprio OpenBot.' };
  }
}

export const openBotFactory = (log?: (m: string) => void): ConnectorFactory => ({
  kind: 'openbot',
  label: 'OpenBot',
  description: 'Lê, só para leitura, os agentes, conversas e canais do OpenBot neste computador. Ainda não envia mensagens.',
  multiple: false,
  fields: [
    { key: 'dataDir', label: 'Pasta de dados', type: 'text', placeholder: '~/Library/Application Support/OpenBot', default: '~/Library/Application Support/OpenBot' },
    { key: 'pollMs', label: 'Intervalo de leitura (ms)', type: 'number', default: 3000 },
  ],
  create: () => new OpenBotConnector(log),
});
