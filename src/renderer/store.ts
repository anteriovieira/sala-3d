// Estado da interface (zustand): dados da sala e preferências guardadas.
// Layout da casca (painel, abas, largura da lista) fica no slice `ui` (uiSlice.ts).
// Posições, caminhadas e rostos NÃO ficam aqui: são do motor 3D.

import { create } from 'zustand';
import type { DeptLayout, DeptMode } from '@shared/layout';
import type { AgentId, ChatItem, RoomState } from '@shared/types';
import { useLayout } from './uiSlice';

export interface Prefs {
  depts: boolean;
  roster: boolean;
  names: boolean;
  bubbles: boolean;
  screens: boolean;
  skins: boolean;
  zone: boolean;
  legend: boolean;
  rotate: boolean;
  open: boolean;
  timeline: boolean;
  tlOpen: boolean;
  sound: boolean;
  size: number;
  speed: number;
  theme: number;
  deptMode: DeptMode;
  sign: string;
  thirdParty: boolean;
  timeZone: string;
  platform: string | null;
  /** skin por agente (id estável): nome da skin ou 'none' */
  skinOf: Record<AgentId, string>;
  cam: { p: number[]; t: number[] } | null;
}

export const DEFAULT_PREFS: Prefs = {
  depts: true, roster: true, names: true, bubbles: true, screens: true, skins: false, zone: true, legend: true,
  rotate: true, open: true, timeline: true, tlOpen: true, sound: false, size: 1, speed: 0, theme: 0,
  deptMode: 'separate', sign: 'SALA 3D', thirdParty: true, timeZone: '', platform: null, skinOf: {}, cam: null,
};

const KEY = 'sala.prefs';
function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULT_PREFS, ...(raw.cfg ?? raw), skinOf: { ...(raw.cfg?.skinOf ?? raw.skinOf ?? {}) }, cam: raw.cam ?? null };
  } catch { /* ignora */ }
  return { ...DEFAULT_PREFS };
}
export function savePrefs(p: Prefs) {
  try {
    const { cam, ...cfg } = p;
    localStorage.setItem(KEY, JSON.stringify({ cfg, cam }));
  } catch { /* ignora */ }
}

export type Compose =
  | { kind: 'dept'; deptKey: string | null }
  | { kind: 'group'; deptKey: string; groupId: string | null };

export interface UIState {
  room: RoomState;
  link: boolean;
  prefs: Prefs;
  compose: Compose | null;
  pending: Record<AgentId, ChatItem[]>;
  skinMenu: { agentId: AgentId; top: number } | null;
  active: AgentId | null;
  connectionsOpen: boolean;
  toast: string | null;
  depts: DeptLayout[];
  setDepts(d: DeptLayout[]): void;
  setRoom(s: RoomState): void;
  setLink(ok: boolean): void;
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void;
  openWindow(id: AgentId): void;
  closeWindow(id: AgentId): void;
  raiseWindow(id: AgentId): void;
  setCompose(c: Compose | null): void;
  addPending(id: AgentId, text: string): void;
  setSkinMenu(m: UIState['skinMenu']): void;
  setActive(id: AgentId | null): void;
  setConnectionsOpen(v: boolean): void;
  showToast(msg: string | null): void;
}

const flat = (x: string) => String(x).replace(/[*`#]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

export const useUI = create<UIState>((set, get) => ({
  room: { at: 0, agents: [], groups: [], events: [], connectors: [] },
  link: false,
  prefs: loadPrefs(),
  compose: null,
  pending: {},
  skinMenu: null,
  active: null,
  connectionsOpen: false,
  toast: null,
  depts: [],
  setDepts: (depts) => set({ depts }),
  setRoom: (room) => {
    // mensagens otimistas: mantidas até a plataforma confirmar (até 90 s)
    const now = Date.now();
    const pending: Record<AgentId, ChatItem[]> = {};
    for (const [id, list] of Object.entries(get().pending)) {
      const a = room.agents.find((x) => x.id === id);
      const keep = list.filter((p) => now - p.at < 90_000 && !(a?.chat ?? []).some((m) => m.r === 'u' && m.at > p.at - 5000 && flat(m.t) === flat(p.t)));
      if (keep.length) pending[id] = keep;
    }
    const ids = new Set(room.agents.map((a) => a.id));
    set({ room, pending });
    useLayout.getState().keepTabs(ids);
  },
  setLink: (link) => set({ link }),
  setPref: (k, v) => {
    const prefs = { ...get().prefs, [k]: v };
    set({ prefs });
    savePrefs(prefs);
  },
  // conversas viraram abas do painel (slice `ui`); os nomes ficam para o motor e as ações
  openWindow: (id) => useLayout.getState().openTab(id),
  closeWindow: (id) => useLayout.getState().closeTab(id),
  raiseWindow: (id) => useLayout.getState().setActiveTab(id),
  setCompose: (compose) => set({ compose }),
  addPending: (id, text) => set({ pending: { ...get().pending, [id]: [...(get().pending[id] ?? []), { r: 'u', t: text, at: Date.now() }] } }),
  setSkinMenu: (skinMenu) => set({ skinMenu }),
  setActive: (active) => set({ active }),
  setConnectionsOpen: (connectionsOpen) => set({ connectionsOpen }),
  showToast: (toast) => set({ toast }),
}));
