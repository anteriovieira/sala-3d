// A skin é desenhada com o rosto no centro da textura; com offset 0,5 + correção, o centro cai na frente do bot (+z).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyUShift, GEO } from '../src/renderer/engine/geometry';

const fract = (x: number) => ((x % 1) + 1) % 1;

/** u da textura (já com offset) que aparece no ponto do anel mais largo mais próximo do ângulo pedido. */
function texelAt(g: THREE.BufferGeometry, angle: number, offset: number): number {
  const pos = g.attributes.position, uv = g.attributes.uv;
  let best = 0, bestScore = Infinity;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k), r = Math.hypot(x, z);
    const d = Math.abs(Math.atan2(Math.sin(Math.atan2(x, z) - angle), Math.cos(Math.atan2(x, z) - angle)));
    const score = d - r; // anel mais largo, ângulo mais próximo
    if (score < bestScore) { bestScore = score; best = k; }
  }
  return fract(uv.getX(best) + offset);
}

describe('skin no corpo do bot', () => {
  it('rosto da skin (centro da textura) fica na frente do bot', () => {
    const off = 0.5 + bodyUShift(GEO.body);
    expect(texelAt(GEO.body, 0, off)).toBeCloseTo(0.5, 1);
    // e as costas mostram a borda da textura
    expect(Math.min(texelAt(GEO.body, Math.PI, off), 1 - texelAt(GEO.body, Math.PI, off))).toBeLessThan(0.05);
  });

  it('na geometria antiga (torno, como no three r160) não há correção', () => {
    const pts = Array.from({ length: 9 }, (_, i) => new THREE.Vector2(0.3 * Math.sin((i / 8) * Math.PI), -Math.cos((i / 8) * Math.PI) * 0.3));
    expect(bodyUShift(new THREE.LatheGeometry(pts, 32))).toBe(0);
  });
});
