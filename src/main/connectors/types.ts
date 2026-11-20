import type { CommandResult, ConfigField, ConnectorCapabilities, ConnectorSnapshot, RoomCommand } from '@shared/types';

/**
 * Contrato de cada plataforma (seção 12.1). O conector entrega snapshots completos com ids
 * da própria plataforma; o agregador prefixa com o id da conexão, dá slots e junta tudo.
 * Os comandos chegam com ids já sem prefixo.
 */
export interface AgentConnector {
  readonly kind: string;
  readonly label: string;
  readonly capabilities: ConnectorCapabilities;
  connect(config: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(onSnapshot: (s: ConnectorSnapshot) => void, onError: (e: Error) => void): () => void;
  send(cmd: RoomCommand): Promise<CommandResult>;
}

export interface ConnectorFactory {
  kind: string;
  label: string;
  description: string;
  fields: ConfigField[];
  multiple: boolean;
  create(): AgentConnector;
}
