// Falar com vários: um departamento inteiro (ou todos) ou o grupo ligado a uma mesa.

import { useEffect, useRef } from 'react';
import { css } from '../avatar';
import { dayTime, t } from '../i18n';
import { useUI } from '../store';
import { sendToDept, sendToGroup } from './actions';

export function ComposeBox() {
  const compose = useUI((s) => s.compose);
  const setCompose = useUI((s) => s.setCompose);
  const depts = useUI((s) => s.depts);
  const room = useUI((s) => s.room);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (compose && !matchMedia('(pointer: coarse)').matches) setTimeout(() => ta.current?.focus(), 40);
  }, [compose?.kind]);

  if (!compose) return null;
  const close = () => setCompose(null);
  const nameOf = (id: string) => room.agents.find((a) => a.id === id)?.name ?? '?';

  let title = '', sub = '', color = 0x8fd0ff;
  let body: React.ReactNode = null;
  let acts: React.ReactNode = null;
  let canSend = true;

  if (compose.kind === 'dept') {
    title = t('dept.title');
    sub = t('dept.sub');
    body = <div className="empty">{t('dept.empty')}</div>;
    acts = (
      <>
        {depts.map((D) => (
          <button key={D.key} className={'qbtn' + (compose.deptKey === D.key ? ' sel' : '')} onClick={() => setCompose({ kind: 'dept', deptKey: D.key })}>{D.name + ' · ' + D.members.length}</button>
        ))}
        <button className={'qbtn' + (compose.deptKey === null ? ' sel' : '')} onClick={() => setCompose({ kind: 'dept', deptKey: null })}>{t('all')}</button>
      </>
    );
  } else {
    const D = depts.find((d) => d.key === compose.deptKey);
    const groups = (D?.groups ?? []).map((id) => room.groups.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g);
    const g = groups.find((x) => x.id === compose.groupId) ?? groups[0];
    color = D?.color ?? color;
    title = 'Grupo ' + (g?.name ?? '');
    sub = (g?.members ?? []).map(nameOf).join(', ');
    canSend = !!room.connectors.find((c) => c.id === g?.connectorId)?.capabilities.sendToGroup;
    if (groups.length > 1) acts = groups.map((x) => <button key={x.id} className={'qbtn' + (x.id === g?.id ? ' sel' : '')} onClick={() => setCompose({ kind: 'group', deptKey: compose.deptKey, groupId: x.id })}>{x.name}</button>);
    const ev = room.events.filter((e) => e.groupId === g?.id);
    body = ev.length ? ev.map((m) => (
      <div key={m.id} className="cmsg b">{m.text}<span className="when">{nameOf(m.from) + ' · ' + dayTime(m.at)}</span></div>
    )) : <div className="empty">{t('group.empty')}</div>;
  }

  const send = () => {
    const v = ta.current?.value.trim() ?? '';
    close();
    if (!v) return;
    if (compose.kind === 'dept') void sendToDept(compose.deptKey, v);
    else {
      const D = depts.find((d) => d.key === compose.deptKey);
      const gid = compose.groupId ?? D?.groups[0];
      if (gid) void sendToGroup(gid, v);
    }
  };

  return (
    <div className="backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="composeBox" onWheel={(e) => e.stopPropagation()}>
        <div className="top">
          <span className="av" style={{ background: css(color), color: css(color) }} />
          <div>
            <h2>{title}</h2>
            <div className="sub">{sub}</div>
          </div>
          <button className="x" title={t('close')} onClick={close}>✕</button>
        </div>
        <div className="clog">{body}</div>
        <div className="cact">{acts}</div>
        {canSend ? (
          <div className="inrow">
            <textarea
              ref={ta}
              rows={1}
              maxLength={4000}
              placeholder={t('chat.placeholder')}
              onInput={(e) => { const x = e.currentTarget; x.style.height = '20px'; x.style.height = Math.min(110, x.scrollHeight) + 'px'; }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                if (e.key === 'Escape') close();
              }}
              onKeyUp={(e) => e.stopPropagation()}
            />
            <button className="send" title={t('send')} onClick={send}>↑</button>
          </div>
        ) : (
          <div className="note plain readonly">{t('chat.readonly')}</div>
        )}
      </div>
    </div>
  );
}
