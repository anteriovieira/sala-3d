// Leitura de dados locais numa thread separada (readerWorker.js, gerado ao lado do index.js), para que uma
// leitura lenta (disco frio, banco trancado) não trave o IPC da janela. Sem o arquivo gerado (testes rodando do
// código-fonte) a leitura acontece no próprio processo. Uma thread por conexão; só existe enquanto há assinatura.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ConnectorSnapshot } from '@shared/types';
import type { ReaderKind, WorkerReply, WorkerRequest } from './readerProtocol';

export const READ_TIMEOUT_MS = 20000;
let workerFile: string | null | undefined;

function findWorker(): string | null {
  if (workerFile === undefined) {
    // no build este código pode cair em out/main/chunks/, e a thread fica em out/main/
    const dirs = [import.meta.dirname, join(import.meta.dirname, '..')];
    workerFile = dirs.map((d) => join(d, 'readerWorker.js')).find((f) => existsSync(f)) ?? null;
  }
  return workerFile;
}

export class ReaderThread {
  private worker: Worker | null = null;
  private reqId = 0;
  private last = '';
  private pending = new Map<number, { resolve: (r: WorkerReply) => void; reject: (e: Error) => void }>();
  /** null força leitura no próprio processo (testes). */
  file: string | null | undefined = undefined;

  constructor(private readonly kind: ReaderKind) {}

  /** Esquece o último snapshot: a próxima leitura sempre entrega. */
  reset(): void { this.last = ''; this.stop(); }

  /** Devolve o snapshot novo, ou null quando nada mudou desde a última leitura. */
  async read(home: string, inline: () => ConnectorSnapshot): Promise<ConnectorSnapshot | null> {
    const file = this.file === undefined ? findWorker() : this.file;
    if (!file) {
      const s = inline();
      const key = JSON.stringify(s);
      if (key === this.last) return null;
      this.last = key;
      return s;
    }
    const w = this.ensure(file);
    const id = ++this.reqId;
    const reply = await new Promise<WorkerReply>((resolve, reject) => {
      const t = setTimeout(() => {
        // leitura presa: descarta a thread e cria outra na próxima vez
        this.pending.delete(id);
        this.stop();
        reject(new Error('a leitura demorou mais de ' + READ_TIMEOUT_MS / 1000 + ' s'));
      }, READ_TIMEOUT_MS);
      this.pending.set(id, { resolve: (r) => { clearTimeout(t); resolve(r); }, reject: (e) => { clearTimeout(t); reject(e); } });
      w.postMessage({ id, kind: this.kind, home } satisfies WorkerRequest);
    });
    if (!reply.ok) throw new Error(reply.error);
    return 'snap' in reply ? reply.snap : null;
  }

  private ensure(file: string): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(file);
    w.unref();
    w.on('message', (r: WorkerReply) => { const p = this.pending.get(r.id); if (p) { this.pending.delete(r.id); p.resolve(r); } });
    const fail = (e: Error) => {
      if (this.worker !== w) return;
      this.worker = null;
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
    };
    w.on('error', (e) => fail(e));
    w.on('exit', (code) => fail(new Error('a thread de leitura parou (código ' + code + ')')));
    this.worker = w;
    return w;
  }

  stop(): void {
    const w = this.worker;
    this.worker = null;
    for (const p of this.pending.values()) p.reject(new Error('leitura cancelada'));
    this.pending.clear();
    if (w) void w.terminate();
  }
}
