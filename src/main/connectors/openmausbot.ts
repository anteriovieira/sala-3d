// Conector do OpenMausBot: porta de referencia/sala_watch.py.
// Lê SOMENTE PARA LEITURA a pasta de dados do app (~/.openmausbot). Se a leitura falhar
// (banco trancado/ausente), registra, espera e tenta de novo — nunca para de vez.

import { readFileSync, readdirSync, statSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ReaderThread } from './readerThread';
import type { AskKind, ChatItem, CommandResult, ConnectorSnapshot, RoomCommand, SnapshotAgent, SnapshotGroup, Status } from '@shared/types';
import type { AgentConnector, ConnectorFactory } from './types';

const RECENT_MS = 30 * 60 * 1000;
const ASK_KINDS = ['question', 'sign-in', 'secret'];
const FAIL_KINDS = ['incident', 'turn-failed', 'routine-failed'];
export const DOING: [string, string][] = [
  ['coordinate_bots', 'Falando com outro bot'], ['agent_browser', 'Navegando na web'], ['browser', 'Navegando na web'],
  ['gmail', 'Olhando o e-mail'], ['calendar', 'Olhando a agenda'], ['radarscout', 'Consultando o Radar Scout'],
  ['show_html', 'Montando uma página'], ['composio', 'Usando um app conectado'], ['computer', 'Usando o computador'],
  ['search', 'Pesquisando'], ['fetch', 'Lendo uma página da web'], ['editing a file', 'Editando um arquivo'],
  ['writing a file', 'Escrevendo um arquivo'], ['reading a file', 'Lendo um arquivo'], ['command', 'Rodando um comando'],
  ['memory', 'Anotando na memória'], ['trigger', 'Mexendo nas automações'], ['data_', 'Analisando dados'],
];

