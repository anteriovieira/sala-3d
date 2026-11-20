// Processo principal: hospeda os conectores e o agregador, guarda credenciais,
// fala com a janela por IPC e serve a sala para navegadores (local e rede com chave).

import { app, BrowserWindow, clipboard, ipcMain, safeStorage, shell, type IpcMainInvokeEvent } from 'electron';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateCommand } from '@shared/commands';
import { IPC, type ConnectionInput } from '@shared/api';
import type { LanInfo } from '@shared/types';
import { ConfigStore, type Cipher } from './config';
import { Hub } from './hub';
import { factories, kindInfo } from './registry';
import { RoomServer } from './server';

const log = (m: string) => console.error(new Date().toISOString().slice(11, 19), m); // nunca conteúdo de conversa

if (process.env.SALA_USER_DATA) app.setPath('userData', process.env.SALA_USER_DATA);

const cipher: Cipher = {
  available: () => safeStorage.isAsyncEncryptionAvailable(),
  encrypt: async (s) => (await safeStorage.encryptStringAsync(s)).toString('base64'),
  decrypt: async (s) => (await safeStorage.decryptStringAsync(Buffer.from(s, 'base64'))).result,
};

let win: BrowserWindow | null = null;
let store: ConfigStore;
let hub: Hub;
let server: RoomServer;
const FACTORIES = factories(log);
const rendererDir = join(import.meta.dirname, '../renderer');

async function startConnection(id: string) {
  const entry = store.list().find((c) => c.id === id);
  if (!entry || !entry.enabled) return;
  const f = FACTORIES.find((x) => x.kind === entry.kind);
  if (!f) return log(`tipo de conexão desconhecido: ${entry.kind}`);
  const config = (await store.full(entry.id)) || {};
  if (hub.ids().includes(entry.id)) return;
  hub.add(entry.id, entry.kind, entry.label, f.create(), config);
}

async function firstRun() {
  store.initEmpty();
  await store.upsert({ kind: 'demo', label: 'Demonstração', enabled: true, config: { seed: 7, agents: 0, interval: 2500 }, secrets: {} });
  // OpenMausBot detectado neste computador: fica cadastrado, desligado, para o dono ligar quando quiser
  if (existsSync(join(homedir(), '.openmausbot', 'bots.json'))) {
    await store.upsert({ kind: 'openmausbot', label: 'OpenMausBot', enabled: false, config: { dataDir: '~/.openmausbot', pollMs: 3000, legacyDir: '' }, secrets: {} });
  }
}

function lanInfo(): LanInfo {
  const s = store.server();
  return { enabled: s.lanEnabled, port: s.lanPort, localUrl: `http://127.0.0.1:${s.localPort}/`, urls: s.lanEnabled ? server.lanUrls(s.lanPort, store.lanKey()) : [] };
}

/** Só a própria janela do app chama o IPC. */
function trusted(e: IpcMainInvokeEvent): boolean {
  const u = e.senderFrame?.url || '';
  return !!win && e.sender === win.webContents && (u.startsWith('file://') || (!!process.env.ELECTRON_RENDERER_URL && u.startsWith(process.env.ELECTRON_RENDERER_URL)));
}

function handle<A extends unknown[], R>(ch: string, fn: (...a: A) => R | Promise<R>) {
  ipcMain.handle(ch, (e, ...args) => {
    if (!trusted(e)) throw new Error('origem não permitida');
    return fn(...(args as A));
  });
}

function registerIpc() {
  handle(IPC.getState, () => hub.state());
  handle(IPC.send, async (raw: unknown) => {
    const v = validateCommand(raw);
    if (!v.ok) return { ok: false, error: v.error };
    return hub.send(v.cmd);
  });
  handle(IPC.kinds, () => FACTORIES.map(kindInfo));
  handle(IPC.connections, () => store.list());
  handle(IPC.saveConnection, async (c: ConnectionInput) => {
    const f = FACTORIES.find((x) => x.kind === c?.kind);
    if (!f) return { ok: false, error: 'tipo desconhecido' };
    if (!c.id && !f.multiple && store.list().some((x) => x.kind === f.kind)) return { ok: false, error: 'já existe uma conexão deste tipo' };
    const secretKeys = new Set(f.fields.filter((x) => x.type === 'secret').map((x) => x.key));
    const config: Record<string, unknown> = {};
    const secrets: Record<string, string | null | undefined> = {};
    for (const field of f.fields) {
      if (secretKeys.has(field.key)) secrets[field.key] = c.secrets?.[field.key] ?? undefined;
      else if (c.config?.[field.key] !== undefined) config[field.key] = field.type === 'number' ? Number(c.config[field.key]) : field.type === 'boolean' ? !!c.config[field.key] : String(c.config[field.key]).slice(0, 2000);
    }
    const prev = c.id ? store.list().find((x) => x.id === c.id) : undefined;
    for (const field of f.fields) {
      if (!field.required) continue;
      const has = secretKeys.has(field.key) ? (secrets[field.key] ?? (prev?.secretsSet.includes(field.key) ? 'x' : '')) : String(config[field.key] ?? '').trim();
      if (!has) return { ok: false, error: `Preencha: ${field.label}` };
    }
    const label = String(c.label || (f.kind === 'http' ? config.name : '') || f.label).slice(0, 60);
    const entry = await store.upsert({ id: c.id, kind: f.kind, label, enabled: c.enabled !== false, config, secrets });
    await hub.remove(entry.id);
    await startConnection(entry.id);
    return { ok: true, entry };
  });
  handle(IPC.removeConnection, async (id: string) => {
    await hub.remove(id);
    store.remove(id);
  });
  handle(IPC.lan, () => lanInfo());
  handle(IPC.setLan, async (enabled: boolean) => {
    const s = store.setServer({ lanEnabled: !!enabled });
    try {
      await server.setLan({ enabled: s.lanEnabled, port: s.lanPort, key: store.lanKey() });
      return lanInfo();
    } catch (e) {
      store.setServer({ lanEnabled: false });
      return { ...lanInfo(), error: 'Não consegui abrir a porta ' + s.lanPort + ': ' + (e as Error).message };
    }
  });
  handle(IPC.copy, (text: string) => clipboard.writeText(String(text).slice(0, 2000)));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 760,
    minHeight: 520,
    title: 'Sala 3D',
    backgroundColor: '#070a12',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    if (!(dev && url.startsWith(dev))) e.preventDefault();
  });
  win.on('closed', () => { win = null; });
  if (process.env.SALA_SMOKE) smoke(win, process.env.SALA_SMOKE);
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(rendererDir, 'index.html'));
}

