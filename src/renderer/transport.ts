// Cliente de transporte: dentro do app usa IPC (window.sala); no navegador (tablet, outra tela)
// recebe o estado por SSE e envia comandos por POST ao próprio servidor da sala.

import type { SalaBridge } from '@shared/api';
import type { CommandResult, RoomCommand, RoomState } from '@shared/types';

declare global {
  interface Window {
    sala?: SalaBridge;
  }
}

export const inApp = () => !!window.sala;

export function subscribeState(onState: (s: RoomState) => void, onLink: (ok: boolean) => void): () => void {
  if (window.sala) {
    const b = window.sala;
    let alive = true;
    b.getState().then((s) => { if (alive) { onState(s); onLink(true); } }).catch(() => onLink(false));
    const off = b.onState((s) => { onState(s); onLink(true); });
    return () => { alive = false; off(); };
  }
  // navegador: SSE; se cair, o EventSource tenta de novo sozinho
  let es: EventSource | null = null;
  let misses = 0;
  let closed = false;
  const open = () => {
    es = new EventSource('/api/events');
    es.onmessage = (ev) => {
      misses = 0;
      try { onState(JSON.parse(ev.data)); onLink(true); } catch { /* ignora */ }
    };
    es.onerror = () => {
      if (++misses >= 3) onLink(false);
      if (es && es.readyState === EventSource.CLOSED && !closed) setTimeout(open, 3000);
    };
  };
  open();
  return () => { closed = true; es?.close(); };
}

export async function sendCommand(cmd: RoomCommand): Promise<CommandResult> {
  if (window.sala) return window.sala.send(cmd);
  try {
    const r = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
    return (await r.json()) as CommandResult;
  } catch {
    return { ok: false, error: 'sem ligação com a sala' };
  }
}