// ---------- utilidades com a mesma semântica do Python (tamanho em pontos de código) ----------
const cp = (s: string) => Array.from(s);
const trunc = (s: string, n: number) => { const a = cp(s); return a.length <= n ? s : a.slice(0, n - 1).join('') + '…'; };
const pyStrip = (s: string) => s.replace(/^\s+|\s+$/g, '');
const words = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Mesma ordem do SQLite para ids de texto (comparação binária). */
const binary = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function clean(s: unknown, n: number): string {
  let t = String(s ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = words(t.replace(/[*`#]+/g, ''));
  return trunc(t, n);
}

export function cleanChat(s: unknown, n: number): string {
  let t = String(s ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = t.replace(/[*`#]+/g, '');
  t = pyStrip(t).split('\n').map((l) => words(l)).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return trunc(t, n);
}

const ROOM_MSG = /^\[Sala 3D\] Mensagem para [^:]{1,120}: "([\s\S]*)"\s*$/;
const EVENT = /\[UNTRUSTED WEBHOOK EVENT DATA\]([\s\S]*)\[\/UNTRUSTED WEBHOOK EVENT DATA\]/;
const ROUTINE = /^\[(?:Scheduled routine|Routine) "([^"]+)"/;
const WEBHOOK = /^\[From webhook "([^"]+)"/;

/** (papel, texto) como numa conversa: u dono, b bot, n aviso curto; null = não mostrar. */
export function said(role: string, text: unknown): ['u' | 'b' | 'n', string] | null {
  const t = pyStrip(String(text ?? ''));
  if (!t) return null;
  if (role !== 'user') return t[0] === '{' ? null : ['b', t];
  let m = ROOM_MSG.exec(t);
  if (m) return ['u', m[1]];
  if (t.startsWith('[Sala 3D]')) return null;
  m = WEBHOOK.exec(t);
  if (m) {
    const ev = EVENT.exec(t);
    let msg: unknown = null;
    if (ev) {
      const body = ev[1];
      const i = body.indexOf('{');
      if (i >= 0) {
        try { const o = JSON.parse(pyStrip(body.slice(i))); msg = o && typeof o === 'object' ? (o as Record<string, unknown>).text : null; } catch { msg = null; }
      }
    }
    if (typeof msg === 'string' && pyStrip(msg)) {
      const s = pyStrip(msg);
      const r = ROOM_MSG.exec(s);
      if (r) return ['u', r[1]];
      if (s.startsWith('[Sala 3D]')) return null;
      if (m[1].startsWith('Mensagens da Sala 3D')) return ['u', s];
    }
    return ['n', 'Automação: ' + m[1]];
  }
  m = ROUTINE.exec(t);
  if (m) return ['n', 'Automação: ' + m[1]];
  if (t.startsWith('[OpenMausBot') || t.startsWith('[From OpenMausBot')) return null;
  return ['u', t];
}

export function doingLabel(j: unknown): string {
  let tool: Record<string, unknown>;
  try {
    const o = JSON.parse(String(j)) || {};
    if (typeof o !== 'object' || Array.isArray(o)) return '';
    tool = (o.tool as Record<string, unknown>) || {};
    if (typeof tool !== 'object') return '';
  } catch { return ''; }
  const k = `${tool.name || ''} ${tool.spoken || ''}`.toLowerCase();
  for (const [key, label] of DOING) if (k.includes(key)) return label;
  return 'Trabalhando';
}

const parse = (j: unknown): Record<string, unknown> => {
  try { const o = JSON.parse(String(j ?? '{}')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
};
const items = (d: unknown, key: string): Record<string, unknown>[] => {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    for (const k of [key, 'list', 'items']) { const v = (d as Record<string, unknown>)[k]; if (Array.isArray(v)) return v; }
  }
  return [];
};

// ---------- formato legado (o mesmo de sala_watch.py build()), usado no teste de comparação ----------
export interface LegacyBot { status: Status; need: string; chat: { r: string; t: string; at: number; w?: string }[]; ask?: string; doing?: string; next?: { name: string; at: number } }
export interface LegacyState {
  bots: Record<string, LegacyBot>;
  events: { id: string; at: number; bot: string; text: string; room?: string; to?: string }[];
  meet: { room: string; bots: string[] }[];
  rooms: Record<string, string[]>;
  roster: { name: string; dept: string; color: string; role: string; chief: boolean; id: string }[];
}

interface BotRec { id: string; name: string; threadId?: string; tasks?: { threadId?: string }[]; section?: string; chiefOfStaff?: boolean; title?: string; color?: string; createdAt?: number }

export class OpenMausBotReader {
  constructor(readonly home: string) {}

  private json(name: string): unknown {
    try { return JSON.parse(readFileSync(join(this.home, name), 'utf8')); } catch { return null; }
  }
  private ro(name: string): DatabaseSync {
    return new DatabaseSync(join(this.home, name), { readOnly: true, timeout: 2000 });
  }

  roster(bots: BotRec[]): LegacyState['roster'] {
    const sec = (this.json('section-contexts.json') as Record<string, unknown>) || {};
    const order = ['Geral', ...((Array.isArray(sec.sections) ? sec.sections : []) as unknown[]).filter((x): x is string => typeof x === 'string')];
    const seen = new Set<string>();
    const out: (LegacyState['roster'][number] & { createdAt: number; idx: number })[] = [];
    bots.forEach((b, idx) => {
      const n = b.name;
      if (!n || seen.has(n)) return;
      seen.add(n);
      const dept = pyStrip(b.section || '') || 'Geral';
      const chief = !!b.chiefOfStaff;
      const title = clean(b.title, 60);
      let role: string;
      if (chief) role = 'Chief of Staff · ' + dept;
      else if (title && title.toLowerCase() !== n.toLowerCase()) role = title;
      else if (n.toLowerCase().startsWith(dept.toLowerCase() + ' ') && n.length > dept.length + 1) role = n.slice(dept.length + 1);
      else role = dept;
      out.push({ name: n, dept, color: b.color || 'silver', role, chief, id: b.id, createdAt: Number(b.createdAt) || 0, idx });
    });
    const extra = [...new Set(out.map((r) => r.dept))].filter((d) => !order.includes(d)).sort();
    const depts = [...order, ...extra];
    // sala_watch ordena por slot (ordem de criação); aqui o agregador dá os slots, então usamos createdAt
    out.sort((a, b) => depts.indexOf(a.dept) - depts.indexOf(b.dept) || Number(a.chief === false) - Number(b.chief === false) || a.createdAt - b.createdAt || a.idx - b.idx);
    return out.map(({ createdAt: _c, idx: _i, ...r }) => r);
  }

  departmentOrder(): string[] {
    const sec = (this.json('section-contexts.json') as Record<string, unknown>) || {};
    return ['Geral', ...((Array.isArray(sec.sections) ? sec.sections : []) as unknown[]).filter((x): x is string => typeof x === 'string')];
  }

  workingThreads(now: number): Set<string> {
    const out = new Set<string>();
    const dir = join(this.home, 'events');
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith('.ndjson')); } catch { return out; }
    for (const f of files) {
      const p = join(dir, f);
      try {
        const st = statSync(p);
        const age = now / 1000 - st.mtimeMs / 1000;
        if (age > 600) continue;
        const size = st.size;
        const start = Math.max(0, size - 400000);
        const buf = Buffer.alloc(size - start);
        const fd = openSync(p, 'r');
        try { readSync(fd, buf, 0, buf.length, start); } finally { closeSync(fd); }
        const tail = buf.toString('utf8');
        const a = tail.lastIndexOf('"type":"turn.started"');
        const b = Math.max(tail.lastIndexOf('"type":"turn.completed"'), tail.lastIndexOf('"type":"turn.failed"'), tail.lastIndexOf('"type":"turn.aborted"'), tail.lastIndexOf('"type":"turn.cancelled"'));
        if (a > b || (a === -1 && b === -1 && age < 30)) out.add(basename(f).slice(0, -7));
      } catch { /* arquivo sumiu ou trancado: ignora nesta leitura */ }
    }
    return out;
  }

  static answered(m: DatabaseSync, ths: string[], since: number): boolean {
    const q = m.prepare("select role, text, json from messages where thread_id=? and kind='text' and at>? order by at");
    for (const th of ths) {
      let wrote = false;
      for (const r of q.all(th, since) as { role: string; text: string; json: string }[]) {
        if (r.role !== 'user') { if (wrote) return true; }
        else if (!wrote && !(r.json || '').includes('"peerAsk"')) {
          const sd = said(r.role, r.text);
          wrote = !!(sd && sd[0] === 'u');
        }
      }
    }
    return false;
  }

  /** Mesma montagem de sala_watch.build(). Lança erro se a leitura falhar. */
  build(now = Date.now()): LegacyState {
    const d = JSON.parse(readFileSync(join(this.home, 'bots.json'), 'utf8'));
    const botList: BotRec[] = Array.isArray(d) ? d : d.bots || [];
    const byId = new Map<string, string>();
    const t2b = new Map<string, string>();
    for (const b of botList) {
      byId.set(b.id, b.name);
      if (b.threadId) t2b.set(b.threadId, b.name);
      for (const t of b.tasks || []) if (t.threadId) t2b.set(t.threadId, b.name);
    }
    const roster = this.roster(botList);
    const bots: Record<string, LegacyBot> = {};
    for (const n of byId.values()) bots[n] = { status: 'available', need: '', chat: [] };
    const events: LegacyState['events'] = [];
    const workTh = new Map<string, string[]>();
    for (const th of this.workingThreads(now)) {
      const n = t2b.get(th);
      if (n) {
        bots[n].status = 'working';
        if (!workTh.has(n)) workTh.set(n, []);
        workTh.get(n)!.push(th);
      }
    }
    for (const r of items(this.json('routines.json'), 'routines')) {
      const n = byId.get(r.botId as string);
      const at = r.nextRunAt as number;
      if (n && r.enabled && at && at > now) {
        const cur = bots[n].next;
        if (!cur || at < cur.at) bots[n].next = { name: clean(r.name, 60), at };
      }
    }
    const g2n = new Map<string, string>();
    const gmem: Record<string, string[]> = {};
    for (const g of items(this.json('groups.json'), 'groups')) {
      const nm = (g.name as string) || 'Grupo';
      gmem[nm] = ((g.memberIds as string[]) || []).filter((i) => byId.has(i)).map((i) => byId.get(i)!);
      const ths = [g.threadId as string, ...((g.tasks as { threadId?: string }[]) || []).map((t) => t.threadId)];
      for (const th of ths) if (th) g2n.set(th, nm);
    }
    const meet = new Map<string, string[]>();

    const m = this.ro('messages.db');
    try {
      // Última mensagem de texto de cada conversa de bot. Uma consulta por conversa conhecida usa o índice
      // (thread_id, at) de trás para frente; o "group by" sobre a tabela inteira levava ~0,5 s com 19 mil linhas.
      // Ordem das conversas igual à do "group by 1" (texto, ordem binária) para manter o desempate.
      const latest = new Map<string, [string, number]>();
      const last = m.prepare("select at from messages where thread_id=? and kind='text' order by at desc limit 1");
      for (const th of [...t2b.keys()].sort(binary)) {
        const r = last.get(th) as { at: number } | undefined;
        if (!r) continue;
        const n = t2b.get(th)!;
        if (r.at > (latest.get(n)?.[1] ?? 0)) latest.set(n, [th, r.at]);
      }
      const q = m.prepare("select role, text, at, json from messages where thread_id=? and kind='text' order by at desc limit 40");
      for (const [n, [th]] of latest) {
        let rows = q.all(th) as { role: string; text: string; at: number; json: string }[];
        const ex = rows.length ? ((parse(rows[0].json).automation as Record<string, unknown>) || {}).executionThreadId : undefined;
        if (typeof ex === 'string' && ex && ex !== th) {
          const alt = q.all(ex) as typeof rows;
          if (alt.length) rows = alt;
        }
        const chat: LegacyBot['chat'] = [];
        for (const row of rows.slice().reverse()) {
          const sd = said(row.role, row.text);
          if (!sd) continue;
          const item: LegacyBot['chat'][number] = { r: sd[0], t: sd[1], at: row.at };
          const o = parse(row.json);
          if (row.role !== 'user') {
            const who = byId.get(((o.from as Record<string, unknown>) || {}).botId as string);
            if (who && who !== n) {
              item.r = 'o';
              item.w = who;
              item.t = sd[1].replace(new RegExp('^(@[^\\n]{0,40}?' + escRe(n) + '\\s+)'), '');
            }
          } else if (sd[0] === 'u' && o.peerAsk && typeof o.peerAsk === 'object' && !Array.isArray(o.peerAsk)) {
            const pa = o.peerAsk as Record<string, unknown>;
            item.r = 'o';
            item.w = byId.get(pa.botId as string) || (pa.name as string) || 'Outro bot';
          }
          item.t = cleanChat(item.t, 1500);
          chat.push(item);
        }
        bots[n].chat = chat.slice(-12);
      }
      // As consultas "recentes" abaixo também vão conversa por conversa (só as de bots e grupos conhecidos,
      // as únicas que o resultado usa), em vez de varrer a tabela inteira.
      type RecentRow = { id: string; thread_id: string; text: string; at: number; json: string };
      const recentQ = m.prepare("select id, thread_id, text, at, json from messages where thread_id=? and kind='text' and role='bot' and at>? order by at");
      const recent: RecentRow[] = [];
      for (const th of new Set([...g2n.keys(), ...t2b.keys()])) recent.push(...(recentQ.all(th, now - RECENT_MS) as RecentRow[]));
      recent.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      for (const r of recent) {
        const first = (r.text || '').replace(/^\s+/, '').slice(0, 1);
        if (!r.text || first === '' || '@{['.includes(first)) continue;
        const room = g2n.get(r.thread_id);
        if (room) {
          const n = byId.get(((parse(r.json).from as Record<string, unknown>) || {}).botId as string);
          if (n) {
            events.push({ id: r.id, at: r.at, bot: n, room, text: clean(r.text, 230) });
            if (r.at > now - 4 * 60000) {
              if (!meet.has(room)) meet.set(room, []);
              if (!meet.get(room)!.includes(n)) meet.get(room)!.push(n);
            }
          }
          continue;
        }
        const n = t2b.get(r.thread_id);
        if (n) events.push({ id: r.id, at: r.at, bot: n, text: clean(r.text, 230) });
      }
      const anyQ = m.prepare("select 1 from messages where thread_id=? and kind='text' and at>? limit 1");
      for (const th of [...g2n.keys()].sort(binary)) {
        const room = g2n.get(th)!;
        if (gmem[room]?.length && anyQ.get(th, now - 4 * 60000)) meet.set(room, gmem[room].slice());
      }
      const act = m.prepare("select at, json from messages where thread_id=? and kind='activity' order by at desc limit 1");
      for (const [n, ths] of workTh) {
        let best: { at: number; json: string } | undefined;
        for (const th of ths) {
          const row = act.get(th) as { at: number; json: string } | undefined;
          if (row && (!best || row.at > best.at)) best = row;
        }
        bots[n].doing = (best && best.at > now - RECENT_MS ? doingLabel(best.json) : '') || 'Pensando';
      }
      const seen = new Set<string>();
      const spoke = new Map<string, number>();
      const spokeQ = m.prepare("select at from messages where thread_id=? and kind='text' and role='bot' and at>? order by at desc limit 1");
      for (const [th, n] of t2b) {
        const r = spokeQ.get(th, now - 12 * 3600000) as { at: number } | undefined;
        if (r) spoke.set(n, Math.max(spoke.get(n) ?? 0, r.at));
      }
      for (const r of m.prepare('select kind, bot_name, thread_id, title, read, at, body from notification_log where at>? order by at desc').all(now - 7 * 86400000) as { kind: string; bot_name: string; title: string; read: number; at: number; body: string }[]) {
        const bn = r.bot_name;
        if (seen.has(bn)) continue;
        seen.add(bn);
        if (!(bn in bots)) continue;
        if (ASK_KINDS.includes(r.kind) && !r.read) {
          bots[bn].status = 'waiting';
          bots[bn].ask = r.kind;
          bots[bn].need = bots[bn].need || clean(r.title, 140);
        } else if (FAIL_KINDS.includes(r.kind) && r.at > now - 12 * 3600000 && bots[bn].status === 'available' && (spoke.get(bn) ?? 0) < r.at) {
          bots[bn].status = 'problem';
          const body = r.body || '';
          const why = body.includes('failed:') ? pyStrip(body.split('failed:').pop() || '') : '';
          bots[bn].need = clean(why ? 'Falhou: ' + why : 'A última tarefa falhou', 140);
        }
      }
    } finally {
      m.close();
    }

    const rt = this.ro('runtime.db');
    try {
      for (const r of rt.prepare("select created_at, json from assignments where status='needs_input'").all() as { created_at: number; json: string }[]) {
        const o = JSON.parse(r.json);
        const n = byId.get((o.assignee || {}).botId);
        if (!n) continue;
        const q = String(o.question || '').split('Waiting on the person: ').join('');
        const ql = q.toLowerCase();
        const ask = /key|token|password|secret|credential/.test(ql) ? 'secret' : ql.includes('sign') ? 'sign-in' : 'question';
        if (ask === 'question') {
          const m2 = this.ro('messages.db');
          try {
            const ths = [...t2b.entries()].filter(([, b]) => b === n).map(([t]) => t);
            if (OpenMausBotReader.answered(m2, ths, o.lastActivityAt || r.created_at)) continue;
          } finally { m2.close(); }
        }
        bots[n].status = 'waiting';
        bots[n].ask = ask;
        bots[n].need = clean(q, 140) || bots[n].need;
      }
      for (const r of rt.prepare('select id, created_at, json from assignments where created_at>? order by created_at').all(now - RECENT_MS) as { id: string; created_at: number; json: string }[]) {
        const o = JSON.parse(r.json);
        const a = byId.get((o.requester || {}).botId);
        const b = byId.get((o.assignee || {}).botId);
        if (a && b && a !== b) events.push({ id: 'a-' + r.id, at: r.created_at, bot: a, to: b, text: clean(o.brief, 170) });
      }
    } finally {
      rt.close();
    }
    events.sort((x, y) => x.at - y.at);
    const meetList = [...meet.entries()].filter(([, b]) => b.length >= 2).map(([room, b]) => ({ room, bots: b }));
    return { bots, events: events.slice(-25), meet: meetList, rooms: gmem, roster };
  }

  /** Converte o estado legado para o formato normalizado dos conectores. */
  snapshot(now = Date.now()): ConnectorSnapshot {
    const st = this.build(now);
    const idOf = new Map(st.roster.map((r) => [r.name, r.id]));
    const groupsRaw = items(this.json('groups.json'), 'groups');
    const gid = new Map<string, string>();
    for (const g of groupsRaw) { const nm = (g.name as string) || 'Grupo'; if (!gid.has(nm)) gid.set(nm, String(g.id || nm)); }
    const active = new Set(st.meet.map((x) => x.room));
    const agents: SnapshotAgent[] = st.roster.map((r) => {
      const b = st.bots[r.name] || { status: 'available' as Status, need: '', chat: [] };
      const chat: ChatItem[] = b.chat.map((c) => ({ r: c.r as ChatItem['r'], t: c.t, at: c.at, ...(c.w ? { w: c.w, from: idOf.get(c.w) } : {}) }));
      return {
        id: r.id, name: r.name, role: r.role, department: r.dept, color: r.color, chief: r.chief,
        status: b.status, need: b.need, ask: b.ask as AskKind | undefined, doing: b.doing, next: b.next, chat,
      };
    });
    const groups: SnapshotGroup[] = Object.entries(st.rooms).map(([nm, ms]) => ({
      id: gid.get(nm) || nm, name: nm, members: ms.map((n) => idOf.get(n)).filter((x): x is string => !!x), active: active.has(nm),
    }));
    const events = st.events
      .filter((e) => idOf.has(e.bot))
      .map((e) => ({ id: e.id, at: e.at, from: idOf.get(e.bot)!, text: e.text, to: e.to ? idOf.get(e.to) : undefined, groupId: e.room ? gid.get(e.room) || e.room : undefined }));
    return { agents, groups, events, departments: this.departmentOrder() };
  }
}

// ---------- envio ----------
export const roomPhrase = {
  agent: (name: string, text: string) => `[Sala 3D] Mensagem para o bot ${name}: "${text}"`,
  group: (name: string, text: string) => `[Sala 3D] Mensagem para o grupo ${name}: "${text}"`,
  dept: (dept: string | null, text: string) => `[Sala 3D] Mensagem para todos os bots ${dept === null ? 'de todos os departamentos' : 'do departamento ' + dept}: "${text}"`,
  retry: (name: string) => `[Sala 3D] Tentar de novo a tarefa que falhou do bot ${name}`,
};

/** "Nome do bot = http://127.0.0.1:…" por linha. */
export function parseHooks(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of String(text || '').split('\n')) {
    const i = line.lastIndexOf('=');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim().normalize('NFC');
    const url = line.slice(i + 1).trim();
    if (name && url) out.set(name, url);
  }
  return out;
}

