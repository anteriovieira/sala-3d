import { describe, expect, it } from 'vitest';
import { decideStatus, fallbackStatus } from '../src/shared/status';
import { validateCommand, splitId } from '../src/shared/commands';

const now = 1_800_000_000_000;

describe('regra de status (4.1)', () => {
  it('waiting vence working', () => {
    const d = decideStatus({ now, running: true, ask: { kind: 'question', need: 'Posso seguir?' } });
    expect(d.status).toBe('waiting');
    expect(d.ask).toBe('question');
    expect(d.need).toBe('Posso seguir?');
  });
  it('pergunta respondida deixa de contar; sign-in e secret continuam', () => {
    expect(decideStatus({ now, running: false, ask: { kind: 'question', need: 'x', answered: true } }).status).toBe('available');
    expect(decideStatus({ now, running: false, ask: { kind: 'sign-in', need: 'x', answered: true } }).status).toBe('waiting');
    expect(decideStatus({ now, running: false, ask: { kind: 'secret', need: 'x', answered: true } }).status).toBe('waiting');
  });
  it('working com rótulo padrão Pensando', () => {
    const d = decideStatus({ now, running: true });
    expect(d).toMatchObject({ status: 'working', doing: 'Pensando' });
  });
  it('problem só se falhou nas últimas 12 h e não falou depois', () => {
    expect(decideStatus({ now, running: false, failure: { at: now - 1000, reason: 'timeout' } })).toMatchObject({ status: 'problem', need: 'Falhou: timeout' });
    expect(decideStatus({ now, running: false, failure: { at: now - 1000 } }).need).toBe('A última tarefa falhou');
    expect(decideStatus({ now, running: false, failure: { at: now - 13 * 3600_000 } }).status).toBe('available');
    expect(decideStatus({ now, running: false, failure: { at: now - 5000 }, lastSpokeAt: now - 1000 }).status).toBe('available');
    expect(decideStatus({ now, running: true, failure: { at: now - 1000 } }).status).toBe('working');
  });
  it('need corta em 140', () => {
    expect(decideStatus({ now, running: false, ask: { kind: 'question', need: 'a'.repeat(300) } }).need.length).toBe(140);
  });
  it('reserva nunca adivinha waiting', () => {
    expect(fallbackStatus(false, now - 10_000, now)).toBe('working');
    expect(fallbackStatus(false, now - 120_000, now)).toBe('available');
  });
});

describe('comandos', () => {
  it('valida tipos e tamanho', () => {
    expect(validateCommand({ type: 'message.agent', agentId: 'demo:d1', text: 'oi' }).ok).toBe(true);
    expect(validateCommand({ type: 'message.agent', agentId: 'demo:d1', text: 'x'.repeat(4001) }).ok).toBe(false);
    expect(validateCommand({ type: 'message.agent', agentId: 'demo:d1', text: '   ' }).ok).toBe(false);
    expect(validateCommand({ type: 'message.department', department: null, text: 'oi' }).ok).toBe(true);
    expect(validateCommand({ type: 'drop.table' }).ok).toBe(false);
    expect(validateCommand(null).ok).toBe(false);
  });
  it('separa o id da conexão', () => {
    expect(splitId('openmausbot:abc:def')).toEqual(['openmausbot', 'abc:def']);
  });
});
