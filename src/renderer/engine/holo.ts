// Tela de trabalho: desktop falso animado (canvas 512×304) compartilhado por todos os bots.
// Barra superior, dock com 6 ícones, 2 a 5 janelas que um cursor abre, arrasta e fecha.

import * as THREE from 'three';
import { css } from '../avatar';

interface Win { kind: string; icon: number; w: number; h: number; a: number; n: number; x: number; y: number; ox: number; oy: number }
interface Act { type: 'open' | 'move' | 'close'; w: Win; ph: 'go' | 'do' | 'rest'; k: number; fx: number; fy: number; tx: number; ty: number; dur: number; sx?: number; sy?: number; gx?: number; gy?: number; ex?: number; ey?: number }

export function makeHolo(colorHex: number) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 304;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const hex = css(colorHex), INK = '#dcecff', BG = '#02060c';
  const W = c.width, H = c.height, TOP = 24, DOCK = H - 38, KINDS = ['text', 'image', 'list', 'chat', 'grid', 'form'];
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ease = (k: number) => k * k * (3 - 2 * k);
  const iconX = (i: number) => W / 2 + (i - (KINDS.length - 1) / 2) * 30, iconY = DOCK + 12;
  const wins: Win[] = [], cur = { x: W * 0.5, y: H * 0.55 };
  let act: Act | null = null, last = 0, nk = 0, click = 9, pressI = -1;
  const place = (w: Win) => { w.x = 14 + rnd() * (W - 28 - w.w); w.y = TOP + 6 + rnd() * (DOCK - 16 - w.h - TOP); };
  const mk = (): Win => { const k = nk++ % KINDS.length; const w: Win = { kind: KINDS[k], icon: k, w: 120 + rnd() * 90, h: 78 + rnd() * 62, a: 1, n: rnd(), x: 0, y: 0, ox: 0, oy: 0 }; place(w); w.ox = w.x; w.oy = w.y; return w; };
  for (let i = 0; i < 3; i++) wins.push(mk());
  // o cursor só clica num ponto que não está coberto por outra janela
  const free = (w: Win, px: number, py: number) => wins.slice(wins.indexOf(w) + 1).every((o) => px < o.x || px > o.x + o.w || py < o.y || py > o.y + o.h);
  const grab = (w: Win): [number, number] => [w.x + w.w * 0.55, w.y + 9], shut = (w: Win): [number, number] => [w.x + 11, w.y + 9];
  function plan() {
    const n = wins.length, r = rnd();
    const type: Act['type'] = n <= 2 ? 'open' : n >= 5 ? (r < 0.6 ? 'close' : 'move') : r < 0.42 ? 'move' : r < 0.74 ? 'open' : 'close';
    let to: [number, number], w: Win;
    if (type === 'open') { w = mk(); w.a = 0; to = [iconX(w.icon), iconY]; w.ox = to[0]; w.oy = to[1]; }
    else { const pt = type === 'move' ? grab : shut, ok = wins.filter((o) => free(o, ...pt(o))); w = ok[Math.floor(rnd() * ok.length)] || wins[wins.length - 1]; to = pt(w); }
    act = { type, w, ph: 'go', k: 0, fx: cur.x, fy: cur.y, tx: to[0], ty: to[1], dur: 0.35 + Math.hypot(to[0] - cur.x, to[1] - cur.y) / 520 };
  }
  function step(dt: number) {
    click += dt;
    if (!act) plan();
    const a = act!, w = a.w;
    a.k = Math.min(1, a.k + dt / a.dur);
    const e = ease(a.k), end = a.k >= 1;
    if (a.ph === 'go') {
      cur.x = a.fx + (a.tx - a.fx) * e; cur.y = a.fy + (a.ty - a.fy) * e;
      if (!end) return;
      click = 0; a.k = 0; a.ph = 'do';
      if (a.type === 'open') { wins.push(w); pressI = w.icon; a.dur = 0.42; return; }
      wins.splice(wins.indexOf(w), 1); wins.push(w); // a janela clicada vem para a frente
      if (a.type === 'close') { w.ox = w.x + w.w / 2; w.oy = w.y + w.h / 2; a.dur = 0.3; }
      else {
        a.sx = w.x; a.sy = w.y; a.gx = cur.x - w.x; a.gy = cur.y - w.y;
        let i = 0;
        do place(w); while (Math.hypot(w.x - a.sx, w.y - a.sy) < 70 && ++i < 6);
        a.ex = w.x; a.ey = w.y; w.x = a.sx; w.y = a.sy; a.dur = 0.55 + Math.hypot(a.ex - a.sx, a.ey - a.sy) / 380;
      }
    } else if (a.ph === 'do') {
      if (a.type === 'open') w.a = e;
      else if (a.type === 'close') { w.a = 1 - e; if (end) wins.splice(wins.indexOf(w), 1); }
      else { w.x = a.sx! + (a.ex! - a.sx!) * e; w.y = a.sy! + (a.ey! - a.sy!) * e; cur.x = w.x + a.gx!; cur.y = w.y + a.gy!; }
      if (end) { pressI = -1; a.ph = 'rest'; a.k = 0; a.dur = 0.25 + rnd() * 0.5; }
    } else if (end) act = null;
  }
  const rr = (x: number, y: number, w: number, h: number, r: number) => { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  let am = 1;
  const A = (v: number) => { ctx.globalAlpha = v * am; };
  const bar = (x: number, y: number, w: number, h: number, col: string, a: number) => { ctx.fillStyle = col; A(a); rr(x, y, w, h, h / 2); ctx.fill(); };
  // o miolo de cada janela é só enfeite: texto, imagem, lista, conversa, grade ou formulário em blocos
  function content(w: Win, x: number, y: number, cw: number, ch: number) {
    const k = w.kind;
    if (k === 'text') { bar(x, y, cw * 0.5, 7, hex, 0.95); const ws = [0.95, 0.8, 0.9, 0.55, 0.85, 0.7, 0.4]; for (let i = 0, yy = y + 16; yy + 5 <= y + ch; i++, yy += 11) bar(x, yy, cw * ws[i % ws.length], 5, INK, 0.6); }
    else if (k === 'list') { for (let i = 0, yy = y; yy + 10 <= y + ch; i++, yy += 16) { ctx.fillStyle = hex; A(0.9); ctx.beginPath(); ctx.arc(x + 5, yy + 5, 5, 0, 7); ctx.fill(); bar(x + 16, yy + 2, (cw - 16) * (0.5 + 0.45 * ((i * 0.37 + w.n) % 1)), 6, INK, 0.6); } }
    else if (k === 'image') {
      const ih = ch - 12; ctx.fillStyle = hex; A(0.2); rr(x, y, cw, ih, 5); ctx.fill();
      A(0.9); ctx.beginPath(); ctx.arc(x + cw * 0.76, y + ih * 0.3, Math.min(9, ih * 0.16), 0, 7); ctx.fill();
      A(0.65); ctx.beginPath(); ctx.moveTo(x + 4, y + ih - 2); ctx.lineTo(x + cw * 0.34, y + ih * 0.38); ctx.lineTo(x + cw * 0.56, y + ih * 0.7); ctx.lineTo(x + cw * 0.7, y + ih * 0.52); ctx.lineTo(x + cw - 4, y + ih - 2); ctx.closePath(); ctx.fill();
      bar(x, y + ch - 6, cw * 0.45, 5, INK, 0.6);
    }
    else if (k === 'grid') { const n = 3, g = 6, tw = (cw - g * (n - 1)) / n, th = 26; for (let r = 0; (r + 1) * th + r * g <= ch; r++) for (let i = 0; i < n; i++) { ctx.fillStyle = hex; A(0.28 + 0.22 * ((i + r) % 2)); rr(x + i * (tw + g), y + r * (th + g), tw, th, 4); ctx.fill(); } }
    else if (k === 'chat') { const ws = [0.6, 0.45, 0.7, 0.35, 0.55]; for (let i = 0, yy = y; yy + 12 <= y + ch; i++, yy += 17) { const bw = cw * ws[i % ws.length], me = i % 2; ctx.fillStyle = me ? hex : INK; A(me ? 0.8 : 0.45); rr(me ? x + cw - bw : x, yy, bw, 12, 6); ctx.fill(); } }
    else { for (let yy = y; yy + 20 <= y + ch - 16; yy += 26) { bar(x, yy, cw * 0.3, 4, INK, 0.6); ctx.strokeStyle = hex; ctx.lineWidth = 1.5; A(0.7); rr(x, yy + 8, cw, 12, 4); ctx.stroke(); } ctx.fillStyle = hex; A(0.95); rr(x + cw - 46, y + ch - 13, 46, 13, 6); ctx.fill(); }
  }
  function win(w: Win, front: boolean) {
    const s = ease(Math.max(0, Math.min(1, w.a)));
    if (s <= 0.01) return;
    // abre crescendo a partir do ícone e fecha encolhendo para o próprio centro
    ctx.save(); ctx.translate(w.ox + (w.x - w.ox) * s, w.oy + (w.y - w.oy) * s); ctx.scale(s, s); am = s;
    rr(0, 0, w.w, w.h, 8); ctx.fillStyle = '#040b15'; A(1); ctx.fill(); ctx.fillStyle = hex; A(0.1); ctx.fill();
    ctx.save(); ctx.clip();
    A(front ? 0.42 : 0.2); ctx.fillRect(0, 0, w.w, 18);
    [0.95, 0.6, 0.35].forEach((al, i) => { A(front ? al : al * 0.6); ctx.beginPath(); ctx.arc(11 + i * 11, 9, 3.2, 0, 7); ctx.fill(); });
    bar(48, 6, Math.min(w.w - 60, 30 + w.n * 40), 6, INK, front ? 0.8 : 0.4);
    content(w, 9, 27, w.w - 18, w.h - 36);
    ctx.restore();
    rr(0, 0, w.w, w.h, 8); ctx.strokeStyle = hex; ctx.lineWidth = front ? 2.5 : 1.5; A(front ? 1 : 0.6); ctx.stroke();
    ctx.restore(); am = 1;
  }
  function draw(t: number) {
    const dt = Math.max(0, Math.min(0.25, t - last)); last = t;
    if (dt > 0) step(dt);
    am = 1; ctx.globalAlpha = 1; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = hex; A(0.14); ctx.fillRect(6, 6, W - 12, 16);
    bar(16, 11, 14, 6, hex, 0.95); [[38, 30], [76, 24], [108, 28]].forEach(([x, w]) => bar(x, 11.5, w, 5, INK, 0.5)); bar(W - 58, 11.5, 40, 5, INK, 0.5);
    ctx.fillStyle = hex; A(0.5 + 0.5 * Math.sin(t * 4)); ctx.beginPath(); ctx.arc(W - 70, 14, 3, 0, 7); ctx.fill();
    // dock: o ícone salta quando abre uma janela e ganha um pontinho enquanto ela existe
    ctx.fillStyle = hex; ctx.strokeStyle = hex; A(0.16); rr(W / 2 - 100, DOCK, 200, 26, 9); ctx.fill(); A(0.5); ctx.lineWidth = 1.5; ctx.stroke();
    KINDS.forEach((_k, i) => {
      const z = pressI === i ? 10 : 8, x = iconX(i), y = iconY - (pressI === i ? 3 : 0);
      ctx.fillStyle = hex; A(0.55 + 0.4 * (i % 2)); rr(x - z, y - z, z * 2, z * 2, 5); ctx.fill();
      if (wins.some((w) => w.icon === i)) { ctx.fillStyle = INK; A(0.9); ctx.beginPath(); ctx.arc(x, DOCK + 23, 1.6, 0, 7); ctx.fill(); }
    });
    wins.forEach((w, i) => win(w, i === wins.length - 1));
    if (click < 0.3) { ctx.strokeStyle = hex; ctx.lineWidth = 2; A(1 - click / 0.3); ctx.beginPath(); ctx.arc(cur.x, cur.y, 4 + click * 50, 0, 7); ctx.stroke(); }
    ctx.save(); ctx.translate(cur.x, cur.y); ctx.scale(1.3, 1.3); A(1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.lineTo(4, 11.5); ctx.lineTo(6.8, 17.5); ctx.lineTo(9.3, 16.3); ctx.lineTo(6.6, 10.6); ctx.lineTo(11.5, 10.6); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = BG; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    ctx.fillStyle = hex; ctx.strokeStyle = hex;
    ctx.globalAlpha = 0.1; ctx.fillRect(0, (t * 60) % H, W, 4);
    ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.strokeRect(4, 4, W - 8, H - 8);
    const cl = 40; ctx.lineWidth = 8;
    [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * cl); ctx.lineTo(x, y); ctx.lineTo(x + sx * cl, y); ctx.stroke(); });
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw };
}