function readLegacyHooks(dir: string): { main?: string; bots: Map<string, string> } {
  const bots = new Map<string, string>();
  let main: string | undefined;
  try { main = readFileSync(join(dir, '.sala_hook'), 'utf8').trim() || undefined; } catch { /* sem arquivo */ }
  const hd = join(dir, '.sala_hooks');
  if (existsSync(hd)) {
    for (const f of readdirSync(hd)) {
      if (!f.endsWith('.txt')) continue;
      try { bots.set(f.slice(0, -4).normalize('NFC'), readFileSync(join(hd, f), 'utf8').trim()); } catch { /* ignora */ }
    }
  }
  return { main, bots };
}

const isLocalHook = (u: string) => /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(u);

export class OpenMausBotConnector implements AgentConnector {
  readonly kind = 'openmausbot';
  readonly label = 'OpenMausBot';
  readonly capabilities = { sendToAgent: true, sendToGroup: true, retryTask: true, groups: true, departments: true, chatHistory: true, transport: 'poll' as const };
  private reader!: OpenMausBotReader;
  private poll = 3000;
  private mainHook?: string;
  private botHooks = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSnap?: ConnectorSnapshot;
  private stopped = false;
  /** leitura fora do processo principal (ver readerThread.ts) */
  readonly thread = new ReaderThread('openmausbot');

