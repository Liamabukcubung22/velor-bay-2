// ?shot= scenes. Each plays the real rules forward from a fresh world,
// steered by a simple autopilot (walk straight at the target, drive the
// BFS road route), then paints twice and sets window.__shotReady.
import { STEP, ROAD_LINES } from './config.js';
import { findRoute } from './city.js';
import { addWanted, syncCops } from './police.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { PLACES } from './config.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Autopilot input: walks at a target, or drives the road route to it.
export function makePilot(S) {
  let route = null;
  let routeIdx = 0;
  let routeTarget = null;
  let stuckT = 0;
  let reverseT = 0;
  return {
    setTarget(x, y) {
      if (!routeTarget || Math.hypot(routeTarget.x - x, routeTarget.y - y) > 5) {
        route = findRoute(S.player.x, S.player.y, x, y) || [{ x, y }];
        routeIdx = 0;
        routeTarget = { x, y };
      }
    },
    dir() {
      const p = S.player;
      if (!routeTarget) return { x: 0, y: 0, run: false, brake: false };
      if (!p.inCar) {
        const dx = routeTarget.x - p.x, dy = routeTarget.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 25) return { x: 0, y: 0, run: false, brake: false };
        return { x: clamp(dx / 40, -1, 1), y: clamp(dy / 40, -1, 1), run: true, brake: false };
      }
      // Driving: follow route waypoints.
      if (!route || routeIdx >= route.length) {
        route = findRoute(p.x, p.y, routeTarget.x, routeTarget.y) || [{ x: routeTarget.x, y: routeTarget.y }];
        routeIdx = 0;
      }
      const wp = route[Math.min(routeIdx, route.length - 1)];
      const dx = wp.x - p.x, dy = wp.y - p.y;
      if (Math.hypot(dx, dy) < 45) { routeIdx += 1; return { x: 0, y: -1, run: false, brake: false }; }
      const want = Math.atan2(dy, dx);
      const diff = angleDiff(want, p.angle);
      const car = p.inCar;
      if (Math.abs(car.speed) < 12 && reverseT <= 0) {
        stuckT += STEP;
        if (stuckT > 1.5) { reverseT = 0.8; stuckT = 0; }
      } else {
        stuckT = 0;
      }
      if (reverseT > 0) {
        reverseT -= STEP;
        return { x: clamp(-diff * 2, -1, 1), y: 1, run: false, brake: false };
      }
      const throttle = Math.abs(diff) < 0.6 ? 1 : 0.45;
      return { x: clamp(diff * 2.2, -1, 1), y: -throttle, run: false, brake: Math.abs(diff) > 2.4 };
    },
  };
}

function fakeInput(pilot) {
  return {
    dir: () => pilot.dir(),
    state: { mouseX: 640, mouseY: 360, mouseDown: false },
  };
}

function stepFor(game, pilot, seconds, viewW, viewH, until) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.stepPlay(STEP, fakeInput(pilot), viewW, viewH);
    if (until && until()) break;
    if (game.S.screen !== 'play') break;
  }
}

export function stageShot(name, game, viewW, viewH) {
  const S = game.S;
  if (name === 'title') {
    for (let i = 0; i < 5 / STEP; i += 1) game.stepTitle(STEP, viewW, viewH);
    S.screen = 'title';
    return { screen: SCREEN_TITLE };
  }
  game.newGame();
  const pilot = makePilot(S);

  if (name === 'wanted') {
    // Steal a parked civilian car for real (retry spots until the car
    // entered is actually civilian), raise the heat to 3 stars, pull the
    // interceptors in close, then flee down the avenue.
    const spots2 = [[1400, 240], [1000, 640], [2200, 640], [2600, 1040], [640, 1800]];
    for (const [sx, sy] of spots2) {
      S.player.x = sx; S.player.y = sy + 40;
      game.handleInteract();
      if (S.player.inCar && S.player.inCar.wasCivilian) break;
      if (S.player.inCar) { S.player.inCar = null; }
    }
    addWanted(S.police, 2, 'shot');
    syncCops(S.police, S.rng, S.player.x, S.player.y, S.city);
    // Stage the interceptors at distinct intersections behind the player.
    const nearLine = (v) => ROAD_LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const offs = [[-200, 0], [-600, 0], [0, 400]];
    S.police.cops.forEach((cop, i) => {
      const [dx, dy] = offs[i % offs.length];
      cop.x = nearLine(S.player.x + dx);
      cop.y = nearLine(S.player.y + dy);
      cop.angle = Math.atan2(S.player.y - cop.y, S.player.x - cop.x);
      cop.speed = 200;
    });
    pilot.setTarget(2600, 600);
    stepFor(game, pilot, 3.5, viewW, viewH);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // Play mission 1 end to end with the autopilot, then freeze on the
    // MISSION COMPLETE panel.
    pilot.setTarget(PLACES.garage.x, PLACES.garage.y);
    stepFor(game, pilot, 25, viewW, viewH, () => !!S.player.inCar);
    if (!S.player.inCar) game.handleInteract();
    pilot.setTarget(PLACES.safehouse.x, PLACES.safehouse.y);
    stepFor(game, pilot, 60, viewW, viewH, () => S.missions.completeFlash > 0);
    return { screen: SCREEN_PLAY };
  }

  // Default: 'drive' — the cover. Play mission 1, then cruise the avenue.
  pilot.setTarget(PLACES.garage.x, PLACES.garage.y);
  stepFor(game, pilot, 25, viewW, viewH, () => !!S.player.inCar);
  if (!S.player.inCar) game.handleInteract();
  pilot.setTarget(PLACES.safehouse.x, PLACES.safehouse.y);
  stepFor(game, pilot, 40, viewW, viewH, () => S.missions.completeFlash > 0);
  pilot.setTarget(2600, 600);
  stepFor(game, pilot, 12, viewW, viewH);
  return { screen: SCREEN_PLAY };
}
