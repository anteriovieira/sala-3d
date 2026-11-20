// Agregador: junta os snapshots de todas as conexões numa só sala, com ids `conexão:id`,
// slots fixos, status anterior e reconexão com espera crescente. Erro numa conexão não derruba as outras.

import { splitId } from '@shared/commands';
import type { Agent, CommandResult, ConnectorInfo, ConnectorSnapshot, Group, RoomCommand, RoomEvent, RoomState, Status } from '@shared/types';
import type { AgentConnector } from './connectors/types';

export interface SlotStore {
  load(): Record<string, number>;
  save(slots: Record<string, number>): void;
}

export const memorySlots = (): SlotStore => {
  let m: Record<string, number> = {};
  return { load: () => ({ ...m }), save: (s) => { m = { ...s }; } };
};

interface Conn {
  id: string;
  kind: string;
  label: string;
  connector: AgentConnector;
  config: Record<string, unknown>;
  state: ConnectorInfo['state'];
  error?: string;
  snap?: ConnectorSnapshot;
  unsub?: () => void;
  retryMs: number;
  timer?: ReturnType<typeof setTimeout>;
  stopped: boolean;
}

const EVENT_WINDOW = 30 * 60_000;
const MIN_RETRY = 2000;
const MAX_RETRY = 60_000;