/**
 * Teste de fumaça (SALA_SMOKE=<pasta>): registra erros do console, mede a sala por alguns
 * segundos (bots, menor distância entre eles), salva capturas e fecha. Usado por scripts/smoke.mjs.
 */
function smoke(w: BrowserWindow, dir: string) {
  const errors: string[] = [];
  w.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') errors.push(`${e.level}: ${e.message}`); });
  w.webContents.on('render-process-gone', (_e, d) => errors.push('renderer caiu: ' + d.reason));
  const secs = Number(process.env.SALA_SMOKE_SECONDS || 12);
  const js = (code: string) => w.webContents.executeJavaScript(code, true);
  void (async () => {
    const { writeFileSync } = await import('node:fs');
    await new Promise<void>((r) => w.webContents.once('did-finish-load', () => r()));
    let minD = Infinity;
    const t0 = Date.now();
    let shot = 0;
    while (Date.now() - t0 < secs * 1000) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const d = await js('window.__salaDebug ? window.__salaDebug() : null');
        if (d && Date.now() - t0 > 2500) minD = Math.min(minD, d.min);
      } catch { /* página recarregando */ }
      if (Date.now() - t0 > 5000 && shot === 0) {
        shot++;
        writeFileSync(join(dir, 'shot-1.png'), (await w.webContents.capturePage()).toPNG());
        // abre a janela de conversa do primeiro bot e a caixa de grupo para a segunda captura
        await js(`(() => { const l = document.querySelector('.bot-label'); l && l.click(); })()`);
      }
    }
    writeFileSync(join(dir, 'shot-2.png'), (await w.webContents.capturePage()).toPNG());
    const info = await js(`({ labels: document.querySelectorAll('.bot-label').length, rows: document.querySelectorAll('.r-row').length, windows: document.querySelectorAll('.cwin').length, live: document.getElementById('live')?.textContent, debug: window.__salaDebug && window.__salaDebug() })`);
    // servidor para navegadores: estado, página e envio (com e sem a origem certa)
    const base = `http://127.0.0.1:${store.server().localPort}`;
    const http: Record<string, unknown> = {};
    try {
      http.state = (await fetch(base + '/api/state')).status;
      http.page = (await fetch(base + '/')).status;
      const agentId = hub.state().agents[0]?.id;
      const body = JSON.stringify({ type: 'message.agent', agentId, text: 'teste de fumaça' });
      http.postOk = (await fetch(base + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body })).status;
      http.postBadOrigin = (await fetch(base + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body })).status;
      http.postBadType = (await fetch(base + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{"type":"x"}' })).status;
    } catch (e) { http.error = (e as Error).message; }
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ minDistance: minD, fps: info?.debug?.fps ?? null, errors, info, http, state: { agents: hub.state().agents.length, connectors: hub.state().connectors } }, null, 2));
    app.exit(0);
  })().catch((e) => { console.error('smoke', e); app.exit(1); });
}

app.whenReady().then(async () => {
  store = new ConfigStore(app.getPath('userData'), cipher);
  if (!(await cipher.available().catch(() => false))) log('aviso: cofre do sistema indisponível; segredos ficam só com permissão de dono (0600)');
  hub = new Hub(store.slots(), log);
  hub.onState((s) => win?.webContents.send(IPC.state, s));
  if (store.isFirstRun()) await firstRun();
  for (const c of store.list()) await startConnection(c.id);
  server = new RoomServer({ staticDir: rendererDir, getState: () => hub.state(), onState: (fn) => hub.onState(fn), send: (c) => hub.send(c), log });
  const s = store.server();
  await server.start(s.localPort, { enabled: s.lanEnabled, port: s.lanPort, key: store.lanKey() }).catch((e) => log('servidor: ' + e.message));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let quitting = false;
app.on('before-quit', (e) => {
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  Promise.allSettled([hub?.stopAll(), server?.stop()]).finally(() => app.exit(0));
});
