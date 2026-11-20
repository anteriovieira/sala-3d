// Imagem do bot (512×512, fundo transparente) com a skin atual; a mesma, pequena, é o avatar.

import { FX } from './skins/kit';
import { skinCanvas, type Skin } from './skins/registry';

export const PASTEL = [0xdcecfb, 0xe4f6ee, 0xece6f7, 0xfaf0df, 0xf8e6ef, 0xe3ecfa, 0xeef6e3, 0xf6eee4, 0xe2f5f6, 0xe9e4f8, 0xfaf6e1, 0xe1f6ea, 0xf8e5e5, 0xe2e9f8, 0xedf7e2, 0xf6e8f6, 0xe1f7f8];
export const css = (h: number) => '#' + h.toString(16).padStart(6, '0');
export const pastelOf = (slot: number) => PASTEL[((slot % PASTEL.length) + PASTEL.length) % PASTEL.length];

export function botImage(slot: number, s: Skin | null): HTMLCanvasElement {
  const d = document.createElement('canvas');
  d.width = 512;
  d.height = 512;
  const q = d.getContext('2d')!;
  q.save();
  q.beginPath();
  q.roundRect(95, 16, 322, 480, 161);
  q.clip();
  if (s) q.drawImage(skinCanvas(s), 512 - 208, 0, 416, 640, 95, 16, 322, 480);
  else {
    q.fillStyle = css(pastelOf(slot));
    q.fillRect(0, 0, 512, 512);
  }
  q.fillStyle = s ? s.eye : '#1b2030';
  [-1, 1].forEach((m) => { q.beginPath(); q.ellipse(256 + m * 82 * 0.774, 16 + 206 * 0.75, 16, 32, 0, 0, 7); q.fill(); });
  q.restore();
  q.lineWidth = 3;
  q.strokeStyle = 'rgba(0,0,0,.35)';
  q.beginPath();
  q.roundRect(95, 16, 322, 480, 161);
  q.stroke();
  return d;
}

const avatarCache = new Map<string, string>();
export function avatarUrl(slot: number, s: Skin | null): string {
  const key = (s ? s.name : 'none:' + pastelOf(slot));
  let u = avatarCache.get(key);
  if (!u) {
    const c = document.createElement('canvas');
    c.width = 66;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(botImage(slot, s), 93, 14, 326, 484, 0, 0, 66, 96);
    u = c.toDataURL('image/png');
    avatarCache.set(key, u);
  }
  return u;
}

const thumbCache = new Map<string, string>();
export function skinThumb(s: Skin): string {
  let u = thumbCache.get(s.name);
  if (!u) {
    // desenha direto no tamanho da miniatura (antes desenhava a skin inteira em 1024×640 para cada uma:
    // abrir o menu pela primeira vez travava a sala ~2,4 s)
    const c = document.createElement('canvas');
    c.width = c.height = 44;
    const g = c.getContext('2d')!;
    g.scale(44 / 340, 44 / 340);
    g.translate(-(FX - 170), -40);
    s.draw(g);
    u = c.toDataURL();
    thumbCache.set(s.name, u);
  }
  return u;
}

const slug = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function downloadBotImage(name: string, slot: number, s: Skin | null): void {
  const a = document.createElement('a');
  a.download = slug(name) + '-' + (s ? slug(s.name) : 'sem-skin') + '.png';
  a.href = botImage(slot, s).toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  a.remove();
}
