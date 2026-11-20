// Formas compartilhadas por todos os bots (criadas uma vez).

import * as THREE from 'three';

/** Tela legível dos dois lados: o verso repete os triângulos ao contrário, com a imagem espelhada. */
function bothSides(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const a = g.toNonIndexed();
  const P = a.attributes.position.array as Float32Array, U = a.attributes.uv.array as Float32Array, n = P.length / 3;
  const P2 = new Float32Array(P.length * 2), U2 = new Float32Array(U.length * 2);
  P2.set(P); U2.set(U);
  for (let v = 0; v < n; v++) {
    const k = v % 3, src = k === 0 ? v : k === 1 ? v + 1 : v - 1, d = n + v;
    P2.set(P.subarray(src * 3, src * 3 + 3), d * 3); U2[d * 2] = 1 - U[src * 2]; U2[d * 2 + 1] = U[src * 2 + 1];
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  o.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
  return o;
}

function footGeometry() {
  // placa em forma de lente curvada sobre uma esfera de raio RC (pé em meia-lua)
  const g = new THREE.SphereGeometry(1, 40, 20), p = g.attributes.position, RC = 0.44;
  for (let k = 0; k < p.count; k++) {
    const a = (p.getX(k) * 0.175) / RC, c = (p.getY(k) * 0.135) / RC, n = RC + p.getZ(k) * 0.017;
    p.setXYZ(k, n * Math.sin(a) * Math.cos(c), n * Math.sin(c), n * Math.cos(a) * Math.cos(c) - RC);
  }
  g.computeVertexNormals();
  return g;
}

function bodyGeometry() {
  const g = new THREE.CapsuleGeometry(0.3, 0.27, 12, 32);
  // v do corpo pela distância ao longo da curva, para a skin não esticar
  const pos = g.attributes.position, uv = g.attributes.uv, R = 0.3, HH = 0.135, L = Math.PI * R + 2 * HH;
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k);
    let sLen: number;
    if (y > HH) sLen = (Math.PI * R) / 2 + 2 * HH + Math.asin(Math.min(1, (y - HH) / R)) * R;
    else if (y < -HH) sLen = (Math.PI * R) / 2 - Math.asin(Math.min(1, (-HH - y) / R)) * R;
    else sLen = (Math.PI * R) / 2 + (y + HH);
    uv.setY(k, sLen / L);
  }
  uv.needsUpdate = true;
  return g;
}

/** Coroa dourada de peça única, 5 pontas. */
function crownGeometry() {
  const N = 100, M = 6, pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= M; j++) for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2, v = j / M, H = 0.05 + 0.07 * (1 - Math.abs(Math.sin(2.5 * a))), r = 0.09 + 0.3 * v * H;
    pos.push(Math.sin(a) * r, v * H, Math.cos(a) * r);
  }
  for (let j = 0; j < M; j++) for (let k = 0; k < N; k++) { const p0 = j * (N + 1) + k, p1 = p0 + 1, p2 = p0 + N + 1, p3 = p2 + 1; idx.push(p0, p1, p2, p1, p3, p2); }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setIndex(idx);
  cg.computeVertexNormals();
  return cg;
}

export const GEO = {
  body: bodyGeometry(),
  eye: new THREE.CapsuleGeometry(0.034, 0.045, 6, 16),
  arcEye: new THREE.TorusGeometry(0.032, 0.009, 8, 20, 2.2),
  mouthLine: new THREE.CapsuleGeometry(0.009, 0.062, 4, 10),
  mouthSmile: new THREE.TorusGeometry(0.042, 0.009, 8, 20, 1.9),
  mouthO: new THREE.SphereGeometry(0.024, 16, 12),
  arm: new THREE.CapsuleGeometry(0.06, 0.23, 8, 18),
  foot: footGeometry(),
  console: bothSides(new THREE.CylinderGeometry(0.85, 0.85, 0.6, 32, 1, true, -0.62, 1.24).translate(0, 0, -0.85)),
  ring: new THREE.RingGeometry(0.43, 0.5, 48),
  crown: crownGeometry(),
  crownRim: new THREE.TorusGeometry(0.093, 0.015, 12, 40),
};

export const GOLD = new THREE.MeshStandardMaterial({ color: 0xffc531, emissive: 0xb87a00, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.38, side: THREE.DoubleSide });

/** Texto nítido por textura de canvas (letreiro, rótulos do piso). */
export function crispText(text: string, color: string, maxAniso = 8): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.font = '600 150px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px'; } catch { /* antigo */ }
  // encolhe textos longos para caber
  const w = ctx.measureText(text).width;
  if (w > 1980) ctx.font = `600 ${Math.floor((150 * 1980) / w)}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(text, 1024, 134);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}
