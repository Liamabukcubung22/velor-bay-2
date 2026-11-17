// Combat: player bullets (mouse aim), gang enemies with simple chase-and-
// shoot AI, ammo/health pickups. Shooting a cop raises wanted.
import { PISTOL_DAMAGE, PISTOL_RANGE } from './config.js';
import { addWanted } from './police.js';

export function createCombat() {
  return { bullets: [], enemies: [], pickups: [] };
}

export function fireBullet(combat, x, y, angle, from, damage = PISTOL_DAMAGE) {
  combat.bullets.push({
    x, y, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620,
    life: PISTOL_RANGE / 620, from, damage,
  });
}

export function spawnEnemies(combat, rng, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    combat.enemies.push({
      x: x + rng.range(-90, 90), y: y + rng.range(-90, 90),
      hp: 70, angle: rng.range(0, Math.PI * 2),
      speed: 120 + rng.range(0, 40),
      cooldown: rng.range(0.5, 1.5), state: 'chase',
    });
  }
}

export function spawnPickups(combat, rng, city) {
  // Ammo + health scattered on sidewalks near roads.
  for (let i = 0; i < 10; i += 1) {
    const line = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000][rng.int(0, 7)];
    const along = rng.range(150, 3050);
    const horizontal = rng.chance(0.5);
    combat.pickups.push({
      x: horizontal ? along : line + 85,
      y: horizontal ? line + 85 : along,
      kind: i % 2 === 0 ? 'ammo' : 'health',
      taken: false, bob: rng.range(0, Math.PI * 2),
    });
  }
}

function hitBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

export function stepCombat(combat, dt, S, audio) {
  const player = S.player;
  // Bullets.
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || hitBuilding(S.city, b.x, b.y);
    if (!dead && b.from === 'player') {
      for (const e of combat.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.hp -= b.damage;
          S.particles.spawn(b.x, b.y, 'spark', 5);
          if (e.hp <= 0) {
            S.stats.kills += 1;
            S.particles.spawn(e.x, e.y, 'smoke', 10);
          }
          dead = true; break;
        }
      }
      if (!dead) {
        for (const cop of S.police.cops) {
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 26) {
            cop.hp -= b.damage;
            addWanted(S.police, 1, 'shot-cop');
            S.particles.spawn(b.x, b.y, 'spark', 5);
            dead = true; break;
          }
        }
      }
    } else if (!dead && b.from === 'enemy') {
      if (!player.inCar && Math.hypot(player.x - b.x, player.y - b.y) < 15) {
        player.hp -= b.damage;
        player.hurtFlash = 0.25;
        audio.hit();
        dead = true;
      } else if (player.inCar && Math.hypot(player.inCar.x - b.x, player.inCar.y - b.y) < 26) {
        player.inCar.hp -= b.damage;
        dead = true;
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }
  // Enemy AI: chase the player, shoot when in range and line of sight is clear-ish.
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    if (d > 40) {
      const step = Math.min(e.speed * dt, d - 30);
      e.x += Math.cos(e.angle) * step;
      e.y += Math.sin(e.angle) * step;
    }
    e.cooldown -= dt;
    if (e.cooldown <= 0 && d < 420 && !player.inCar) {
      e.cooldown = 1.4 + Math.random() * 0.8;
      fireBullet(combat, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.16, 'enemy', 9);
      audio.enemyShot();
    }
  }
  combat.enemies = combat.enemies.filter((e) => e.hp > 0);
  // Pickups (on foot only).
  if (!player.inCar) {
    for (const p of combat.pickups) {
      if (p.taken) continue;
      p.bob += dt * 3;
      if (Math.hypot(p.x - player.x, p.y - player.y) < 26) {
        p.taken = true;
        if (p.kind === 'ammo') { player.ammo += 18; audio.blip(); }
        else { player.hp = Math.min(100, player.hp + 40); audio.blip(); }
      }
    }
  }
  // Player firing (mouse aim, held click, 0.22 s between shots).
  if (S.firing && !player.inCar && player.ammo > 0 && player.fireCooldown <= 0) {
    player.fireCooldown = 0.22;
    player.ammo -= 1;
    const gx = S.cam.x + S.mouse.sx, gy = S.cam.y + S.mouse.sy;
    const a = Math.atan2(gy - player.y, gx - player.x);
    player.aimAngle = a;
    fireBullet(combat, player.x + Math.cos(a) * 20, player.y + Math.sin(a) * 20, a, 'player');
    S.particles.spawn(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24, 'spark', 3);
    audio.shot();
    // Pedestrians flee the gunshot.
    S.danger = { x: player.x, y: player.y, radius: 260, t: 0.6 };
  }
}
