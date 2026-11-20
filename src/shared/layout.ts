// Layout da sala como função pura de (agentes, departamentos, semente).
// Refeito ao vivo quando entra/sai um agente, departamento ou grupo: os bots andam até os novos lugares.

import type { Agent, AgentId, Group } from './types';

export const ROOM_W = 22;
export const ROOM_D = 16;
export const HALF_W = 9.3;
export const HALF_D = 6.3;
export const DEPT_Z0 = -6.2;
export const DEPT_Z1 = 3.7;
export const TABLE_Z = 2.1;
export const TABLE_R = 0.62;
export const SEAT_R = 1.15;
export const ZONE = { x: 0, z: 6.3, w: 7.6, d: 2.0 };
export const DOCK = { x0: -10.15, z: -7.2, step: 0.9 };
export const LAYOUT_SEED = 20261112;
export const DEPT_COLORS = [0x8fd0ff, 0xa56bff, 0x3ecf6e, 0xff9233, 0xff6fae, 0x1fc8b4, 0xffd23f, 0xff4d4d];

export type DeptMode = 'separate' | 'merge';

export interface LayoutAgent {
  id: AgentId;
  connectorId: string;
  department: string;
  chief: boolean;
  slot: number;
}

export interface DeptLayout {
  key: string;
  name: string;
  color: number;
  x0: number;
  x1: number;
  tx: number;
  tz: number;
  members: AgentId[];
  /** grupos cuja maioria dos membros é deste departamento */
  groups: string[];
}

export interface RoomLayout {
  depts: DeptLayout[];
  deptOf: Map<AgentId, string>;
  spots: Map<AgentId, { x: number; z: number }>;
  order: AgentId[];
}

/** Gerador da referência (mulberry32 com semente fixa): mesma entrada, mesmos lugares. */
export function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nome da faixa do agente: com nomes iguais em plataformas diferentes, separa por plataforma (padrão) ou junta. */
export function departmentKeys(agents: LayoutAgent[], mode: DeptMode, connectorLabel: (id: string) => string): Map<AgentId, { key: string; name: string }> {
  const owners = new Map<string, Set<string>>();
  for (const a of agents) {
    const n = a.department || 'Geral';
    if (!owners.has(n)) owners.set(n, new Set());
    owners.get(n)!.add(a.connectorId);
  }
  const out = new Map<AgentId, { key: string; name: string }>();
  for (const a of agents) {
    const n = a.department || 'Geral';
    const clash = (owners.get(n)?.size ?? 0) > 1;
    if (mode === 'separate' && clash) out.set(a.id, { key: a.connectorId + '\u0000' + n, name: n + ' · ' + connectorLabel(a.connectorId) });
    else out.set(a.id, { key: n, name: n });
  }
  return out;
}

