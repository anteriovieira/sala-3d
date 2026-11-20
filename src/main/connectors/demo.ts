// Conector de demonstração: agentes falsos com semente fixa, para desenvolver e testar sem plataforma.

import { makeRng } from '@shared/layout';
import type { AskKind, ChatItem, CommandResult, ConnectorSnapshot, RoomCommand, RoomEvent, SnapshotAgent, SnapshotGroup, Status } from '@shared/types';
import type { AgentConnector, ConnectorFactory } from './types';

const FIRST = ['Atlas', 'Bento', 'Ciça', 'Dora', 'Eco', 'Faísca', 'Gaia', 'Hugo', 'Íris', 'Juno', 'Kiko', 'Lia', 'Milo', 'Nina', 'Otto', 'Pipa', 'Quim', 'Rubi', 'Sol', 'Tito', 'Uma', 'Vavá'];
const DEPTS = ['Pesquisa', 'Vendas', 'Operações', 'Conteúdo'];
const COLORS = ['silver', 'pink', 'yellow', 'purple', 'orange', 'teal', 'blue', 'green', 'red'];
const DOING = ['Navegando na web', 'Olhando o e-mail', 'Olhando a agenda', 'Pesquisando', 'Lendo uma página da web', 'Editando um arquivo', 'Rodando um comando', 'Analisando dados', 'Montando uma página'];
const LINES = [
  'Terminei o resumo das notícias de hoje.',
  'Encontrei três fornecedores com preço melhor.',
  'A planilha de vendas foi atualizada.',
  'Revisei o texto e mandei para aprovação.',
  'O relatório semanal está pronto.',
  'Agendei a reunião para quinta às 10h.',
  'Achei um erro no cadastro e já corrigi.',
  'Separei os e-mails importantes da manhã.',
];
const ASKS: [AskKind, string][] = [
  ['question', 'Posso enviar a proposta para o cliente agora?'],
  ['question', 'Devo publicar o post de amanhã já hoje?'],
  ['sign-in', 'Preciso que você entre na conta da loja'],
  ['secret', 'Falta a chave de acesso do serviço de mapas'],
];
const PEER = ['Pode revisar esse texto para mim?', 'Me passa os números de ontem?', 'Consegue checar essa fonte?', 'Preciso da lista de contatos atualizada.'];

interface DemoAgent extends SnapshotAgent {
  busyUntil: number;
  replyAt?: number;
  replyTo?: string;
}

export class DemoConnector implements AgentConnector {
  readonly kind = 'demo';
  readonly label = 'Demonstração';
  readonly capabilities = { sendToAgent: true, sendToGroup: true, retryTask: true, groups: true, departments: true, chatHistory: true, transport: 'push' as const };
  private rng = makeRng(1);
  private agents: DemoAgent[] = [];
  private groups: (SnapshotGroup & { lastAt: number })[] = [];
  private events: RoomEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(s: ConnectorSnapshot) => void>();
  private evN = 0;
  private interval = 2500;
  private depts: string[] = [];

  async connect(config: Record<string, unknown>): Promise<void> {
    const seed = Number(config.seed ?? 7) || 7;
    const asked = Number(config.agents ?? 0) || 0;
    const count = asked > 0 ? Math.min(40, asked) : 0;
    this.interval = Math.max(300, Number(config.interval ?? 2500) || 2500);
    this.rng = makeRng(seed);
    this.build(count || 8 + Math.floor(this.rng() * 13));
  }

