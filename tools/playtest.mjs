// Velor Bay playtest: 25 checks through Playwright + window.__VB.
// Usage: node tools/playtest.mjs [port]
// Serves game/ on localhost. Waits on game state (waitForFunction), never
// on wall-clock sleeps, because the VM's game loop runs slower than real time.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
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
const PORT = Number(process.argv[2] || 8932);

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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const requests = [];
const errors = [];
page.on('request', (r) => requests.push(r.url()));
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const vb = (expr) => page.evaluate(expr);
const waitState = (fn, timeout) =>
  page.waitForFunction(fn, null, { timeout: timeout || 60000, polling: 400 });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
await waitState(() => !!window.__VB, 30000);

// 1. Load without console errors.
check('1 load tanpa console error', errors.length === 0, errors.join(' | ') || 'clean');

// 2. Start button begins a run.
await page.mouse.click(640, 630);
await waitState(() => window.__VB.screen === 'play', 30000);
check('2 tombol start memulai run', (await vb(`window.__VB.screen`)) === 'play');

// 3. Save written on new game.
const save = await page.evaluate(() => window.localStorage.getItem('velorbay-save-v1'));
check('3 save tertulis saat new game', !!save, save ? save.slice(0, 80) : 'no save');

// 4. Traffic and pedestrians populated.
const counts = await vb(`({ t: window.__VB.trafficCount, p: window.__VB.pedCount })`);
check('4 lalu lintas dan pejalan kaki terisi', counts.t >= 10 && counts.p >= 10, `traffic=${counts.t} peds=${counts.p}`);

// 5. Walking moves the player.
const p0 = await vb(`window.__VB.player`);
await page.keyboard.down('KeyW');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyW');
const p1 = await vb(`window.__VB.player`);
const moved = Math.hypot(p1.x - p0.x, p1.y - p0.y);
check('5 jalan kaki menggerakkan pemain', moved > 20, `moved ${moved.toFixed(0)}px`);

// 6. Mission 1 step 1: walk to the garage.
await vb(`window.__VB.goTo(620, 640)`);
await waitState(() => window.__VB.mission.step === 1, 60000);
check('6 misi 1 langkah 1 (jalan ke garasi)', (await vb(`window.__VB.mission.step`)) === 1);

// 7. Enter the mission car: clean, no wanted.
await vb(`window.__VB.teleport(660, 640); window.__VB.enterNearestCar()`);
const afterEnter = await vb(`({ inCar: window.__VB.player.inCar, wanted: window.__VB.wanted })`);
check('7 masuk mobil misi (bersih, tanpa wanted)', afterEnter.inCar && afterEnter.wanted === 0, JSON.stringify(afterEnter));

// 8. Mission 1 completes and $400 payout lands.
await waitState(() => window.__VB.screen === 'mission' && window.__VB.money === 600, 30000);
const m1 = await vb(`({ screen: window.__VB.screen, money: window.__VB.money, done: window.__VB.missionsDone })`);
check('8 misi 1 selesai dan payout masuk (400 dolar)', m1.screen === 'mission' && m1.money === 600, JSON.stringify(m1));
await page.mouse.click(640, 360);
try {
  await waitState(() => window.__VB.screen === 'play', 8000);
} catch {
  console.log('mission dismiss retry: screen=' + (await vb(`window.__VB.screen`)));
  await page.keyboard.press('Enter');
  await waitState(() => window.__VB.screen === 'play', 30000);
}

// 9. Exit the car.
await vb(`window.__VB.exitCar()`);
check('9 keluar mobil', (await vb(`window.__VB.player.inCar`)) === false);

// 10. Stealing a car raises wanted.
const civ = await vb(`window.__VB.parked.find((c) => !c.mission && !c.target)`);
await vb(`window.__VB.teleport(${civ.x}, ${civ.y}); window.__VB.enterNearestCar()`);
const stolen = await vb(`({ wanted: window.__VB.wanted, stolen: window.__VB.stats.stolen, inCar: window.__VB.player.inCar })`);
check('10 curi mobil menaikkan wanted', stolen.inCar && stolen.wanted >= 1, JSON.stringify(stolen));

// 11. Stolen counter increments.
check('11 counter curian naik', stolen.stolen >= 1, `stolen=${stolen.stolen}`);

// 12. Police spawn and chase.
await waitState(() => window.__VB.policeCount >= 1, 30000);
const cop0 = await vb(`window.__VB.police[0]`);
await page.waitForTimeout(900);
const cop1 = await vb(`window.__VB.police[0]`);
const copMoved = cop0 && cop1 ? Math.hypot(cop1.x - cop0.x, cop1.y - cop0.y) : 0;
check('12 polisi spawn dan mengejar', !!cop0 && copMoved > 5, `cop moved ${copMoved.toFixed(0)}px`);

// 13. Respray clears wanted.
await vb(`window.__VB.setMoney(500)`);
const respray = await vb(`window.__VB.locations().respray`);
await vb(`window.__VB.teleport(${respray.x}, ${respray.y})`);
await waitState(() => window.__VB.wanted === 0, 30000);
check('13 respray menghapus wanted', (await vb(`window.__VB.wanted`)) === 0);

