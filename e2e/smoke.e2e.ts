import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Smoke e2e: precisa de `npm run build` antes (usa out/main via "main" do package.json).
test('app abre, canvas 3D aparece e o Roster mostra bots do conector demo', async () => {
  const app = await electron.launch({
    args: ['.', ...(process.env.CI ? ['--no-sandbox'] : [])],
    env: { ...process.env, SALA_USER_DATA: mkdtempSync(join(tmpdir(), 'sala-e2e-')) },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    const box = await page.locator('canvas').first().boundingBox();
    expect(box && box.width > 100 && box.height > 100).toBeTruthy();

    await expect(page.locator('#roster')).toBeVisible();
    await expect(page.locator('#roster .r-row').first()).toBeVisible({ timeout: 30_000 });
    expect(await page.locator('#roster .r-row').count()).toBeGreaterThan(0);

    // resize nao deve quebrar o canvas
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 600));
    await expect(page.locator('canvas').first()).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
