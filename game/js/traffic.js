// AI traffic (cars follow the road graph, slow for the car ahead, honk)
// and pedestrians (sidewalks, flee gunfire and speeding cars).
import { ROAD_LINES, WORLD_W, WORLD_H } from './config.js';
import { createCar, stepCar } from './vehicles.js';
import { findRoute, isRoad, nearestRoadPoint } from './city.js';

const TRAFFIC_TYPES = ['hatch', 'sedan', 'van', 'sedan', 'hatch', 'taxi'];
const PED_COLORS = ['#e86a6a', '#6ae87a', '#6a9ae8', '#e8d86a', '#c86ae8', '#e8a06a'];

export function spawnTraffic(rng, city, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const type = rng.pick(TRAFFIC_TYPES);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(100, WORLD_H - 100);
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : line;
    const y = horizontal ? line : along;
    const angle = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(type, x, y, angle, { owner: 'traffic' });
    car.route = randomRoute(rng, x, y);
    car.routeIdx = 0;
    cars.push(car);
  }
  return cars;
}

function randomRoute(rng, x, y) {
  const tx = rng.pick(ROAD_LINES) + rng.range(-40, 40);
  const ty = rng.pick(ROAD_LINES) + rng.range(-40, 40);
  return findRoute(x, y, tx, ty) || [{ x: tx, y: ty }];
}

export function spawnPedestrians(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(100, WORLD_H - 100);
    const horizontal = rng.chance(0.5);
    peds.push({
      x: horizontal ? along : line + (rng.chance(0.5) ? 78 : -78),
      y: horizontal ? line + (rng.chance(0.5) ? 78 : -78) : along,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(35, 70),
      color: rng.pick(PED_COLORS),
      flee: 0, state: 'walk', vx: 0, vy: 0,
    });
  }
  return peds;
}

// Traffic step: steer toward next route waypoint, slow when blocked ahead.
export function stepTraffic(cars, dt, city, rng, playerCar, audio) {
  for (const car of cars) {
    if (!car.route || car.routeIdx >= car.route.length) {
      car.route = randomRoute(rng, car.x, car.y);
      car.routeIdx = 0;
    }
    const target = car.route[car.routeIdx];
    // Knocked off the road? Head for the nearest road first.
    const goal = isRoad(car.x, car.y) ? target : nearestRoadPoint(car.x, car.y);
    const dx = goal.x - car.x, dy = goal.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30 && isRoad(car.x, car.y)) { car.routeIdx += 1; continue; }
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Slow for the car ahead (player or traffic) in roughly the same heading.
    let blocked = false;
    const aheadX = car.x + Math.cos(car.angle) * 70;
    const aheadY = car.y + Math.sin(car.angle) * 70;
    const all = playerCar ? [...cars, playerCar] : cars;
    for (const o of all) {
      if (o === car) continue;
      if (Math.hypot(o.x - aheadX, o.y - aheadY) < 34) { blocked = true; break; }
    }
    if (blocked && car.honkAt <= 0 && rng.chance(0.02)) {
      car.honkAt = 2; audio.honk();
    }
    car.honkAt = Math.max(0, car.honkAt - dt);
    const throttle = blocked ? 0 : 0.55;
    stepCar(car, { throttle, steer: Math.max(-1, Math.min(1, diff * 1.6)), brake: blocked }, dt, city, cars);
  }
}

export function stepPedestrians(peds, dt, city, danger) {
  for (const p of peds) {
    if (p.flee > 0) {
      p.flee -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = Math.max(15, Math.min(WORLD_W - 15, p.x));
      p.y = Math.max(15, Math.min(WORLD_H - 15, p.y));
      continue;
    }
    // Flee gunfire / a speeding car nearby.
    if (danger && Math.hypot(p.x - danger.x, p.y - danger.y) < (danger.radius || 160)) {
      const a = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.vx = Math.cos(a) * 190; p.vy = Math.sin(a) * 190;
      p.flee = 1.6;
      continue;
    }
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (!isRoad(p.x, p.y) && Math.random() < 0.02) {
      // Wander: stay near sidewalks, turn at random.
      p.angle += (Math.random() - 0.5) * 1.6;
    }
    if (p.x < 40 || p.x > WORLD_W - 40 || p.y < 40 || p.y > WORLD_H - 40) {
      p.angle += Math.PI;
      p.x = Math.max(40, Math.min(WORLD_W - 40, p.x));
      p.y = Math.max(40, Math.min(WORLD_H - 40, p.y));
    }
  }
}
