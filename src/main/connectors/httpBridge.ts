// Ponte HTTP genérica: qualquer plataforma (ou um adaptador pequeno escrito para ela) que sirva
// um ConnectorSnapshot em JSON e aceite RoomCommand por POST entra na sala sem mudar o app.
// É o caminho para OpenBot, agents.chat e GrokBot enquanto as APIs deles não forem verificadas.

import type { CommandResult, ConnectorCapabilities, ConnectorSnapshot, RoomCommand } from '@shared/types';
import type { AgentConnector, ConnectorFactory } from './types';

const asArr = (v: unknown) => (Array.isArray(v) ? v : []);

/** Aceita só o que a sala entende e corta o resto (texto de terceiros é dado não confiável). */
export function sanitizeSnapshot(raw: unknown): ConnectorSnapshot {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const statuses = ['available', 'working', 'waiting', 'problem'];
  const asks = ['question', 'sign-in', 'secret'];
  return {
    agents: asArr(o.agents).slice(0, 200).map((a: Record<string, unknown>) => ({
      id: str(a.id, 200),
      name: str(a.name, 80) || str(a.id, 80),
      role: str(a.role, 80),
      department: str(a.department, 80),
      color: str(a.color, 20) || undefined,
      chief: !!a.chief,
      status: (statuses.includes(a.status as string) ? a.status : 'available') as ConnectorSnapshot['agents'][number]['status'],
      need: str(a.need, 140),
      ask: asks.includes(a.ask as string) ? (a.ask as 'question') : undefined,
      doing: str(a.doing, 60) || undefined,
      next: a.next && typeof a.next === 'object' ? { name: str((a.next as Record<string, unknown>).name, 60), at: num((a.next as Record<string, unknown>).at) } : undefined,
      chat: asArr(a.chat).slice(-12).map((c: Record<string, unknown>) => ({
        r: (['u', 'b', 'n', 'o'].includes(c.r as string) ? c.r : 'b') as 'b',
        t: str(c.t, 1500),
        at: num(c.at),
        w: str(c.w, 80) || undefined,
        from: str(c.from, 200) || undefined,
      })),
    })).filter((a) => a.id),
    groups: asArr(o.groups).slice(0, 100).map((g: Record<string, unknown>) => ({
      id: str(g.id, 200), name: str(g.name, 80), members: asArr(g.members).map((m) => str(m, 200)).filter(Boolean), active: !!g.active,
    })).filter((g) => g.id),
    events: asArr(o.events).slice(-25).map((e: Record<string, unknown>) => ({
      id: str(e.id, 200), at: num(e.at), from: str(e.from, 200), text: str(e.text, 230), to: str(e.to, 200) || undefined, groupId: str(e.groupId, 200) || undefined,
    })).filter((e) => e.id && e.from),
    departments: asArr(o.departments).map((d) => str(d, 80)).filter(Boolean),
  };
}

export class HttpBridgeConnector implements AgentConnector {
  readonly kind = 'http';
  readonly label = 'Ponte HTTP';
  capabilities: ConnectorCapabilities = { sendToAgent: false, sendToGroup: false, retryTask: false, groups: true, departments: true, chatHistory: true, transport: 'poll' };
  private url = '';
  private commandUrl = '';
  private token = '';
  private poll = 3000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  async connect(config: Record<string, unknown>): Promise<void> {
    this.url = String(config.url || '').trim();
    this.commandUrl = String(config.commandUrl || '').trim();
    this.token = String(config.token || '').trim();
    this.poll = Math.max(1000, Number(config.pollMs) || 3000);
    if (!/^https?:\/\//.test(this.url)) throw new Error('Endereço do estado inválido');
    const caps = String(config.capabilities || '').split(',').map((s) => s.trim());
    const has = (k: string) => caps.includes(k);
    const canSend = !!this.commandUrl;
    this.capabilities = {
      sendToAgent: canSend,
      sendToGroup: canSend && has('grupos'),
      retryTask: canSend && has('repetir'),
      groups: true,
      departments: true,
      chatHistory: true,
      transport: 'poll',
    };
    await this.fetchState();
  }

  private headers(): Record<string, string> {
    return this.token ? { Authorization: 'Bearer ' + this.token } : {};
  }

  private async fetchState(): Promise<ConnectorSnapshot> {
    const r = await fetch(this.url, { headers: this.headers(), signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('A ponte respondeu ' + r.status);
    return sanitizeSnapshot(await r.json());
  }

  subscribe(onSnapshot: (s: ConnectorSnapshot) => void, onError: (e: Error) => void): () => void {
    let alive = true;
    let last = '';
    const loop = async () => {
      if (!alive) return;
      try {
        const s = await this.fetchState();
        const k = JSON.stringify(s);
        if (k !== last) { last = k; onSnapshot(s); }
      } catch (e) {
        onError(e as Error);
      }
      if (alive) this.timer = setTimeout(loop, this.poll);
    };
    void loop();
    return () => { alive = false; if (this.timer) clearTimeout(this.timer); };
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async send(cmd: RoomCommand): Promise<CommandResult> {
    if (!this.commandUrl) return { ok: false, error: 'Esta ponte é só leitura' };
    try {
      const r = await fetch(this.commandUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...this.headers() }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(10000) });
      return r.ok ? { ok: true } : { ok: false, error: 'A ponte respondeu ' + r.status };
    } catch {
      return { ok: false, error: 'Não consegui entregar o comando' };
    }
  }
}

export const httpBridgeFactory: ConnectorFactory = {
  kind: 'http',
  label: 'Ponte HTTP (genérica)',
  description: 'Para qualquer plataforma com um adaptador que sirva o estado no formato da sala (GET) e receba comandos (POST). Use para OpenBot, agents.chat, GrokBot ou outras.',
  multiple: true,
  fields: [
    { key: 'name', label: 'Nome da plataforma', type: 'text', placeholder: 'ex.: agents.chat', required: true },
    { key: 'url', label: 'Endereço do estado (GET, devolve ConnectorSnapshot)', type: 'text', placeholder: 'http://127.0.0.1:9000/sala/state', required: true },
    { key: 'commandUrl', label: 'Endereço de comandos (POST RoomCommand) — vazio = só leitura', type: 'text' },
    { key: 'token', label: 'Chave de acesso (enviada como Bearer)', type: 'secret' },
    { key: 'capabilities', label: 'Recursos extras (separados por vírgula: grupos, repetir)', type: 'text', placeholder: 'grupos, repetir' },
    { key: 'pollMs', label: 'Intervalo de consulta (ms)', type: 'number', default: 3000 },
  ],
  create: () => new HttpBridgeConnector(),
};
