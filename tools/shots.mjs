// Screenshot tool: serves game/, loads each ?shot= scene in headless
// Chromium, waits for window.__shotReady, captures via CDP
// Page.captureScreenshot (fromSurface:false) at 1280x720 JPEG.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8081;
const SHOTS = JSON.parse(readFileSync(`${ROOT}/shots.json`, 'utf8'));

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

let failed = 0;
try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  for (const shot of SHOTS) {
    const url = `http://127.0.0.1:${PORT}/?${shot.query.slice(1)}`;
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
    } catch {
      console.log(`TIMEOUT waiting for __shotReady: ${shot.name}`);
      failed += 1;
      continue;
    }
    const cdp = await context.newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82, fromSurface: false });
    const buf = Buffer.from(data, 'base64');
    mkdirSync(`${ROOT}/screenshots`, { recursive: true });
    writeFileSync(`${ROOT}/screenshots/${shot.name}`, buf);
    console.log(`${shot.name}: ${buf.length} bytes`);
  }
  const external = requests.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:'));
  console.log(`requests: ${requests.length} total, ${external.length} external${external.length ? ' -> ' + external.join(', ') : ''}`);
  await browser.close();
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
