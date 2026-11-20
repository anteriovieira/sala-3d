// Thread de leitura (ver readerThread.ts). Abre os bancos e monta o snapshot fora do processo principal.
// Só devolve o snapshot quando ele muda; senão responde { same: true }, sem copiar nada.

import { parentPort } from 'node:worker_threads';
import type { ConnectorSnapshot } from '@shared/types';
import { OpenMausBotReader } from './openmausbot';
import { OpenBotReader } from './openbot';
import { TucanoReader } from './tucano';
import { GrokBotReader } from './grokbot';
import type { WorkerReply, WorkerRequest } from './readerProtocol';

let reader: { kind: string; home: string; snapshot: () => ConnectorSnapshot } | null = null;
let last = '';

parentPort?.on('message', (req: WorkerRequest) => {
  let reply: WorkerReply;
  try {
    if (!reader || reader.kind !== req.kind || reader.home !== req.home) {
      const r = req.kind === 'openbot' ? new OpenBotReader(req.home)
        : req.kind === 'tucano' ? new TucanoReader(req.home)
        : req.kind === 'grokbot' ? new GrokBotReader(req.home)
        : new OpenMausBotReader(req.home);
      reader = { kind: req.kind, home: req.home, snapshot: () => r.snapshot() };
      last = '';
    }
    const snap = reader.snapshot();
    const key = JSON.stringify(snap);
    if (key === last) reply = { id: req.id, ok: true, same: true };
    else { last = key; reply = { id: req.id, ok: true, snap }; }
  } catch (e) {
    reply = { id: req.id, ok: false, error: (e as Error).message || String(e) };
  }
  parentPort!.postMessage(reply);
});
