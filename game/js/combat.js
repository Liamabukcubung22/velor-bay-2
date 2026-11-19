// Combat: pistol bullets (mouse aim, click to fire), gang enemies that
// chase and shoot, melee punches, and health/ammo pickups on the street.
import { CFG } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { collideBuildings } from './city.js';

export function makeEnemy(x, y, hp) {
  return {
    x, y,
    angle: 0,
    hp: hp || 60,
    speed: 120,
    shootAt: 1 + Math.random() * 2,
    dead: false,
    flash: 0,
  };
}

export function spawnGang(S, x, y, count, hp) {
  for (let i = 0; i < count; i++) {
    S.enemies.push(makeEnemy(x + (S.rng() * 120 - 60), y + (S.rng() * 120 - 60), hp));
  }
  S.hudFlash('GANG MEMBERS — ' + count + ' HOSTILES');
}

export function fireBullet(S, fromX, fromY, angle, friendly) {
  S.bullets.push({
    x: fromX + Math.cos(angle) * 18,
    y: fromY + Math.sin(angle) * 18,
    vx: Math.cos(angle) * CFG.bulletSpeed,
    vy: Math.sin(angle) * CFG.bulletSpeed,
    friendly: !!friendly,
    life: 1.1,
  });
  S.lastShotAt = performance.now();
  S.lastShotPos = { x: fromX, y: fromY };
  if (friendly) S.audio.shot();
  else S.audio.enemyShot();
}

export function playerShoot(S) {
  const p = S.player;
  if (p.inCar || p.dead) return;
  if (p.ammo <= 0) {
    S.hudFlash('NO AMMO — FIND A PICKUP');
    return;
  }
  p.ammo -= 1;
  const aim = S.aimAngle;
  fireBullet(S, p.x, p.y, aim, true);
  S.particles.burst(p.x + Math.cos(aim) * 20, p.y + Math.sin(aim) * 20, '#ffd76a', 4);
}

export function combatPunch(S) {
  const p = S.player;
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (dist(p.x, p.y, e.x, e.y) < 34) {
      e.hp -= 20;
      e.flash = 0.15;
      if (e.hp <= 0) killEnemy(S, e);
    }
  }
}

export function killEnemy(S, e) {
  if (e.dead) return;
  e.dead = true;
  S.stats.kills = (S.stats.kills || 0) + 1;
  S.particles.burst(e.x, e.y, '#d85a5a', 18);
  S.audio.pickup();
  S.missions.onKill(S, e);
}

export function updateCombat(S, dt) {
  // Bullets fly, hit buildings, enemies, the player, or police cars.
  for (const b of S.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const probe = { x: b.x, y: b.y };
    if (collideBuildings(S.city, probe, 2)) b.life = 0;
    if (b.friendly) {
      for (const e of S.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= CFG.bulletDamage;
          e.flash = 0.12;
          b.life = 0;
          if (e.hp <= 0) killEnemy(S, e);
          break;
        }
      }
      if (b.life > 0) {
        for (const cop of S.policeCars) {
          if (dist(b.x, b.y, cop.x, cop.y) < 22) {
            b.life = 0;
            S.addWanted(1, 'shot police');
            break;
          }
        }
      }
    } else {
      if (!S.player.inCar && dist(b.x, b.y, S.player.x, S.player.y) < 13) {
        b.life = 0;
        S.damagePlayer(CFG.gangDamage, 'shot');
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
  S.enemies = S.enemies.filter((e) => !e.dead);

  // Enemies chase the player on foot and shoot when in range.
  for (const e of S.enemies) {
    if (e.flash > 0) e.flash -= dt;
    const d = dist(e.x, e.y, S.player.x, S.player.y);
    if (S.player.inCar || S.player.dead) continue;
    e.angle = angleTo(e.x, e.y, S.player.x, S.player.y);
    if (d > 130) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
      collideBuildings(S.city, e, 11);
    } else if (d < 60) {
      e.x -= Math.cos(e.angle) * e.speed * 0.5 * dt;
      e.y -= Math.sin(e.angle) * e.speed * 0.5 * dt;
    }
    e.shootAt -= dt;
    if (e.shootAt <= 0 && d < 420) {
      e.shootAt = 1.4 + S.rng() * 1.2;
      const spread = (S.rng() - 0.5) * 0.25;
      fireBullet(S, e.x, e.y, e.angle + spread, false);
    }
    // Melee range: a gang member can hurt the player up close.
    if (d < 26) {
      e.shootAt = Math.max(e.shootAt, 0.6);
      S.damagePlayer(6, 'beaten');
    }
  }

  // Pickups: health crosses and ammo boxes scattered near roads.
  for (const pk of S.pickups) {
    if (pk.taken) continue;
    const d = S.player.inCar
      ? dist(S.playerCar.x, S.playerCar.y, pk.x, pk.y)
      : dist(S.player.x, S.player.y, pk.x, pk.y);
    if (d < 30) {
      pk.taken = true;
      if (pk.kind === 'health') {
        S.healPlayer(40);
        S.hudFlash('+40 HEALTH');
      } else {
        S.player.ammo += 12;
        S.hudFlash('+12 AMMO');
      }
      S.audio.pickup();
    }
  }
  S.pickups = S.pickups.filter((p) => !p.taken);
}

export function spawnPickups(rng, city) {
  const out = [];
  const spots = [
    { x: 640, y: 240 }, { x: 1840, y: 240 }, { x: 2640, y: 1040 },
    { x: 1040, y: 1840 }, { x: 2240, y: 1840 }, { x: 240, y: 1440 },
    { x: 1440, y: 640 }, { x: 2240, y: 240 }, { x: 640, y: 2240 },
    { x: 2840, y: 1840 },
  ];
  for (const s of spots) {
    out.push({ x: s.x, y: s.y, kind: rng() < 0.5 ? 'health' : 'ammo', taken: false });
  }
  return out;
}
