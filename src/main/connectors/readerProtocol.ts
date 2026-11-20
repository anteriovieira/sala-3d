import type { ConnectorSnapshot } from '@shared/types';

export type ReaderKind = 'openmausbot' | 'openbot' | 'tucano' | 'grokbot';
export interface WorkerRequest { id: number; kind: ReaderKind; home: string }
export type WorkerReply =
  | { id: number; ok: true; same: true }
  | { id: number; ok: true; snap: ConnectorSnapshot }
  | { id: number; ok: false; error: string };