  /** Monta o elenco inicial (determinístico pela semente). */
  build(n: number, now = Date.now()): void {
    const r = this.rng;
    const nd = 2 + Math.floor(r() * 3);
    this.depts = DEPTS.slice(0, nd);
    this.agents = [];
    for (let i = 0; i < n; i++) {
      const dept = this.depts[i % nd];
      const chief = i < nd;
      const name = FIRST[i % FIRST.length] + (i >= FIRST.length ? ' ' + (Math.floor(i / FIRST.length) + 1) : '');
      this.agents.push({
        id: 'd' + i,
        name,
        role: chief ? 'Chefe · ' + dept : ['Analista', 'Assistente', 'Pesquisador', 'Redator', 'Operador'][i % 5],
        department: dept,
        color: COLORS[i % COLORS.length],
        chief,
        status: 'available',
        need: '',
        chat: [{ r: 'b', t: 'Olá! Estou pronto para ajudar.', at: now - 3600_000 }],
        busyUntil: 0,
        next: i % 3 === 0 ? { name: 'Resumo diário', at: now + (1 + i) * 3600_000 } : undefined,
      });
    }
    this.groups = this.depts.map((d, k) => ({
      id: 'g' + k,
      name: 'Time ' + d,
      members: this.agents.filter((a) => a.department === d).map((a) => a.id),
      active: false,
      lastAt: 0,
    }));
    // alguns estados iniciais variados
    for (const a of this.agents) {
      const x = r();
      if (x < 0.35) this.setStatus(a, 'working', now);
      else if (x < 0.45) this.setWaiting(a, now);
      else if (x < 0.5) this.setProblem(a);
    }
  }

  private setStatus(a: DemoAgent, s: Status, now: number) {
    a.status = s;
    a.need = '';
    a.ask = undefined;
    a.doing = s === 'working' ? DOING[Math.floor(this.rng() * DOING.length)] : undefined;
    a.busyUntil = s === 'working' ? now + 4000 + this.rng() * 14000 : 0;
  }
  private setWaiting(a: DemoAgent, _now: number) {
    const [kind, need] = ASKS[Math.floor(this.rng() * ASKS.length)];
    a.status = 'waiting';
    a.ask = kind;
    a.need = need;
    a.doing = undefined;
    a.chat.push({ r: 'b', t: need, at: Date.now() });
  }
  private setProblem(a: DemoAgent) {
    a.status = 'problem';
    a.ask = undefined;
    a.doing = undefined;
    a.need = 'Falhou: o site demorou demais para responder';
  }
  private push(ev: Omit<RoomEvent, 'id'>) {
    this.events.push({ ...ev, id: 'e' + ++this.evN });
    if (this.events.length > 25) this.events.splice(0, this.events.length - 25);
  }
  private chatPush(a: DemoAgent, item: ChatItem) {
    a.chat.push(item);
    if (a.chat.length > 12) a.chat.splice(0, a.chat.length - 12);
  }

  /** Um passo de simulação (público para testes). */
  tick(now = Date.now()): void {
    const r = this.rng;
    for (const a of this.agents) {
      if (a.replyAt && now >= a.replyAt) {
        const txt = 'Recebi: "' + (a.replyTo ?? '') + '". Vou cuidar disso.';
        this.chatPush(a, { r: 'b', t: txt, at: now });
        this.push({ at: now, from: a.id, text: txt });
        a.replyAt = undefined;
        if (a.status === 'waiting' && a.ask === 'question') this.setStatus(a, 'working', now);
        else if (a.status !== 'waiting') this.setStatus(a, 'working', now);
      }
      if (a.status === 'working' && now > a.busyUntil) {
        const x = r();
        if (x < 0.55) {
          this.setStatus(a, 'available', now);
          const line = LINES[Math.floor(r() * LINES.length)];
          this.chatPush(a, { r: 'b', t: line, at: now });
          this.push({ at: now, from: a.id, text: line });
        } else if (x < 0.7) this.setWaiting(a, now);
        else if (x < 0.78) this.setProblem(a);
        else a.busyUntil = now + 5000;
      }
    }
    const x = r();
    const idle = this.agents.filter((a) => a.status === 'available');
    if (x < 0.3 && idle.length) {
      this.setStatus(idle[Math.floor(r() * idle.length)], 'working', now);
    } else if (x < 0.45 && this.agents.length > 1) {
      const a = this.agents[Math.floor(r() * this.agents.length)];
      const others = this.agents.filter((o) => o !== a);
      const b = others[Math.floor(r() * others.length)];
      const text = PEER[Math.floor(r() * PEER.length)];
      this.push({ at: now, from: a.id, to: b.id, text });
      this.chatPush(b, { r: 'o', t: text, at: now, w: a.name, from: a.id });
    } else if (x < 0.55 && this.groups.length) {
      const g = this.groups[Math.floor(r() * this.groups.length)];
      const ms = this.agents.filter((a) => g.members.includes(a.id));
      if (ms.length >= 2) {
        const a = ms[Math.floor(r() * ms.length)];
        this.push({ at: now, from: a.id, groupId: g.id, text: LINES[Math.floor(r() * LINES.length)] });
        g.lastAt = now;
      }
    }
    for (const g of this.groups) g.active = now - g.lastAt < 4 * 60_000 && g.lastAt > 0;
    // janela de 30 min
    this.events = this.events.filter((e) => e.at > now - 30 * 60_000);
  }

