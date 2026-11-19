// Velor Bay state machine: title → play → pause / busted / wasted /
// mission-complete → victory → free roam. Owns the world state, the camera,
// the fixed-step update, saving, and the window.__VB debug handle that the
// playtest and the shot scenes drive.
import { CFG, districtAt } from './config.js';
import { makeRng } from './random.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { loadSave, writeSave, defaultSave, clearSave } from './storage.js';
import { buildCity } from './city.js';
import { spawnParkedCar, driveCar, autoDrive } from './vehicles.js';
import { spawnTraffic, spawnPedestrians, updateTraffic, updatePedestrians, checkPedHits } from './traffic.js';
import { addWanted, updatePolice, tryRespray } from './police.js';
import { makePlayer, updatePlayerOnFoot, tryEnterCar, exitCar, damagePlayer, healPlayer } from './player.js';
import { updateCombat, spawnPickups, playerShoot, spawnGang } from './combat.js';
import { buildMissions } from './missions.js';
import { makeParticles } from './particles.js';
import { drawWorld, drawTitle, drawPause, drawEnd, drawMissionComplete, drawVictory } from './render.js';
import { drawHud } from './hud.js';

export function createGame(canvas, opts) {
  const o = opts || {};
  const seed = o.seed || 1;
  const rng = makeRng(seed);
  const ctx = canvas.getContext('2d');
  const input = makeInput(canvas);
  const audio = makeAudio();
  const city = buildCity(seed);
  const saved = loadSave();

  const S = {
    canvas, ctx, input, audio, city, rng,
    seed,
    time: 0,
    dt: CFG.tick,
    screen: 'title',
    money: saved ? saved.money : CFG.startMoney,
    missionsDone: saved ? saved.missionsDone : 0,
    stats: saved ? { ...defaultSave().stats, ...saved.stats } : defaultSave().stats,
    savedGame: saved,
    player: makePlayer(620, 700),
    playerCar: null,
    missionCar: null,
    parkedCars: [],
    traffic: [],
    peds: [],
    policeCars: [],
    enemies: [],
    bullets: [],
    pickups: [],
    wanted: 0,
    coolTimer: 0,
    bustTimer: 0,
    camera: { x: 0, y: 0 },
    aimAngle: 0,
    autoTarget: null,
    flashText: '',
    flashT: 0,
    lastShotAt: 0,
    lastShotPos: null,
    lastMissionName: '',
    lastPayout: 0,
    missionOverlayT: 0,
    victoryPending: false,
    particles: makeParticles(),
    missions: null,
    addWanted(n, why) { addWanted(S, n, why); },
    damagePlayer(n, why) { damagePlayer(S, n, why); },
    healPlayer(n) { healPlayer(S, n); },
    hudFlash(text) {
      S.flashText = text;
      S.flashT = 3;
    },
    setScreen(name) {
      S.screen = name;
      if (name === 'busted' || name === 'wasted') S.saveNow();
    },
    saveNow() {
      const ok = writeSave({
        money: S.money,
        missionsDone: S.missionsDone,
        stats: S.stats,
        pos: { x: S.player.x, y: S.player.y },
        version: 1,
      });
      S.savedGame = loadSave();
      return ok;
    },
    showMissionComplete(name, pay) {
      S.lastMissionName = name;
      S.lastPayout = pay;
      S.missionOverlayT = 999;
      S.screen = 'mission';
    },
    busted() {
      S.stats.busted = (S.stats.busted || 0) + 1;
      audio.bust();
      S.setScreen('busted');
    },
  };

  S.missions = buildMissions(S);
  S.particles = makeParticles();

  // Populate the streets.
  S.traffic = spawnTraffic(rng, city, CFG.trafficCount);
  S.peds = spawnPedestrians(rng, city, CFG.pedCount);
  S.pickups = spawnPickups(rng, city);
  const missionCar = spawnParkedCar(rng, city, true);
  missionCar.x = city.locations.garage.x + 40;
  missionCar.y = city.locations.garage.y;
  missionCar.color = '#2e6fc2';
  S.missionCar = missionCar;
  S.parkedCars.push(missionCar);
  for (let i = 0; i < 10; i++) S.parkedCars.push(spawnParkedCar(rng, city, false));
  if (saved && saved.pos) {
    S.player.x = saved.pos.x;
    S.player.y = saved.pos.y;
  }

  function startRun(fresh) {
    if (fresh) {
      clearSave();
      S.money = CFG.startMoney;
      S.missionsDone = 0;
      S.stats = defaultSave().stats;
      S.player = makePlayer(620, 700);
      S.playerCar = null;
      S.wanted = 0;
      S.policeCars.length = 0;
      S.enemies.length = 0;
      S.bullets.length = 0;
      S.missions = buildMissions(S);
      const mc = spawnParkedCar(rng, city, true);
      mc.x = city.locations.garage.x + 40;
      mc.y = city.locations.garage.y;
      mc.color = '#2e6fc2';
      S.missionCar = mc;
      S.parkedCars = [mc];
      for (let i = 0; i < 10; i++) S.parkedCars.push(spawnParkedCar(rng, city, false));
    }
    S.saveNow();
    S.missions.startMission(S, S.missionsDone >= 6 ? 0 : S.missionsDone);
    if (S.missionsDone >= 6) S.missionsDone = 0;
    S.setScreen('play');
    audio.unlock();
  }

  function restartAfterEnd() {
    S.player.dead = false;
    S.player.health = CFG.maxHealth;
    S.player.ammo = CFG.startAmmo;
    S.player.x = 620;
    S.player.y = 700;
    if (S.playerCar) {
      S.playerCar.driver = null;
      S.parkedCars.push(S.playerCar);
      S.playerCar = null;
      S.player.inCar = null;
    }
    S.wanted = 0;
    S.policeCars.length = 0;
    S.enemies.length = 0;
    S.bullets.length = 0;
    S.bustTimer = 0;
    S.setScreen('play');
  }

  function update(dt) {
    S.time += dt;
    if (S.flashT > 0) S.flashT -= dt;
    if (S.screen === 'title') {
      if (input.takeClick() || input.takePressed('Enter')) {
        startRun(!S.savedGame);
      }
      return;
    }
    if (S.screen === 'mission') {
      if (input.takeClick() || input.takePressed('Enter')) {
        S.missionOverlayT = 0;
        if (S.victoryPending) {
          S.victoryPending = false;
          S.setScreen('victory');
        } else {
          S.setScreen('play');
        }
      }
      return;
    }
    if (S.screen === 'victory') {
      if (input.takeClick() || input.takePressed('Enter')) {
        S.missionsDone = 6;
        S.saveNow();
        S.setScreen('play');
      }
      return;
    }
    if (S.screen === 'busted' || S.screen === 'wasted') {
      if (input.takePressed('KeyR') || input.takePressed('Enter') || input.takeClick()) {
        restartAfterEnd();
      }
      return;
    }
    if (S.screen !== 'play') return;

    // Pause.
    if (input.takePressed('KeyP') || input.takePressed('Escape')) {
      S.setScreen('pause');
      return;
    }
    if (input.takePressed('KeyM')) audio.toggleMute();
    if (input.takePressed('KeyR')) {
      // Restart the current run from the title state.
      S.setScreen('title');
      return;
    }

    // Aim from the mouse (screen → world).
    const mx = input.mouse.x + S.camera.x;
    const my = input.mouse.y + S.camera.y;
    S.aimAngle = Math.atan2(my - S.player.y, mx - S.player.x);

    if (S.playerCar) {
      const car = S.playerCar;
      if (S.autoTarget) {
        const d = autoDrive(car, dt, S.autoTarget);
        if (d < 30) S.autoTarget = null;
      } else {
        let fwd = 0;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) fwd = 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) fwd = -1;
        let steer = 0;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steer = -1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) steer = 1;
        const hb = input.isDown('Space');
        driveCar(car, dt, fwd, steer, hb);
      }
      S.player.x = car.x;
      S.player.y = car.y;
      S.player.angle = car.angle;
      S.stats.distance = (S.stats.distance || 0) + Math.abs(car.speed) * dt;
      if (input.takePressed('KeyE') || input.takePressed('KeyF')) exitCar(S);
      if (Math.abs(car.speed) > 200 && Math.random() < dt * 2) {
        S.particles.puff(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
      }
      // Car wrecked: too much damage throws the player out, hurt.
      if (car.damage > 100) {
        car.damage = 0;
        exitCar(S);
        damagePlayer(S, 25, 'wreck');
        S.hudFlash('CAR WRECKED');
      }
      tryRespray(S);
    } else {
      updatePlayerOnFoot(S, dt);
    }

    // Shooting (on foot, mouse click).
    if (input.takeClick() && !S.playerCar && S.screen === 'play') playerShoot(S);

    updateTraffic(S, dt);
    updatePedestrians(S, dt);
    checkPedHits(S);
    updateCombat(S, dt);
    updatePolice(S, dt);
    S.missions.update(S, dt);
    S.particles.update(dt);
    audio.update(dt, S.playerCar ? Math.abs(S.playerCar.speed) / CFG.carMaxSpeed : 0, S.wanted, !!S.playerCar);

    // Camera follows the player, clamped to the world.
    const tx = S.player.x - canvas.width / 2;
    const ty = S.player.y - canvas.height / 2;
    S.camera.x = Math.max(0, Math.min(CFG.worldW - canvas.width, tx));
    S.camera.y = Math.max(0, Math.min(CFG.worldH - canvas.height, ty));

    // Autosave every ~10s of play.
    if (Math.floor(S.time * 10) % 100 === 0) S.saveNow();
  }

  function render() {
    const w = canvas.width;
    const h = canvas.height;
    if (S.screen === 'title') {
      drawTitle(S, ctx, w, h);
      return;
    }
    drawWorld(S, ctx, w, h);
    if (S.screen === 'play' || S.screen === 'pause') drawHud(S, ctx, w, h);
    if (S.screen === 'pause') {
      if (input.takePressed('KeyP') || input.takePressed('Escape') || input.takeClick()) {
        S.setScreen('play');
      } else {
        drawPause(S, ctx, w, h);
      }
    }
    if (S.screen === 'busted') drawEnd(S, ctx, w, h, 'busted');
    if (S.screen === 'wasted') drawEnd(S, ctx, w, h, 'wasted');
    if (S.screen === 'mission') drawMissionComplete(S, ctx, w, h);
    if (S.screen === 'victory') drawVictory(S, ctx, w, h);
  }

  // Debug / automation handle: the playtest and the shot scenes drive the
  // game through this, using the same mechanics a player uses.
  const VB = {
    S,
    get screen() { return S.screen; },
    get money() { return S.money; },
    get wanted() { return S.wanted; },
    get missionsDone() { return S.missionsDone; },
    get trafficCount() { return S.traffic.length; },
    get pedCount() { return S.peds.length; },
    get policeCount() { return S.policeCars.length; },
    get player() { return { x: S.player.x, y: S.player.y, health: S.player.health, ammo: S.player.ammo, inCar: !!S.playerCar }; },
    get mission() {
      const m = S.missions.current();
      return m ? { index: S.missions.index, name: m.name, step: S.missions.step, stepLabel: (S.missions.currentStep() || {}).label || '' } : null;
    },
    get stats() { return { ...S.stats }; },
    get camera() { return { x: S.camera.x, y: S.camera.y }; },
    get enemies() { return S.enemies.map((e) => ({ x: e.x, y: e.y, hp: e.hp })); },
    get parked() { return S.parkedCars.map((c) => ({ x: c.x, y: c.y, mission: c.mission, target: c.target })); },
    get police() { return S.policeCars.map((c) => ({ x: c.x, y: c.y, speed: c.speed })); },
    get carSpeed() { return S.playerCar ? Math.abs(S.playerCar.speed) : 0; },
    start(fresh) { startRun(fresh); },
    pause() { if (S.screen === 'play') S.setScreen('pause'); },
    resume() { if (S.screen === 'pause') S.setScreen('play'); },
    keyDown(code) { input.injectDown(code); },
    keyUp(code) { input.injectUp(code); },
    clickAt(x, y) {
      input.mouse.x = x;
      input.mouse.y = y;
      input.mouse.clicked = true;
    },
    goTo(x, y) { S.autoTarget = { x, y }; },
    teleport(x, y) {
      if (S.playerCar) {
        S.playerCar.x = x;
        S.playerCar.y = y;
        S.playerCar.speed = 0;
      }
      S.player.x = x;
      S.player.y = y;
    },
    enterNearestCar() { return tryEnterCar(S); },
    exitCar() { return exitCar(S); },
    setWanted(n) { S.wanted = n; },
    hurt(n) { damagePlayer(S, n, 'debug'); },
    heal() { healPlayer(S, CFG.maxHealth); },
    giveAmmo(n) { S.player.ammo += n || 24; },
    spawnGang(n) { spawnGang(S, S.player.x + 80, S.player.y, n || 1, 60); },
    jumpToMission(i) {
      S.missionsDone = i;
      S.missions.startMission(S, i);
      S.setScreen('play');
    },
    setMoney(n) { S.money = n; },
    resprayAt() {
      const r = S.city.locations.respray;
      S.teleport(r.x, r.y);
    },
    locations() { return { ...S.city.locations }; },
    marker() { return S.missions.marker(); },
  };
  window.__VB = VB;
  window.__shotReady = false;

  return { S, VB, update, render, input };
}
