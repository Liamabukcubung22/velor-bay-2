// Wanted level (0-5 stars) and the police that enforce it. Interceptors
// spawn at the world edge, chase the player, ram the car, and bust the
// player when they get close while the player is slow. Hiding out of sight
// cools the heat down, and a Respray wipes it for cash.
import { CFG } from './config.js';
import { clamp, dist } from './random.js';
import { makeCar } from './vehicles.js';
import { roadWaypoint } from './city.js';

export function addWanted(S, n, why) {
  if (S.wanted >= CFG.maxWanted) return;
  S.wanted = clamp(S.wanted + n, 0, CFG.maxWanted);
  S.wantedAt = S.time;
  S.lastWantedWhy = why || '';
  if (S.wanted > 0) S.hudFlash('WANTED ' + S.wanted + '★');
}

export function updatePolice(S, dt) {
  // Spawn interceptors to match the wanted level.
  const wantCount = Math.min(S.wanted, CFG.policeMax);
  while (S.policeCars.length < wantCount) {
    const edge = Math.floor(S.rng() * 4);
    let x = 200;
    let y = 200;
    const px = S.player.x;
    const py = S.player.y;
    if (edge === 0) { x = px - 700; y = py - 500; }
    if (edge === 1) { x = px + 700; y = py - 500; }
    if (edge === 2) { x = px - 700; y = py + 500; }
    if (edge === 3) { x = px + 700; y = py + 500; }
    x = clamp(x, 140, CFG.worldW - 140);
    y = clamp(y, 140, CFG.worldH - 140);
    const car = makeCar(x, y, 0, { name: 'interceptor', w: 40, h: 21, color: '#111111', max: 470 }, { police: true, driver: 'police' });
    car.color = '#14181d';
    S.policeCars.push(car);
  }
  while (S.policeCars.length > wantCount) S.policeCars.pop();

  const target = S.playerCar || S.player;
  const playerSpeed = S.playerCar ? Math.abs(S.playerCar.speed) : S.player.speedNow || 0;
  let anyNear = false;

  for (const cop of S.policeCars) {
    // Chase along roads toward the player.
    const wp = roadWaypoint(S.city, cop, target);
    const dx = wp.x - cop.x;
    const dy = wp.y - cop.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += clamp(diff * 2.4, -1, 1) * 2.6 * dt;
    const dPlayer = dist(cop.x, cop.y, target.x, target.y);
    if (dPlayer < 420) anyNear = true;
    // Ram: full speed when far, ease off when close so the bust can land.
    const wantSpeed = dPlayer > 90 ? 460 : 300;
    cop.speed += clamp(wantSpeed - cop.speed, -300 * dt, 260 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 60, CFG.worldW - 60);
    cop.y = clamp(cop.y, 60, CFG.worldH - 60);
    // Ramming the player's car damages it.
    if (S.playerCar && dPlayer < 34) {
      S.playerCar.damage += 6 * dt;
      S.playerCar.speed *= 1 - 0.4 * dt;
      S.particles.burst(cop.x, cop.y, '#c2c2c2', 3);
    }
    // Bust: close and slow for long enough.
    if (dPlayer < 46 && playerSpeed < 60) {
      S.bustTimer += dt;
      if (S.bustTimer > CFG.bustHoldSeconds) {
        S.busted();
        return;
      }
    } else {
      S.bustTimer = Math.max(0, S.bustTimer - dt * 2);
    }
  }

  // Cool down: no cop in sight for a while drops one star.
  if (S.wanted > 0) {
    if (!anyNear) {
      S.coolTimer += dt;
      if (S.coolTimer > CFG.wantedCoolSeconds) {
        S.coolTimer = 0;
        S.wanted = Math.max(0, S.wanted - 1);
        if (S.wanted === 0) S.policeCars.length = 0;
      }
    } else {
      S.coolTimer = 0;
    }
  }
}

// Drive into the Respray zone with cash to wipe the wanted level.
export function tryRespray(S) {
  const r = S.city.locations.respray;
  if (S.wanted === 0) return false;
  if (!S.playerCar) return false;
  if (dist(S.playerCar.x, S.playerCar.y, r.x, r.y) > 70) return false;
  if (S.money < CFG.resprayCost) return false;
  S.money -= CFG.resprayCost;
  S.wanted = 0;
  S.policeCars.length = 0;
  S.coolTimer = 0;
  S.playerCar.damage = 0;
  S.playerCar.color = ['#c23b2e', '#2e6fc2', '#3f9e5f', '#7a4fb0'][Math.floor(S.rng() * 4)];
  S.audio.jingle();
  S.hudFlash('RESPRAY — WANTED CLEARED (−$150)');
  return true;
}
