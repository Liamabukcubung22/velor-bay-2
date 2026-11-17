// Procedural Velor Bay: road grid, building blocks, parks, beach, palms.
// Collision is circle-vs-building-rectangle with push-out. The road graph
// (intersections at every road crossing) powers traffic, police and the
// screenshot autopilot via BFS routing.
import { WORLD_W, WORLD_H, ROAD_LINES, ROAD_HALF, ROAD_SPACING, BEACH_X, DISTRICTS, PLACES } from './config.js';

const ROOF_COLORS = ['#b0553f', '#4f7a5a', '#5a6b8f', '#8f7a4f', '#7a4f6b', '#4f8f7a', '#a08a5a', '#6b5a8f'];
const PARK_BLOCKS = new Set(['3,2', '5,5', '2,6']);

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  // Blocks sit between road lines: block (i,j) spans x in [line_i+HALF, line_{i+1}-HALF].
  for (let i = 0; i < ROAD_LINES.length - 1; i += 1) {
    for (let j = 0; j < ROAD_LINES.length - 1; j += 1) {
      const x0 = ROAD_LINES[i] + ROAD_HALF + 8;
      const y0 = ROAD_LINES[j] + ROAD_HALF + 8;
      const x1 = ROAD_LINES[i + 1] - ROAD_HALF - 8;
      const y1 = ROAD_LINES[j + 1] - ROAD_HALF - 8;
      const key = `${i},${j}`;
      if (PARK_BLOCKS.has(key)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: rng.range(x0 + 15, x1 - 15), y: rng.range(y0 + 15, y1 - 15), r: 9 + rng.range(0, 6) });
        }
        continue;
      }
      // 1–4 buildings per block, leaving alleys between them.
      const n = rng.int(1, 3);
      for (let b = 0; b < n; b += 1) {
        const w = rng.range(70, 130);
        const h = rng.range(60, 120);
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        buildings.push({
          x, y, w, h,
          color: rng.pick(ROOF_COLORS),
          hgt: rng.int(1, 3),
          windows: rng.int(2, 5),
        });
      }
      if (rng.chance(0.6)) {
        trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: 8 + rng.range(0, 5) });
      }
    }
  }
  // Beach palms along the east strip.
  for (let y = 120; y < WORLD_H; y += 130) {
    trees.push({ x: BEACH_X + 40 + rng.range(-12, 30), y: y + rng.range(-20, 20), r: 10, palm: true });
  }
  return { buildings, trees, parks };
}

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
  for (const l of ROAD_LINES) {
    if (Math.abs(x - l) <= ROAD_HALF || Math.abs(y - l) <= ROAD_HALF) return true;
  }
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Velor Bay';
}

// Push a circle out of buildings and world bounds. Returns true if it hit something.
export function collideCircle(city, x, y, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push; y += dy * push;
      } else {
        y = b.y - r; // directly inside: shove up
      }
    }
  }
  const nx = Math.max(r, Math.min(WORLD_W - r, x));
  const ny = Math.max(r, Math.min(WORLD_H - r, y));
  if (nx !== x || ny !== y) hit = true;
  return { x: nx, y: ny, hit };
}

// Nearest intersection node to a point.
function nearestNode(x, y) {
  let bi = 0, bj = 0, bd = Infinity;
  for (let i = 0; i < ROAD_LINES.length; i += 1) {
    for (let j = 0; j < ROAD_LINES.length; j += 1) {
      const dx = x - ROAD_LINES[i], dy = y - ROAD_LINES[j];
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
  }
  return { i: bi, j: bj };
}

// BFS route over the intersection grid. Returns waypoint list (world coords)
// from start to target, or null if unreachable.
export function findRoute(fromX, fromY, toX, toY) {
  const n = ROAD_LINES.length;
  const start = nearestNode(fromX, fromY);
  const goal = nearestNode(toX, toY);
  const prev = new Map();
  const key = (i, j) => i * 100 + j;
  const queue = [start];
  prev.set(key(start.i, start.j), null);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.i === goal.i && cur.j === goal.j) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = cur.i + di, nj = cur.j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const k = key(ni, nj);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      queue.push({ i: ni, j: nj });
    }
  }
  const gk = key(goal.i, goal.j);
  if (!prev.has(gk)) return null;
  const nodes = [];
  let cur = goal;
  while (cur) { nodes.unshift(cur); cur = prev.get(key(cur.i, cur.j)); }
  const pts = nodes.map((nd) => ({ x: ROAD_LINES[nd.i], y: ROAD_LINES[nd.j] }));
  pts.push({ x: toX, y: toY });
  return pts;
}

// Nearest point on the road network: snap to the closer centreline.
export function nearestRoadPoint(x, y) {
  const nx = ROAD_LINES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const ny = ROAD_LINES.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  if (Math.abs(nx - x) <= Math.abs(ny - y)) return { x: nx, y };
  return { x, y: ny };
}

export function routeDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export { PLACES, ROAD_SPACING };
