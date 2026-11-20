// Ações do dono: envia o comando tipado e avisa o motor (pensar, andar até a mesa...).

import type { RoomEngine } from '../engine/engine';
import { downloadBotImage } from '../avatar';
import { resolveSkin } from '../skins/registry';
import { sendCommand } from '../transport';
import { useUI } from '../store';
import type { Agent, AgentId, ConnectorCapabilities } from '@shared/types';

let engine: RoomEngine | null = null;
export const setEngine = (e: RoomEngine | null) => { engine = e; };
export const getEngine = () => engine;

const report = (r: { ok: boolean; error?: string }) => {
  if (!r.ok) useUI.getState().showToast('Não foi possível enviar: ' + (r.error || 'erro desconhecido'));
};

export function capsOf(a: Pick<Agent, 'connectorId'> | undefined): ConnectorCapabilities | undefined {
  if (!a) return undefined;
  return useUI.getState().room.connectors.find((c) => c.id === a.connectorId)?.capabilities;
}

export async function sendToAgent(id: AgentId, text: string) {
  const t = text.trim();
  if (!t) return;
  useUI.getState().addPending(id, t);
  engine?.messageSent(id, t);
  report(await sendCommand({ type: 'message.agent', agentId: id, text: t }));
}

export async function retryAgent(id: AgentId) {
  engine?.retrySent(id);
  useUI.getState().closeWindow(id);
  report(await sendCommand({ type: 'task.retry', agentId: id }));
}

export async function sendToGroup(groupId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  engine?.groupMessageSent(groupId);
  report(await sendCommand({ type: 'message.group', groupId, text: t }));
}

/** deptKey null = todos os departamentos. Com faixas separadas por plataforma, a chave traz o conector. */
export async function sendToDept(deptKey: string | null, text: string) {
  const t = text.trim();
  if (!t) return;
  const { depts } = useUI.getState();
  const D = deptKey === null ? null : depts.find((d) => d.key === deptKey);
  engine?.thinkMany(D ? D.members : depts.flatMap((d) => d.members));
  if (deptKey === null) return report(await sendCommand({ type: 'message.department', department: null, text: t }));
  if (!D) return;
  const i = deptKey.indexOf('\u0000');
  const connectorId = i >= 0 ? deptKey.slice(0, i) : undefined;
  const department = i >= 0 ? deptKey.slice(i + 1) : deptKey;
  report(await sendCommand({ type: 'message.department', department, connectorId, text: t }));
}

export function skinFor(a: Agent) {
  const p = useUI.getState().prefs;
  return resolveSkin(a.slot, p.skinOf[a.id], p.skins);
}

export function download(a: Agent) {
  const p = useUI.getState().prefs;
  // como na sala antiga: baixa com a skin escolhida (ou a de fábrica), mesmo com "Mostrar skins" desligado
  downloadBotImage(a.name, a.slot, resolveSkin(a.slot, p.skinOf[a.id], true));
}
