// Testes do RoomServer (src/main/server.ts) com servidor real em porta livre.
// `it.todo` marca o que o PR de endurecimento do Caio vai mudar.

import { createServer as createNet } from 'node:net';
import { request, type IncomingHttpHeaders } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomServer } from '../src/main/server';
import type { CommandResult, RoomCommand, RoomState } from '../src/shared/types';

const STATE: RoomState = { at: 1, agents: [], groups: [], events: [], connectors: [] };
const CMD: RoomCommand = { type: 'message.agent', agentId: 'demo:1', text: 'oi' };

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createNet();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => resolve(p));
    });
  });
}

interface Res { status: number; headers: IncomingHttpHeaders; body: string }

/** HTTP cru: deixa mexer em Host, Origin e no caminho sem normalização do fetch. */
function raw(port: number, o: { method?: string; path?: string; headers?: Record<string, string>; body?: string | Buffer } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method: o.method ?? 'GET', path: o.path ?? '/', headers: o.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}

const json = (extra: Record<string, string> = {}) => ({ 'Content-Type': 'application/json', ...extra });

describe('RoomServer', () => {
  let dir: string;
  let staticDir: string;
  let server: RoomServer;
  let send: ReturnType<typeof vi.fn<(c: RoomCommand) => Promise<CommandResult>>>;
  let log: ReturnType<typeof vi.fn<(m: string) => void>>;
  let emit: (s: RoomState) => void;
  let localPort: number;
  let lanPort: number;
  const KEY = 'chave-de-teste-123';

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sala-srv-'));
    staticDir = join(dir, 'renderer');
    mkdirSync(staticDir);
    writeFileSync(join(staticDir, 'index.html'), '<h1>sala</h1>');
    writeFileSync(join(staticDir, 'app.js'), 'console.log(1)');
    writeFileSync(join(staticDir, 'blob.bin'), 'x');
    writeFileSync(join(dir, 'secret.txt'), 'segredo');
    send = vi.fn(async () => ({ ok: true }));
    log = vi.fn();
    server = new RoomServer({
      staticDir,
      getState: () => STATE,
      onState: (fn) => { emit = fn; return () => {}; },
      send,
      log,
    });
    localPort = await freePort();
    lanPort = await freePort();
  });

  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('modo local (127.0.0.1)', () => {
    beforeEach(async () => {
      await server.start(localPort, { enabled: false, port: lanPort, key: KEY });
    });
    const origin = () => `http://127.0.0.1:${localPort}`;

    it('GET /api/state devolve o estado em JSON, sem cache', async () => {
      const r = await raw(localPort, { path: '/api/state' });
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/json');
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(JSON.parse(r.body)).toEqual(STATE);
    });

    it('aceita Host localhost:<porta> e recusa qualquer outro Host (403)', async () => {
      expect((await raw(localPort, { path: '/api/state', headers: { Host: `localhost:${localPort}` } })).status).toBe(200);
      expect((await raw(localPort, { path: '/api/state', headers: { Host: 'evil.example' } })).status).toBe(403);
      expect((await raw(localPort, { path: '/api/state', headers: { Host: `127.0.0.1:${localPort + 1}` } })).status).toBe(403);
    });

    it('POST válido com Origin certo chama send e devolve 200', async () => {
      const r = await raw(localPort, { method: 'POST', path: '/api/command', headers: json({ Origin: origin() }), body: JSON.stringify(CMD) });
      expect(r.status).toBe(200);
      expect(JSON.parse(r.body)).toEqual({ ok: true });
      expect(send).toHaveBeenCalledWith(CMD);
    });

    it('POST com Origin de outro site, sem Origin, ou content-type errado -> 403 e send não é chamado', async () => {
      const body = JSON.stringify(CMD);
      expect((await raw(localPort, { method: 'POST', path: '/api/command', headers: json({ Origin: 'http://evil.example' }), body })).status).toBe(403);
      expect((await raw(localPort, { method: 'POST', path: '/api/command', headers: json(), body })).status).toBe(403);
      expect((await raw(localPort, { method: 'POST', path: '/api/command', headers: { 'Content-Type': 'text/plain', Origin: origin() }, body })).status).toBe(403);
      expect(send).not.toHaveBeenCalled();
    });

    it('POST em outro caminho -> 403', async () => {
      const r = await raw(localPort, { method: 'POST', path: '/api/other', headers: json({ Origin: origin() }), body: JSON.stringify(CMD) });
      expect(r.status).toBe(403);
    });

    it('corpo acima de 8000 bytes -> 413', async () => {
      const big = JSON.stringify({ ...CMD, text: 'a'.repeat(9000) });
      const r = await raw(localPort, { method: 'POST', path: '/api/command', headers: json({ Origin: origin() }), body: big });
      expect(r.status).toBe(413);
      expect(send).not.toHaveBeenCalled();
    });

    it('JSON malformado -> 400', async () => {
      const r = await raw(localPort, { method: 'POST', path: '/api/command', headers: json({ Origin: origin() }), body: '{nope' });
      expect(r.status).toBe(400);
    });

    it('comando inválido -> 400 com { ok:false, error }', async () => {
      const r = await raw(localPort, { method: 'POST', path: '/api/command', headers: json({ Origin: origin() }), body: '{"type":"x"}' });
      expect(r.status).toBe(400);
      const j = JSON.parse(r.body);
      expect(j.ok).toBe(false);
      expect(typeof j.error).toBe('string');
      expect(send).not.toHaveBeenCalled();
    });

    it('conector recusou (send -> ok:false) -> 502 com o resultado', async () => {
      send.mockResolvedValueOnce({ ok: false, error: 'offline' });
      const r = await raw(localPort, { method: 'POST', path: '/api/command', headers: json({ Origin: origin() }), body: JSON.stringify(CMD) });
      expect(r.status).toBe(502);
      expect(JSON.parse(r.body)).toEqual({ ok: false, error: 'offline' });
    });

    it('método fora de GET/POST -> 405', async () => {
      expect((await raw(localPort, { method: 'PUT', path: '/api/state' })).status).toBe(405);
      expect((await raw(localPort, { method: 'DELETE', path: '/' })).status).toBe(405);
    });

    it('serve index.html em / e em rotas sem extensão, com o content-type certo', async () => {
      const a = await raw(localPort, { path: '/' });
      expect(a.status).toBe(200);
      expect(a.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(a.body).toBe('<h1>sala</h1>');
      expect((await raw(localPort, { path: '/qualquer-rota' })).body).toBe('<h1>sala</h1>');
      expect((await raw(localPort, { path: '/app.js' })).headers['content-type']).toBe('application/javascript; charset=utf-8');
      expect((await raw(localPort, { path: '/blob.bin' })).headers['content-type']).toBe('application/octet-stream');
    });

    it('arquivo inexistente -> 404', async () => {
      expect((await raw(localPort, { path: '/nao-existe.js' })).status).toBe(404);
    });

    it('sem build (index.html ausente) -> 404 com a dica de npm run build', async () => {
      rmSync(join(staticDir, 'index.html'));
      const r = await raw(localPort, { path: '/' });
      expect(r.status).toBe(404);
      expect(r.body).toContain('npm run build');
    });

    it('path traversal codificado (%2e%2e) não sai da pasta estática -> 403', async () => {
      const r = await raw(localPort, { path: '/%2e%2e/secret.txt' });
      expect(r.status).toBe(403);
      expect(r.body).not.toContain('segredo');
    });

    it('path traversal com barra codificada (..%2f) também -> 403', async () => {
      const r = await raw(localPort, { path: '/..%2fsecret.txt' });
      expect(r.status).toBe(403);
      expect(r.body).not.toContain('segredo');
    });

    // BUG (reportado no PR): decodeURIComponent('%') lança URIError e vira 500; o certo é 400.
    // it.fails passa enquanto o bug existe e quebra quando for corrigido (aí troque por it).
    it.fails('% malformado na URL responde 400 (hoje: 500)', async () => {
      const r = await raw(localPort, { path: '/%' });
      expect(r.status).toBe(400);
    });

    it('% malformado não derruba o servidor e registra o erro no log', async () => {
      const r = await raw(localPort, { path: '/%E0%A4%A' });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(log).toHaveBeenCalled();
      expect((await raw(localPort, { path: '/api/state' })).status).toBe(200);
    });

    it('SSE: manda o estado atual e depois cada atualização', async () => {
      await new Promise<void>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: localPort, path: '/api/events' }, (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toBe('text/event-stream');
          let buf = '';
          res.setEncoding('utf8');
          res.on('data', (d: string) => {
            buf += d;
            if (buf.includes('"at":1') && !buf.includes('"at":2')) emit({ ...STATE, at: 2 });
            if (buf.includes('"at":2')) {
              expect(buf).toContain('retry: 3000');
              req.destroy();
              resolve();
            }
          });
        });
        req.on('error', (e) => { if ((e as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(e); });
        req.end();
      });
    });

    it('stop() fecha a porta', async () => {
      await server.stop();
      await expect(raw(localPort, { path: '/api/state' })).rejects.toThrow();
    });
  });

  describe('modo rede local (LAN, com chave)', () => {
    beforeEach(async () => {
      await server.start(localPort, { enabled: true, port: lanPort, key: KEY });
    });
    const cookie = `sala_k=${KEY}`;

    it('sem chave nem cookie -> 403', async () => {
      const r = await raw(lanPort, { path: '/api/state' });
      expect(r.status).toBe(403);
      expect(r.body).toContain('chave');
    });

    it('?k= errado -> 403 e nenhum cookie', async () => {
      const r = await raw(lanPort, { path: '/?k=errada' });
      expect(r.status).toBe(403);
      expect(r.headers['set-cookie']).toBeUndefined();
    });

    it('?k= certo -> 302 para / com cookie HttpOnly; SameSite=Strict', async () => {
      const r = await raw(lanPort, { path: `/?k=${encodeURIComponent(KEY)}` });
      expect(r.status).toBe(302);
      expect(r.headers.location).toBe('/');
      const c = String(r.headers['set-cookie']);
      expect(c).toContain('sala_k=');
      expect(c).toContain('HttpOnly');
      expect(c).toContain('SameSite=Strict');
    });

    it('cookie certo -> 200; cookie errado -> 403', async () => {
      expect((await raw(lanPort, { path: '/api/state', headers: { Cookie: cookie } })).status).toBe(200);
      expect((await raw(lanPort, { path: '/api/state', headers: { Cookie: 'sala_k=errada' } })).status).toBe(403);
      expect((await raw(lanPort, { path: '/api/state', headers: { Cookie: `outro=1; ${cookie}` } })).status).toBe(200);
    });

    it('na LAN o Host não é restrito (só a chave conta)', async () => {
      const r = await raw(lanPort, { path: '/api/state', headers: { Cookie: cookie, Host: '192.168.0.10:' + lanPort } });
      expect(r.status).toBe(200);
    });

    it('POST com cookie e Origin igual ao Host -> 200; Origin diferente -> 403', async () => {
      const host = `127.0.0.1:${lanPort}`;
      const ok = await raw(lanPort, { method: 'POST', path: '/api/command', headers: json({ Cookie: cookie, Origin: 'http://' + host }), body: JSON.stringify(CMD) });
      expect(ok.status).toBe(200);
      const bad = await raw(lanPort, { method: 'POST', path: '/api/command', headers: json({ Cookie: cookie, Origin: 'http://evil.example' }), body: JSON.stringify(CMD) });
      expect(bad.status).toBe(403);
    });

    it('POST sem cookie -> 403', async () => {
      const r = await raw(lanPort, { method: 'POST', path: '/api/command', headers: json({ Origin: `http://127.0.0.1:${lanPort}` }), body: JSON.stringify(CMD) });
      expect(r.status).toBe(403);
      expect(send).not.toHaveBeenCalled();
    });

    it('setLan({ enabled:false }) desliga a porta da rede', async () => {
      await server.setLan({ enabled: false, port: lanPort, key: KEY });
      await expect(raw(lanPort, { path: '/api/state', headers: { Cookie: cookie } })).rejects.toThrow();
    });

    it('lanUrls inclui a chave codificada em ?k=', () => {
      for (const u of server.lanUrls(lanPort, 'a b/c')) expect(u).toMatch(/^http:\/\/[\d.]+:\d+\/\?k=a%20b%2Fc$/);
    });
  });

  // Vão mudar com o PR de endurecimento do Caio; ajustar quando ele entrar.
  describe('endurecimento (PR do Caio)', () => {
    it.todo('servidor local fica desligado por padrão');
    it.todo('chave também é exigida no modo local');
    it.todo('cookie guarda um token de sessão, não a chave');
    it.todo('?k= certo troca a chave por token de sessão e a chave não aparece no cookie');
    it.todo('limite de 16 clientes SSE: o 17º recebe erro (503) e não entra em this.clients');
  });
});
