// Velor Bay — game state machine: title / play / paused / busted / wasted /
// victory. Owns the world (city, cars, traffic, police, combat, missions)
// and advances it in fixed 1/60 s steps.
import { STEP, WORLD_W, WORLD_H, PLACES, START_MONEY } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, loadBest, writeBest } from './storage.js';
import { createPlayer, stepOnFoot, nearestCar, tryEnterCar, exitCar, flagCivilian } from './player.js';
import { createCar, stepCar } from './vehicles.js';
import { spawnTraffic, spawnPedestrians, stepTraffic, stepPedestrians } from './traffic.js';
import { createPolice, syncCops, stepPolice, checkRespray, clearWanted } from './police.js';
import { createCombat, stepCombat, spawnPickups } from './combat.js';
import { createMissions, startMission, updateMissions, currentDef } from './missions.js';
import { createParticles } from './particles.js';

export function createGame(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const audio = createAudio();
  const S = {
    seed, rng, city, audio,
    player: createPlayer(600, 820),
    cars: [], traffic: [], peds: [],
    police: createPolice(),
    combat: createCombat(),
    particles: createParticles(),
    missions: createMissions(),
    cam: { x: 0, y: 0 },
    mouse: { sx: 0, sy: 0 },
    time: 8 * 3600,
    firing: false,
    screen: 'title',
    stats: { missionsDone: 0, stolen: 0, kills: 0, moneyEarned: 0 },
    save: loadSave(),
    best: loadBest(),
    ui: { newGameBtn: null, continueBtn: null },
    danger: null,
    muted: false,
    autosaveT: 0,
    attractT: 0,
  };

  function spawnParkedCars() {
    // Civilian cars parked along roads — stealing one raises wanted.
    const spots = [
      [1000, 640, 'hatch'], [1400, 240, 'sedan'], [2200, 640, 'van'],
      [2600, 1040, 'hatch'], [640, 1800, 'sedan'], [1400, 2240, 'hatch'],
      [2240, 2600, 'van'], [2600, 1840, 'sedan'], [1040, 2640, 'hatch'],
      [1840, 1040, 'sedan'],
    ];
    for (const [x, y, type] of spots) {
      const car = createCar(type, x, y, (Math.random() < 0.5 ? 0 : Math.PI / 2), { owner: 'civilian' });
      flagCivilian(car);
      S.cars.push(car);
    }
  }

  function resetWorld() {
    S.player = createPlayer(600, 820);
    S.cars = [];
    S.traffic = spawnTraffic(rng, city, 12);
    S.peds = spawnPedestrians(rng, 26);
    S.police = createPolice();
    S.combat = createCombat();
    spawnPickups(S.combat, rng, city);
    S.particles.clear();
    S.missions = createMissions();
    S.time = 8 * 3600;
    S.stats = { missionsDone: 0, stolen: 0, kills: 0, moneyEarned: 0 };
    S.danger = null;
    spawnParkedCars();
  }

  function saveGame() {
    const save = {
      money: Math.floor(S.player.money),
      ammo: S.player.ammo, hp: Math.ceil(S.player.hp),
      mission: Math.max(0, S.missions.index),
      missionsDone: S.stats.missionsDone,
      stolen: S.stats.stolen, kills: S.stats.kills,
      moneyEarned: S.stats.moneyEarned,
      x: Math.round(S.player.x), y: Math.round(S.player.y),
      time: Math.floor(S.time),
    };
    if (writeSave(save)) S.save = save;
    const best = {
      money: Math.max(S.best?.money || 0, save.money),
      missions: Math.max(S.best?.missions || 0, save.missionsDone),
    };
    writeBest(best);
    S.best = best;
  }

  function newGame() {
    resetWorld();
    startMission(S.missions, 0, S);
    S.screen = 'play';
    saveGame();
    audio.resume();
    audio.startMusic();
  }

  function continueGame() {
    const save = S.save;
    if (!save) { newGame(); return; }
    resetWorld();
    S.player.money = save.money;
    S.player.ammo = save.ammo;
    S.player.hp = save.hp;
    S.player.x = save.x; S.player.y = save.y;
    S.stats.missionsDone = save.missionsDone;
    S.stats.stolen = save.stolen || 0;
    S.stats.kills = save.kills || 0;
    S.stats.moneyEarned = save.moneyEarned || 0;
    S.time = save.time || 8 * 3600;
    startMission(S.missions, Math.min(save.mission, 5), S);
    S.screen = 'play';
    audio.resume();
    audio.startMusic();
  }

  function updateCamera(viewW, viewH) {
    const p = S.player;
    const tx = Math.max(0, Math.min(WORLD_W - viewW, p.x - viewW / 2));
    const ty = Math.max(0, Math.min(WORLD_H - viewH, p.y - viewH / 2));
    S.cam.x += (tx - S.cam.x) * 0.12;
    S.cam.y += (ty - S.cam.y) * 0.12;
  }

  // One fixed step of live play.
  function stepPlay(dt, input, viewW, viewH) {
    S.time += dt;
    const p = S.player;
    const dir = input.dir();
    S.mouse.sx = input.state.mouseX;
    S.mouse.sy = input.state.mouseY;
    S.firing = input.state.mouseDown;

    if (p.inCar) {
      const car = p.inCar;
      stepCar(car, {
        throttle: dir.y !== 0 ? -dir.y : 0,
        steer: dir.x,
        brake: dir.brake,
      }, dt, city, [...S.cars, ...S.traffic, ...S.police.cops]);
      p.x = car.x; p.y = car.y;
      p.angle = car.angle;
      if (car.hp <= 0) {
        // Wrecked: bail out, take a hit, the car is a dead shell now.
        S.particles.spawn(car.x, car.y, 'smoke', 24);
        exitCar(S);
        p.hp -= 25;
        car.hp = 0;
      }
      audio.engine(Math.abs(car.speed) / car.max, true);
    } else {
      stepOnFoot(p, dir, dt, city, S.cars, S.peds, S);
      const wx = S.cam.x + S.mouse.sx, wy = S.cam.y + S.mouse.sy;
      p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
      audio.engine(0, false);
    }

    stepTraffic(S.traffic, dt, city, rng, p.inCar, audio);
    if (S.danger) {
      S.danger.t -= dt;
      if (S.danger.t <= 0) S.danger = null;
    }
    stepPedestrians(S.peds, dt, city, S.danger);
    syncCops(S.police, rng, p.x, p.y, city);
    const busted = stepPolice(S.police, dt, S, audio);
    stepCombat(S.combat, dt, S, audio);
    const events = updateMissions(S.missions, dt, S, audio);
    for (const e of events) {
      if (e.type === 'missionComplete' || e.type === 'victory') saveGame();
      if (e.type === 'victory') S.screen = 'victory';
    }
    S.particles.step(dt);
    // Respray.
    const respray = checkRespray(S.police, S);
    if (respray === 'done') { S.police.resprayMsg = 3; audio.blip(); }
    if (S.police.resprayMsg > 0) S.police.resprayMsg -= dt;
    // Car-cop collision damage while driving.
    if (p.inCar && p.inCar.hp <= 0) { /* handled above next step */ }
    // Death.
    if (p.hp <= 0) {
      p.hp = 0;
      S.screen = 'wasted';
      audio.jingle(false);
      audio.engine(0, false);
      saveGame();
      return;
    }
    if (busted === 'busted') {
      S.screen = 'busted';
      audio.busted();
      audio.engine(0, false);
      // Respawn at the safehouse, heat cleared, car left behind.
      p.inCar = null;
      p.x = PLACES.safehouse.x; p.y = PLACES.safehouse.y + 60;
      p.hp = Math.max(p.hp, 60);
      clearWanted(S.police);
      saveGame();
      return;
    }
    S.autosaveT += dt;
    if (S.autosaveT > 12) { S.autosaveT = 0; saveGame(); }
    updateCamera(viewW, viewH);
  }

  // Attract mode behind the title screen: traffic + peds drift, clock runs.
  function stepTitle(dt, viewW, viewH) {
    S.time += dt;
    S.attractT += dt;
    stepTraffic(S.traffic, dt, city, rng, null, audio);
    stepPedestrians(S.peds, dt, city, null);
    S.particles.step(dt);
    // Slow camera pan around the garage district.
    const cx = 900 + Math.cos(S.attractT * 0.05) * 350;
    const cy = 900 + Math.sin(S.attractT * 0.05) * 350;
    S.cam.x = Math.max(0, Math.min(WORLD_W - viewW, cx - viewW / 2));
    S.cam.y = Math.max(0, Math.min(WORLD_H - viewH, cy - viewH / 2));
  }

  function handleInteract() {
    const p = S.player;
    if (p.inCar) return;
    const car = nearestCar(p, [...S.cars, ...S.traffic], 75);
    if (!car) return;
    const res = tryEnterCar(S, car);
    if (res === 'stolen') {
      S.missions.message = 'Stolen! The cops are onto you.';
      S.missions.messageT = 3;
      audio.honk();
    } else if (res === 'entered') {
      audio.blip();
    } else if (res === 'cop') {
      S.missions.message = 'That one belongs to the police!';
      S.missions.messageT = 2;
    } else if (res === 'wreck') {
      S.missions.message = 'That car is a wreck.';
      S.missions.messageT = 2;
    }
  }

  function handleClick(mx, my) {
    if (S.screen !== 'title') return;
    const ui = S.ui;
    if (ui.newGameBtn && mx >= ui.newGameBtn.x && mx <= ui.newGameBtn.x + ui.newGameBtn.w
      && my >= ui.newGameBtn.y && my <= ui.newGameBtn.y + ui.newGameBtn.h) {
      newGame();
    } else if (ui.continueBtn && mx >= ui.continueBtn.x && mx <= ui.continueBtn.x + ui.continueBtn.w
      && my >= ui.continueBtn.y && my <= ui.continueBtn.y + ui.continueBtn.h) {
      continueGame();
    }
  }

  resetWorld();
  return {
    S, newGame, continueGame, saveGame,
    stepPlay, stepTitle, handleInteract, handleClick,
    get screen() { return S.screen; },
    set screen(v) { S.screen = v; },
  };
}
