import { describe, expect, it } from 'vitest';
import { computeLayout, computeMeetings, dockSlot, HALF_W, zoneSlot, type LayoutAgent } from '../src/shared/layout';

const mk = (n: number, depts = ['A', 'B', 'C'], con = 'demo'): LayoutAgent[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${con}:a${i}`, connectorId: con, department: depts[i % depts.length], chief: i < depts.length, slot: i }));

describe('layout', () => {
  it('é determinístico', () => {
    const a = computeLayout(mk(12));
    const b = computeLayout(mk(12));
    expect([...a.spots.entries()]).toEqual([...b.spots.entries()]);
  });
  it('faixas cabem na área útil, proporcionais a bots + 3', () => {
    const L = computeLayout(mk(10, ['A', 'B']));
    expect(L.depts[0].x0).toBeCloseTo(-HALF_W);
    expect(L.depts[L.depts.length - 1].x1).toBeCloseTo(HALF_W);
    const w = L.depts.map((d) => d.x1 - d.x0);
    expect(w[0] / w[1]).toBeCloseTo((5 + 3) / (5 + 3));
  });
  it('lugares ficam dentro do próprio departamento e afastados', () => {
    const L = computeLayout(mk(20, ['A', 'B', 'C', 'D']));
    for (const [id, p] of L.spots) {
      const D = L.depts.find((d) => d.key === L.deptOf.get(id))!;
      expect(p.x).toBeGreaterThanOrEqual(D.x0);
      expect(p.x).toBeLessThanOrEqual(D.x1);
    }
    const pts = [...L.spots.values()];
    let minD = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) minD = Math.min(minD, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
    expect(minD).toBeGreaterThan(0.8);
  });
  it('nomes iguais em plataformas diferentes: separa por padrão, junta se pedido', () => {
    const agents = [...mk(3, ['Vendas'], 'p1'), ...mk(3, ['Vendas'], 'p2')];
    expect(computeLayout(agents).depts.length).toBe(2);
    expect(computeLayout(agents, { mode: 'merge' }).depts.length).toBe(1);
  });
  it('reunião vai para a mesa do departamento com mais membros, chefe primeiro', () => {
    const agents = mk(6, ['A', 'B']);
    const L = computeLayout(agents);
    const ms = computeMeetings([{ id: 'g', connectorId: 'demo', name: 'G', members: ['demo:a2', 'demo:a4', 'demo:a1', 'demo:a0'], active: true }], L, agents.map((a) => ({ id: a.id, chief: a.chief })));
    expect(ms).toHaveLength(1);
    expect(ms[0].dept).toBe('A');
    expect(agents.find((a) => a.id === ms[0].members[0])!.chief).toBe(true);
  });
  it('área de espera em fileiras de 6', () => {
    expect(zoneSlot(0, 1).x).toBeCloseTo(0);
    expect(zoneSlot(6, 7).z).toBeLessThan(zoneSlot(0, 7).z);
  });
  it('arena cresce com muitos agentes e a recarga cabe no piso', () => {
    const small = computeLayout(mk(8, ['A', 'B']));
    expect(small.dims.scale).toBe(1);
    const L = computeLayout(mk(40, ['A', 'B', 'C', 'D', 'E', 'F', 'G']));
    const d = L.dims;
    expect(d.halfW).toBeGreaterThan(HALF_W);
    expect(d.scale).toBeGreaterThan(1);
    for (let k = 0; k < 40; k++) {
      const p = dockSlot(k, d);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(d.roomW / 2);
      expect(p.z).toBeGreaterThan(d.cz - d.roomD / 2);
    }
    for (const p of L.spots.values()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(d.halfW);
      expect(p.z).toBeGreaterThan(d.cz - d.roomD / 2);
    }
    // cada faixa tem pelo menos ~2,2 de largura
    for (const D of L.depts) expect(D.x1 - D.x0).toBeGreaterThan(2.2);
  });
});
