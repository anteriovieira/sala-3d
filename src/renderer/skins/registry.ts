// Registro de skins: pacotes novos entram com registerSkin, sem mexer no núcleo.

import { DEFAULT_SKINS } from './defaultPack';
import { SH, SW, type Skin } from './kit';

export type { Skin } from './kit';

const skins: Skin[] = [];
const listeners = new Set<() => void>();
const canvasCache = new Map<string, HTMLCanvasElement>();

export function registerSkin(s: Skin | Skin[], pack = 'extra'): void {
  for (const x of Array.isArray(s) ? s : [s]) {
    if (skins.some((y) => y.name === x.name)) continue;
    skins.push({ pack, ...x });
  }
  listeners.forEach((l) => l());
}

export function onSkinsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pacotes desligados (ex.: 'terceiros' num app público) somem da lista e dos padrões. */
let disabledPacks = new Set<string>();
export function setDisabledPacks(p: string[]): void {
  disabledPacks = new Set(p);
  listeners.forEach((l) => l());
}

export function allSkins(): Skin[] {
  return skins.filter((s) => !disabledPacks.has(s.pack || 'extra'));
}

export function skinByName(name: string): Skin | undefined {
  return allSkins().find((s) => s.name === name);
}

/** Skin de fábrica do bot: slot % nº de skins. */
export function defaultSkin(slot: number): Skin | undefined {
  const list = allSkins();
  return list.length ? list[((slot % list.length) + list.length) % list.length] : undefined;
}

/** skinOf: nome escolhido, 'none' = sem skin, undefined = de fábrica. */
export function resolveSkin(slot: number, chosen: string | undefined, show: boolean): Skin | null {
  if (!show || chosen === 'none') return null;
  return (chosen && skinByName(chosen)) || defaultSkin(slot) || null;
}

export function skinCanvas(s: Skin): HTMLCanvasElement {
  let c = canvasCache.get(s.name);
  if (!c) {
    c = document.createElement('canvas');
    c.width = SW;
    c.height = SH;
    s.draw(c.getContext('2d')!);
    canvasCache.set(s.name, c);
  }
  return c;
}

registerSkin(DEFAULT_SKINS, 'base');
