// Ícones de linha (os mesmos da sala antiga).

const I = ({ d, children }: { d?: string; children?: React.ReactNode }) => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
    {d ? <path d={d} /> : null}
    {children}
  </svg>
);

export const IconLegend = () => <I d="M12 11v5.5M12 7.6v.2"><circle cx="12" cy="12" r="8.5" /></I>;
export const IconRoster = () => <I d="M3.2 19c.5-3.2 2.9-5 5.8-5s5.3 1.8 5.8 5M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3c1.8.7 3 2.3 3.3 4.7"><circle cx="9" cy="8.5" r="3.2" /></I>;
export const IconTimeline = () => <I d="M12 7.5V12l3 2"><circle cx="12" cy="12" r="8.5" /></I>;
export const IconSettings = () => (
  <I d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1">
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="17" r="2" />
  </I>
);
export const IconPlug = () => <I d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4" />;
export const IconFull = ({ on }: { on: boolean }) => <I d={on ? 'M20 10h-6V4M14 10l6.5-6.5M4 14h6v6M10 14l-6.5 6.5' : 'M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5'} />;
export const IconAll = () => <I d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />;
export const IconMail = () => <I d="M4.5 8.5l7.5 5 7.5-5"><rect x="3" y="5.5" width="18" height="13" rx="3.5" /></I>;
export const IconSkin = () => (
  <I d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.1 0 1.8-.8 1.8-1.8 0-1.3-1-1.6-1-2.7 0-.9.7-1.6 1.7-1.6h2.3a4 4 0 0 0 4-4c0-4.2-3.9-7.5-8.8-7.5z">
    <circle cx="7.6" cy="11.2" r=".6" />
    <circle cx="10.4" cy="7.4" r=".6" />
    <circle cx="15" cy="7.6" r=".6" />
  </I>
);
export const IconDownload = () => <I d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />;