// 14. Wanted decays while hiding.
await vb(`window.__VB.setWanted(2)`);
await waitState(() => {
  const vbh = window.__VB;
  const pl = vbh.player;
  let min = 1e9;
  for (const c of vbh.police) min = Math.min(min, Math.hypot(c.x - pl.x, c.y - pl.y));
  if (min < 600) {
    const corners = [[240, 240], [2960, 240], [240, 2160], [2960, 2160]];
    const c = corners[Math.floor(Math.random() * 4)];
    vbh.teleport(c[0], c[1]);
  }
  return vbh.wanted < 2;
}, 120000);
check('14 wanted turun saat sembunyi', (await vb(`window.__VB.wanted`)) < 2, `wanted=${await vb(`window.__VB.wanted`)}`);

// 15. Combat kills an enemy.
await vb(`window.__VB.setWanted(0); window.__VB.exitCar(); window.__VB.heal(); window.__VB.giveAmmo(24); window.__VB.spawnGang(1)`);
let killed = false;
for (let i = 0; i < 18 && !killed; i++) {
  const st = await vb(`({ e: window.__VB.enemies[0], cam: window.__VB.camera, pl: window.__VB.player, kills: window.__VB.stats.kills })`);
  if (!st.e) { killed = st.kills >= 1; break; }
  const sx = st.e.x - st.cam.x;
  const sy = st.e.y - st.cam.y;
  await page.mouse.click(Math.max(20, Math.min(1260, sx)), Math.max(20, Math.min(700, sy)));
  await page.waitForTimeout(350);
  killed = (await vb(`window.__VB.stats.kills`)) >= 1;
}
check('15 combat membunuh musuh', killed, `kills=${await vb(`window.__VB.stats.kills`)}`);

// 16. Pause works.
await page.keyboard.press('KeyP');
await waitState(() => window.__VB.screen === 'pause', 30000);
check('16 pause bekerja', (await vb(`window.__VB.screen`)) === 'pause');

// 17. Resume works.
await page.keyboard.press('KeyP');
await waitState(() => window.__VB.screen === 'play', 30000);
check('17 resume bekerja', (await vb(`window.__VB.screen`)) === 'play');

// 18. Death shows WASTED.
await vb(`window.__VB.hurt(500)`);
await waitState(() => window.__VB.screen === 'wasted', 30000);
check('18 mati menampilkan WASTED', (await vb(`window.__VB.screen`)) === 'wasted');

// 19. R restarts after WASTED.
await page.keyboard.press('KeyR');
await waitState(() => window.__VB.screen === 'play', 30000);
check('19 R restart setelah WASTED', (await vb(`window.__VB.screen`)) === 'play');

// 20. Mission 6: steal the getaway car.
await vb(`window.__VB.heal(); window.__VB.jumpToMission(5)`);
await waitState(() => window.__VB.mission.index === 5, 30000);
const tgt = await vb(`window.__VB.parked.find((c) => c.target)`);
await vb(`window.__VB.teleport(${tgt.x}, ${tgt.y}); window.__VB.enterNearestCar()`);
const m6a = await vb(`({ step: window.__VB.mission.step, inCar: window.__VB.player.inCar })`);
check('20 misi 6: curi mobil', m6a.inCar && m6a.step === 1, JSON.stringify(m6a));

// 21. Mission 6: bank cash taken, wanted 4.
await vb(`window.__VB.goTo(1820, 1040)`);
await waitState(() => window.__VB.mission.step === 2, 90000);
await vb(`window.__VB.exitCar(); window.__VB.goTo(1820, 1040)`);
await waitState(() => window.__VB.wanted === 4 && window.__VB.mission.step === 3, 60000);
const m6b = await vb(`({ wanted: window.__VB.wanted, step: window.__VB.mission.step })`);
check('21 misi 6: uang bank diambil, wanted 4', m6b.wanted === 4 && m6b.step === 3, JSON.stringify(m6b));

// 22. Mission 6 completes, then victory.
await vb(`window.__VB.goTo(620, 1840)`);
await waitState(() => window.__VB.screen === 'mission', 120000);
await page.mouse.click(640, 360);
await waitState(() => window.__VB.screen === 'victory', 30000);
check('22 misi 6 selesai lalu victory', (await vb(`window.__VB.screen`)) === 'victory');

// 23. Victory restarts into free roam.
await page.mouse.click(640, 360);
await waitState(() => window.__VB.screen === 'play', 30000);
check('23 victory restart ke free roam', (await vb(`window.__VB.screen`)) === 'play');

// 24. Zero network requests (local only).
const external = requests.filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('http://localhost') && !u.startsWith('data:') && !u.startsWith('about:'));
check('24 zero network request (hanya request lokal)', external.length === 0, external.join(', ') || `${requests.length} local requests`);

// 25. No console/page errors at all.
check('25 no console/page error', errors.length === 0, errors.join(' | ') || 'clean');

const passed = results.filter((r) => r.ok).length;
console.log(`\nRESULT: ${passed}/${results.length} PASS`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
