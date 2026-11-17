// Headless play-test: drives the real game through the real loop in
// Chromium and checks the 24-item checklist from the handoff.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8082;

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const errors = [];
const requests = [];
let failed = 0;
try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('page: ' + e.message));
  page.on('request', (req) => requests.push(req.url()));

  const vb = (fn, arg) => page.evaluate(fn, arg);
  const state = () => page.evaluate(() => {
    const S = window.__VB.S;
    return {
      screen: S.screen,
      px: Math.round(S.player.x), py: Math.round(S.player.y),
      hp: Math.round(S.player.hp), money: Math.floor(S.player.money),
      ammo: S.player.ammo, wanted: S.police.wanted,
      cops: S.police.cops.length,
      inCar: !!S.player.inCar,
      carHp: S.player.inCar ? Math.round(S.player.inCar.hp) : null,
      mission: S.missions.index, step: S.missions.stepIdx,
      victory: S.missions.victory,
      traffic: S.traffic.length, peds: S.peds.length,
      enemies: S.combat.enemies.length,
      stolen: S.stats.stolen, kills: S.stats.kills,
      missionsDone: S.stats.missionsDone,
    };
  });
  const waitState = (pred, timeout = 60000) => page.waitForFunction(pred, null, { timeout });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__VB, null, { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 1. Loads to title.
  let s = await state();
  check('loads to title', s.screen === 'title', `screen=${s.screen}`);

  // 2. Start button begins run (click the real NEW GAME button).
  await page.mouse.click(640, 503);
  await page.waitForTimeout(800);
  s = await state();
  check('start button begins run', s.screen === 'play', `screen=${s.screen}`);

  // 3. Save written on new game.
  const saved = await page.evaluate(() => !!window.localStorage.getItem('velorbay.save.v1'));
  check('save written on new game', saved);

  // 4. Traffic + pedestrians populated.
  check('traffic + pedestrians populated', s.traffic >= 10 && s.peds >= 20, `${s.traffic} cars, ${s.peds} peds`);

  // 5. Walking moves the player.
  const before = await state();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  s = await state();
  check('walking moves player', Math.abs(s.py - before.py) > 20 || Math.abs(s.px - before.px) > 20, `moved ${Math.round(Math.hypot(s.px - before.px, s.py - before.py))}px`);

  // Pilot helpers (page-side autopilot through the real input).
  await page.evaluate(() => {
    window.__driveStop = () => {
      if (window.__pilotTimer) clearInterval(window.__pilotTimer);
      window.__pilotTimer = null;
      const input = window.__VB.input;
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) input.release(k);
    };
    window.__driveTo = (x, y) => {
      const { S, makePilot } = window.__VB;
      const pilot = makePilot(S);
      pilot.setTarget(x, y);
      window.__driveStop();
      const held = {};
      window.__pilotTimer = setInterval(() => {
        const d = pilot.dir();
        const want = {};
        if (d.y < -0.1) want.KeyW = 1;
        if (d.y > 0.1) want.KeyS = 1;
        if (d.x < -0.1) want.KeyA = 1;
        if (d.x > 0.1) want.KeyD = 1;
        if (d.brake) want.Space = 1;
        if (d.run) want.ShiftLeft = 1;
        const input = window.__VB.input;
        for (const k of Object.keys(held)) if (!want[k]) { input.release(k); delete held[k]; }
        for (const k of Object.keys(want)) if (!held[k]) { input.press(k); held[k] = 1; }
      }, 60);
    };
  });

  // 6. Mission 1 step 1: walk to garage.
  await vb(() => { const S = window.__VB.S; S.player.x = 600; S.player.y = 660; });
  await waitState(() => window.__VB.S.missions.stepIdx >= 1, 30000).catch(() => {});
  s = await state();
  check('mission 1 step 1 (walk to garage)', s.step >= 1, `step=${s.step}`);

  // 7. Enter mission car (clean, no wanted) — retry in case a traffic car
  //    happens to be closer on the first try.
  let entered = false;
  for (let attempt = 0; attempt < 3 && !entered; attempt += 1) {
    await vb(() => {
      const S = window.__VB.S;
      const car = S.cars.find((c) => c.missionTag === 'mission');
      if (car) { S.player.x = car.x; S.player.y = car.y; }
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    entered = await vb(() => {
      const c = window.__VB.S.player.inCar;
      return !!c && c.missionTag === 'mission';
    });
    if (!entered) await page.keyboard.press('KeyF');
  }
  s = await state();
  check('enter mission car (clean, no wanted)', entered && s.wanted === 0, `inCar=${s.inCar} wanted=${s.wanted}`);

  // 8. Drive to safehouse — mission 1 completes.
  await vb(() => window.__driveTo(1000, 1000));
  await waitState(() => window.__VB.S.missions.index >= 1, 120000).catch(() => {});
  await vb(() => window.__driveStop());
  s = await state();
  check('mission 1 completes, payout lands ($400)', s.mission >= 1 && s.money >= 450, `mission=${s.mission} money=$${s.money}`);

  // 9. Exit car.
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(500);
  s = await state();
  check('exit car', !s.inCar, `inCar=${s.inCar}`);

  // 10. Steal car raises wanted (retry at parked spots until a civilian car).
  let stolen = false;
  for (const [sx, sy] of [[1400, 300], [2240, 2660], [640, 1860]]) {
    if (stolen) break;
    await vb(([x, y]) => { const S = window.__VB.S; S.player.x = x; S.player.y = y; }, [sx, sy]);
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    stolen = await vb(() => {
      const c = window.__VB.S.player.inCar;
      return !!c && c.wasCivilian === true;
    });
    if (!stolen) await page.keyboard.press('KeyF');
  }
  s = await state();
  check('steal car raises wanted', stolen && s.wanted >= 1, `inCar=${s.inCar} wanted=${s.wanted}`);
  check('stolen counter', s.stolen >= 1, `stolen=${s.stolen}`);

  // 11. Police spawn and chase (wait until one is actually moving).
  await waitState(() => window.__VB.S.police.cops.length > 0, 30000).catch(() => {});
  await waitState(() => window.__VB.S.police.cops.some((c) => Math.abs(c.speed) > 20), 30000).catch(() => {});
  s = await state();
  const copNear = await vb(() => {
    const S = window.__VB.S;
    return S.police.cops.some((c) => Math.abs(c.speed) > 20);
  });
  check('police spawn and chase', s.cops > 0 && copNear, `cops=${s.cops} moving=${copNear}`);

  // 12. Respray clears wanted.
  await vb(() => {
    const S = window.__VB.S;
    S.player.money = Math.max(S.player.money, 500);
    if (S.player.inCar) { S.player.inCar.x = 1000; S.player.inCar.y = 1800; S.player.x = 1000; S.player.y = 1800; }
    else { S.player.x = 1000; S.player.y = 1800; }
  });
  await waitState(() => window.__VB.S.police.wanted === 0, 30000).catch(() => {});
  s = await state();
  check('respray clears wanted', s.wanted === 0, `wanted=${s.wanted} money=$${s.money}`);

  // 13. Wanted decays when hidden.
  await vb(() => {
    const S = window.__VB.S;
    S.police.wanted = 1;
    S.player.x = 300; S.player.y = 300;
    if (S.player.inCar) { S.player.inCar.x = 300; S.player.inCar.y = 300; }
  });
  await waitState(() => window.__VB.S.police.wanted === 0, 90000).catch(() => {});
  s = await state();
  check('wanted decays when hidden', s.wanted === 0, `wanted=${s.wanted}`);

  // 14. Combat kills an enemy. The enemy stands on the same road as the
  //    player (clear line of sight — no building between them).
  await vb(() => {
    const S = window.__VB.S;
    if (S.player.inCar) { S.player.inCar.x = 600; S.player.inCar.y = 820; }
    S.player.x = 600; S.player.y = 820;
    S.player.hp = 100; S.player.ammo = 60;
    S.combat.enemies.push({ x: 600, y: 1020, hp: 70, angle: -Math.PI / 2, speed: 0, cooldown: 5, state: 'chase' });
  });
  await page.keyboard.press('KeyF').catch(() => {});
  await page.waitForTimeout(300);
  // Aim at the enemy and hold fire until it dies.
  const shoot = async () => {
    for (let i = 0; i < 120; i += 1) {
      const done = await vb(() => {
        const S = window.__VB.S;
        const e = S.combat.enemies[0];
        if (!e) return true;
        const input = window.__VB.input;
        input.setMouse(e.x - S.cam.x, e.y - S.cam.y);
        input.click();
        return false;
      });
      if (done) return true;
      await page.waitForTimeout(250);
      await vb(() => window.__VB.input.releaseMouse());
    }
    return false;
  };
  const killed = await shoot();
  s = await state();
  check('combat kills an enemy', killed && s.kills >= 1, `kills=${s.kills}`);

  // 15. Pause works.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(500);
  s = await state();
  check('pause works', s.screen === 'paused', `screen=${s.screen}`);

  // 16. Resume works.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(500);
  s = await state();
  check('resume works', s.screen === 'play', `screen=${s.screen}`);

  // 17. Death shows WASTED (enemy on the same road, clear line of sight).
  await vb(() => {
    const S = window.__VB.S;
    S.player.hp = 1;
    S.combat.enemies.push({ x: S.player.x, y: S.player.y + 150, hp: 70, angle: -Math.PI / 2, speed: 0, cooldown: 0.1, state: 'chase' });
  });
  await waitState(() => window.__VB.S.screen === 'wasted', 60000).catch(() => {});
  s = await state();
  check('death shows WASTED', s.screen === 'wasted', `screen=${s.screen}`);

  // 18. R restarts after WASTED.
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(800);
  s = await state();
  check('R restarts after WASTED', s.screen === 'play' && s.mission === 0, `screen=${s.screen} mission=${s.mission}`);

  // 19. Mission 6 completes -> victory (teleport between real objectives).
  await vb(() => window.__VB.debugStartMission(5));
  let m6stolen = false;
  for (const [sx, sy] of [[2600, 1900], [1400, 300], [2240, 2660]]) {
    if (m6stolen) break;
    await vb(([x, y]) => { const S = window.__VB.S; S.player.x = x; S.player.y = y; }, [sx, sy]);
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    m6stolen = await vb(() => {
      const c = window.__VB.S.player.inCar;
      return !!c && c.wasCivilian === true;
    });
    if (!m6stolen) await page.keyboard.press('KeyF');
  }
  s = await state();
  check('mission 6: steal a car', m6stolen && s.step >= 1, `inCar=${s.inCar} step=${s.step}`);
  await vb(() => window.__driveTo(2200, 1000));
  await waitState(() => window.__VB.S.missions.stepIdx >= 2, 120000).catch(() => {});
  await vb(() => window.__driveStop());
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(400);
  await vb(() => { const S = window.__VB.S; S.player.x = 2200; S.player.y = 1060; });
  await waitState(() => window.__VB.S.missions.stepIdx >= 3, 30000).catch(() => {});
  s = await state();
  check('mission 6: bank cash grabbed, wanted 4', s.step >= 3 && s.wanted >= 4, `step=${s.step} wanted=${s.wanted}`);
  // Re-enter the getaway car (pull it next to the player first).
  await vb(() => {
    const S = window.__VB.S;
    let best = null, bd = Infinity;
    for (const c of [...S.cars, ...S.traffic]) {
      const d = Math.hypot(c.x - S.player.x, c.y - S.player.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { best.x = S.player.x + 30; best.y = S.player.y; S.player.x += 0; }
  });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  await vb(() => window.__driveTo(1000, 1000));
  await waitState(() => window.__VB.S.missions.victory === true, 180000).catch(() => {});
  await vb(() => window.__driveStop());
  s = await state();
  check('mission 6 completes -> victory', s.victory && s.screen === 'victory', `victory=${s.victory} screen=${s.screen}`);

  // 20. Victory restarts into free roam.
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(800);
  s = await state();
  check('victory restarts into free roam', s.screen === 'play' && s.victory, `screen=${s.screen} victory=${s.victory}`);

  // 21. Zero network requests (only local).
  const external = requests.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:'));
  check('zero network requests', external.length === 0, `${requests.length} local, ${external.length} external`);

  // 22. No console/page errors.
  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
} finally {
  server.kill();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
