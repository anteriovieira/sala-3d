import { describe, expect, it } from 'vitest';
import { splitDoing } from '../src/renderer/doing';

describe('o que está fazendo', () => {
  it('rótulo curto fica no rótulo', () => {
    expect(splitDoing('Navegando na web')).toEqual({ label: 'Navegando na web' });
    expect(splitDoing('Lendo uma página da web')).toEqual({ label: 'Lendo uma página da web' });
  });
  it('frase de conversa vira balão', () => {
    const s = 'Entendi: às vezes a resposta do chat demora a aparecer e não há nenhum sinal';
    expect(splitDoing(s)).toEqual({ speech: s });
    expect(splitDoing('Pronto. Já mandei.')).toEqual({ speech: 'Pronto. Já mandei.' });
  });
  it('vazio', () => {
    expect(splitDoing(undefined)).toEqual({});
    expect(splitDoing('  ')).toEqual({});
  });
});
