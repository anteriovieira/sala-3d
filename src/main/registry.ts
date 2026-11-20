import type { ConnectorKindInfo } from '@shared/types';
import { demoFactory } from './connectors/demo';
import { httpBridgeFactory } from './connectors/httpBridge';
import { openMausBotFactory } from './connectors/openmausbot';
import type { ConnectorFactory } from './connectors/types';

/** Tipos de conexão disponíveis. Plataformas novas entram aqui. */
export function factories(log: (m: string) => void): ConnectorFactory[] {
  return [openMausBotFactory(log), demoFactory, httpBridgeFactory];
}

export const kindInfo = (f: ConnectorFactory): ConnectorKindInfo => ({ kind: f.kind, label: f.label, description: f.description, fields: f.fields, multiple: f.multiple });
