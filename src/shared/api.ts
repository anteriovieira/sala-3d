import type { CommandResult, ConnectionEntry, ConnectorKindInfo, LanInfo, RoomCommand, RoomState } from './types';

export interface ConnectionInput {
  id?: string;
  kind: string;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
  /** undefined = não mexe; '' ou null = apaga */
  secrets: Record<string, string | null | undefined>;
}

/** O que o preload expõe em window.sala (só dentro do app Electron). */
export interface SalaBridge {
  getState(): Promise<RoomState>;
  onState(fn: (s: RoomState) => void): () => void;
  send(cmd: RoomCommand): Promise<CommandResult>;
  kinds(): Promise<ConnectorKindInfo[]>;
  connections(): Promise<ConnectionEntry[]>;
  saveConnection(c: ConnectionInput): Promise<{ ok: boolean; error?: string; entry?: ConnectionEntry }>;
  removeConnection(id: string): Promise<void>;
  lan(): Promise<LanInfo>;
  setLan(enabled: boolean): Promise<LanInfo & { error?: string }>;
  copy(text: string): Promise<void>;
}

export const IPC = {
  state: 'sala:state',
  getState: 'sala:getState',
  send: 'sala:send',
  kinds: 'sala:kinds',
  connections: 'sala:connections',
  saveConnection: 'sala:saveConnection',
  removeConnection: 'sala:removeConnection',
  lan: 'sala:lan',
  setLan: 'sala:setLan',
  copy: 'sala:copy',
} as const;
