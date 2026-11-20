// Skins de terceiros (pack 'terceiros') ficam desligadas por padrão; o interruptor continua nos ajustes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentId } from '@shared/types';
import { DEFAULT_PREFS, loadPrefs, savePrefs, useUI } from '../src/renderer/store';

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

  it('prefs v1 com thirdParty: true (gravado pelo padrão antigo) voltam a desligado', () => {
    saved({ cfg: { thirdParty: true, names: false }, cam: null });
    const p = loadPrefs();
    expect(p.thirdParty).toBe(false);
    expect(p.names).toBe(false);
  });

  it('escolha explícita guardada em v2 é respeitada', () => {
    saved({ v: 2, cfg: { thirdParty: true }, cam: null });
    expect(loadPrefs().thirdParty).toBe(true);
    saved({ v: 2, cfg: { thirdParty: false }, cam: null });
    expect(loadPrefs().thirdParty).toBe(false);
  });

  it('savePrefs grava a versão, e a escolha sobrevive a recarregar', () => {
    let out = '';
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: (_k: string, v: string) => { out = v; } });
    savePrefs({ ...DEFAULT_PREFS, thirdParty: true });
    const raw = JSON.parse(out);
    expect(raw.v).toBe(2);
    saved(raw);
    expect(loadPrefs().thirdParty).toBe(true);
  });

  it('prefs corrompidas: desligado', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{nao e json', setItem: () => {} });
    expect(loadPrefs().thirdParty).toBe(false);
  });
});

describe('SkinMenu: escolher skin não mexe nos interruptores globais', () => {
  const a1 = 'a1' as AgentId;
  const reset = () => {
    saved(undefined);
    useUI.setState({ prefs: { ...DEFAULT_PREFS, skinOf: {} } });
  };

  it('com "Mostrar skins" desligado, continua desligado', () => {
    reset();
    useUI.getState().chooseSkin(a1, 'Robô', 'Outra');
    const p = useUI.getState().prefs;
    expect(p.skins).toBe(false);
    expect(p.thirdParty).toBe(false);
    expect(p.skinOf[a1]).toBe('Robô');
  });

  it('com "Mostrar skins" ligado, continua ligado', () => {
    reset();
    useUI.getState().setPref('skins', true);
    useUI.getState().chooseSkin(a1, 'Robô', 'Outra');
    expect(useUI.getState().prefs.skins).toBe(true);
  });

  it('null vira "none" e a skin de fábrica limpa a escolha', () => {
    reset();
    useUI.getState().chooseSkin(a1, null, 'Outra');
    expect(useUI.getState().prefs.skinOf[a1]).toBe('none');
    useUI.getState().chooseSkin(a1, 'Outra', 'Outra');
    expect(useUI.getState().prefs.skinOf).toEqual({});
  });
});
