// Critério 10: para a mesma entrada, o conector devolve o mesmo estado que sala_watch.py.
// Os dados de exemplo são inventados (anonimizados) e criados numa pasta temporária.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OpenMausBotReader, said, clean, cleanChat, parseHooks, roomPhrase } from '../src/main/connectors/openmausbot';

const REF = process.env.SALA_REF || '/Users/anteriovieira/.openmausbot/task-workspaces/98748862-b75f-4bf8-98bb-d5e462c84446/8a860dc6-5fd0-4040-b4a9-39dab01616a4/sala-3d-handoff/referencia/sala_watch.py';

let root = '';
let home = '';
const now = Date.now();
const min = 60_000;

function fixture() {
  root = mkdtempSync(join(tmpdir(), 'sala-omb-'));
  home = join(root, '.openmausbot');
  mkdirSync(join(home, 'events'), { recursive: true });
  const bots = [
    { id: 'b1', name: 'Chefe', threadId: 't1', section: '', chiefOfStaff: true, color: 'silver', createdAt: 1 },
    { id: 'b2', name: 'Vendas Ana', threadId: 't2', section: 'Vendas', color: 'pink', createdAt: 2, tasks: [{ threadId: 't2b' }] },
    { id: 'b3', name: 'Beto', threadId: 't3', section: 'Vendas', title: 'Analista **sênior**', color: 'blue', createdAt: 3 },
    { id: 'b4', name: 'Caio', threadId: 't4', section: 'Pesquisa', color: 'green', createdAt: 4 },
    { id: 'b5', name: 'Duda', threadId: 't5', section: 'Pesquisa', chiefOfStaff: true, color: 'orange', createdAt: 5 },
    { id: 'b6', name: 'Elis', threadId: 't6', section: 'Extra', color: 'teal', createdAt: 6 },
  ];
  writeFileSync(join(home, 'bots.json'), JSON.stringify({ bots }));
  writeFileSync(join(home, 'section-contexts.json'), JSON.stringify({ sections: ['Pesquisa', 'Vendas'] }));
  writeFileSync(join(home, 'routines.json'), JSON.stringify({ routines: [
    { botId: 'b3', enabled: true, nextRunAt: now + 3600_000, name: 'Resumo [diário](http://x)' },
    { botId: 'b3', enabled: true, nextRunAt: now + 7200_000, name: 'Outro' },
    { botId: 'b4', enabled: false, nextRunAt: now + 600_000, name: 'Desligada' },
  ] }));
  writeFileSync(join(home, 'groups.json'), JSON.stringify({ groups: [{ id: 'g1', name: 'Time Vendas', memberIds: ['b2', 'b3', 'b1'], threadId: 'tg1' }] }));
  // execução aberta em t4 (Caio trabalhando); t5 terminou
  writeFileSync(join(home, 'events', 't4.ndjson'), '{"type":"turn.started"}\n{"type":"tool"}\n');
  writeFileSync(join(home, 'events', 't5.ndjson'), '{"type":"turn.started"}\n{"type":"turn.completed"}\n');

  const m = new DatabaseSync(join(home, 'messages.db'));
  m.exec(`CREATE TABLE messages ( thread_id TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL, text TEXT, json TEXT NOT NULL, search_text TEXT, PRIMARY KEY (thread_id, id) );
    CREATE TABLE notification_log ( id TEXT PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL, bot_id TEXT NOT NULL, bot_name TEXT NOT NULL, thread_id TEXT NOT NULL, group_id TEXT, title TEXT NOT NULL, body TEXT NOT NULL, avatar_url TEXT, read INTEGER NOT NULL DEFAULT 0 , for_person TEXT, read_by TEXT);`);
  const ins = m.prepare('insert into messages (thread_id, id, at, role, kind, text, json) values (?,?,?,?,?,?,?)');
  let k = 0;
  const msg = (th: string, at: number, role: string, text: string, json: unknown = {}, kind = 'text') => ins.run(th, 'm' + ++k, at, role, kind, text, JSON.stringify(json));
  msg('t1', now - 50 * min, 'user', 'Bom dia, **chefe**');
  msg('t1', now - 49 * min, 'bot', 'Bom dia! Vou ver a [agenda](http://a).');
  msg('t1', now - 20 * min, 'user', '[Sala 3D] Mensagem para o bot Chefe: "Tudo certo?"');
  msg('t1', now - 19 * min, 'bot', 'Tudo certo por aqui.');
  msg('t1', now - 18 * min, 'user', '[Sala 3D] Salvar ajustes');
  msg('t1', now - 17 * min, 'user', '[Scheduled routine "Monitor diário"] rodar');
  msg('t1', now - 16 * min, 'bot', '{"internal":true}');
  msg('t1', now - 15 * min, 'user', '[From webhook "Mensagens da Sala 3D"] x [UNTRUSTED WEBHOOK EVENT DATA] {"text":"Oi pelo webhook"} [/UNTRUSTED WEBHOOK EVENT DATA]');
  msg('t1', now - 14 * min, 'user', '[From webhook "Github"] x [UNTRUSTED WEBHOOK EVENT DATA] {"text":"push"} [/UNTRUSTED WEBHOOK EVENT DATA]');
  msg('t1', now - 13 * min, 'user', '[OpenMausBot notice] interno');
  msg('t2', now - 40 * min, 'user', 'Ana, manda o relatório');
  msg('t2', now - 39 * min, 'bot', '@Vendas Ana pode revisar?', { from: { botId: 'b3' } });
  msg('t2', now - 38 * min, 'user', 'Pedido do outro bot', { peerAsk: { botId: 'b4' } });
  msg('t2b', now - 10 * min, 'bot', 'Relatório pronto, veja na pasta.', { automation: { executionThreadId: 't2' } });
  msg('t3', now - 25 * min, 'bot', 'Beto falando aqui.');
  msg('t3', now - 5 * min, 'user', 'Beto, sim pode');
  msg('t3', now - 4 * min, 'bot', 'Ok, seguindo.');
  msg('t4', now - 3 * min, 'bot', 'Pesquisando agora.');
  msg('t4', now - 2 * min, 'bot', '', { tool: { name: 'agent_browser', spoken: 'abrindo' } }, 'activity');
  msg('tg1', now - 2 * min, 'bot', 'Vamos fechar a meta do mês.', { from: { botId: 'b2' } });
  msg('tg1', now - 1 * min, 'bot', 'Concordo, eu cuido dos números.', { from: { botId: 'b3' } });
  msg('t6', now - 11 * min, 'bot', '[interno]');
  const nl = m.prepare('insert into notification_log (id, at, kind, bot_id, bot_name, thread_id, title, body, read) values (?,?,?,?,?,?,?,?,?)');
  nl.run('n1', now - 30 * min, 'question', 'b1', 'Chefe', 't1', 'Posso **enviar** o e-mail?', '', 0);
  nl.run('n2', now - 60 * min, 'turn-failed', 'b1', 'Chefe', 't1', 'Falhou', 'x failed: antigo', 0);
  nl.run('n3', now - 9 * min, 'turn-failed', 'b6', 'Elis', 't6', 'Falhou', 'Run failed: o site caiu', 0);
  nl.run('n4', now - 8 * min, 'sign-in', 'b5', 'Duda', 't5', 'Entrar na conta da loja', '', 0);
  nl.run('n5', now - 30 * min, 'incident', 'b3', 'Beto', 't3', 'Falhou', 'failed: cedo', 0);
  m.close();

  const r = new DatabaseSync(join(home, 'runtime.db'));
  r.exec('CREATE TABLE assignments ( id TEXT PRIMARY KEY, root_id TEXT NOT NULL, parent_id TEXT, status TEXT NOT NULL, requester_thread_id TEXT, requester_run_id TEXT, assignee_bot_id TEXT NOT NULL, assignee_thread_id TEXT NOT NULL, created_at INTEGER NOT NULL, finished_at INTEGER, json TEXT NOT NULL )');
  const ai = r.prepare('insert into assignments (id, root_id, status, assignee_bot_id, assignee_thread_id, created_at, json) values (?,?,?,?,?,?,?)');
  ai.run('a1', 'a1', 'needs_input', 'b3', 't3', now - 6 * min, JSON.stringify({ assignee: { botId: 'b3' }, question: 'Waiting on the person: Posso seguir com a compra?' }));
  ai.run('a2', 'a2', 'needs_input', 'b4', 't4', now - 6 * min, JSON.stringify({ assignee: { botId: 'b4' }, question: 'Preciso da API key do mapa' }));
  ai.run('a3', 'a3', 'done', 'b2', 't2', now - 12 * min, JSON.stringify({ requester: { botId: 'b1' }, assignee: { botId: 'b2' }, brief: 'Prepare a proposta do cliente X' }));
  r.close();
}

