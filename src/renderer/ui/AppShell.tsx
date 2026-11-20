// Casca do app: barra superior, lista de bots fixa à esquerda, cena 3D no centro (#stage),
// painel de conversas fixo à direita (uma aba por bot + Atividade) e barra de status.
// Estado de layout no slice `ui` (uiSlice.ts); dados da sala continuam em store.ts.

import type { CSSProperties, PointerEvent as RPointerEvent, ReactNode, RefObject } from 'react';
import { t } from '../i18n';
import { useUI } from '../store';
import { ACTIVITY, LIST_DEFAULT, useLayout } from '../uiSlice';
import { ChatWindow } from './ChatWindow';
import { Timeline } from './Panels';

function TopBar() {
  const open = useLayout((s) => s.panelOpen);
  const toggle = useLayout((s) => s.togglePanel);
  return (
    <header id="topbar">
      <span>{t('title')}</span>
      <span className="sp" />
      <button className={open ? 'on' : ''} aria-pressed={open} onClick={toggle}>Conversas</button>
    </header>
  );
}

function ListGrip() {
  const setW = useLayout((s) => s.setListWidth);
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const x0 = e.clientX, w0 = useLayout.getState().listWidth;
    el.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => setW(w0 + ev.clientX - x0);
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  return <div className="listgrip" role="separator" aria-orientation="vertical" aria-label="Largura da lista" onPointerDown={down} onDoubleClick={() => setW(LIST_DEFAULT)} />;
}

function ConvPanel() {
  const open = useLayout((s) => s.panelOpen);
  const tabs = useLayout((s) => s.tabs);
  const active = useLayout((s) => s.activeTab);
  const setActiveTab = useLayout((s) => s.setActiveTab);
  const closeTab = useLayout((s) => s.closeTab);
  const agents = useUI((s) => s.room.agents);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const current = active === ACTIVITY ? null : byId.get(active) ?? null;
  return (
    <aside id="convpanel" className="glass" hidden={!open}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={!current} className={!current ? 'on' : ''} onClick={() => setActiveTab(ACTIVITY)}>Atividade</button>
        {tabs.map((id) => {
          const a = byId.get(id);
          if (!a) return null;
          return (
            <span key={id} className={'tab' + (current?.id === id ? ' on' : '')}>
              <button role="tab" aria-selected={current?.id === id} onClick={() => setActiveTab(id)}>{a.name}</button>
              <button className="tx" title={t('close')} onClick={() => closeTab(id)}>✕</button>
            </span>
          );
        })}
      </div>
      <div className="tabbody">{current ? <ChatWindow key={current.id} a={current} /> : <Timeline />}</div>
    </aside>
  );
}

function StatusBar() {
  const link = useUI((s) => s.link);
  const bots = useUI((s) => s.room.agents.length);
  const conns = useUI((s) => s.room.connectors);
  const online = conns.filter((c) => c.state === 'online').length;
  return (
    <footer id="statusbar">
      <span className={link ? '' : 'off'}>{link ? t('live') : t('offline')}</span>
      <span>{bots} bots</span>
      <span>{online}/{conns.length} conexões</span>
    </footer>
  );
}

export function AppShell({ stageRef, list, children, overlays }: {
  /** contêiner da cena: o motor observa o tamanho dele (ResizeObserver) */
  stageRef: RefObject<HTMLDivElement | null>;
  list: ReactNode;
  /** o que fica dentro da área da cena (rótulos e sobreposições que ainda flutuam) */
  children: ReactNode;
  /** sobreposições da janela toda (modais, menus, aviso, véu) */
  overlays: ReactNode;
}) {
  const listWidth = useLayout((s) => s.listWidth);
  const showList = useUI((s) => s.prefs.roster);
  return (
    <div id="app" className="shell" style={{ '--list-w': showList ? listWidth + 'px' : '0px' } as CSSProperties}>
      <TopBar />
      <aside id="botlist" hidden={!showList}>{list}<ListGrip /></aside>
      <main id="stage" ref={stageRef}>{children}</main>
      <ConvPanel />
      <StatusBar />
      {overlays}
    </div>
  );
}
