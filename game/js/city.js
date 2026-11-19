// Procedural Velor Bay: a road grid, building blocks, a beach on the east
// edge, parks, and the fixed story locations (garage, bank, safehouse,
// respray shop, alleys). Collision is a list of building rects; routing is
// Manhattan along the nearest roads.
import { CFG, districtAt } from './config.js';
import { makeRng, pick, range, clamp } from './random.js';

export function roadXs() {
  const xs = [];
  for (let x = 200; x <= 3000; x += CFG.roadGap) xs.push(x);
  return xs;
}

export function roadYs() {
  const ys = [];
  for (let y = 200; y <= 2200; y += CFG.roadGap) ys.push(y);
  return ys;
}

function nearestRoad(v, roads) {
  let best = roads[0];
  for (const r of roads) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const xs = roadXs();
  const ys = roadYs();
  const buildings = [];
  const trees = [];
  const parks = [];
  // One building cluster per block between four roads.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + CFG.roadW / 2 + 24;
      const y0 = ys[j] + CFG.roadW / 2 + 24;
      const x1 = xs[i + 1] - CFG.roadW / 2 - 24;
      const y1 = ys[j + 1] - CFG.roadW / 2 - 24;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (rng() < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 7, 12) });
        }
        continue;
      }
      const n = 1 + Math.floor(rng() * 3);
      for (let b = 0; b < n; b++) {
        const w = range(rng, 70, Math.min(150, x1 - x0));
        const h = range(rng, 60, Math.min(130, y1 - y0));
        const bx = range(rng, x0, x1 - w);
        const by = range(rng, y0, y1 - h);
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, CFG.colors.roof),
          roof: rng() < 0.5 ? 'flat' : 'pitched',
          hgt: range(rng, 0.5, 1),
        });
      }
      if (rng() < 0.5) {
        trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 6, 11) });
      }
    }
  }
  // Beach strip: sand then water on the far east.
  const beach = { x: 3064, w: CFG.worldW - 3064 };

  const locations = {
    garage: { x: 620, y: 640, label: 'Garage' },
    bank: { x: 1820, y: 1040, label: 'Velor Bank' },
    safehouse: { x: 620, y: 1840, label: 'Safehouse' },
    respray: { x: 1020, y: 620, label: 'Respray' },
    alley: { x: 1420, y: 1440, label: 'Alley' },
    cargo: { x: 2620, y: 640, label: 'Docks' },
  };

  return { seed, xs, ys, buildings, trees, parks, beach, locations };
}

export function isOnRoad(city, x, y) {
  const hw = CFG.roadW / 2;
  for (const rx of city.xs) if (Math.abs(x - rx) <= hw) return true;
  for (const ry of city.ys) if (Math.abs(y - ry) <= hw) return true;
  return false;
}

// Circle vs building rects: push the circle out, report whether it hit.
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = clamp(p.x, b.x, b.x + b.w);
    const cy = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        p.y = b.y - r;
      }
    }
  }
  return hit;
}

export function clampToWorld(p, margin) {
  p.x = clamp(p.x, margin, CFG.worldW - margin);
  p.y = clamp(p.y, margin, CFG.worldH - margin);
}

// Next waypoint for a road-following route: go along the current road to
// the target's road, then along that road to the target.
export function roadWaypoint(city, from, to) {
  const fx = nearestRoad(from.x, city.xs);
  const fy = nearestRoad(from.y, city.ys);
  const tx = nearestRoad(to.x, city.xs);
  const ty = nearestRoad(to.y, city.ys);
  const onV = Math.abs(from.x - fx) < CFG.roadW / 2 - 6;
  const onH = Math.abs(from.y - fy) < CFG.roadW / 2 - 6;
  if (onV) {
    if (Math.abs(from.y - ty) < 8) return { x: to.x, y: to.y };
    return { x: fx, y: ty };
  }
  if (onH) {
    if (Math.abs(from.x - tx) < 8) return { x: to.x, y: to.y };
    return { x: tx, y: fy };
  }
  // Off-road: head for the nearest intersection first.
  return { x: fx, y: fy };
}

export function districtOf(x, y) {
  return districtAt(x, y);
}
