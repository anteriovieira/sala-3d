// Bench de quadros (dev): troca a sala do motor por salas sintéticas de N bots e mede.
// Uso no console do DevTools: await __salaBench()  ·  await __salaBench([10, 30, 60], 20)
// A janela precisa ficar visível e em primeiro plano: janela escondida não gera quadros.
import type { Agent, ConnectorInfo, RoomState, Status } from '../shared/types';
import { useUI } from './store';
import { getEngine } from './ui/actions';

const STATUSES: Status[] = ['available', 'working', 'waiting', 'problem'];
const DEPTS = ['Produto', 'Engenharia', 'Design', 'Vendas', 'Suporte'];

const BENCH_CONNECTOR: ConnectorInfo = {
  id: 'bench',
  kind: 'bench',
  label: 'Bench',
  state: 'online',
  capabilities: {
    sendToAgent: false,
    sendToGroup: false,
    retryTask: false,
    groups: false,
    departments: true,
    chatHistory: false,
    transport: 'poll',
  },
  departments: DEPTS,
};

/** Sala falsa com n bots espalhados por 5 departamentos e os 4 estados (um chefe por departamento). */
export function fakeRoom(n: number, at = Date.now()): RoomState {
  const agents: Agent[] = [];
  for (let i = 0; i < n; i++) {
    const status = STATUSES[i % STATUSES.length];
    agents.push({
      id: `bench:${i}`,
      connectorId: 'bench',
      name: `Bot ${i + 1}`,
      role: 'Bench',
      department: DEPTS[i % DEPTS.length],
      chief: i < DEPTS.length,
      slot: i,
      status,
      need: status === 'waiting' ? 'Precisa de você' : '',
      doing: status === 'working' ? 'Medindo quadros' : undefined,
      chat: [],
      statusSince: at,
    });
  }
  return { at, agents, groups: [], events: [], connectors: [BENCH_CONNECTOR] };
}

export interface BenchResult {
  bots: number;
  /** média de quadros por segundo */
  avg: number;
  /** 95% dos quadros levaram até isto (ms) */
  p95Ms: number;
  worstMs: number;
  frames: number;
  /** draw calls e triângulos do último quadro */
  calls: number;
  triangles: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function sampleFrames(ms: number): Promise<number[]> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = 0;
    const end = performance.now() + ms;
    const tick = (now: number) => {
      if (last) gaps.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick);
      else resolve(gaps);
    };
    requestAnimationFrame(tick);
  });
}

/** Resumo de uma amostra de intervalos entre quadros. Exportado para teste. */
export function summarize(bots: number, gaps: number[], calls: number, triangles: number): BenchResult {
  const total = gaps.reduce((a, b) => a + b, 0);
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    bots,
    avg: total ? round1((1000 * gaps.length) / total) : 0,
    p95Ms: round1(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0),
    worstMs: round1(sorted[sorted.length - 1] ?? 0),
    frames: gaps.length,
    calls,
    triangles,
  };
}

let running = false;

/**
 * Mede cada tamanho de sala: troca para a sala falsa, espera 5 s de aquecimento
 * (bots entrando, shaders, texturas) e amostra `secs` segundos.
 * Durante a medição, as atualizações reais da sala não chegam ao motor; no fim a sala real volta.
 */
export async function runBench(counts: number[] = [10, 30, 60], secs = 20): Promise<BenchResult[]> {
  const engine = getEngine();
  if (!engine) throw new Error('motor ainda não existe');
  if (running) throw new Error('bench já está rodando');
  running = true;
  const target = engine as unknown as { setRoom: (s: RoomState) => void };
  const realSetRoom = target.setRoom;
  target.setRoom = () => {}; // segura as atualizações reais
  const out: BenchResult[] = [];
  try {
    for (const n of counts) {
      realSetRoom.call(engine, fakeRoom(n));
      await wait(5000);
      const gaps = await sampleFrames(secs * 1000);
      const s = engine.fpsStats();
      out.push(summarize(n, gaps, s.calls, s.triangles));
    }
  } finally {
    target.setRoom = realSetRoom;
    engine.setRoom(useUI.getState().room);
    running = false;
  }
  console.table(out);
  return out;
}

(window as unknown as { __salaBench: typeof runBench }).__salaBench = runBench;
