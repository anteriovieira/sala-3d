// Conector do OpenBot sobre um banco inventado com só as tabelas/colunas que ele lê.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { OpenBotReader, OpenBotConnector, hueToColor } from '../src/main/connectors/openbot';

let home = '';
const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const min = 60_000;

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'sala-openbot-'));
  writeFileSync(join(home, 'openbot-sidebar-layout-v1.json'), JSON.stringify({
    sections: [{ id: 's1', name: 'Vendas' }, { id: 's2', name: 'Pesquisa' }], order: ['s2', 's1'],
    agentAssignments: { a1: 's1', a2: 's2' },
  }));
  const db = new DatabaseSync(join(home, 'openbot.db'));
  for (const sql of [
    'create table projection_agents (agent_id text primary key, thread_id text, sort_order integer, agent_json text)',
    'create table projection_threads (thread_id text primary key, agent_id text, title text, active_turn_id text, created_at text, updated_at text)',
    'create table projection_turns (turn_id text primary key, thread_id text, status text)',
    'create table projection_thread_messages (thread_id text, message_id text, author text, status text, item_type text, created_at text, ordinal integer, message_json text)',
    'create table projection_agent_threads (thread_id text primary key, agent_id text, outcome text, error text, updated_at text, archived_at text)',
    'create table projection_agent_routines (routine_id text primary key, agent_id text, name text, active integer)',
    'create table projection_routine_triggers (trigger_id text primary key, routine_id text, next_run_at text)',
    'create table projection_channels (channel_id text primary key, channel_json text)',
    'create table projection_channel_messages (channel_id text, message_id text, sequence integer, message_json text)',
  ]) db.exec(sql);
  const agent = db.prepare('insert into projection_agents values (?,?,?,?)');
  agent.run('a1', 't1', 1, JSON.stringify({ id: 'a1', name: 'Vendedor', title: 'Faz vendas', avatarHue: 210 }));
  agent.run('a2', 't2', 2, JSON.stringify({ id: 'a2', name: 'Pesquisador', title: '', avatarHue: 120 }));
  agent.run('a3', 't3', 3, JSON.stringify({ id: 'a3', name: 'Perguntador', title: 'Pergunta' }));
  agent.run('a4', 't4', 4, JSON.stringify({ id: 'a4', name: 'Quebrado', title: 'Falha' }));
  const th = db.prepare('insert into projection_threads values (?,?,?,?,?,?)');
  th.run('t1', 'a1', 'x', 'turn1', iso(60 * min), iso(1 * min));
  th.run('t2', 'a2', 'x', null, iso(60 * min), iso(2 * min));
  th.run('t3', 'a3', 'x', null, iso(60 * min), iso(3 * min));
  th.run('t4', 'a4', 'x', null, iso(60 * min), iso(3 * min));
  db.prepare('insert into projection_turns values (?,?,?)').run('turn1', 't1', 'running');
  const msg = db.prepare('insert into projection_thread_messages values (?,?,?,?,?,?,?,?)');
  msg.run('t1', 'm1', 'user', 'completed', null, iso(10 * min), 0, JSON.stringify({ text: 'Oi **vendedor**' }));
  msg.run('t1', 'm2', 'assistant', 'completed', 'final_answer', iso(9 * min), 1, JSON.stringify({ text: 'Olá, dono' }));
  msg.run('t1', 'm3', 'assistant', 'streaming', 'commentary', iso(1 * min), 2, JSON.stringify({ text: 'Montando a proposta' }));
  msg.run('t2', 'm4', 'agent', 'completed', 'agent-exchange', iso(5 * min), 0, JSON.stringify({ id: 'm4', text: 'Pesquise o cliente X', exchange: { direction: 'incoming', messageId: 'x1', senderAgentId: 'a1' } }));
  msg.run('t2', 'm5', 'assistant', 'completed', 'routine_quiet_answer', iso(4 * min), 1, JSON.stringify({ text: 'nada' }));
  msg.run('t3', 'm6', 'assistant', 'completed', 'question_prompt', iso(3 * min), 0, JSON.stringify({ questionPrompt: { requestId: 'r', questions: [{ question: 'Qual plano usar?' }] } }));
  msg.run('t4', 'm7', 'assistant', 'completed', 'question_prompt', iso(30 * min), 0, JSON.stringify({ questionPrompt: { requestId: 'r2', questions: [{ question: 'Já respondida' }], resolution: { status: 'answered' } } }));
  db.prepare('insert into projection_agent_threads values (?,?,?,?,?,?)').run('t4', 'a4', 'failed', 'sem acesso', iso(20 * min), null);
  db.prepare('insert into projection_agent_routines values (?,?,?,?)').run('r1', 'a2', 'Resumo diário', 1);
  db.prepare('insert into projection_routine_triggers values (?,?,?)').run('g1', 'r1', iso(-60 * min));
  db.prepare('insert into projection_channels values (?,?)').run('c1', JSON.stringify({ name: 'Time', members: [{ agentId: 'a1' }, { agentId: 'a2' }, { agentId: 'zz' }], archived: false }));
  db.prepare('insert into projection_channels values (?,?)').run('c2', JSON.stringify({ name: 'Velho', members: [{ agentId: 'a1' }], archived: true }));
  db.prepare('insert into projection_channel_messages values (?,?,?,?)').run('c1', 'cm1', 1, JSON.stringify({ id: 'cm1', author: { kind: 'agent', id: 'a2', name: 'Pesquisador' }, superseded: false, message: { text: 'Achei o cliente', createdAt: iso(2 * min), itemType: 'final_answer' } }));
  db.close();
});

