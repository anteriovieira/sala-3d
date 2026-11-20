// Barra lateral de ícones e os painéis que ela abre (legenda, ajustes, linha do tempo).
// Todos começam fechados; cada botão abre o seu painel ao lado da barra e fecha o que estiver aberto.

import { useEffect, useState } from 'react';
import { hm, hms, t } from '../i18n';
import { STATUS_COLOR } from '../engine/bot';
import { css } from '../avatar';
import { inApp } from '../transport';
import { useUI, type PanelId, type Prefs } from '../store';
import { getEngine } from './actions';
import { IconAll, IconFull, IconLegend, IconPlug, IconRoster, IconSettings, IconTimeline } from './icons';

// ---------- tela cheia ----------
const isFull = () => !!document.fullscreenElement;
export const canFull = () => !!document.documentElement.requestFullscreen && document.fullscreenEnabled;
export function toggleFull() {
  try {
    const r = isFull() ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    r?.catch?.(() => {});
  } catch { /* aparelho sem tela cheia */ }
}

/** Cabeçalho comum dos painéis: título e botão de fechar. */
export function PanelHead({ title, children }: { title: string; children?: React.ReactNode }) {
  const setPanel = useUI((s) => s.setPanel);
  return (
    <div className="phead">
      <span className="ptitle">{title}</span>
      <span className="pacts">{children}<button className="pclose" title="Fechar (Esc)" onClick={() => setPanel(null)}>✕</button></span>
    </div>
  );
}

