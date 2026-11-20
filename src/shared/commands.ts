import { MAX_TEXT, type RoomCommand } from './types';

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Valida um comando vindo da interface ou da rede. Devolve o comando limpo ou um erro legível. */
export function validateCommand(raw: unknown): { ok: true; cmd: RoomCommand } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'comando inválido' };
  const c = raw as Record<string, unknown>;
  const text = typeof c.text === 'string' ? c.text.trim() : '';
  switch (c.type) {
    case 'message.agent':
      if (!isStr(c.agentId, 300)) return { ok: false, error: 'agentId inválido' };
      if (!isStr(text, MAX_TEXT)) return { ok: false, error: 'texto vazio ou longo demais' };
      return { ok: true, cmd: { type: 'message.agent', agentId: c.agentId, text } };
    case 'message.group':
      if (!isStr(c.groupId, 300)) return { ok: false, error: 'groupId inválido' };
      if (!isStr(text, MAX_TEXT)) return { ok: false, error: 'texto vazio ou longo demais' };
      return { ok: true, cmd: { type: 'message.group', groupId: c.groupId, text } };
    case 'message.department': {
      if (c.department !== null && !isStr(c.department, 200)) return { ok: false, error: 'departamento inválido' };
      if (c.connectorId !== undefined && !isStr(c.connectorId, 100)) return { ok: false, error: 'conector inválido' };
      if (!isStr(text, MAX_TEXT)) return { ok: false, error: 'texto vazio ou longo demais' };
      return { ok: true, cmd: { type: 'message.department', department: c.department as string | null, connectorId: c.connectorId as string | undefined, text } };
    }
    case 'task.retry':
      if (!isStr(c.agentId, 300)) return { ok: false, error: 'agentId inválido' };
      return { ok: true, cmd: { type: 'task.retry', agentId: c.agentId } };
    default:
      return { ok: false, error: 'tipo de comando desconhecido' };
  }
}

/** Separa `conector:id` (o id da plataforma pode conter ':'). */
export function splitId(full: string): [string, string] {
  const i = full.indexOf(':');
  return i < 0 ? ['', full] : [full.slice(0, i), full.slice(i + 1)];
}