  snapshot(): ConnectorSnapshot {
    return {
      agents: this.agents.map(({ busyUntil: _b, replyAt: _r, replyTo: _t, ...a }) => ({ ...a, chat: a.chat.slice() })),
      groups: this.groups.map(({ lastAt: _l, ...g }) => ({ ...g, members: g.members.slice() })),
      events: this.events.slice(),
      departments: this.depts.slice(),
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((l) => l(s));
  }

  subscribe(onSnapshot: (s: ConnectorSnapshot) => void): () => void {
    this.listeners.add(onSnapshot);
    onSnapshot(this.snapshot());
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.tick();
        this.emit();
      }, this.interval);
    }
    return () => {
      this.listeners.delete(onSnapshot);
      if (!this.listeners.size && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  async send(cmd: RoomCommand): Promise<CommandResult> {
    const now = Date.now();
    const reply = (a: DemoAgent, text: string) => {
      this.chatPush(a, { r: 'u', t: text, at: now });
      a.replyAt = now + 2500 + this.rng() * 3000;
      a.replyTo = text.length > 60 ? text.slice(0, 59) + '…' : text;
      if (a.status !== 'waiting' || a.ask === 'question') this.setStatus(a, 'working', now);
    };
    switch (cmd.type) {
      case 'message.agent': {
        const a = this.agents.find((x) => x.id === cmd.agentId);
        if (!a) return { ok: false, error: 'agente não encontrado' };
        reply(a, cmd.text);
        break;
      }
      case 'message.group': {
        const g = this.groups.find((x) => x.id === cmd.groupId);
        if (!g) return { ok: false, error: 'grupo não encontrado' };
        g.lastAt = now;
        g.active = true;
        this.agents.filter((a) => g.members.includes(a.id)).forEach((a) => reply(a, cmd.text));
        break;
      }
      case 'message.department':
        this.agents.filter((a) => cmd.department === null || a.department === cmd.department).forEach((a) => reply(a, cmd.text));
        break;
      case 'task.retry': {
        const a = this.agents.find((x) => x.id === cmd.agentId);
        if (!a) return { ok: false, error: 'agente não encontrado' };
        this.setStatus(a, 'working', now);
        break;
      }
    }
    setTimeout(() => this.emit(), 50);
    return { ok: true };
  }
}

export const demoFactory: ConnectorFactory = {
  kind: 'demo',
  label: 'Demonstração',
  description: 'Agentes falsos que trocam de status, conversam e se reúnem. Bom para testar a sala sem nenhuma plataforma.',
  multiple: true,
  fields: [
    { key: 'seed', label: 'Semente', type: 'number', default: 7, help: 'A mesma semente gera os mesmos agentes.' },
    { key: 'agents', label: 'Quantidade de agentes (0 = sorteado entre 8 e 20)', type: 'number', default: 0 },
    { key: 'interval', label: 'Intervalo entre novidades (ms)', type: 'number', default: 2500 },
  ],
  create: () => new DemoConnector(),
};
