// Modelo normalizado da sala (v2). Usado pelo processo principal (conectores, agregador),
// pelo servidor da rede local e pela interface.

export type Status = 'available' | 'working' | 'waiting' | 'problem';
export type AskKind = 'question' | 'sign-in' | 'secret';

/** `${connectorId}:${idNaPlataforma}` — estável e único entre plataformas. */
export type AgentId = string;

export interface ChatItem {
  /** u = dono, b = o agente, n = aviso curto, o = outro agente */
  r: 'u' | 'b' | 'n' | 'o';
  t: string;
  at: number;
  /** quando r = 'o': nome do outro agente */
  w?: string;
  /** quando r = 'o' e o outro agente é conhecido */
  from?: AgentId;
}

export interface NextRoutine {
  name: string;
  at: number;
}

export interface Agent {
  id: AgentId;
  connectorId: string;
  name: string;
  role: string;
  department: string;
  color?: string;
  chief: boolean;
  slot: number;
  status: Status;
  need: string;
  ask?: AskKind;
  doing?: string;
  next?: NextRoutine;
  chat: ChatItem[];
  statusSince: number;
  previousStatus?: Status;
}

export interface Group {
  id: string;
  connectorId: string;
  name: string;
  members: AgentId[];
  /** conversa nos últimos 4 minutos: os membros se reúnem na mesa */
  active: boolean;
}

export interface RoomEvent {
  id: string;
  at: number;
  from: AgentId;
  text: string;
  /** pedido entre agentes: quem fala anda até o destinatário */
  to?: AgentId;
  /** fala dentro de um grupo */
  groupId?: string;
}

export type ConnectorState = 'online' | 'connecting' | 'error';

export interface ConnectorInfo {
  id: string;
  kind: string;
  label: string;
  state: ConnectorState;
  error?: string;
  capabilities: ConnectorCapabilities;
  /** ordem dos departamentos que a plataforma informou */
  departments?: string[];
}

export interface RoomState {
  at: number;
  agents: Agent[];
  groups: Group[];
  events: RoomEvent[];
  connectors: ConnectorInfo[];
}

export type RoomCommand =
  | { type: 'message.agent'; agentId: AgentId; text: string }
  | { type: 'message.group'; groupId: string; text: string }
  | { type: 'message.department'; connectorId?: string; department: string | null; text: string }
  | { type: 'task.retry'; agentId: AgentId };

export interface CommandResult {
  ok: boolean;
  error?: string;
}

export interface ConnectorCapabilities {
  sendToAgent: boolean;
  sendToGroup: boolean;
  retryTask: boolean;
  groups: boolean;
  departments: boolean;
  chatHistory: boolean;
  transport: 'push' | 'poll';
}

/** Agente como o conector entrega: id ainda sem o prefixo do conector. */
export type SnapshotAgent = Omit<Agent, 'slot' | 'connectorId' | 'statusSince' | 'previousStatus'>;
/** Grupo como o conector entrega: ids sem prefixo. */
export type SnapshotGroup = Omit<Group, 'connectorId'>;

export interface ConnectorSnapshot {
  agents: SnapshotAgent[];
  groups: SnapshotGroup[];
  /** ids (from/to/groupId) sem prefixo */
  events: RoomEvent[];
  /** ordem das faixas de departamento, se a plataforma tiver */
  departments?: string[];
}

/** Campo da tela "Adicionar conexão". */
export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'textarea' | 'number' | 'boolean';
  placeholder?: string;
  help?: string;
  required?: boolean;
  default?: string | number | boolean;
}

export interface ConnectorKindInfo {
  kind: string;
  label: string;
  description: string;
  fields: ConfigField[];
  /** pode haver mais de uma conexão deste tipo */
  multiple: boolean;
}

export interface ConnectionEntry {
  id: string;
  kind: string;
  label: string;
  enabled: boolean;
  /** só campos não secretos; os secretos nunca saem do processo principal */
  config: Record<string, unknown>;
  secretsSet: string[];
}

export interface LanInfo {
  enabled: boolean;
  port: number;
  localUrl: string;
  urls: string[];
}

export const STATUS_LIST: Status[] = ['available', 'working', 'waiting', 'problem'];
export const MAX_TEXT = 4000;
