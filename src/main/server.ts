// Servidor HTTP da sala para navegadores: 127.0.0.1 (este computador) e, se ligado,
// a rede local com chave (?k=<chave> uma vez -> cookie HttpOnly; SameSite=Strict).
// Estado por SSE (empurrado), comandos por POST. Conexões e credenciais só pela janela do app.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { validateCommand } from '@shared/commands';
import type { CommandResult, RoomCommand, RoomState } from '@shared/types';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

export interface RoomServerDeps {
  staticDir: string;
  getState: () => RoomState;
  onState: (fn: (s: RoomState) => void) => () => void;
  send: (cmd: RoomCommand) => Promise<CommandResult>;
  log: (m: string) => void;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export class RoomServer {
  private local?: Server;
  private lan?: Server;
  private clients = new Set<ServerResponse>();
  private unsub?: () => void;

  constructor(private deps: RoomServerDeps) {}

  private handler(mode: 'local' | 'lan', port: number, key?: string) {
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    return async (req: IncomingMessage, res: ServerResponse) => {
      const out = (code: number, body: string | Buffer = '', type = 'text/plain; charset=utf-8', extra: Record<string, string> = {}) => {
        res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
        res.end(body);
      };
      try {
        const url = new URL(req.url || '/', 'http://x');
        const host = req.headers.host || '';
        if (mode === 'lan' && key) {
          const given = url.searchParams.get('k');
          if (given && same(given, key)) {
            return out(302, '', 'text/plain', { Location: '/', 'Set-Cookie': `sala_k=${key}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict` });
          }
          const ok = (req.headers.cookie || '').split(';').some((p) => {
            const [n, ...v] = p.trim().split('=');
            return n === 'sala_k' && same(v.join('='), key);
          });
          if (!ok) return out(403, 'Sala 3D: abra pelo link com a chave.');
        } else if (!hosts.includes(host)) return out(403);

        if (req.method === 'POST') {
          // só a própria página da sala pode enviar
          const origin = req.headers.origin || '';
          const originOk = mode === 'lan' ? origin === 'http://' + host : hosts.some((h) => origin === 'http://' + h);
          if (url.pathname !== '/api/command' || !originOk || !(req.headers['content-type'] || '').startsWith('application/json')) return out(403);
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const c of req) {
            size += (c as Buffer).length;
            if (size > 8000) return out(413);
            chunks.push(c as Buffer);
          }
          let body: unknown;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return out(400); }
          const v = validateCommand(body);
          if (!v.ok) return out(400, JSON.stringify({ ok: false, error: v.error }), 'application/json');
          const r = await this.deps.send(v.cmd);
          return out(r.ok ? 200 : 502, JSON.stringify(r), 'application/json');
        }
        if (req.method !== 'GET') return out(405);
        if (url.pathname === '/api/state') return out(200, JSON.stringify(this.deps.getState()), 'application/json; charset=utf-8');
        if (url.pathname === '/api/events') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write('retry: 3000\n\n');
          res.write('data: ' + JSON.stringify(this.deps.getState()) + '\n\n');
          this.clients.add(res);
          const ping = setInterval(() => res.write(': ping\n\n'), 20000);
          req.on('close', () => { clearInterval(ping); this.clients.delete(res); });
          return;
        }
        // arquivos do app
        let p = decodeURIComponent(url.pathname);
        if (p === '/' || !extname(p)) p = '/index.html';
        const file = normalize(join(this.deps.staticDir, p));
        if (!file.startsWith(normalize(this.deps.staticDir) + sep)) return out(403);
        try {
          const data = await readFile(file);
          return out(200, data, TYPES[extname(file)] || 'application/octet-stream');
        } catch {
          return out(404, p === '/index.html' ? 'Sala 3D: rode "npm run build" para servir a sala pela rede.' : '');
        }
      } catch (e) {
        this.deps.log('servidor: ' + (e as Error).message);
        if (!res.headersSent) out(500);
      }
    };
  }

  private broadcast(s: RoomState) {
    const line = 'data: ' + JSON.stringify(s) + '\n\n';
    for (const c of this.clients) c.write(line);
  }

  async start(localPort: number, lan: { enabled: boolean; port: number; key: string }): Promise<void> {
    this.unsub ??= this.deps.onState((s) => this.broadcast(s));
    if (!this.local) {
      this.local = createServer(this.handler('local', localPort));
      await this.listen(this.local, localPort, '127.0.0.1').catch((e) => { this.deps.log('porta local ocupada: ' + e.message); this.local = undefined; });
    }
    await this.setLan(lan);
  }

  async setLan(lan: { enabled: boolean; port: number; key: string }): Promise<void> {
    if (this.lan) {
      await new Promise<void>((r) => this.lan!.close(() => r()));
      this.lan.closeAllConnections?.();
      this.lan = undefined;
    }
    if (!lan.enabled) return;
    const srv = createServer(this.handler('lan', lan.port, lan.key));
    await this.listen(srv, lan.port, '0.0.0.0');
    this.lan = srv;
  }

  lanUrls(port: number, key: string): string[] {
    const out: string[] = [];
    for (const list of Object.values(networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}/?k=${encodeURIComponent(key)}`);
    }
    return out;
  }

  private listen(s: Server, port: number, host: string) {
    return new Promise<void>((resolve, reject) => {
      s.once('error', reject);
      s.listen(port, host, () => { s.off('error', reject); resolve(); });
    });
  }

  async stop(): Promise<void> {
    this.unsub?.();
    for (const c of this.clients) c.end();
    this.clients.clear();
    for (const s of [this.local, this.lan]) if (s) { s.closeAllConnections?.(); await new Promise<void>((r) => s.close(() => r())); }
  }
}