  constructor(private log: (m: string) => void = () => {}) {}

  async connect(config: Record<string, unknown>): Promise<void> {
    const dir = String(config.dataDir || '').trim() || join(homedir(), '.openmausbot');
    this.reader = new OpenMausBotReader(dir.replace(/^~(?=\/|$)/, homedir()));
    this.poll = Math.max(1000, Number(config.pollMs) || 3000);
    const legacy = String(config.legacyDir || '').trim();
    const leg = legacy ? readLegacyHooks(legacy.replace(/^~(?=\/|$)/, homedir())) : { bots: new Map<string, string>() };
    this.mainHook = String(config.mainHook || '').trim() || leg.main;
    this.botHooks = new Map([...leg.bots, ...parseHooks(String(config.botHooks || ''))]);
    if (!existsSync(join(this.reader.home, 'bots.json'))) throw new Error('Não achei bots.json em ' + this.reader.home);
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
        const s = await this.thread.read(this.reader.home, () => this.reader.snapshot());
        if (!alive || this.stopped) return;
        fails = 0;
        if (s) { this.lastSnap = s; onSnapshot(s); }
      } catch (e) {
        if (!alive || this.stopped) return;
        // arquivo trancado/ausente: registra, espera mais um pouco e tenta de novo
        fails++;
        wait = Math.min(30000, this.poll * Math.min(10, fails));
        this.log('openmausbot: leitura falhou: ' + (e as Error).message);
        onError(e as Error);
      }
      this.timer = setTimeout(() => void loop(), wait);
    };
    void loop();
    return () => {
      alive = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.thread.stop();
    };
  }

  private nameOf(id: string): string | undefined {
    return this.lastSnap?.agents.find((a) => a.id === id)?.name;
  }

  private async post(url: string | undefined, text: string): Promise<CommandResult> {
    if (!url) return { ok: false, error: 'Falta configurar o endereço de entrada do bot principal.' };
    if (!/^https?:\/\//.test(url)) return { ok: false, error: 'Endereço de entrada inválido.' };
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(10000) });
      await r.text();
      return r.ok ? { ok: true } : { ok: false, error: 'A plataforma respondeu ' + r.status };
    } catch (e) {
      this.log('openmausbot: envio falhou: ' + (e as Error).name);
      return { ok: false, error: 'Não consegui entregar a mensagem.' };
    }
  }

  async send(cmd: RoomCommand): Promise<CommandResult> {
    switch (cmd.type) {
      case 'message.agent': {
        const name = this.nameOf(cmd.agentId);
        if (!name) return { ok: false, error: 'bot não encontrado' };
        const hook = this.botHooks.get(name.normalize('NFC'));
        if (hook && isLocalHook(hook)) return this.post(hook, cmd.text);
        return this.post(this.mainHook, roomPhrase.agent(name, cmd.text));
      }
      case 'message.group': {
        const g = this.lastSnap?.groups.find((x) => x.id === cmd.groupId);
        if (!g) return { ok: false, error: 'grupo não encontrado' };
        return this.post(this.mainHook, roomPhrase.group(g.name, cmd.text));
      }
      case 'message.department':
        return this.post(this.mainHook, roomPhrase.dept(cmd.department, cmd.text));
      case 'task.retry': {
        const name = this.nameOf(cmd.agentId);
        if (!name) return { ok: false, error: 'bot não encontrado' };
        return this.post(this.mainHook, roomPhrase.retry(name));
      }
    }
  }
}

