// Wanted 0–5: police interceptors spawn, chase and ram; pin a slow player
// down and it's BUSTED. Wanted decays when no cop can see you, or pay the
// Respray to wipe it clean.
import { createCar, stepCar } from './vehicles.js';
import { findRoute, isRoad, nearestRoadPoint } from './city.js';
import { RESPRAY_COST, PLACES } from './config.js';

export function createPolice() {
  return {
    wanted: 0,
    cops: [],
    bustedTimer: 0,
    hiddenTimer: 0,
    decayTimer: 0,
    resprayMsg: 0,
    lastSeen: null,
    lastSeenT: 0,
  };
}

export function addWanted(police, n, reason) {
  const before = police.wanted;
  police.wanted = Math.max(0, Math.min(5, police.wanted + n));
  if (police.wanted > before) police.hiddenTimer = 0;
  return police.wanted;
}

export function clearWanted(police) {
  police.wanted = 0;
  police.cops.length = 0;
  police.bustedTimer = 0;
  police.hiddenTimer = 0;
  police.lastSeen = null;
  police.lastSeenT = 0;
}

// A spawn point 650–900 px from the player. Clamping to the world edge can
// land a cop right next to the player (a westward spawn from x=300 clamps
// to x=120, only 180 px away) — so retry angles until the clamped point is
// still at least 550 px out.
function spawnPoint(rng, px, py) {
  let best = null, bestD = -1;
  for (let t = 0; t < 6; t += 1) {
    const a = rng.range(0, Math.PI * 2);
    const d = 650 + rng.range(0, 250);
    const x = Math.max(120, Math.min(3080, px + Math.cos(a) * d));
    const y = Math.max(120, Math.min(3080, py + Math.sin(a) * d));
    const dist = Math.hypot(x - px, y - py);
    if (dist >= 550) return { x, y };
    if (dist > bestD) { bestD = dist; best = { x, y }; }
  }
  return best;
}

// Spawn cops just off-screen around the player until count == wanted.
export function syncCops(police, rng, px, py, city) {
  const want = police.wanted;
  while (police.cops.length < want) {
    const pt = spawnPoint(rng, px, py);
    const cop = createCar('cop', pt.x, pt.y, Math.atan2(py - pt.y, px - pt.x), { owner: 'police' });
    cop.route = findRoute(pt.x, pt.y, px, py) || [{ x: px, y: py }];
    cop.routeIdx = 0;
    police.cops.push(cop);
  }
  while (police.cops.length > want) police.cops.pop();
}

