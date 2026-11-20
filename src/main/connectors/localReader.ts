// Base dos conectores que só leem dados de um app neste computador (Tucano, Grok Bot): lê a cada N ms na
// thread de leitura (readerThread.ts) e não envia mensagens — essas plataformas não expõem entrada local documentada.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CommandResult, ConnectorSnapshot, RoomCommand } from '@shared/types';
import type { ReaderKind } from './readerProtocol';
import { ReaderThread } from './readerThread';
import type { AgentConnector } from './types';

export const expandHome = (p: string) => p.replace(/^~(?=\/|$)/, homedir());

/** Cor de um app (nome em inglês, como "violet", "amber", "indigo") → cor nomeada da sala. */
export function namedColor(c: unknown): string {
  const k = String(c ?? '').toLowerCase().trim();
  const map: Record<string, string> = {
    red: 'red', rose: 'pink', pink: 'pink', fuchsia: 'pink', magenta: 'pink',
    orange: 'orange', amber: 'orange', yellow: 'yellow', lime: 'green', green: 'green', emerald: 'green',
    teal: 'teal', cyan: 'teal', sky: 'blue', blue: 'blue', indigo: 'blue', violet: 'purple', purple: 'purple',
  };
  return map[k] ?? 'silver';
}

export interface LocalReaderSpec {
  kind: ReaderKind;
  label: string;
  defaultDir: string;
  /** basta um destes arquivos existir dentro da pasta para a conexão valer */
  mustHave: string[];
  read: (home: string) => ConnectorSnapshot;
  sendError: string;
}

export class LocalReadConnector implements AgentConnector {
  readonly capabilities = { sendToAgent: false, sendToGroup: false, retryTask: false, groups: true, departments: true, chatHistory: true, transport: 'poll' as const };
  private home: string;
  private poll = 3000;
  private thread: ReaderThread;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private spec: LocalReaderSpec, private log: (m: string) => void = () => {}) {
    this.home = spec.defaultDir;
    this.thread = new ReaderThread(spec.kind);
  }

  get kind() { return this.spec.kind; }
  get label() { return this.spec.label; }

  async connect(config: Record<string, unknown>): Promise<void> {
    this.home = expandHome(String(config.dataDir || '').trim() || this.spec.defaultDir);
    this.poll = Math.max(1000, Number(config.pollMs) || 3000);
    if (!this.spec.mustHave.some((f) => existsSync(join(this.home, f)))) throw new Error(`Não achei ${this.spec.mustHave.join(' nem ')} em ${this.home}`);
    this.thread.reset();
    this.stopped = false;
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.thread.stop();
  }

  subscribe(onSnapshot: (s: ConnectorSnapshot) => void, onError: (e: Error) => void): () => void {
    let alive = true;
    let fails = 0;
    const loop = async () => {
      if (!alive || this.stopped) return;
      let wait = this.poll;
      try {
        const s = await this.thread.read(this.home, () => this.spec.read(this.home));
        if (!alive || this.stopped) return;
        fails = 0;
        if (s) onSnapshot(s);
      } catch (e) {
        if (!alive || this.stopped) return;
        fails++;
        wait = Math.min(30000, this.poll * Math.min(10, fails));
        this.log(`${this.spec.kind}: leitura falhou: ${(e as Error).message}`);
        onError(e as Error);
      }
      this.timer = setTimeout(() => void loop(), wait);
    };
    void loop();
    return () => { alive = false; if (this.timer) clearTimeout(this.timer); this.timer = null; this.thread.stop(); };
  }

  async send(_cmd: RoomCommand): Promise<CommandResult> {
    return { ok: false, error: this.spec.sendError };
  }
}
