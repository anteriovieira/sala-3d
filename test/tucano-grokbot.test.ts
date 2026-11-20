// Conectores do Tucano e do Grok Bot sobre dados inventados com só o que eles leem.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TucanoReader, tucanoDataDir, tucanoFactory } from '../src/main/connectors/tucano';
import { b32decode, GrokBotReader } from '../src/main/connectors/grokbot';
import { namedColor } from '../src/main/connectors/localReader';

const now = Date.now();
const min = 60_000;
let root = '';

const b32 = (s: string) => {
  const A = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, val = 0, out = '';
  for (const byte of Buffer.from(s, 'utf8')) { val = (val << 8) | byte; bits += 8; while (bits >= 5) { out += A[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += A[(val << (5 - bits)) & 31];
  return out;
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'sala-tg-'));
  // ---------- Tucano: espaço de trabalho escolhido em outra pasta ----------
  const tu = join(root, 'Tucano'), ws = join(tu, 'workspaces', 'w1');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(tu, 'workspaces.json'), JSON.stringify({ selected: 'w1', workspaces: [{ id: 'w0', dataDir: tu, isDefault: true }, { id: 'w1', dataDir: ws }] }));
  const db = new DatabaseSync(join(ws, 'tucano.db'));
  for (const sql of [
    'create table settings (key text primary key, value text)',
    'create table agents (id text primary key, name text, role text, color text, archived integer, created_at integer)',
    'create table conversations (id text primary key, kind text, name text)',
    'create table members (conversation_id text, agent_id text)',
    'create table messages (id text primary key, conversation_id text, author_kind text, author_id text, text text, at integer, run text)',
    'create table questions (id text primary key, agent_id text, text text, state text, created_at integer)',
    'create table approvals (id text primary key, agent_id text, tool text, connector_name text, state text, created_at integer, expires_at integer)',
    'create table delegations (id text primary key, from_agent text, to_agent text, text text, created_at integer)',
    'create table routines (id text primary key, agent_id text, name text, enabled integer, next_at integer)',
  ]) db.exec(sql);
  db.prepare('insert into settings values (?,?)').run('workspaceName', JSON.stringify('Minha Empresa'));
  const ag = db.prepare('insert into agents values (?,?,?,?,?,?)');
  ag.run('a1', 'Ana', 'Pesquisa', 'violet', 0, 1); ag.run('a2', 'Beto', '', 'amber', 0, 2); ag.run('a3', 'Caio', 'Vendas', 'rose', 0, 3);
  ag.run('a4', 'Duda', 'Apoio', 'teal', 0, 4); ag.run('ax', 'Arquivado', '', 'red', 1, 5);
  const cv = db.prepare('insert into conversations values (?,?,?)');
  cv.run('d1', 'dm', 'Ana'); cv.run('d2', 'dm', 'Beto'); cv.run('ch', 'channel', 'Time');
  const mb = db.prepare('insert into members values (?,?)');
  mb.run('d1', 'a1'); mb.run('d2', 'a2'); mb.run('ch', 'a1'); mb.run('ch', 'a2'); mb.run('ch', 'ax');
  const ms = db.prepare('insert into messages values (?,?,?,?,?,?,?)');
  ms.run('m1', 'd1', 'person', 'p1', 'Oi **Ana**', now - 10 * min, null);
  ms.run('m2', 'd1', 'agent', 'a1', 'Olá!', now - 9 * min, JSON.stringify({ status: 'done', endedAt: now - 9 * min }));
  ms.run('m3', 'd1', 'agent', 'a3', 'Ana, veja isto', now - 8 * min, null);
  ms.run('m4', 'd2', 'agent', 'a2', 'Falhei', now - 20 * min, JSON.stringify({ status: 'failed', error: 'limite', errorDetail: 'Limite do plano', endedAt: now - 20 * min }));
  ms.run('m5', 'ch', 'agent', 'a1', 'Resumo do dia', now - 2 * min, null);
  ms.run('m6', 'd1', 'agent', 'a4', 'agora mesmo', now - 20_000, null);
  db.prepare('insert into questions values (?,?,?,?,?)').run('q1', 'a3', 'Qual cliente primeiro?', 'open', now - 5 * min);
  db.prepare('insert into questions values (?,?,?,?,?)').run('q2', 'a1', 'Já respondida', 'answered', now - 50 * min);
  db.prepare('insert into delegations values (?,?,?,?,?)').run('g1', 'a1', 'a3', 'Ligue para o cliente', now - 6 * min);
  db.prepare('insert into routines values (?,?,?,?,?)').run('r1', 'a1', 'Resumo diário', 1, now + 60 * min);
  db.close();

  // ---------- Grok Bot: cache com chaves em base32 ----------
  const gc = join(root, 'Grok Bot', 'sand-client-persistence');
  mkdirSync(gc, { recursive: true });
  const put = (key: string, value: unknown) => writeFileSync(join(gc, b32(key) + '.blob'), JSON.stringify({ schemaVersion: 1, value }));
  const acc = 'sand.client.slice.account.github%7Cuser_x.';
  put(acc + 'roster.last-roster', { rows: [
    { id: 'g1', name: 'Jarvis', title: 'Assistente', avatarColor: 'red', awaitingUserResponse: null },
    { id: 'g2', name: 'Sexta', description: 'Agenda', avatarColor: 'black', awaitingUserResponse: { text: 'Posso marcar às 15h?' } },
    { id: 'g3', name: 'Oculto', isHiddenFromSidebar: true },
  ] });
  put(acc + 'sidebar.last-sections', { sections: [{ id: 's', name: 'Pessoal', agentIds: ['g2'] }] });
  put(acc + 'transcript.replicas.g1', { persistedAt: now, entries: [
    { kind: 'message', role: 'user', content: 'Oi', timestampMs: now - 3 * min },
    { kind: 'send-message', content: 'interno' },
    { kind: 'message', role: 'assistant', content: 'Escrevendo…', timestampMs: now - 1000, isStreaming: true },
  ] });
  put('sand.client.slice.ui-layout', {});
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('conector do Tucano', () => {
  it('usa o espaço de trabalho escolhido', () => {
    expect(tucanoDataDir(join(root, 'Tucano'))).toBe(join(root, 'Tucano', 'workspaces', 'w1'));
  });

  it('monta agentes, status, conversa, canal e eventos', () => {
    const s = new TucanoReader(join(root, 'Tucano')).snapshot(now);
    const a = Object.fromEntries(s.agents.map((x) => [x.id, x]));
    expect(Object.keys(a)).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(s.departments).toEqual(['Minha Empresa']);
    expect(a.a1).toMatchObject({ role: 'Pesquisa', department: 'Minha Empresa', color: 'purple', status: 'available', next: { name: 'Resumo diário' } });
    expect(a.a1.chat.map((c) => [c.r, c.t, c.w])).toEqual([['u', 'Oi Ana', undefined], ['b', 'Olá!', undefined], ['o', 'Ana, veja isto', 'Caio'], ['o', 'agora mesmo', 'Duda']]);
    expect(a.a2).toMatchObject({ status: 'problem', need: 'Falhou: Limite do plano', color: 'orange' });
    expect(a.a3).toMatchObject({ status: 'waiting', ask: 'question', need: 'Qual cliente primeiro?' });
    expect(a.a4).toMatchObject({ status: 'working' });
    expect(s.groups).toEqual([{ id: 'ch', name: 'Time', members: ['a1', 'a2'], active: true }]);
    expect(s.events.map((e) => [e.from, e.to ?? e.groupId, e.text])).toEqual([['a1', 'a3', 'Ligue para o cliente'], ['a1', 'ch', 'Resumo do dia']]);
  });

  it('assina pela conexão e recusa envio', async () => {
    const c = tucanoFactory().create();
    await c.connect({ dataDir: join(root, 'Tucano'), pollMs: 1000 });
    const n = await new Promise<number>((resolve, reject) => { const off = c.subscribe((s) => { off(); resolve(s.agents.length); }, reject); });
    await c.disconnect();
    expect(n).toBe(4);
    expect((await c.send({ type: 'message.agent', agentId: 'a1', text: 'oi' })).ok).toBe(false);
  });
});

describe('conector do Grok Bot', () => {
  it('decodifica o nome dos arquivos do cache', () => {
    expect(b32decode(b32('sand.client.slice.ui-layout'))).toBe('sand.client.slice.ui-layout');
  });

  it('monta agentes, seções, conversa e status a partir do cache', () => {
    const s = new GrokBotReader(join(root, 'Grok Bot')).snapshot(now);
    const a = Object.fromEntries(s.agents.map((x) => [x.id, x]));
    expect(Object.keys(a)).toEqual(['g1', 'g2']);
    expect(s.departments).toEqual(['Geral', 'Pessoal']);
    expect(a.g1).toMatchObject({ role: 'Assistente', department: 'Geral', color: 'red', status: 'working' });
    expect(a.g1.chat.map((c) => [c.r, c.t])).toEqual([['u', 'Oi'], ['b', 'Escrevendo…']]);
    expect(a.g2).toMatchObject({ role: 'Agenda', department: 'Pessoal', color: 'silver', status: 'waiting', need: 'Posso marcar às 15h?' });
  });

  it('com o cache antigo, resposta "escrevendo" não conta como trabalhando', () => {
    const s = new GrokBotReader(join(root, 'Grok Bot')).snapshot(now + 10 * min);
    expect(s.agents.find((x) => x.id === 'g1')?.status).toBe('available');
  });

  it('cores dos apps viram cores da sala', () => {
    expect([namedColor('indigo'), namedColor('rose'), namedColor('black'), namedColor(undefined)]).toEqual(['blue', 'pink', 'silver', 'silver']);
  });
});