afterAll(() => rmSync(home, { recursive: true, force: true }));

describe('conector do OpenBot', () => {
  it('monta agentes, status, conversa, canais e eventos', () => {
    const s = new OpenBotReader(home).snapshot(now);
    const a = Object.fromEntries(s.agents.map((x) => [x.id, x]));
    expect(s.departments).toEqual(['Geral', 'Pesquisa', 'Vendas']);
    expect(a.a1).toMatchObject({ name: 'Vendedor', role: 'Faz vendas', department: 'Vendas', color: 'blue', status: 'working', doing: 'Montando a proposta' });
    expect(a.a1.chat.map((c) => [c.r, c.t])).toEqual([['u', 'Oi vendedor'], ['b', 'Olá, dono']]);
    expect(a.a2).toMatchObject({ role: 'Pesquisa', status: 'available', next: { name: 'Resumo diário' } });
    expect(a.a2.chat).toEqual([expect.objectContaining({ r: 'o', w: 'Vendedor', from: 'a1', t: 'Pesquise o cliente X' })]);
    expect(a.a3).toMatchObject({ department: 'Geral', status: 'waiting', ask: 'question', need: 'Qual plano usar?' });
    expect(a.a4).toMatchObject({ status: 'problem', need: 'Falhou: sem acesso' });
    expect(s.groups).toEqual([{ id: 'c1', name: 'Time', members: ['a1', 'a2'], active: true }]);
    expect(s.events.map((e) => [e.from, e.to ?? e.groupId, e.text])).toEqual([['a1', 'a2', 'Pesquise o cliente X'], ['a2', 'c1', 'Achei o cliente']]);
  });

  it('cor do avatar vira cor da sala', () => {
    expect(hueToColor(undefined)).toBe('silver');
    expect(hueToColor(5)).toBe('red');
    expect(hueToColor(320)).toBe('pink');
  });

  it('assina e entrega o snapshot; recusa envio com motivo', async () => {
    const c = new OpenBotConnector();
    await c.connect({ dataDir: home, pollMs: 1000 });
    const snap = await new Promise<number>((resolve, reject) => { const off = c.subscribe((s) => { off(); resolve(s.agents.length); }, reject); });
    await c.disconnect();
    expect(snap).toBe(4);
    expect((await c.send({ type: 'message.agent', agentId: 'a1', text: 'oi' })).ok).toBe(false);
  });

  it('pasta sem openbot.db dá erro claro', async () => {
    await expect(new OpenBotConnector().connect({ dataDir: join(home, 'nada') })).rejects.toThrow(/openbot\.db/);
  });
});
