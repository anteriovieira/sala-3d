// Lista de bots à direita, em cartões por departamento; filtro por plataforma quando há mais de uma.

import { avatarUrl, css } from '../avatar';
import { STATUS_COLOR } from '../engine/bot';
import { hm, dayTime, statusText, t } from '../i18n';
import { useUI } from '../store';
import type { Agent } from '@shared/types';
import { download, getEngine, skinFor } from './actions';
import { IconDownload, IconMail, IconSkin } from './icons';

export function subLine(a: Agent) {
  const st = a.status;
  const sub = st === 'working' ? a.doing || statusText('working') : st === 'available' ? a.role || a.department : statusText(st);
  return sub + (a.next ? ' · ⏰ ' + hm(a.next.at) : '');
}

export function Roster() {
  const room = useUI((s) => s.room);
  const depts = useUI((s) => s.depts);
  const prefs = useUI((s) => s.prefs);
  const active = useUI((s) => s.active);
  const setPref = useUI((s) => s.setPref);
  const openWindow = useUI((s) => s.openWindow);
  const setCompose = useUI((s) => s.setCompose);
  const setSkinMenu = useUI((s) => s.setSkinMenu);
  if (!prefs.roster) return null;
  const by = new Map(room.agents.map((a) => [a.id, a]));
  const multi = room.connectors.length > 1;
  const label = (id: string) => room.connectors.find((c) => c.id === id)?.label ?? id;
  const errored = new Set(room.connectors.filter((c) => c.state === 'error').map((c) => c.id));
  const filter = prefs.platform && room.connectors.some((c) => c.id === prefs.platform) ? prefs.platform : null;

  return (
    <div id="roster" className="glass">
      <div className="head">
        <span>{t('bots')}</span>
        <span>
          <button title="Mandar uma mensagem para um departamento inteiro" onClick={() => setCompose({ kind: 'dept', deptKey: depts[0]?.key ?? null })}><IconMail />{t('all')}</button>
          <button onClick={() => getEngine()?.viewAll()}>{t('viewAll')}</button>
        </span>
      </div>
      {multi ? (
        <div className="pfilter">
          <button className={!filter ? 'on' : ''} onClick={() => setPref('platform', null)}>Todas</button>
          {room.connectors.map((c) => <button key={c.id} className={filter === c.id ? 'on' : ''} onClick={() => setPref('platform', c.id)}>{c.label}</button>)}
        </div>
      ) : null}
      <div id="rosterList">
        {depts.map((D) => {
          const rows = D.members.map((id) => by.get(id)).filter((a): a is Agent => !!a && (!filter || a.connectorId === filter));
          if (!rows.length) return null;
          return (
            <div className="grp" key={D.key}>
              <div className="gh"><i style={{ background: css(D.color) }} /><span>{D.name}</span><b>{rows.length}</b></div>
              {rows.map((a) => {
                const c = css(STATUS_COLOR[a.status]);
                return (
                  <div
                    key={a.id}
                    className={'r-row' + (active === a.id ? ' active' : '') + (errored.has(a.connectorId) ? ' dim' : '')}
                    title={statusText(a.status) + (a.need ? ': ' + a.need : '') + (a.next ? '\nPróxima rotina: ' + a.next.name + ' · ' + dayTime(a.next.at) : '')}
                    onClick={() => getEngine()?.focusAgent(a.id)}
                  >
                    <span className="sw pic" style={{ backgroundImage: `url(${avatarUrl(a.slot, prefs.skins ? skinFor(a) : null)})` }} />
                    <div className="tx">
                      <div className="nm" title={a.chief ? t('chief') : undefined}>{(a.chief ? '👑 ' : '') + a.name}</div>
                      <div className="rl">{(multi ? label(a.connectorId) + ' · ' : '') + subLine(a)}</div>
                    </div>
                    <span className="st" style={{ background: c, color: c }} />
                    <span className="acts">
                      <button className="msg skb" title={t('chooseSkin')} onClick={(e) => { e.stopPropagation(); setSkinMenu({ agentId: a.id, top: (e.currentTarget as HTMLElement).getBoundingClientRect().top }); }}><IconSkin /></button>
                      <button className="msg skb" title={t('download')} onClick={(e) => { e.stopPropagation(); download(a); }}><IconDownload /></button>
                      <button className="msg" title={t('message')} onClick={(e) => { e.stopPropagation(); getEngine()?.focusAgent(a.id); openWindow(a.id); }}><IconMail /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