// Returns 'busted' when the pin-down completes, else null.
export function stepPolice(police, dt, S, audio) {
  const player = S.player;
  const px = player.x, py = player.y;
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.moveSpeed || 0;
  let anyNear = false;
  let nearest = Infinity;
  for (const cop of police.cops) {
    const dPlayer0 = Math.hypot(cop.x - px, cop.y - py);
    nearest = Math.min(nearest, dPlayer0);
    if (dPlayer0 < 600) { police.lastSeen = { x: px, y: py }; police.lastSeenT = S.time; anyNear = true; }
  }
  // Cops chase the last place they saw the player — outrun them past 600 px
  // and the heat cools off. If the trail is cold (>4 s), they search the
  // area around the last sighting instead of idling on the stale point.
  let tx = police.lastSeen ? police.lastSeen.x : px;
  let ty = police.lastSeen ? police.lastSeen.y : py;
  const cold = !police.lastSeen || (S.time - police.lastSeenT > 4);
  for (let ci = 0; ci < police.cops.length; ci += 1) {
    const cop = police.cops[ci];
    // Chase: route to the last-seen spot, refreshed every couple of seconds.
    cop.repath = (cop.repath || 0) - dt;
    if (cop.repath <= 0 || !cop.route || cop.routeIdx >= cop.route.length) {
      let gx = tx, gy = ty;
      if (cold && police.lastSeen) {
        // Search pattern: a random nearby intersection.
        gx = police.lastSeen.x + S.rng.int(-1, 1) * 400;
        gy = police.lastSeen.y + S.rng.int(-1, 1) * 400;
        gx = Math.max(200, Math.min(3000, gx));
        gy = Math.max(200, Math.min(3000, gy));
      }
      cop.route = findRoute(cop.x, cop.y, gx, gy) || [{ x: gx, y: gy }];
      cop.routeIdx = 0;
      cop.repath = 2 + Math.random();
    }
    const wp = cop.route[Math.min(cop.routeIdx, cop.route.length - 1)];
    // Spread interceptors across the road so they don't bunch up and jam.
    const laneOff = (ci % 3 - 1) * 30;
    const wAng = Math.atan2(wp.y - cop.y, wp.x - cop.x);
    let target = {
      x: wp.x + Math.cos(wAng + Math.PI / 2) * laneOff,
      y: wp.y + Math.sin(wAng + Math.PI / 2) * laneOff,
    };
    // Knocked off the road (rammed by the player or another car)? Head for
    // the nearest road first instead of cutting across a block.
    if (!isRoad(cop.x, cop.y)) target = nearestRoadPoint(cop.x, cop.y);
    const dx = target.x - cop.x, dy = target.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 40) cop.routeIdx += 1;
    const want = Math.atan2(dy, dx);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Ram: full throttle when roughly lined up, brake-steer otherwise.
    let throttle = Math.abs(diff) < 0.9 ? 1 : 0.4;
    let steer = Math.max(-1, Math.min(1, diff * 2));
    // Wedged against a building? Back out and try again.
    cop.stuckT = Math.abs(cop.speed) < 20 ? (cop.stuckT || 0) + dt : 0;
    if (cop.stuckT > 1.0) { cop.stuckT = 0; cop.reverseT = 0.8; }
    if (cop.reverseT > 0) {
      cop.reverseT -= dt;
      throttle = -1;
      steer = -steer;
    }
    // Cops push through traffic and each other (no cop-cop jam) — they only
    // collide with the player's car.
    stepCar(cop, { throttle, steer, brake: false }, dt, S.city, player.inCar ? [player.inCar] : []);
    const dPlayer = Math.hypot(cop.x - px, cop.y - py);
    nearest = Math.min(nearest, dPlayer);
    if (dPlayer < 550) anyNear = true;
    // Ramming the player's car damages it; ramming the player hurts.
    if (dPlayer < 46) {
      if (player.inCar) {
        player.inCar.hp -= 6 * dt;
        if (player.inCar.hp <= 0) {
          player.inCar.hp = 0;
        }
      } else {
        player.hp -= 6 * dt;
      }
    }
  }
  // BUSTED: a cop within 80 px while the player is slow, for 1.6 s.
  if (police.wanted > 0 && nearest < 85 && playerSpeed < 45) {
    police.bustedTimer += dt;
    if (police.bustedTimer >= 1.6) return 'busted';
  } else {
    police.bustedTimer = Math.max(0, police.bustedTimer - dt * 2);
  }
  // Decay: stay out of sight (no cop within 550 px) and the heat cools.
  if (police.wanted > 0) {
    if (!anyNear) {
      police.hiddenTimer += dt;
      if (police.hiddenTimer > 8) {
        police.hiddenTimer = 0;
        police.wanted -= 1;
      }
    } else {
      police.hiddenTimer = 0;
    }
  }
  audio.siren(police.wanted > 0, dt);
  return null;
}

// Respray: drive (or walk) into the respray zone with wanted > 0 and $150.
export function checkRespray(police, S) {
  const p = S.player;
  const d = Math.hypot(p.x - PLACES.respray.x, p.y - PLACES.respray.y);
  if (d > 90) return null;
  if (police.wanted === 0) return null;
  if (p.money < RESPRAY_COST) return 'poor';
  p.money -= RESPRAY_COST;
  clearWanted(police);
  police.resprayMsg = 3;
  return 'done';
}
