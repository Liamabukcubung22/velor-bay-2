// Car physics: arcade top-down — throttle, brake/reverse, steering that
// scales with speed, handbrake drift, building collision, car-car push.
import { CAR_TYPES } from './config.js';
import { collideCircle } from './city.js';

let nextId = 1;

export function createCar(type, x, y, angle, opts = {}) {
  const t = CAR_TYPES[type];
  return {
    id: nextId += 1,
    type, name: t.name, x, y, angle,
    speed: 0, max: t.max, accel: t.accel, turn: t.turn,
    len: t.len, wid: t.wid, color: opts.color || t.color,
    taxi: !!t.taxi, cop: type === 'cop',
    owner: opts.owner || 'civilian', // 'civilian' | 'mission' | 'player' | 'police'
    missionCar: !!opts.missionCar,
    hp: 100, smoke: false, honkAt: 0,
    route: null, routeIdx: 0, waitAt: 0,
  };
}

// Drive inputs: { throttle: -1..1, steer: -1..1, brake: bool }. Returns collision info.
export function stepCar(car, input, dt, city, others) {
  const t = CAR_TYPES[car.type];
  if (input.brake) {
    car.speed *= Math.pow(0.02, dt); // hard handbrake
    if (Math.abs(car.speed) < 5) car.speed = 0;
  } else if (input.throttle !== 0) {
    const dir = input.throttle > 0 ? 1 : -1;
    const top = dir > 0 ? t.max : t.max * 0.45;
    car.speed += dir * t.accel * dt;
    if (car.speed > top) car.speed = top;
    if (car.speed < -top) car.speed = -top;
  } else {
    car.speed *= Math.pow(0.25, dt); // rolling drag
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  const steerScale = Math.min(1, Math.abs(car.speed) / 90);
  car.angle += input.steer * t.turn * steerScale * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = Math.max(car.len, car.wid) * 0.42;
  const res = collideCircle(city, nx, ny, r);
  if (res.hit && Math.abs(car.speed) > 120) {
    car.hp -= Math.abs(car.speed) * 0.02;
    car.speed *= 0.4;
  } else if (res.hit) {
    car.speed *= 0.5;
  }
  car.x = res.x; car.y = res.y;
  // Soft car-car push (circle approximation).
  if (others) {
    for (const o of others) {
      if (o === car) continue;
      const dx = car.x - o.x, dy = car.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = (car.len + o.len) * 0.32;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d, uy = dy / d;
        car.x += ux * push; car.y += uy * push;
        o.x -= ux * push * 0.5; o.y -= uy * push * 0.5;
        const rel = Math.abs(car.speed - (o.speed || 0));
        if (rel > 150) { car.hp -= rel * 0.01; if (o.hp !== undefined) o.hp -= rel * 0.01; }
        car.speed *= 0.7;
      }
    }
  }
  if (car.hp < 35) car.smoke = true;
  return res.hit;
}

export function carFront(car) {
  return { x: car.x + Math.cos(car.angle) * car.len * 0.55, y: car.y + Math.sin(car.angle) * car.len * 0.55 };
}
