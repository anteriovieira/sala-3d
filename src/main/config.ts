// Configuração guardada pelo app (pasta de dados do usuário). Segredos das conexões ficam
// cifrados pelo cofre do sistema (safeStorage) e nunca vão para o navegador.

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { ConnectionEntry } from '@shared/types';
import type { SlotStore } from './hub';

export interface Cipher {
  available(): Promise<boolean>;
  encrypt(s: string): Promise<string>;
  decrypt(s: string): Promise<string>;
}

interface StoredConnection {
  id: string;
  kind: string;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
  /** campo -> valor cifrado (base64) ou, sem cofre do sistema, "plain:" + valor */
  secrets: Record<string, string>;
}

export interface ServerSettings {
  lanEnabled: boolean;
  lanPort: number;
  localPort: number;
}

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(readFileSync(p, 'utf8')) as T; } catch { return fallback; }
}

function writeJson(p: string, v: unknown, mode = 0o600) {
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(v, null, 2), { mode });
  renameSync(tmp, p);
  try { chmodSync(p, mode); } catch { /* ignora */ }
}

export class ConfigStore {
  private connPath: string;
  private slotPath: string;
  private serverPath: string;
  private keyPath: string;

  constructor(private dir: string, private cipher: Cipher) {
    mkdirSync(dir, { recursive: true });
    this.connPath = join(dir, 'connections.json');
    this.slotPath = join(dir, 'slots.json');
    this.serverPath = join(dir, 'server.json');
    this.keyPath = join(dir, 'lan-key');
  }

  isFirstRun(): boolean {
    return !existsSync(this.connPath);
  }

  private all(): StoredConnection[] {
    return readJson<StoredConnection[]>(this.connPath, []);
  }

  list(): ConnectionEntry[] {
    return this.all().map((c) => ({ id: c.id, kind: c.kind, label: c.label, enabled: c.enabled, config: { ...c.config }, secretsSet: Object.keys(c.secrets).filter((k) => c.secrets[k]) }));
  }

  /** Configuração completa (com segredos decifrados), só para o processo principal. */
  async full(id: string): Promise<Record<string, unknown> | null> {
    const c = this.all().find((x) => x.id === id);
    if (!c) return null;
    const out: Record<string, unknown> = { ...c.config };
    for (const [k, v] of Object.entries(c.secrets)) {
      if (!v) continue;
      try { out[k] = v.startsWith('plain:') ? v.slice(6) : await this.cipher.decrypt(v); } catch { /* cofre trocado: campo fica vazio */ }
    }
    return out;
  }

  async upsert(entry: { id?: string; kind: string; label: string; enabled: boolean; config: Record<string, unknown>; secrets: Record<string, string | null | undefined> }): Promise<ConnectionEntry> {
    const list = this.all();
    let id = entry.id;
    if (!id) {
      const base = entry.kind.replace(/[^a-z0-9.-]/gi, '').toLowerCase() || 'conexao';
      id = base;
      let n = 2;
      while (list.some((c) => c.id === id)) id = base + '-' + n++;
    }
    const prev = list.find((c) => c.id === id);
    const secrets: Record<string, string> = { ...(prev?.secrets ?? {}) };
    const vault = await this.cipher.available().catch(() => false);
    for (const [k, v] of Object.entries(entry.secrets)) {
      if (v === undefined) continue; // não mexe
      if (v === null || v === '') delete secrets[k];
      else secrets[k] = vault ? await this.cipher.encrypt(v) : 'plain:' + v;
    }
    const rec: StoredConnection = { id, kind: entry.kind, label: entry.label, enabled: entry.enabled, config: entry.config, secrets };
    const next = prev ? list.map((c) => (c.id === id ? rec : c)) : [...list, rec];
    writeJson(this.connPath, next);
    return this.list().find((c) => c.id === id)!;
  }

  remove(id: string): void {
    writeJson(this.connPath, this.all().filter((c) => c.id !== id));
  }

  initEmpty(): void {
    if (!existsSync(this.connPath)) writeJson(this.connPath, []);
  }

  slots(): SlotStore {
    return { load: () => readJson<Record<string, number>>(this.slotPath, {}), save: (s) => writeJson(this.slotPath, s) };
  }

  server(): ServerSettings {
    return { lanEnabled: false, lanPort: 8766, localPort: 8765, ...readJson<Partial<ServerSettings>>(this.serverPath, {}) };
  }

  setServer(s: Partial<ServerSettings>): ServerSettings {
    const next = { ...this.server(), ...s };
    writeJson(this.serverPath, next);
    return next;
  }

  /** Chave de acesso pela rede: SALA_KEY do ambiente, ou criada uma vez e guardada só para o dono. */
  lanKey(): string {
    const env = process.env.SALA_KEY;
    if (env && env.length >= 20) return env;
    try {
      const k = readFileSync(this.keyPath, 'utf8').trim();
      if (k.length >= 20) return k;
    } catch { /* cria */ }
    const k = randomBytes(18).toString('base64url');
    writeFileSync(this.keyPath, k + '\n', { mode: 0o600 });
    return k;
  }
}
