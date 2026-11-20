// Diagnóstico só de leitura: abre a sala que já está rodando (modo navegador, SSE) numa janela
// escondida, mede os tempos de quadro e tira capturas de perto de um bot trabalhando e de um na recarga.
// Não envia nenhum comando. Uso: npm run build && npx electron scripts/inspect.mjs [porta] [pasta-saída]
import { app, BrowserWindow } from 'electron';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : '8765';
const out = process.argv[3] || mkdtempSync(join(tmpdir(), 'sala-inspect-'));
app.setPath('userData', mkdtempSync(join(tmpdir(), 'sala-inspect-profile-')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, paintWhenInitiallyHidden: true, webPreferences: { backgroundThrottling: false } });
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => writeFileSync(join(out, name), (await win.webContents.capturePage()).toPNG());
  const result = { out };
  try {
    await win.loadURL(`http://127.0.0.1:${port}/`);
    await sleep(7000);
    result.overview = await js('window.__salaEngine.frameStats()');
    result.agents = await js('window.__salaEngine.room.agents.length');
    await shot('overview.png');
    const pick = async (cond) => js(`(() => { const e = window.__salaEngine; for (const b of e.bots.values()) if (${cond}) return b.d.id; return null; })()`);
    const working = await pick("b.d.status === 'working' && !b.move");
    if (working) {
      await js(`window.__salaEngine.focusAgent(${JSON.stringify(working)})`);
      await sleep(3500);
      await shot('working.png');
    }
    const docked = await pick('b.wantDock && b.dock > 0.9');
    if (docked) {
      await js(`window.__salaEngine.focusAgent(${JSON.stringify(docked)})`);
      await sleep(3500);
      await shot('dock.png');
    }
    await js('window.__salaEngine.viewAll()');
    await sleep(5500);
    result.later = await js('window.__salaEngine.frameStats()');
    result.found = { working: !!working, docked: !!docked };
  } catch (e) {
    result.error = String(e);
  }
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  app.exit(0);
});
