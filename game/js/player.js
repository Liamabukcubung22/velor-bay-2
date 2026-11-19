// Kai Mercer on foot: WASD walk/run, E to steal or enter a car, F to punch.
// Entering a civilian car raises wanted; entering a mission/target car is
// clean. The player object also carries health, ammo and the money.
import { CFG } from './config.js';
import { clamp, dist } from './random.js';
import { collideBuildings, clampToWorld } from './city.js';
import { makeCar } from './vehicles.js';
import { combatPunch } from './combat.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speedNow: 0,
    health: CFG.maxHealth,
    ammo: CFG.startAmmo,
    hasGun: true,
    inCar: null,
    punchAt: 0,
    dead: false,
  };
}

export function nearestCar(S, maxD) {
  let best = null;
  let bestD = maxD;
  const all = [...S.parkedCars, ...S.traffic];
  for (const c of all) {
    if (c.driver === 'player') continue;
    const d = dist(S.player.x, S.player.y, c.x, c.y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function updatePlayerOnFoot(S, dt) {
  const p = S.player;
  const inp = S.input;
  let mx = 0;
  let my = 0;
  if (inp.isDown('KeyW') || inp.isDown('ArrowUp')) my -= 1;
  if (inp.isDown('KeyS') || inp.isDown('ArrowDown')) my += 1;
  if (inp.isDown('KeyA') || inp.isDown('ArrowLeft')) mx -= 1;
  if (inp.isDown('KeyD') || inp.isDown('ArrowRight')) mx += 1;
  // Autopilot (shots / tests): walk toward the target.
  if (S.autoTarget && !p.inCar) {
    const dx = S.autoTarget.x - p.x;
    const dy = S.autoTarget.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 14) {
      mx = dx / d;
      my = dy / d;
    } else {
      S.autoTarget = null;
    }
  }
  const len = Math.sqrt(mx * mx + my * my);
  const running = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight') || (S.autoTarget ? true : false);
  const speed = running ? CFG.runSpeed : CFG.walkSpeed;
  p.speedNow = 0;
  if (len > 0.01) {
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speedNow = speed;
    S.stats.distance = (S.stats.distance || 0) + speed * dt;
  }
  collideBuildings(S.city, p, 12);
  clampToWorld(p, 20);

  // E: enter / steal the nearest car.
  if (inp.takePressed('KeyE')) tryEnterCar(S);
  // F: punch in front of the player.
  if (inp.takePressed('KeyF')) {
    p.punchAt = 0.25;
    S.audio.punch();
    combatPunch(S);
  }
  if (p.punchAt > 0) p.punchAt -= dt;
}

export function tryEnterCar(S) {
  const p = S.player;
  if (p.inCar) return false;
  const car = nearestCar(S, 52);
  if (!car) return false;
  return enterCar(S, car);
}

export function enterCar(S, car) {
  const p = S.player;
  p.inCar = car;
  S.playerCar = car;
  car.driver = 'player';
  car.speed = 0;
  S.parkedCars = S.parkedCars.filter((c) => c !== car);
  S.traffic = S.traffic.filter((c) => c !== car);
  if (!car.mission && !car.target) {
    // Stealing a civilian's car is a crime.
    car.stolen = true;
    S.stats.stolen = (S.stats.stolen || 0) + 1;
    S.addWanted(1, 'steal');
    S.hudFlash('CAR STOLEN — WANTED +1★');
  } else if (car.mission) {
    S.hudFlash('MISSION CAR — CLEAN');
  }
  S.audio.pickup();
  S.missions.onEnterCar(S, car);
  return true;
}

export function exitCar(S) {
  const p = S.player;
  if (!p.inCar) return false;
  const car = p.inCar;
  car.driver = null;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.inCar = null;
  S.playerCar = null;
  if (!S.parkedCars.includes(car)) S.parkedCars.push(car);
  S.missions.onExitCar(S, car);
  return true;
}

export function damagePlayer(S, amount, why) {
  const p = S.player;
  if (p.dead || S.screen !== 'play') return;
  p.health = clamp(p.health - amount, 0, CFG.maxHealth);
  S.hudFlash('−' + amount + ' HP' + (why ? ' (' + why + ')' : ''));
  if (p.health <= 0) {
    p.dead = true;
    S.stats.wasted = (S.stats.wasted || 0) + 1;
    S.audio.fail();
    S.setScreen('wasted');
  }
}

export function healPlayer(S, amount) {
  S.player.health = clamp(S.player.health + amount, 0, CFG.maxHealth);
}