export class Hub {
  private conns = new Map<string, Conn>();
  private slots: Record<string, number>;
  private prev = new Map<string, { status: Status; since: number; previous?: Status }>();
  private last: RoomState = { at: 0, agents: [], groups: [], events: [], connectors: [] };
  private lastKey = '';
  private pending: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: RoomState) => void>();

  constructor(private store: SlotStore, private log: (msg: string) => void = () => {}, private debounceMs = 60) {
    this.slots = store.load();
  }

  onState(fn: (s: RoomState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  state(): RoomState {
    return this.last;
  }

  ids(): string[] {
    return [...this.conns.keys()];
  }

  add(id: string, kind: string, label: string, connector: AgentConnector, config: Record<string, unknown>): void {
    if (this.conns.has(id)) throw new Error('conexão já existe: ' + id);
    const c: Conn = { id, kind, label, connector, config, state: 'connecting', retryMs: MIN_RETRY, stopped: false };
    this.conns.set(id, c);
    this.schedule();
    void this.start(c);
  }

  async remove(id: string): Promise<void> {
    const c = this.conns.get(id);
    if (!c) return;
    c.stopped = true;
    if (c.timer) clearTimeout(c.timer);
    try { c.unsub?.(); } catch { /* ignora */ }
    try { await c.connector.disconnect(); } catch { /* ignora */ }
    this.conns.delete(id);
    this.schedule();
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.conns.keys()].map((id) => this.remove(id)));
  }

  private async start(c: Conn): Promise<void> {
    if (c.stopped) return;
    c.state = 'connecting';
    this.schedule();
    try {
      await c.connector.connect(c.config);
      if (c.stopped) return;
      c.unsub = c.connector.subscribe(
        (s) => this.onSnapshot(c, s),
        (e) => this.onError(c, e),
      );
    } catch (e) {
      this.onError(c, e as Error, true);
    }
  }

  private onSnapshot(c: Conn, s: ConnectorSnapshot) {
    if (c.stopped) return;
    if (c.timer) { clearTimeout(c.timer); c.timer = undefined; }
    c.state = 'online';
    c.error = undefined;
    c.retryMs = MIN_RETRY;
    c.snap = s;
    this.schedule();
  }

  private onError(c: Conn, e: Error, fatal = false) {
    if (c.stopped) return;
    c.state = 'error';
    c.error = (e && e.message) || String(e);
    this.log(`[${c.id}] erro: ${c.error}`);
    this.schedule();
    if (c.timer) return;
    const wait = c.retryMs;
    c.retryMs = Math.min(MAX_RETRY, c.retryMs * 2);
    // sem novidade até lá: reconecta do zero
    c.timer = setTimeout(async () => {
      c.timer = undefined;
      if (c.stopped || (!fatal && c.state === 'online')) return;
      try { c.unsub?.(); } catch { /* ignora */ }
      c.unsub = undefined;
      try { await c.connector.disconnect(); } catch { /* ignora */ }
      void this.start(c);
    }, wait);
  }

  async send(cmd: RoomCommand): Promise<CommandResult> {
    const route = (full: string): [Conn | undefined, string] => {
      const [cid, local] = splitId(full);
      return [this.conns.get(cid), local];
    };
    try {
      switch (cmd.type) {
        case 'message.agent':
        case 'task.retry': {
          const [c, local] = route(cmd.agentId);
          if (!c) return { ok: false, error: 'conexão não encontrada' };
          if (c.state === 'connecting') return { ok: false, error: 'conexão ainda não está pronta' };
          if (cmd.type === 'message.agent' && !c.connector.capabilities.sendToAgent) return { ok: false, error: 'esta plataforma não aceita mensagens' };
          if (cmd.type === 'task.retry' && !c.connector.capabilities.retryTask) return { ok: false, error: 'esta plataforma não permite tentar de novo' };
          return await c.connector.send({ ...cmd, agentId: local });
        }
        case 'message.group': {
          const [c, local] = route(cmd.groupId);
          if (!c) return { ok: false, error: 'conexão não encontrada' };
          if (!c.connector.capabilities.sendToGroup) return { ok: false, error: 'esta plataforma não aceita mensagens para grupos' };
          return await c.connector.send({ ...cmd, groupId: local });
        }
        case 'message.department': {
          const targets = [...this.conns.values()].filter((c) => {
            if (cmd.connectorId && c.id !== cmd.connectorId) return false;
            if (!c.connector.capabilities.sendToAgent || c.state === 'connecting') return false;
            return cmd.department === null || (c.snap?.agents ?? []).some((a) => (a.department || 'Geral') === cmd.department);
          });
          if (!targets.length) return { ok: false, error: 'nenhuma plataforma com esse departamento' };
          const rs = await Promise.all(targets.map((c) => c.connector.send({ ...cmd, connectorId: undefined })));
          const bad = rs.find((r) => !r.ok);
          return bad ?? { ok: true };
        }
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  private schedule() {
    if (this.pending) return;
    if (this.debounceMs <= 0) { this.recompute(); return; }
    this.pending = setTimeout(() => {
      this.pending = null;
      this.recompute();
    }, this.debounceMs);
  }

  /** Junta tudo. Público para testes. */
  recompute(now = Date.now()): RoomState {
    const agents: Agent[] = [];
    const groups: Group[] = [];
    let events: RoomEvent[] = [];
    const connectors: ConnectorInfo[] = [];
    let slotsChanged = false;
    let nextSlot = Math.max(-1, ...Object.values(this.slots)) + 1;
    const seen = new Set<string>();
    for (const c of this.conns.values()) {
      connectors.push({ id: c.id, kind: c.kind, label: c.label, state: c.state, error: c.error, capabilities: c.connector.capabilities, departments: c.snap?.departments });
      const s = c.snap;
      if (!s) continue;
      const pre = (x: string) => c.id + ':' + x;
      for (const a of s.agents) {
        const id = pre(a.id);
        if (seen.has(id)) continue;
        seen.add(id);
        if (this.slots[id] === undefined) {
          this.slots[id] = nextSlot++;
          slotsChanged = true;
        }
        const p = this.prev.get(id);
        let since = p?.since ?? now;
        let previous = p?.previous;
        if (p && p.status !== a.status) {
          previous = p.status;
          since = now;
        }
        this.prev.set(id, { status: a.status, since, previous });
        agents.push({
          ...a,
          id,
          connectorId: c.id,
          department: a.department || 'Geral',
          slot: this.slots[id],
          statusSince: since,
          previousStatus: previous,
          chat: a.chat.slice(-12).map((m) => (m.from ? { ...m, from: pre(m.from) } : m)),
        });
      }
      for (const g of s.groups) groups.push({ ...g, id: pre(g.id), connectorId: c.id, members: g.members.map(pre) });
      const evs = s.events
        .filter((e) => e.at > now - EVENT_WINDOW)
        .sort((a, b) => a.at - b.at)
        .slice(-25)
        .map((e) => ({ ...e, id: pre(e.id), from: pre(e.from), to: e.to ? pre(e.to) : undefined, groupId: e.groupId ? pre(e.groupId) : undefined }));
      events = events.concat(evs);
    }
    for (const id of [...this.prev.keys()]) if (!seen.has(id)) this.prev.delete(id);
    if (slotsChanged) {
      try { this.store.save(this.slots); } catch (e) { this.log('não consegui guardar os slots: ' + (e as Error).message); }
    }
    events.sort((a, b) => a.at - b.at);
    const body = { agents, groups, events, connectors };
    const key = JSON.stringify(body);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.last = { at: now, ...body };
      this.listeners.forEach((l) => l(this.last));
    }
    return this.last;
  }
}
