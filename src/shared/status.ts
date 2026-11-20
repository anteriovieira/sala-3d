import type { AskKind, Status } from './types';

/** Fatos que um conector sabe sobre um agente; a regra de status é a mesma para todos. */
export interface StatusFacts {
  now: number;
  /** pedido pendente que só o dono resolve (o aviso mais recente do agente) */
  ask?: { kind: AskKind; need: string; answered?: boolean } | null;
  /** há uma execução aberta (começou e ainda não terminou/falhou/foi cancelada) */
  running: boolean;
  /** rótulo do que está fazendo, se houver */
  doing?: string;
  /** a falha mais recente, se o aviso mais recente do agente for uma falha */
  failure?: { at: number; reason?: string } | null;
  /** última vez que o agente falou (ms) */
  lastSpokeAt?: number;
}

export interface StatusDecision {
  status: Status;
  need: string;
  ask?: AskKind;
  doing?: string;
}

export const FAIL_WINDOW_MS = 12 * 3600_000;

export function clip(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/**
 * Prioridade: waiting > working > problem > available (seção 4.1 da especificação).
 * - waiting: algo pendente que só o dono resolve; perguntas já respondidas não contam
 *   (pedidos de conta e de chave continuam até serem resolvidos na plataforma).
 * - working: execução aberta.
 * - problem: parado, falha nas últimas 12 h e sem fala depois dela.
 */
export function decideStatus(f: StatusFacts): StatusDecision {
  const ask = f.ask;
  if (ask && !(ask.kind === 'question' && ask.answered)) {
    return { status: 'waiting', ask: ask.kind, need: clip(ask.need || '', 140), doing: f.running ? f.doing || 'Trabalhando' : undefined };
  }
  if (f.running) return { status: 'working', need: '', doing: f.doing || 'Pensando' };
  const fail = f.failure;
  if (fail && fail.at > f.now - FAIL_WINDOW_MS && (f.lastSpokeAt ?? 0) < fail.at) {
    const why = (fail.reason || '').trim();
    return { status: 'problem', need: clip(why ? 'Falhou: ' + why : 'A última tarefa falhou', 140) };
  }
  return { status: 'available', need: '' };
}

/** Reserva para plataformas sem status explícito (seção 12.4): nunca adivinha "waiting". */
export function fallbackStatus(running: boolean, lastAgentMessageAt: number | undefined, now: number, windowMs = 60_000): Status {
  if (running) return 'working';
  if (lastAgentMessageAt && now - lastAgentMessageAt < windowMs) return 'working';
  return 'available';
}
