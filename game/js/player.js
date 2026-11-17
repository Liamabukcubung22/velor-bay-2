// Kai Mercer on foot: WASD movement with building collision, enter/exit
// cars, steal a civilian car (wanted +1) vs take a mission car (clean).
import { WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, START_MONEY, START_AMMO, START_HEALTH } from './config.js';
import { collideCircle } from './city.js';
import { addWanted } from './police.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: START_HEALTH, money: START_MONEY, ammo: START_AMMO,
    inCar: null, moveSpeed: 0, aimAngle: -Math.PI / 2,
    fireCooldown: 0, hurtFlash: 0, cash: 0,
  };
}

// On-foot step. Returns nothing; moves with collision + world bounds.
export function stepOnFoot(player, dir, dt, city, cars, peds, S) {
  let mx = dir.x, my = dir.y;
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const speed = dir.run ? RUN_SPEED : WALK_SPEED;
  player.moveSpeed = len > 0 ? speed : 0;
  if (len > 0) player.angle = Math.atan2(my, mx);
  const nx = player.x + mx * speed * dt;
  const ny = player.y + my * speed * dt;
  const res = collideCircle(city, nx, ny, PLAYER_RADIUS);
  player.x = res.x; player.y = res.y;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  // Bumping a pedestrian at speed hurts them and raises heat.
  for (const p of peds) {
    if (Math.hypot(p.x - player.x, p.y - player.y) < 22 && player.moveSpeed > 200) {
      p.flee = 2;
      const a = Math.atan2(p.y - player.y, p.x - player.x);
      p.vx = Math.cos(a) * 220; p.vy = Math.sin(a) * 220;
      addWanted(S.police, 1, 'hit-ped');
    }
  }
}

export function nearestCar(player, cars, maxDist = 70) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Try to enter the nearest car. Returns a result tag for HUD feedback.
export function tryEnterCar(S, car) {
  const player = S.player;
  if (!car) return 'none';
  if (car.cop) return 'cop';
  if (car.hp <= 0) return 'wreck';
  player.inCar = car;
  player.x = car.x; player.y = car.y;
  const wasPlayerCar = car.owner === 'player';
  car.owner = 'player';
  if (car.wasCivilian && !wasPlayerCar) {
    addWanted(S.police, 1, 'steal');
    S.stats.stolen += 1;
    return 'stolen';
  }
  return 'entered';
}

// Mark a car as a civilian car (stealing it raises wanted). Mission cars
// are flagged missionCar and never count as stolen.
export function flagCivilian(car) { car.wasCivilian = true; }

export function exitCar(S) {
  const player = S.player;
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  const a = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(a) * 34;
  player.y = car.y + Math.sin(a) * 34;
  const res = collideCircle(S.city, player.x, player.y, PLAYER_RADIUS);
  player.x = res.x; player.y = res.y;
  player.angle = car.angle;
}
