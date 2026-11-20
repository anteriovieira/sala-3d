import { useEffect, useRef, useState } from 'react';
import { RoomEngine } from './engine/engine';
import { setTimeZone } from './i18n';
import { setDisabledPacks } from './skins/registry';
import { useUI } from './store';
import { subscribeState } from './transport';
import { getEngine, setEngine } from './ui/actions';
import { ChatWindow } from './ui/ChatWindow';
import { ComposeBox } from './ui/ComposeBox';
import { Connections } from './ui/Connections';
import { canFull, Hud, Rail, Settings, Timeline, Toast, toggleFull } from './ui/Panels';
import { Roster } from './ui/Roster';
import { SkinMenu } from './ui/SkinMenu';

export function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const prefs = useUI((s) => s.prefs);
  const room = useUI((s) => s.room);
  const windows = useUI((s) => s.windows);

  // motor 3D: criado uma vez, fora do ciclo do React
  useEffect(() => {
    const ui = useUI.getState();
    setDisabledPacks(ui.prefs.thirdParty ? [] : ['terceiros']);
    setTimeZone(ui.prefs.timeZone);
    const e = new RoomEngine(appRef.current!, labelsRef.current!, {
      openAgent: (id) => useUI.getState().openWindow(id),
      openTable: (key) => {
        const s = useUI.getState();
        const D = s.depts.find((d) => d.key === key);
        // mesa sem grupo: cai no envio para o departamento
        if (!D || !D.groups.length) s.setCompose({ kind: 'dept', deptKey: key });
        else s.setCompose({ kind: 'group', deptKey: key, groupId: D.groups[0] });
      },
      activeChanged: (id) => useUI.getState().setActive(id),
      cameraChanged: (cam) => useUI.getState().setPref('cam', cam),
      rotateStopped: () => useUI.getState().setPref('rotate', false),
      layoutChanged: (d) => useUI.getState().setDepts(d),
      ready: () => setReady(true),
    }, ui.prefs);
    setEngine(e);
    // medidas para o teste de fumaça (sem dados de conversa)
    (window as unknown as { __salaDebug: () => unknown }).__salaDebug = () => ({ min: e.minDistance(), agents: useUI.getState().room.agents.length });
    const off = subscribeState((s) => { useUI.getState().setRoom(s); e.setRoom(s); }, (ok) => useUI.getState().setLink(ok));
    return () => { off(); e.dispose(); setEngine(null); };
  }, []);

  useEffect(() => {
    setDisabledPacks(prefs.thirdParty ? [] : ['terceiros']);
    setTimeZone(prefs.timeZone);
    getEngine()?.setPrefs(prefs);
    document.body.classList.toggle('light', prefs.theme === 1);
  }, [prefs]);

  // tecla F: tela cheia
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || '';
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && !/^(TEXTAREA|INPUT|SELECT)$/.test(tag) && canFull()) toggleFull();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const agentById = new Map(room.agents.map((a) => [a.id, a]));
  return (
    <div id="app" ref={appRef}>
      <div id="labels" ref={labelsRef} />
      <Rail />
      <div id="leftcol">
        <Hud />
        <Settings />
      </div>
      <Roster />
      <Timeline />
      {windows.map((id, i) => {
        const a = agentById.get(id);
        return a ? <ChatWindow key={id} a={a} index={i} z={21 + i} /> : null;
      })}
      <SkinMenu />
      <ComposeBox />
      <Connections />
      <Toast />
      <div id="veil" style={{ opacity: ready ? 0 : 1 }} />
    </div>
  );
}
