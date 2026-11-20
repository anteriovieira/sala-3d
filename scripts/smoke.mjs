// Teste de fumaça: abre o app já compilado (npm run build) com dados isolados e o conector
// de demonstração, mede por alguns segundos e salva capturas + result.json.
// Uso: node scripts/smoke.mjs [segundos] [nº de agentes]
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electron from 'electron';

const secs = process.argv[2] || '12';
const agents = Number(process.argv[3] || 20);
const dir = mkdtempSync(join(tmpdir(), 'sala-smoke-'));
const userData = join(dir, 'userdata');
// conexões de teste: demonstração com N agentes + uma segunda demonstração (dois conectores ao mesmo tempo)
mkdirSync(userData, { recursive: true });
writeFileSync(join(userData, 'connections.json'), JSON.stringify([
  { id: 'demo', kind: 'demo', label: 'Demo A', enabled: true, config: { seed: 7, agents, interval: 800 }, secrets: {} },
  { id: 'demo-2', kind: 'demo', label: 'Demo B', enabled: true, config: { seed: 3, agents: 4, interval: 900 }, secrets: {} },
]));
writeFileSync(join(userData, 'server.json'), JSON.stringify({ lanEnabled: false, lanPort: 18766, localPort: 18765 }));
const r = spawnSync(electron, ['.'], { env: { ...process.env, SALA_SMOKE: dir, SALA_SMOKE_SECONDS: secs, SALA_USER_DATA: userData }, stdio: 'inherit', timeout: (Number(secs) + 40) * 1000 });
console.log('saída:', r.status, 'pasta:', dir);
console.log(readFileSync(join(dir, 'result.json'), 'utf8'));