function python(): Record<string, unknown> {
  const dir = join(root, 'reader');
  mkdirSync(dir, { recursive: true });
  copyFileSync(REF, join(dir, 'sala_watch.py'));
  const out = execFileSync('python3', ['-I', '-c', 'import sys, json; sys.path.insert(0, sys.argv[1]); import sala_watch; print(json.dumps(sala_watch.build(), ensure_ascii=False))', dir], { env: { ...process.env, HOME: root }, encoding: 'utf8' });
  return JSON.parse(out);
}

const canCompare = existsSync(REF) && (() => { try { execFileSync('python3', ['--version']); return true; } catch { return false; } })();

describe('conector do OpenMausBot', () => {
  beforeAll(fixture);
  afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

  it.skipIf(!canCompare)('dá o mesmo estado que sala_watch.py', () => {
    const py = python() as { roster: Record<string, unknown>[] } & Record<string, unknown>;
    const ts = new OpenMausBotReader(home).build(Date.now());
    const norm = (x: unknown) => JSON.parse(JSON.stringify(x));
    py.roster = py.roster.map(({ slot: _s, ...r }) => r);
    const mine = norm(ts) as typeof py;
    mine.roster = mine.roster.map(({ id: _i, ...r }) => r);
    expect(mine.roster).toEqual(py.roster);
    expect(mine.bots).toEqual(py.bots);
    expect(mine.events).toEqual(py.events);
    expect(mine.meet).toEqual(py.meet);
    expect(mine.rooms).toEqual(py.rooms);
  });

  it('o snapshot tem os status esperados', () => {
    const s = new OpenMausBotReader(home).snapshot();
    const by = Object.fromEntries(s.agents.map((a) => [a.name, a]));
    expect(by['Chefe'].status).toBe('waiting');
    expect(by['Chefe'].ask).toBe('question');
    expect(by['Caio'].status).toBe('waiting'); // pedido de chave vence o "trabalhando"
    expect(by['Caio'].ask).toBe('secret');
    expect(by['Caio'].doing).toBe('Navegando na web');
    expect(by['Beto'].status).toBe('available'); // pergunta respondida pela conversa
    expect(by['Elis'].status).toBe('problem');
    expect(by['Elis'].need).toBe('Falhou: o site caiu');
    expect(by['Duda'].ask).toBe('sign-in');
    expect(by['Beto'].next?.name).toBe('Resumo diário');
    expect(s.groups[0]).toMatchObject({ id: 'g1', active: true });
    expect(s.events.some((e) => e.to === 'b2' && e.from === 'b1')).toBe(true);
    expect(s.departments).toEqual(['Geral', 'Pesquisa', 'Vendas']);
  });

  it('limpeza da conversa', () => {
    expect(said('user', '[Sala 3D] Mensagem para o bot X: "olá"')).toEqual(['u', 'olá']);
    expect(said('user', '[Sala 3D] ajustes')).toBeNull();
    expect(said('bot', '{"a":1}')).toBeNull();
    expect(said('user', '[Routine "Diário"] x')).toEqual(['n', 'Automação: Diário']);
    expect(clean('a **b** [c](d)  e', 140)).toBe('a b c e');
    expect(clean('x'.repeat(10), 5)).toBe('xxxx…');
    expect(cleanChat('a\n\n\n\nb', 100)).toBe('a\n\nb');
  });

  it('frases de envio e endereços por bot', () => {
    expect(roomPhrase.dept(null, 'oi')).toBe('[Sala 3D] Mensagem para todos os bots de todos os departamentos: "oi"');
    expect(roomPhrase.retry('Ana')).toBe('[Sala 3D] Tentar de novo a tarefa que falhou do bot Ana');
    expect([...parseHooks('Ana = http://127.0.0.1:1/x\nlixo\nBeto=http://127.0.0.1:2/y').entries()]).toEqual([['Ana', 'http://127.0.0.1:1/x'], ['Beto', 'http://127.0.0.1:2/y']]);
  });
});
