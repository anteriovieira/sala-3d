// Slice `ui`: estado de layout da casca (AppShell): painel de conversas, abas e largura da lista.
// Fica separado de store.ts (dados da sala e preferências) e não guarda nada entre sessões.

import { create } from 'zustand';
import { createStore, type StateCreator } from 'zustand/vanilla';
import type { AgentId } from '@shared/types';

export const ACTIVITY = 'activity' as const;
export type TabId = AgentId | typeof ACTIVITY;

export const LIST_MIN = 200;
export const LIST_MAX = 420;
export const LIST_DEFAULT = 268;
export const clampList = (w: number) => (Number.isFinite(w) ? Math.round(Math.min(LIST_MAX, Math.max(LIST_MIN, w))) : LIST_DEFAULT);

export interface UiLayout {
  panelOpen: boolean;
  /** uma aba por bot, na ordem em que foram abertas */
  tabs: AgentId[];
  activeTab: TabId;
  listWidth: number;
  setPanelOpen(v: boolean): void;
  togglePanel(): void;
  openTab(id: AgentId): void;
  closeTab(id: AgentId): void;
  setActiveTab(tab: TabId): void;
  setListWidth(w: number): void;
  /** tira as abas de bots que saíram da sala */
  keepTabs(ids: ReadonlySet<AgentId>): void;
}

export const uiSlice: StateCreator<UiLayout> = (set, get) => ({
  panelOpen: true,
  tabs: [],
  activeTab: ACTIVITY,
  listWidth: LIST_DEFAULT,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set({ panelOpen: !get().panelOpen }),
  openTab: (id) => {
    const { tabs } = get();
    set({ tabs: tabs.includes(id) ? tabs : [...tabs, id], activeTab: id, panelOpen: true });
  },
  closeTab: (id) => {
    const { tabs, activeTab } = get();
    const i = tabs.indexOf(id);
    if (i < 0) return;
    const next = tabs.filter((x) => x !== id);
    set({ tabs: next, activeTab: activeTab === id ? next[Math.min(i, next.length - 1)] ?? ACTIVITY : activeTab });
  },
  setActiveTab: (tab) => {
    if (tab === ACTIVITY || get().tabs.includes(tab)) set({ activeTab: tab, panelOpen: true });
  },
  setListWidth: (w) => set({ listWidth: clampList(w) }),
  keepTabs: (ids) => {
    const { tabs, activeTab } = get();
    const next = tabs.filter((x) => ids.has(x));
    if (next.length === tabs.length) return;
    set({ tabs: next, activeTab: activeTab !== ACTIVITY && !ids.has(activeTab) ? next[next.length - 1] ?? ACTIVITY : activeTab });
  },
});

/** store isolado (testes) */
export const createUiStore = () => createStore<UiLayout>()(uiSlice);
/** store do app */
export const useLayout = create<UiLayout>()(uiSlice);
