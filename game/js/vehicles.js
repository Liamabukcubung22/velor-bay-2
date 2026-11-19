// Car physics and spawning. One car is a position, a heading, a speed and
// a look; steering only bites while the car is moving, and the handbrake
// trades grip for a sharper turn. No car ever leaves the world.
import { CFG } from './config.js';
import { clamp, pick, range } from './random.js';
import { roadXs, roadYs, clampToWorld } from './city.js';

export const CAR_MODELS = [
  { name: 'hatch', w: 34, h: 20, color: '#c23b2e', max: 400 },
  { name: 'sedan', w: 40, h: 21, color: '#2e6fc2', max: 430 },
  { name: 'taxi', w: 38, h: 21, color: '#d8a018', max: 420 },
  { name: 'van', w: 46, h: 24, color: '#3f9e5f', max: 340 },
  { name: 'sports', w: 38, h: 19, color: '#7a4fb0', max: 520 },
];

let nextId = 1;

export function makeCar(x, y, angle, model, opts) {
  const o = opts || {};
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    model: model || pick(Math.random, CAR_MODELS),
    color: o.color || (model && model.color) || '#c2c2c2',
    police: !!o.police,
    mission: !!o.mission,
    target: !!o.target,
    stolen: false,
    damage: 0,
    honkAt: 0,
    driver: o.driver || null, // 'player' | 'traffic' | 'police' | null
    route: o.route || null,
  };
}

export function spawnParkedCar(rng, city, mission) {
  const xs = roadXs();
  const ys = roadYs();
  const rx = pick(rng, xs);
  const ry = pick(rng, ys);
  const alongX = rng() < 0.5;
  const x = alongX ? rx + range(rng, -160, 160) : rx + (rng() < 0.5 ? -CFG.roadW / 2 - 14 : CFG.roadW / 2 + 14);
  const y = alongX ? ry + (rng() < 0.5 ? -CFG.roadW / 2 - 14 : CFG.roadW / 2 + 14) : ry + range(rng, -160, 160);
  const model = pick(rng, CAR_MODELS);
  const car = makeCar(x, y, alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), model);
  car.mission = !!mission;
  return car;
}

// Player driving: forward/back input in [-1,1], steer in [-1,1].
export function driveCar(car, dt, fwd, steer, handbrake) {
  const top = (car.model && car.model.max) || CFG.carMaxSpeed;
  if (fwd > 0) car.speed += CFG.carAccel * fwd * dt;
  else if (fwd < 0) {
    if (car.speed > 5) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carAccel * 0.6 * dt;
  } else {
    // Rolling resistance.
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 600 * dt);
  car.speed = clamp(car.speed, -CFG.carMaxReverse, top);
  const turnRate = (handbrake ? CFG.handbrakeTurn : CFG.carTurn) * clamp(car.speed / 120, -1, 1);
  car.angle += steer * turnRate * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(car, 24);
}

// Simple autopilot: steer a car toward a target point on the road grid.
export function autoDrive(car, dt, target) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 26) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 400 * dt);
    return d;
  }
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.2, -1, 1);
  const fwd = Math.abs(diff) > 1.9 ? -0.4 : 1;
  driveCar(car, dt, fwd, steer, false);
  return d;
}

export function carCorners(car) {
  const w = (car.model && car.model.w) || 38;
  const h = (car.model && car.model.h) || 21;
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: car.x + c * hw - s * hh, y: car.y + s * hw + c * hh },
    { x: car.x + c * hw + s * hh, y: car.y + s * hw - c * hh },
    { x: car.x - c * hw + s * hh, y: car.y - s * hw - c * hh },
    { x: car.x - c * hw - s * hh, y: car.y - s * hw + c * hh },
  ];
}
