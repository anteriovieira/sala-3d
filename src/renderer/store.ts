// Estado da interface (zustand): dados da sala, preferências guardadas, janelas abertas.
// Posições, caminhadas e rostos NÃO ficam aqui: são do motor 3D.

import { create } from 'zustand';
import type { DeptLayout, DeptMode } from '@shared/layout';
import type { AgentId, ChatItem, RoomState } from '@shared/types';

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

/** Painéis da barra lateral: abrem ao lado dela, um de cada vez; nenhum aberto ao iniciar. */
export type PanelId = 'legend' | 'roster' | 'timeline' | 'settings' | 'connections';

export type Compose =
  | { kind: 'dept'; deptKey: string | null }
  | { kind: 'group'; deptKey: string; groupId: string | null };

export interface UIState {
  room: RoomState;
  link: boolean;
  prefs: Prefs;
  windows: AgentId[];
  compose: Compose | null;
  pending: Record<AgentId, ChatItem[]>;
  skinMenu: { agentId: AgentId; top: number } | null;
  active: AgentId | null;
  /** painel aberto ao lado da barra lateral (não é guardado: o app sempre começa com todos fechados) */
  panel: PanelId | null;
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
  /** abre o painel (fechando o que estiver aberto) ou fecha se já for ele */
  togglePanel(p: PanelId): void;
  setPanel(p: PanelId | null): void;
  showToast(msg: string | null): void;
}

const flat = (x: string) => String(x).replace(/[*`#]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

export const useUI = create<UIState>((set, get) => ({
  room: { at: 0, agents: [], groups: [], events: [], connectors: [] },
  link: false,
  prefs: loadPrefs(),
  windows: [],
  compose: null,
  pending: {},
  skinMenu: null,
  active: null,
  panel: null,
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
    set({ room, pending, windows: get().windows.filter((w) => ids.has(w)) });
  },
  setLink: (link) => set({ link }),
  setPref: (k, v) => {
    const prefs = { ...get().prefs, [k]: v };
    set({ prefs });
    savePrefs(prefs);
  },
  openWindow: (id) => set({ windows: [...get().windows.filter((w) => w !== id), id] }),
  closeWindow: (id) => set({ windows: get().windows.filter((w) => w !== id) }),
  raiseWindow: (id) => {
    const w = get().windows;
    if (w[w.length - 1] !== id) set({ windows: [...w.filter((x) => x !== id), id] });
  },
  setCompose: (compose) => set({ compose }),
  addPending: (id, text) => set({ pending: { ...get().pending, [id]: [...(get().pending[id] ?? []), { r: 'u', t: text, at: Date.now() }] } }),
  setSkinMenu: (skinMenu) => set({ skinMenu }),
  setActive: (active) => set({ active }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p }),
  setPanel: (panel) => set({ panel }),
  showToast: (toast) => set({ toast }),
}));