export function computeLayout(
  agents: LayoutAgent[],
  opts: { mode?: DeptMode; order?: string[]; connectorOrder?: string[]; connectorLabel?: (id: string) => string; seed?: number; groups?: Pick<Group, 'id' | 'members'>[] } = {},
): RoomLayout {
  const mode = opts.mode ?? 'separate';
  const label = opts.connectorLabel ?? ((id: string) => id);
  const keys = departmentKeys(agents, mode, label);
  const order = opts.order ?? [];
  const conOrder = opts.connectorOrder ?? [];
  // ordem das faixas: a ordem informada pelas plataformas, depois as outras em ordem alfabética
  const rank = (a: LayoutAgent) => {
    const name = a.department || 'Geral';
    const i = order.indexOf(name);
    return i >= 0 ? i : order.length;
  };
  const sorted = agents.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const na = keys.get(a.id)!.name, nb = keys.get(b.id)!.name;
    if (ra === order.length && na !== nb) return na.localeCompare(nb);
    const ca = conOrder.indexOf(a.connectorId), cb = conOrder.indexOf(b.connectorId);
    if (ca !== cb) return ca - cb;
    if (a.chief !== b.chief) return a.chief ? -1 : 1;
    return a.slot - b.slot;
  });
  const depts: DeptLayout[] = [];
  const deptOf = new Map<AgentId, string>();
  for (const a of sorted) {
    const k = keys.get(a.id)!;
    let D = depts.find((d) => d.key === k.key);
    if (!D) {
      D = { key: k.key, name: k.name, color: DEPT_COLORS[depts.length % DEPT_COLORS.length], x0: 0, x1: 0, tx: 0, tz: TABLE_Z, members: [], groups: [] };
      depts.push(D);
    }
    D.members.push(a.id);
    deptOf.set(a.id, D.key);
  }
  // largura de cada faixa proporcional a nº de bots + 3; espaço de 0.5 entre elas
  const gap = 0.5;
  const wt = (D: DeptLayout) => D.members.length + 3;
  const tot = depts.reduce((s, D) => s + wt(D), 0) || 1;
  const avail = 2 * HALF_W - gap * Math.max(0, depts.length - 1);
  let x = -HALF_W;
  for (const D of depts) {
    D.x0 = x;
    D.x1 = x + (avail * wt(D)) / tot;
    D.tx = (D.x0 + D.x1) / 2;
    x = D.x1 + gap;
  }
  // lugar de cada bot: sorteio com semente fixa, distância mínima 2.6
  const rng = makeRng(opts.seed ?? LAYOUT_SEED);
  const rand = (a: number, b: number) => a + rng() * (b - a);
  const spots = new Map<AgentId, { x: number; z: number }>();
  const pts: { x: number; z: number }[] = [];
  for (const a of sorted) {
    const D = depts.find((d) => d.key === deptOf.get(a.id))!;
    let p: { x: number; z: number };
    let tries = 0;
    let minD = 2.6;
    const mx = Math.min(0.9, (D.x1 - D.x0) * 0.25);
    do {
      p = { x: rand(D.x0 + mx, D.x1 - mx), z: rand(DEPT_Z0 + 1.0, DEPT_Z1 - 3.1) };
      tries++;
      if (tries % 150 === 0) minD *= 0.9;
    } while (pts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < minD) && tries < 3000);
    pts.push(p);
    spots.set(a.id, p);
  }
  for (const g of opts.groups ?? []) {
    const D = groupDept(g.members, depts, deptOf);
    if (D) D.groups.push(g.id);
  }
  return { depts, deptOf, spots, order: sorted.map((a) => a.id) };
}

/** Departamento com mais membros do grupo (empate: o primeiro na ordem das faixas). */
export function groupDept(members: AgentId[], depts: DeptLayout[], deptOf: Map<AgentId, string>): DeptLayout | undefined {
  const cnt = new Map<string, number>();
  for (const m of members) {
    const k = deptOf.get(m);
    if (k) cnt.set(k, (cnt.get(k) ?? 0) + 1);
  }
  let best: DeptLayout | undefined;
  let bestN = -1;
  for (const D of depts) {
    const n = cnt.get(D.key) ?? 0;
    if (n > bestN) {
      best = D;
      bestN = n;
    }
  }
  return best;
}

export interface Meeting {
  groupId: string;
  members: AgentId[];
  x: number;
  z: number;
  dept: string;
}

/** Grupos com conversa ativa: membros vão à mesa do departamento com mais membros do grupo, chefe primeiro. */
export function computeMeetings(groups: Group[], layout: RoomLayout, agents: Pick<Agent, 'id' | 'chief'>[]): Meeting[] {
  const chief = new Map(agents.map((a) => [a.id, a.chief]));
  const out: Meeting[] = [];
  for (const g of groups) {
    if (!g.active) continue;
    const ms = g.members.filter((m) => layout.deptOf.has(m)).sort((a, b) => Number(!!chief.get(b)) - Number(!!chief.get(a)));
    if (ms.length < 2) continue;
    const D = groupDept(g.members, layout.depts, layout.deptOf);
    if (!D) continue;
    out.push({ groupId: g.id, members: ms, x: D.tx, z: D.tz, dept: D.key });
  }
  return out;
}

/** Vaga k (de n) na área "Aguardando você": fileiras de 6, espaçadas 1.15. */
export function zoneSlot(k: number, n: number): { x: number; z: number } {
  const perRow = 6;
  const row = Math.floor(k / perRow);
  const inRow = Math.min(perRow, n - row * perRow);
  const col = k % perRow;
  return { x: ZONE.x + (col - (inRow - 1) / 2) * 1.15, z: ZONE.z + 0.25 - row * 0.95 };
}

export function dockSlot(k: number): { x: number; z: number } {
  return { x: DOCK.x0 + k * DOCK.step, z: DOCK.z };
}

export function seatAt(m: { x: number; z: number }, k: number, n: number): { x: number; z: number; yaw: number } {
  const a = (k / n) * Math.PI * 2;
  return { x: m.x + Math.sin(a) * SEAT_R, z: m.z + Math.cos(a) * SEAT_R, yaw: a + Math.PI };
}
