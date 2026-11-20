// Janela de conversa com um bot: uma por bot, várias abertas, arrastável pelo topo, em cascata.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Agent, ChatItem } from '@shared/types';
import { avatarUrl } from '../avatar';
import { dayTime, statusText, t } from '../i18n';
import { useUI } from '../store';
import { capsOf, download, retryAgent, sendToAgent, skinFor } from './actions';
import { IconDownload, IconSkin } from './icons';

const coarse = () => matchMedia('(pointer: coarse)').matches;

export function botSub(a: Agent): string {
  const st = a.status;
  return st === 'waiting' ? statusText('waiting') : st === 'problem' ? statusText('problem') : st === 'working' ? a.doing || statusText('working') : `${a.role || a.department} · ${statusText(st)}`;
}

function Actions({ a }: { a: Agent }) {
  const caps = capsOf(a);
  const out: React.ReactNode[] = [];
  if (a.status === 'waiting') {
    if ((a.ask ?? 'question') === 'question') {
      out.push(<div key="n" className="note">{t('ask.pending') + (a.need || t('ask.default'))}</div>);
      if (caps?.sendToAgent) for (const label of [t('ask.yes'), t('ask.no'), t('ask.explain')]) out.push(<button key={label} className="qbtn" onClick={() => sendToAgent(a.id, label)}>{label}</button>);
    } else {
      out.push(<div key="n" className="note">{(a.ask === 'sign-in' ? t('ask.signin') : t('ask.secret')) + (a.need ? ' (' + a.need + ')' : '') + t('ask.secure')}</div>);
    }
  } else if (a.status === 'problem') {
    out.push(<div key="n" className="note red">{a.need || t('problem.default')}</div>);
    if (caps?.retryTask) out.push(<button key="r" className="qbtn" onClick={() => retryAgent(a.id)}>{t('retry')}</button>);
  }
  if (a.next) out.push(<div key="x" className="note plain">{t('next.routine') + a.next.name + ' · ' + dayTime(a.next.at)}</div>);
  return <div className="cact">{out}</div>;
}

function Message({ m, a }: { m: ChatItem; a: Agent }) {
  if (m.r === 'n') return <div className="cnote">{m.t + ' · ' + dayTime(m.at)}</div>;
  const cls = m.r === 'u' ? 'u' : m.r === 'o' ? 'o' : 'b';
  const who = m.r === 'u' ? t('chat.you') : m.r === 'o' ? m.w || 'Outro bot' : a.name;
  return (
    <div className={'cmsg ' + cls}>
      {String(m.t).replace(/<attached-image[^>]*>/g, '[imagem]')}
      <span className="when">{who + ' · ' + dayTime(m.at)}</span>
    </div>
  );
}

export function ChatWindow({ a, index, z }: { a: Agent; index: number; z: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const atEnd = useRef(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const pending = useUI((s) => s.pending[a.id]);
  const prefs = useUI((s) => s.prefs);
  const multi = useUI((s) => s.room.connectors.length > 1);
  const platform = useUI((s) => s.room.connectors.find((c) => c.id === a.connectorId)?.label);
  const closeWindow = useUI((s) => s.closeWindow);
  const raise = useUI((s) => s.raiseWindow);
  const setSkinMenu = useUI((s) => s.setSkinMenu);
  const caps = capsOf(a);
  const chat = [...a.chat, ...(pending ?? [])];

  // posição inicial: centro, em cascata
  useLayoutEffect(() => {
    const el = ref.current, app = el?.parentElement;
    if (!el || !app || pos) return;
    const n = index % 6;
    setPos({ x: Math.max(8, (app.clientWidth - el.offsetWidth) / 2 + n * 30), y: Math.max(8, (app.clientHeight - el.offsetHeight) / 2 - 20 + n * 30) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!coarse()) setTimeout(() => text.current?.focus(), 40);
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, []);

  // atualiza ao vivo sem perder a rolagem: só desce sozinho se já estava no fim
  useLayoutEffect(() => {
    const l = log.current;
    if (l && atEnd.current) l.scrollTop = l.scrollHeight;
  }, [chat.length, a.status]);

  const onDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = ref.current!, app = el.parentElement!;
    const ox = e.clientX - el.offsetLeft, oy = e.clientY - el.offsetTop;
    const top = e.currentTarget as HTMLElement;
    top.setPointerCapture(e.pointerId);
    el.classList.add('drag');
    const mv = (ev: PointerEvent) => setPos({ x: Math.min(app.clientWidth - 60, Math.max(60 - el.offsetWidth, ev.clientX - ox)), y: Math.min(app.clientHeight - 44, Math.max(0, ev.clientY - oy)) });
    const up = () => { el.classList.remove('drag'); top.removeEventListener('pointermove', mv); top.removeEventListener('pointerup', up); top.removeEventListener('pointercancel', up); };
    top.addEventListener('pointermove', mv);
    top.addEventListener('pointerup', up);
    top.addEventListener('pointercancel', up);
  };

  const grow = () => { const ta = text.current!; ta.style.height = '20px'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; };
  const send = () => {
    const ta = text.current!;
    const v = ta.value.trim();
    if (!v) return;
    ta.value = '';
    ta.style.height = '20px';
    atEnd.current = true;
    void sendToAgent(a.id, v);
  };

  return (
    <div
      ref={ref}
      className="cwin"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 0, zIndex: z }}
      onPointerDownCapture={() => raise(a.id)}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="top" onPointerDown={onDrag}>
        <img className="av" alt="" src={avatarUrl(a.slot, prefs.skins ? skinFor(a) : null)} />
        <div>
          <h2>{a.name}</h2>
          <div className="sub">{botSub(a) + (multi && platform ? ' · ' + platform : '')}</div>
        </div>
        <span className="wacts">
          <button title={t('chooseSkin')} className="skb" onClick={(e) => { e.stopPropagation(); setSkinMenu({ agentId: a.id, top: (e.currentTarget as HTMLElement).getBoundingClientRect().top }); }}><IconSkin /></button>
          <button title={t('download')} onClick={() => download(a)}><IconDownload /></button>
        </span>
        <button className="x" title={t('close')} onClick={() => closeWindow(a.id)}>✕</button>
      </div>
      <div className="clog" ref={log} onScroll={(e) => { const l = e.currentTarget; atEnd.current = l.scrollHeight - l.scrollTop - l.clientHeight < 30; }}>
        {chat.length ? chat.map((m, i) => <Message key={i + ':' + m.at} m={m} a={a} />) : <div className="empty">{t('chat.empty')}</div>}
      </div>
      <Actions a={a} />
      {caps?.sendToAgent ? (
        <div className="inrow">
          <textarea
            ref={text}
            rows={1}
            maxLength={4000}
            placeholder={t('chat.placeholder')}
            onInput={grow}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              if (e.key === 'Escape') closeWindow(a.id);
            }}
            onKeyUp={(e) => e.stopPropagation()}
          />
          <button className="send" title={t('send')} onClick={send}>↑</button>
        </div>
      ) : (
        <div className="note plain readonly">{t('chat.readonly')}</div>
      )}
    </div>
  );
}
