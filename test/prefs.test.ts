// Skins de terceiros (pack 'terceiros') ficam desligadas por padrão; o interruptor continua nos ajustes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, loadPrefs } from '../src/renderer/store';

function saved(value: unknown) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k === 'sala.prefs' && value !== undefined ? JSON.stringify(value) : null),
    setItem: () => {},
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('prefs: skins de terceiros', () => {
  it('o padrão é desligado', () => {
    expect(DEFAULT_PREFS.thirdParty).toBe(false);
  });

  it('sem prefs guardadas: desligado', () => {
    saved(undefined);
    expect(loadPrefs().thirdParty).toBe(false);
  });

  it('prefs antigas sem a chave caem no novo padrão e mantêm o resto', () => {
    saved({ cfg: { names: false, sign: 'MINHA SALA', skinOf: { a1: 'none' } }, cam: null });
    const p = loadPrefs();
    expect(p.thirdParty).toBe(false);
    expect(p.names).toBe(false);
    expect(p.sign).toBe('MINHA SALA');
    expect(p.skinOf).toEqual({ a1: 'none' });
  });

  it('formato antigo plano (sem cfg) sem a chave: desligado', () => {
    saved({ names: false });
    const p = loadPrefs();
    expect(p.thirdParty).toBe(false);
    expect(p.names).toBe(false);
  });

  it('escolha explícita guardada é respeitada', () => {
    saved({ cfg: { thirdParty: true }, cam: null });
    expect(loadPrefs().thirdParty).toBe(true);
    saved({ cfg: { thirdParty: false }, cam: null });
    expect(loadPrefs().thirdParty).toBe(false);
  });

  it('prefs corrompidas: desligado', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{nao e json', setItem: () => {} });
    expect(loadPrefs().thirdParty).toBe(false);
  });
});
