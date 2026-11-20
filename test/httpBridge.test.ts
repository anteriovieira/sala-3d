import { describe, expect, it } from 'vitest';
import { sanitizeSnapshot } from '../src/main/connectors/httpBridge';

const agent = (over: Record<string, unknown> = {}) => ({ id: 'a1', name: 'Ana', ...over });

describe('sanitizeSnapshot', () => {
  it.each([null, undefined, 'texto', 42, true, []])('entrada inválida %p vira snapshot vazio', (raw) => {
    expect(sanitizeSnapshot(raw)).toEqual({ agents: [], groups: [], events: [], departments: [] });
  });

  it('ignora campos desconhecidos no topo', () => {
    const s = sanitizeSnapshot({ agents: [], evil: '<script>' }) as unknown as Record<string, unknown>;
    expect(s.evil).toBeUndefined();
  });

  describe('agents', () => {
    it('descarta agente sem id', () => {
      expect(sanitizeSnapshot({ agents: [{ name: 'x' }, agent()] }).agents.map((a) => a.id)).toEqual(['a1']);
    });

    it('usa o id como nome quando o nome falta', () => {
      expect(sanitizeSnapshot({ agents: [{ id: 'zed' }] }).agents[0].name).toBe('zed');
    });

    it('status inválido vira available e os válidos passam', () => {
      const [a, b, c, d, e] = sanitizeSnapshot({
        agents: ['available', 'working', 'waiting', 'problem', 'hacked'].map((status, i) => agent({ id: 'a' + i, status })),
      }).agents;
      expect([a, b, c, d, e].map((x) => x.status)).toEqual(['available', 'working', 'waiting', 'problem', 'available']);
    });

    it('ask só aceita os valores conhecidos', () => {
      const r = sanitizeSnapshot({ agents: [agent({ ask: 'secret' }), agent({ id: 'a2', ask: 'rm -rf' })] }).agents;
      expect(r[0].ask).toBe('secret');
      expect(r[1].ask).toBeUndefined();
    });

    it('corta textos nos limites', () => {
      const a = sanitizeSnapshot({
        agents: [agent({ id: 'i'.repeat(300), name: 'n'.repeat(500), role: 'r'.repeat(500), need: 'x'.repeat(500), doing: 'd'.repeat(500) })],
      }).agents[0];
      expect(a.id).toHaveLength(200);
      expect(a.name).toHaveLength(80);
      expect(a.role).toHaveLength(80);
      expect(a.need).toHaveLength(140);
      expect(a.doing).toHaveLength(60);
    });

    it('campos não-string viram vazio e opcionais ficam undefined', () => {
      const a = sanitizeSnapshot({ agents: [agent({ role: 7, color: '', doing: {} })] }).agents[0];
      expect(a.role).toBe('');
      expect(a.color).toBeUndefined();
      expect(a.doing).toBeUndefined();
    });

    it('chief é convertido para booleano', () => {
      expect(sanitizeSnapshot({ agents: [agent({ chief: 'sim' })] }).agents[0].chief).toBe(true);
      expect(sanitizeSnapshot({ agents: [agent()] }).agents[0].chief).toBe(false);
    });

    it('next: aceita objeto, descarta NaN/Infinity no horário', () => {
      expect(sanitizeSnapshot({ agents: [agent({ next: { name: 'tarefa', at: 5 } })] }).agents[0].next).toEqual({ name: 'tarefa', at: 5 });
      expect(sanitizeSnapshot({ agents: [agent({ next: { name: 't', at: Infinity } })] }).agents[0].next?.at).toBe(0);
      expect(sanitizeSnapshot({ agents: [agent({ next: 'x' })] }).agents[0].next).toBeUndefined();
    });

    it('limita a 200 agentes', () => {
      const many = Array.from({ length: 250 }, (_, i) => agent({ id: 'a' + i }));
      expect(sanitizeSnapshot({ agents: many }).agents).toHaveLength(200);
    });

    it('agents que não é lista vira lista vazia', () => {
      expect(sanitizeSnapshot({ agents: { id: 'a' } }).agents).toEqual([]);
    });

    it.fails('rejeita itens null sem lançar (BUG: hoje lança TypeError)', () => {
      // it.fails: passa enquanto o bug existir; quando corrigirem, troque por it.
      expect(() => sanitizeSnapshot({ agents: [null, agent()] })).not.toThrow();
    });
  });

  describe('chat', () => {
    it('mantém só as 12 últimas mensagens', () => {
      const chat = Array.from({ length: 20 }, (_, i) => ({ r: 'u', t: 'm' + i, at: i }));
      const out = sanitizeSnapshot({ agents: [agent({ chat })] }).agents[0].chat;
      expect(out).toHaveLength(12);
      expect(out[0].t).toBe('m8');
      expect(out[11].t).toBe('m19');
    });

    it('papel inválido vira b; texto cortado em 1500; at inválido vira 0', () => {
      const [c] = sanitizeSnapshot({ agents: [agent({ chat: [{ r: 'x', t: 'a'.repeat(2000), at: 'ontem' }] })] }).agents[0].chat;
      expect(c.r).toBe('b');
      expect(c.t).toHaveLength(1500);
      expect(c.at).toBe(0);
    });

    it('papéis válidos u, b, n, o passam', () => {
      const chat = ['u', 'b', 'n', 'o'].map((r) => ({ r, t: 't', at: 1 }));
      expect(sanitizeSnapshot({ agents: [agent({ chat })] }).agents[0].chat.map((c) => c.r)).toEqual(['u', 'b', 'n', 'o']);
    });
  });

  describe('groups', () => {
    it('descarta grupo sem id, filtra membros vazios/não-string e limita a 100', () => {
      const g = sanitizeSnapshot({ groups: [{ name: 'sem id' }, { id: 'g1', name: 'G', members: ['a', '', 3, 'b'], active: 1 }] }).groups;
      expect(g).toEqual([{ id: 'g1', name: 'G', members: ['a', 'b'], active: true }]);
      const many = Array.from({ length: 150 }, (_, i) => ({ id: 'g' + i }));
      expect(sanitizeSnapshot({ groups: many }).groups).toHaveLength(100);
    });
  });

  describe('events', () => {
    it('exige id e from', () => {
      const e = sanitizeSnapshot({ events: [{ id: 'e1' }, { from: 'a' }, { id: 'e2', from: 'a', at: 3, text: 'oi' }] }).events;
      expect(e).toEqual([{ id: 'e2', at: 3, from: 'a', text: 'oi', to: undefined, groupId: undefined }]);
    });

    it('guarda só os 25 últimos e corta o texto em 230', () => {
      const ev = Array.from({ length: 40 }, (_, i) => ({ id: 'e' + i, from: 'a', text: 't'.repeat(400) }));
      const out = sanitizeSnapshot({ events: ev }).events;
      expect(out).toHaveLength(25);
      expect(out[0].id).toBe('e15');
      expect(out[0].text).toHaveLength(230);
    });
  });

  it('departments: só strings não vazias, cortadas em 80', () => {
    expect(sanitizeSnapshot({ departments: ['TI', '', 5, 'x'.repeat(100)] }).departments).toEqual(['TI', 'x'.repeat(80)]);
  });
});
