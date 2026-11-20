import { describe, expect, it, vi } from 'vitest';
import { Hub, memorySlots } from '../src/main/hub';
import { DemoConnector } from '../src/main/connectors/demo';
import type { AgentConnector } from '../src/main/connectors/types';
import type { ConnectorSnapshot } from '../src/shared/types';

const flush = () => new Promise((r) => setTimeout(r, 20));

class Fake implements AgentConnector {
  kind = 'fake';
  label = 'Fake';
  capabilities = { sendToAgent: true, sendToGroup: false, retryTask: false, groups: false, departments: false, chatHistory: false, transport: 'poll' as const };
  emit?: (s: ConnectorSnapshot) => void;
  fail?: (e: Error) => void;
  sent: unknown[] = [];
  constructor(public names: string[]) {}
  async connect() {}
  async disconnect() {}
  subscribe(on: (s: ConnectorSnapshot) => void, err: (e: Error) => void) {
    this.emit = on;
    this.fail = err;
    on(this.snap());
    return () => {};
  }
  snap(status: 'available' | 'working' = 'available'): ConnectorSnapshot {
    return { agents: this.names.map((n) => ({ id: n, name: n, role: '', department: 'Geral', chief: false, status, need: '', chat: [] })), groups: [], events: [] };
  }
  async send(cmd: unknown) {
    this.sent.push(cmd);
    return { ok: true };
  }
}

describe('agregador', () => {
  it('dois conectores, mesmo nome, sem colisão; slots fixos', async () => {
    const store = memorySlots();
    const hub = new Hub(store, () => {}, 0);
    const a = new Fake(['Ana', 'Bia']);
    const b = new Fake(['Ana']);
    hub.add('p1', 'fake', 'P1', a, {});
    hub.add('p2', 'fake', 'P2', b, {});
    await flush();
    const st = hub.recompute();
    expect(st.agents.map((x) => x.id).sort()).toEqual(['p1:Ana', 'p1:Bia', 'p2:Ana']);
    const slots = Object.fromEntries(st.agents.map((x) => [x.id, x.slot]));
    expect(new Set(Object.values(slots)).size).toBe(3);
    // outro hub com o mesmo store mantém os slots
    const hub2 = new Hub(store, () => {}, 0);
    hub2.add('p2', 'fake', 'P2', new Fake(['Ana']), {});
    await flush();
    expect(hub2.recompute().agents[0].slot).toBe(slots['p2:Ana']);
  });

  it('calcula status anterior e erro de um não derruba o outro', async () => {
    const hub = new Hub(memorySlots(), () => {}, 0);
    const a = new Fake(['Ana']);
    const b = new Fake(['Bia']);
    hub.add('p1', 'fake', 'P1', a, {});
    hub.add('p2', 'fake', 'P2', b, {});
    await flush();
    a.emit!(a.snap('working'));
    let st = hub.recompute();
    const ana = st.agents.find((x) => x.id === 'p1:Ana')!;
    expect(ana.status).toBe('working');
    expect(ana.previousStatus).toBe('available');
    b.fail!(new Error('caiu'));
    st = hub.recompute();
    expect(st.connectors.find((c) => c.id === 'p2')!.state).toBe('error');
    expect(st.connectors.find((c) => c.id === 'p1')!.state).toBe('online');
    expect(st.agents.some((x) => x.id === 'p2:Bia')).toBe(true); // continua na sala, esmaecido
    await hub.stopAll();
  });

  it('roteia comandos tirando o prefixo e respeita capacidades', async () => {
    const hub = new Hub(memorySlots(), () => {}, 0);
    const a = new Fake(['Ana']);
    hub.add('p1', 'fake', 'P1', a, {});
    await flush();
    expect(await hub.send({ type: 'message.agent', agentId: 'p1:Ana', text: 'oi' })).toEqual({ ok: true });
    expect(a.sent[0]).toEqual({ type: 'message.agent', agentId: 'Ana', text: 'oi' });
    expect((await hub.send({ type: 'task.retry', agentId: 'p1:Ana' })).ok).toBe(false);
    expect((await hub.send({ type: 'message.agent', agentId: 'zz:Ana', text: 'oi' })).ok).toBe(false);
  });

  it('reconecta com espera quando connect falha', async () => {
    vi.useFakeTimers();
    const hub = new Hub(memorySlots(), () => {}, 0);
    const f = new Fake(['Ana']);
    let n = 0;
    f.connect = async () => { if (n++ === 0) throw new Error('sem banco'); };
    hub.add('p1', 'fake', 'P1', f, {});
    await vi.advanceTimersByTimeAsync(10);
    expect(hub.recompute().connectors[0].state).toBe('error');
    await vi.advanceTimersByTimeAsync(2100);
    expect(hub.recompute().connectors[0].state).toBe('online');
    vi.useRealTimers();
  });
});

describe('conector de demonstração', () => {
  it('é determinístico pela semente e gera 8–20 agentes', async () => {
    const a = new DemoConnector();
    const b = new DemoConnector();
    await a.connect({ seed: 3 });
    await b.connect({ seed: 3 });
    const sa = a.snapshot();
    expect(sa.agents.length).toBeGreaterThanOrEqual(8);
    expect(sa.agents.length).toBeLessThanOrEqual(20);
    expect(sa.agents.map((x) => [x.name, x.status])).toEqual(b.snapshot().agents.map((x) => [x.name, x.status]));
    const ds = new Set(sa.agents.map((x) => x.department));
    expect(ds.size).toBeGreaterThanOrEqual(2);
    expect(ds.size).toBeLessThanOrEqual(4);
  });
  it('responde com eco a message.agent', async () => {
    const d = new DemoConnector();
    await d.connect({ seed: 5 });
    const id = d.snapshot().agents[0].id;
    await d.send({ type: 'message.agent', agentId: id, text: 'teste' });
    const t0 = Date.now();
    d.tick(t0 + 10_000);
    const chat = d.snapshot().agents[0].chat;
    expect(chat.some((m) => m.r === 'u' && m.t === 'teste')).toBe(true);
    expect(chat.some((m) => m.r === 'b' && m.t.includes('teste'))).toBe(true);
    await d.disconnect();
  });
});
