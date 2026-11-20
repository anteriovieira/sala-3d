// Menu de skins: grade com "Sem skin" + todas as skins registradas.

import { useEffect, useRef } from 'react';
import { css, pastelOf, skinThumb } from '../avatar';
import { t } from '../i18n';
import { allSkins, defaultSkin, resolveSkin } from '../skins/registry';
import { useUI } from '../store';

export function SkinMenu() {
  const menu = useUI((s) => s.skinMenu);
  const set = useUI((s) => s.setSkinMenu);
  const agent = useUI((s) => s.room.agents.find((a) => a.id === s.skinMenu?.agentId));
  const prefs = useUI((s) => s.prefs);
  const setPref = useUI((s) => s.setPref);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => { const el = e.target as HTMLElement; if (ref.current && !ref.current.contains(el) && !el.closest?.('.skb')) set(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') set(null); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [menu, set]);

  useEffect(() => {
    // posiciona ao lado da lista, sem sair da tela
    const el = ref.current;
    if (!el || !menu) return;
    const app = el.parentElement!.getBoundingClientRect();
    const roster = document.getElementById('roster')?.getBoundingClientRect();
    // a lista fica à esquerda (AppShell): o menu abre à direita dela
    el.style.left = Math.max(8, Math.min(app.width - el.offsetWidth - 8, roster ? roster.right - app.left + 8 : 8)) + 'px';
    el.style.top = Math.max(8, Math.min(menu.top - app.top - 20, app.height - el.offsetHeight - 8)) + 'px';
  });

  if (!menu || !agent) return null;
  const cur = resolveSkin(agent.slot, prefs.skinOf[agent.id], true);
  const curName = prefs.skinOf[agent.id] === 'none' ? null : cur?.name ?? null;
  const fab = defaultSkin(agent.slot);
  const choose = (name: string | null) => {
    const skinOf = { ...prefs.skinOf };
    if (name !== null && name === fab?.name) delete skinOf[agent.id];
    else skinOf[agent.id] = name ?? 'none';
    setPref('skinOf', skinOf);
    if (!prefs.skins) setPref('skins', true);
    set(null);
  };
  return (
    <div id="skinMenu" className="glass" ref={ref} onWheel={(e) => e.stopPropagation()}>
      <div className="sk-head">{t('skinOf') + agent.name}</div>
      <div className="sk-grid">
        <button className={'sk-item' + (curName === null ? ' on' : '')} onClick={() => choose(null)}>
          <span className="sk-th" style={{ background: css(pastelOf(agent.slot)) }} />
          <span>{t('noSkin')}</span>
        </button>
        {allSkins().map((s) => (
          <button key={s.name} className={'sk-item' + (curName === s.name ? ' on' : '')} onClick={() => choose(s.name)}>
            <span className="sk-th" style={{ backgroundImage: `url(${skinThumb(s)})` }} />
            <span>{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
