// Conversa com um bot: uma aba por bot no painel de conversas da casca (AppShell).

import { useEffect, useLayoutEffect, useRef } from 'react';
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

export function ChatWindow({ a }: { a: Agent }) {
  const ref = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const atEnd = useRef(true);
  const pending = useUI((s) => s.pending[a.id]);
  const prefs = useUI((s) => s.prefs);
  const multi = useUI((s) => s.room.connectors.length > 1);
  const platform = useUI((s) => s.room.connectors.find((c) => c.id === a.connectorId)?.label);
  const closeWindow = useUI((s) => s.closeWindow);
  const setSkinMenu = useUI((s) => s.setSkinMenu);
  const caps = capsOf(a);
  const chat = [...a.chat, ...(pending ?? [])];

  useEffect(() => {
    if (!coarse()) setTimeout(() => text.current?.focus(), 40);
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, []);

  // atualiza ao vivo sem perder a rolagem: só desce sozinho se já estava no fim
  useLayoutEffect(() => {
    const l = log.current;
    if (l && atEnd.current) l.scrollTop = l.scrollHeight;
  }, [chat.length, a.status]);

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
      className="cwin docked"
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="top">
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
