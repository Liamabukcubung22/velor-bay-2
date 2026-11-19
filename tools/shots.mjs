// Render the four screenshots with Playwright + CDP captureScreenshot.
// Usage: node tools/shots.mjs [port]
// Serves game/ on localhost, opens each ?shot= scene, waits for
// window.__shotReady, then captures 1280x720 JPEG (quality 80) with
// fromSurface:false so heavy frames do not hang the capture.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
for (const p of [
  'playwright-core',
  '/home/hatch/workspace/makefun-token-radar-01/tools/node_modules/playwright-core',
]) {
  try {
    chromium = require(p).chromium;
    break;
  } catch { /* try next */ }
}
if (!chromium) throw new Error('playwright-core not found');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'game');
const OUT = join(ROOT, 'screenshots');
const PORT = Number(process.argv[2] || 8931);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const SHOTS = [
  { file: '1-drive.jpg', shot: 'drive' },
  { file: '2-title.jpg', shot: 'title' },
  { file: '3-wanted.jpg', shot: 'wanted' },
  { file: '4-mission.jpg', shot: 'mission' },
];

const server = createServer((req, res) => {
  const path = join(GAME, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(GAME) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end('nf');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true });
let failed = 0;
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?shot=${s.shot}&seed=1`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 45000 });
  } catch {
    console.log(`${s.file}: __shotReady timed out, capturing anyway`);
    failed++;
  }
  await page.waitForTimeout(400);
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, fromSurface: false });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, s.file), Buffer.from(shot.data, 'base64'));
  console.log(`${s.file}: ${(Buffer.from(shot.data, 'base64').length / 1024).toFixed(1)} KiB, errors=${errors.length}${errors.length ? ' ' + errors.join(' | ') : ''}`);
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
