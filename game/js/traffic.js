// Traffic cars that follow the road grid and pedestrians on the sidewalks.
// Traffic slows behind the car ahead, turns at intersections, and honks;
// pedestrians flee gunshots and fast cars.
import { CFG } from './config.js';
import { makeRng, pick, range, clamp, dist, angleDiff } from './random.js';
import { roadXs, roadYs, isOnRoad, collideBuildings, clampToWorld } from './city.js';
import { makeCar, CAR_MODELS } from './vehicles.js';

export function spawnTraffic(rng, city, count) {
  const cars = [];
  const xs = roadXs();
  const ys = roadYs();
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const x = vertical ? pick(rng, xs) : range(rng, 240, CFG.worldW - 240);
    const y = vertical ? range(rng, 240, CFG.worldH - 240) : pick(rng, ys);
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(x, y, angle, pick(rng, CAR_MODELS));
    car.driver = 'traffic';
    car.speed = range(rng, 90, 170);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

export function spawnPedestrians(rng, city, count) {
  const peds = [];
  const xs = roadXs();
  const ys = roadYs();
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const x = vertical ? pick(rng, xs) + (rng() < 0.5 ? -CFG.roadW / 2 - 12 : CFG.roadW / 2 + 12) : range(rng, 240, CFG.worldW - 240);
    const y = vertical ? range(rng, 240, CFG.worldH - 240) : pick(rng, ys) + (rng() < 0.5 ? -CFG.roadW / 2 - 12 : CFG.roadW / 2 + 12);
    peds.push({
      x, y,
      angle: rng() * Math.PI * 2,
      speed: range(rng, 35, 70),
      color: pick(rng, ['#d8b25a', '#5a8ad8', '#d85a7a', '#7ad85a', '#c2c2c2', '#8a5ad8']),
      state: 'walk',
      fleeX: 0, fleeY: 0, fleeT: 0,
      walkT: range(rng, 2, 8),
    });
  }
  return peds;
}

function carAhead(cars, self, look) {
  let best = null;
  let bestD = look;
  for (const c of cars) {
    if (c === self) continue;
    const dx = c.x - self.x;
    const dy = c.y - self.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > look) continue;
    const ahead = Math.cos(self.angle) * dx + Math.sin(self.angle) * dy;
    const side = Math.abs(-Math.sin(self.angle) * dx + Math.cos(self.angle) * dy);
    if (ahead > 0 && side < 26 && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function updateTraffic(S, dt) {
  const rng = S.rng;
  for (const car of S.traffic) {
    // At an intersection, sometimes pick a new direction.
    const nearX = Math.abs(car.x - Math.round(car.x / CFG.roadGap) * CFG.roadGap) < 9999;
    const onV = S.city.xs.some((rx) => Math.abs(car.x - rx) < 10);
    const onH = S.city.ys.some((ry) => Math.abs(car.y - ry) < 10);
    if (onV && onH && rng() < dt * 0.25) {
      const turns = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      car.angle = pick(rng, turns);
    }
    // Slow behind the car ahead; honk if stuck.
    const ahead = carAhead([...S.traffic, ...S.policeCars, S.playerCar].filter(Boolean), car, 90);
    let want = car.cruise || 130;
    if (ahead) {
      want = Math.min(want, Math.max(0, ahead.speed - 20));
      if (ahead.speed < 15) {
        car.honkAt -= dt;
        if (car.honkAt <= 0) {
          car.honkAt = 3 + rng() * 3;
          S.audio.horn();
        }
      }
    }
    car.speed += clamp(want - car.speed, -260 * dt, 160 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the world edges so streets stay busy.
    if (car.x < 120) car.x = CFG.worldW - 140;
    if (car.x > CFG.worldW - 120) car.x = 140;
    if (car.y < 120) car.y = CFG.worldH - 140;
    if (car.y > CFG.worldH - 120) car.y = 140;
    // Nudge back onto the road if drifting.
    if (!isOnRoad(S.city, car.x, car.y)) {
      const nx = S.city.xs.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      const ny = S.city.ys.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      if (Math.abs(nx - car.x) < Math.abs(ny - car.y)) car.x += clamp(nx - car.x, -60 * dt, 60 * dt);
      else car.y += clamp(ny - car.y, -60 * dt, 60 * dt);
    }
  }
}

export function updatePedestrians(S, dt) {
  for (const p of S.peds) {
    if (p.state === 'flee') {
      p.fleeT -= dt;
      p.x += Math.cos(p.angle) * 190 * dt;
      p.y += Math.sin(p.angle) * 190 * dt;
      if (p.fleeT <= 0) p.state = 'walk';
    } else {
      p.walkT -= dt;
      if (p.walkT <= 0) {
        p.walkT = range(S.rng, 3, 9);
        // Keep walking along a sidewalk: pick a cardinal direction.
        p.angle = pick(S.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
    collideBuildings(S.city, p, 10);
    clampToWorld(p, 60);
    // Flee fast cars and gunfire.
    const threat = S.playerCar && Math.abs(S.playerCar.speed) > 260
      ? dist(p.x, p.y, S.playerCar.x, S.playerCar.y) < 130 ? S.playerCar : null
      : null;
    const nearShot = S.lastShotAt && (performance.now() - S.lastShotAt < 900) && S.lastShotPos
      ? dist(p.x, p.y, S.lastShotPos.x, S.lastShotPos.y) < 220
      : false;
    if ((threat || nearShot) && p.state !== 'flee') {
      const tx = threat ? threat.x : S.lastShotPos.x;
      const ty = threat ? threat.y : S.lastShotPos.y;
      p.angle = Math.atan2(p.y - ty, p.x - tx);
      p.state = 'flee';
      p.fleeT = 1.6 + S.rng() * 1.2;
    }
  }
}

// A pedestrian hit by a car: knock them down, raise wanted.
export function checkPedHits(S) {
  if (!S.playerCar) return;
  for (const p of S.peds) {
    if (p.down) continue;
    if (dist(p.x, p.y, S.playerCar.x, S.playerCar.y) < 24 && Math.abs(S.playerCar.speed) > 60) {
      p.down = true;
      p.downT = 4;
      S.stats.hits = (S.stats.hits || 0) + 1;
      S.addWanted(1, 'pedestrian');
      S.particles.burst(p.x, p.y, '#d85a5a', 14);
    }
  }
  for (const p of S.peds) {
    if (p.down) {
      p.downT -= S.dt;
      if (p.downT <= 0) {
        p.down = false;
        p.x += 40;
        p.y += 40;
      }
    }
  }
}
