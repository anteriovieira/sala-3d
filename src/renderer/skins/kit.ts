// Ferramentas de desenho das skins (canvas 1024×640 aplicado ao corpo do bot).

export type G = CanvasRenderingContext2D;
export const SW = 1024, SH = 640, FX = SW / 2, EY = 206, MY = 250; // FX = frente, EY = olhos, MY = boca

export interface Skin {
  name: string;
  /** cor dos olhos */
  eye: string;
  /** cor de braços e pés */
  limb: string;
  /** false = esconde a boca (a skin já desenha uma) */
  mouth?: boolean;
  glow?: number;
  /** pacote de origem: 'base', 'terceiros' ou outro registrado */
  pack?: string;
  draw(g: G): void;
}

export const sk = {
  fill: (g: G, c: string) => { g.fillStyle = c; g.fillRect(0, 0, SW, SH); },
  band: (g: G, y: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(0, y, SW, h); },
  ell: (g: G, x: number, y: number, rx: number, ry: number, c: string, rot = 0) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); },
  poly: (g: G, pts: number[][], c: string) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); },
  rr: (g: G, x: number, y: number, w: number, h: number, r: number, c: string) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); },
  grad: (g: G, y0: number, y1: number, stops: [number, string][]) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, y0, SW, y1 - y0); },
  star: (g: G, x: number, y: number, r: number, c: string, n = 5) => { const pts: number[][] = []; for (let k = 0; k < n * 2; k++) { const a = (k * Math.PI) / n - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } sk.poly(g, pts, c); },
  zig: (g: G, y: number, amp: number, step: number, c: string, h: number) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, y); for (let x = 0, k = 0; x <= SW; x += step, k++) g.lineTo(x, y + (k % 2 ? amp : 0)); for (let x = SW, k = Math.round(SW / step); x >= 0; x -= step, k--) g.lineTo(x, y + h + (k % 2 ? amp : 0)); g.closePath(); g.fill(); },
  rnd: (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; },
  lens: (g: G, c = '#fff', rx = 46, ry = 44) => { sk.ell(g, FX - 82, EY, rx, ry, c); sk.ell(g, FX + 82, EY, rx, ry, c); },
};