export function Rail() {
  const panel = useUI((s) => s.panel);
  const togglePanel = useUI((s) => s.togglePanel);
  const setPanel = useUI((s) => s.setPanel);
  const [full, setFull] = useState(isFull());
  useEffect(() => {
    const f = () => setFull(isFull());
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  // Esc fecha o painel aberto (se o foco não estiver num campo de texto)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || '';
      if (e.key === 'Escape' && useUI.getState().panel && !/^(TEXTAREA|INPUT|SELECT)$/.test(tag)) setPanel(null);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [setPanel]);
  const tg = (p: PanelId, title: string, icon: React.ReactNode) => (
    <button className={panel === p ? 'on' : ''} title={title} aria-pressed={panel === p} data-panel={p} onClick={() => togglePanel(p)}>{icon}</button>
  );
  return (
    <div id="rail" className="glass">
      {tg('legend', 'Legenda', <IconLegend />)}
      {tg('roster', 'Lista de bots', <IconRoster />)}
      {tg('timeline', t('timeline'), <IconTimeline />)}
      {tg('settings', t('settings'), <IconSettings />)}
      {inApp() ? tg('connections', t('connections'), <IconPlug />) : null}
      <div className="sep" />
      {canFull() ? <button className={full ? 'on' : ''} title={full ? t('fullscreenExit') : t('fullscreen')} onClick={toggleFull}><IconFull on={full} /></button> : null}
      <button title={t('viewRoom')} onClick={() => getEngine()?.viewAll()}><IconAll /></button>
    </div>
  );
}

export function Hud() {
  const open = useUI((s) => s.panel === 'legend');
  const link = useUI((s) => s.link);
  const connectors = useUI((s) => s.room.connectors);
  const hasEvents = useUI((s) => s.room.events.length > 0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!open) return null;
  const rows: [keyof typeof STATUS_COLOR, string][] = [['available', t('legend.available')], ['working', t('legend.working')], ['waiting', t('legend.waiting')], ['problem', t('legend.problem')]];
  return (
    <div id="hud" className="panel glass">
      <PanelHead title={t('title')}>
        <span id="live" className={link ? '' : 'off'}><i /><span>{link ? t('live') + ' · ' + hms(now) : t('offline')}</span></span>
      </PanelHead>
      <div className="pbody">
      <div className="legend">
        {rows.map(([k, label]) => (
          <div key={k} className="legend-row"><span className="legend-dot" style={{ background: css(STATUS_COLOR[k]), color: css(STATUS_COLOR[k]) }} />{label}</div>
        ))}
        <div className="legend-row" style={{ opacity: 0.7 }}>{t('legend.next')}</div>
      </div>
      {connectors.length ? (
        <div className="conns">
          {connectors.map((c) => (
            <div key={c.id} className={'conn ' + c.state} title={c.error || ''}>
              <i />{c.label}<span>{c.state === 'online' ? 'ligado' : c.state === 'connecting' ? 'conectando…' : 'com erro · tentando de novo'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="conns"><div className="conn connecting"><i />Nenhuma conexão ligada</div></div>
      )}
      <div className="hint">{t('legend.hint')}</div>
      {hasEvents ? <button id="replay" onClick={() => getEngine()?.replay()}>{t('replay')}</button> : null}
      </div>
    </div>
  );
}

const OPTS: [keyof Prefs, string][] = [
  ['depts', 'Departamentos'], ['names', 'Nomes dos bots'], ['bubbles', 'Balões de fala'], ['screens', 'Telas dos bots'],
  ['skins', 'Mostrar skins'], ['zone', 'Área "Aguardando você"'], ['rotate', 'Giro automático'], ['sound', 'Som nas falas'],
  ['thirdParty', 'Skins de personagens de terceiros'],
];
const CHOICES: [keyof Prefs, string, string[]][] = [['speed', 'Velocidade do giro', ['Lenta', 'Normal', 'Rápida']], ['size', 'Tamanho dos nomes', ['Pequeno', 'Médio', 'Grande']], ['theme', 'Tema', ['Escuro', 'Claro']]];

export function Settings() {
  const prefs = useUI((s) => s.prefs);
  const setPref = useUI((s) => s.setPref);
  const open = useUI((s) => s.panel === 'settings');
  if (!open) return null;
  return (
    <div id="cfg" className="panel glass">
      <PanelHead title={t('settings')} />
      <div id="cfgBody">
        {OPTS.map(([k, label]) => (
          <div key={k} className={'opt' + (prefs[k] ? ' on' : '')} onClick={() => setPref(k, !prefs[k] as never)}>
            <span>{label}</span><span className="sw2" />
          </div>
        ))}
        {CHOICES.map(([k, label, vals]) => (
          <div key={k} className="opt" onClick={() => setPref(k, ((((prefs[k] as number) || 0) + 1) % vals.length) as never)}>
            <span>{label}</span><span className="pill">{vals[prefs[k] as number] ?? vals[0]}</span>
          </div>
        ))}
        <div className="opt" onClick={() => setPref('deptMode', prefs.deptMode === 'separate' ? 'merge' : 'separate')} title="Quando duas plataformas têm departamentos com o mesmo nome">
          <span>Departamentos de mesmo nome</span><span className="pill">{prefs.deptMode === 'separate' ? 'Separar por plataforma' : 'Juntar'}</span>
        </div>
        <label className="field">
          <span>Letreiro da sala</span>
          <input value={prefs.sign} maxLength={40} onChange={(e) => setPref('sign', e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="vazio = sem letreiro" />
        </label>
        <label className="field">
          <span>Fuso horário (vazio = o do aparelho)</span>
          <input value={prefs.timeZone} maxLength={60} onChange={(e) => setPref('timeZone', e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="ex.: America/Sao_Paulo" />
        </label>
        <div className="cap">Os ajustes mudam só a exibição, neste aparelho. Nada aqui altera os bots.</div>
      </div>
    </div>
  );
}

export function Timeline() {
  const open = useUI((s) => s.panel === 'timeline');
  const room = useUI((s) => s.room);
  if (!open) return null;
  const name = (id: string) => room.agents.find((a) => a.id === id)?.name ?? '?';
  const gname = (id: string) => room.groups.find((g) => g.id === id)?.name ?? '?';
  const evs = room.events.slice().reverse();
  return (
    <div id="tl" className="panel glass">
      <PanelHead title={t('timeline')} />
      {(
        <div id="tlBody">
          {evs.length ? evs.map((e) => (
            <div key={e.id} className="tl-row" title={e.text} onClick={() => getEngine()?.focusAgent(e.from)}>
              <span className="tm">{hm(e.at)}</span>
              <span className="wh">{name(e.from) + (e.to ? ' → ' + name(e.to) : e.groupId ? ' · grupo ' + gname(e.groupId) : '')}</span>
              <span className="tx">{e.text}</span>
            </div>
          )) : <div className="tl-empty">{t('timeline.empty')}</div>}
        </div>
      )}
    </div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  const show = useUI((s) => s.showToast);
  useEffect(() => {
    if (!toast) return;
    const i = setTimeout(() => show(null), 5000);
    return () => clearTimeout(i);
  }, [toast, show]);
  return toast ? <div className="toast glass" onClick={() => show(null)}>{toast}</div> : null;
}