export const openMausBotFactory = (log?: (m: string) => void): ConnectorFactory => ({
  kind: 'openmausbot',
  label: 'OpenMausBot',
  description: 'Lê, só para leitura, a pasta de dados do OpenMausBot neste computador. Para enviar mensagens, informe os endereços de entrada.',
  multiple: false,
  fields: [
    { key: 'dataDir', label: 'Pasta de dados', type: 'text', placeholder: '~/.openmausbot', default: '~/.openmausbot' },
    { key: 'pollMs', label: 'Intervalo de leitura (ms)', type: 'number', default: 3000 },
    { key: 'mainHook', label: 'Endereço de entrada do bot principal', type: 'secret', placeholder: 'http://127.0.0.1:…', help: 'Recebe grupos, departamentos, "tentar de novo" e quem não tem endereço próprio.' },
    { key: 'botHooks', label: 'Endereços por bot (um por linha: Nome do bot = URL)', type: 'secret', placeholder: 'MausBot = http://127.0.0.1:…', help: 'Só endereços locais (127.0.0.1) são usados para envio direto.' },
    { key: 'legacyDir', label: 'Importar endereços do leitor antigo (pasta com .sala_hook e .sala_hooks)', type: 'text', placeholder: 'opcional' },
  ],
  create: () => new OpenMausBotConnector(log),
});
