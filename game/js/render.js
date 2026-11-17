// Canvas renderer: the procedural city, cars, people, particles, HUD and
// all screens (title, pause, BUSTED, WASTED, victory, mission complete).
import { WORLD_W, WORLD_H, ROAD_LINES, ROAD_HALF, BEACH_X } from './config.js';
import { drawHUD } from './hud.js';
import { currentDef, missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_VICTORY = 'victory';

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.len, W = car.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 2, -W / 2 + 3, L, W);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.9)';
  ctx.fillRect(-L * 0.12, -W / 2 + 3, L * 0.34, W - 6);
  ctx.fillStyle = 'rgba(160,210,240,0.75)';
  ctx.fillRect(L * 0.24, -W / 2 + 4, L * 0.1, W - 8);
  // Headlights / taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
  ctx.fillStyle = '#e84a4a';
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 7, 3, 5);
  // Wheels.
  ctx.fillStyle = '#111';
  for (const [wx, wy] of [[-L * 0.3, -W / 2 - 2], [L * 0.3, -W / 2 - 2], [-L * 0.3, W / 2 - 2], [L * 0.3, W / 2 - 2]]) {
    ctx.fillRect(wx, wy, 10, 4);
  }
  if (car.taxi) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -W / 2 + 6, 12, 6);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 6px monospace';
    ctx.fillText('TAXI', -5, -W / 2 + 11);
  }
  if (car.cop) {
    // Flashing lightbar.
    const red = Math.floor(time * 5) % 2 === 0;
    ctx.fillStyle = red ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-8, -W / 2 + 2, 8, 5);
    ctx.fillStyle = red ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(0, -W / 2 + 2, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-L * 0.28, -W / 2 + 8, L * 0.2, 4);
  }
  if (car.hp < 35) {
    ctx.fillStyle = 'rgba(120,120,120,0.8)';
    ctx.beginPath();
    ctx.arc(-L * 0.3, 0, 6 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, S, cam, viewW, viewH) {
  const city = S.city;
  const x0 = cam.x - 40, y0 = cam.y - 40, x1 = cam.x + viewW + 40, y1 = cam.y + viewH + 40;
  // Ground.
  ctx.fillStyle = '#2c4630';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach + sea (east strip).
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(Math.max(x0, BEACH_X), y0, x1 - Math.max(x0, BEACH_X), y1 - y0);
  ctx.fillStyle = '#2a6f8f';
  ctx.fillRect(Math.max(x0, 3140), y0, x1 - Math.max(x0, 3140), y1 - y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.beginPath();
    ctx.moveTo(3140, y + Math.sin(S.time * 1.5 + y) * 4);
    ctx.lineTo(3160, y + Math.sin(S.time * 1.5 + y) * 4);
    ctx.stroke();
  }
  // Parks.
  for (const pk of city.parks) {
    if (pk.x > x1 || pk.x + pk.w < x0 || pk.y > y1 || pk.y + pk.h < y0) continue;
    ctx.fillStyle = '#3a6b3a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  // Roads (asphalt + sidewalk edge + centre dashes).
  ctx.fillStyle = '#33333a';
  for (const l of ROAD_LINES) {
    ctx.fillRect(x0, l - ROAD_HALF, x1 - x0, ROAD_HALF * 2);
    ctx.fillRect(l - ROAD_HALF, y0, ROAD_HALF * 2, y1 - y0);
  }
  ctx.fillStyle = '#4a4a52';
  for (const l of ROAD_LINES) {
    ctx.fillRect(x0, l - ROAD_HALF - 10, x1 - x0, 6);
    ctx.fillRect(x0, l + ROAD_HALF + 4, x1 - x0, 6);
    ctx.fillRect(l - ROAD_HALF - 10, y0, 6, y1 - y0);
    ctx.fillRect(l + ROAD_HALF + 4, y0, 6, y1 - y0);
  }
  ctx.strokeStyle = '#d8c85a';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const l of ROAD_LINES) {
    ctx.beginPath(); ctx.moveTo(x0, l); ctx.lineTo(x1, l); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(l, y0); ctx.lineTo(l, y1); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(b.x + 8 + i * 24, b.y + 10 + j * 24, 12, 14);
      }
    }
  }
  // Trees / palms.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 5);
    ctx.fillStyle = t.palm ? '#3f9e4d' : '#2f7a3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Named places: respray, safehouse, bank, garage.
  const places = [
    { x: 1000, y: 1800, label: 'RESPRAY', color: '#ff7a3c' },
    { x: 1000, y: 1000, label: 'SAFEHOUSE', color: '#4fd06a' },
    { x: 2200, y: 1000, label: 'BANK', color: '#ffd94a' },
    { x: 600, y: 600, label: 'GARAGE', color: '#7ab8ff' },
  ];
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  for (const pl of places) {
    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, 16, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillText(pl.label, pl.x, pl.y - 22);
  }
  ctx.textAlign = 'left';
  // Mission marker on the ground.
  const m = S.missions;
  if (m.active && !m.victory) {
    const marker = missionMarker(m, S);
    if (marker) {
      const r = 18 + Math.sin(S.time * 5) * 5;
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEntities(ctx, S) {
  // Pickups.
  for (const p of S.combat.pickups) {
    if (p.taken) continue;
    const bob = Math.sin(p.bob) * 2;
    ctx.fillStyle = p.kind === 'ammo' ? '#ffd94a' : '#4fd06a';
    ctx.fillRect(p.x - 7, p.y - 7 + bob, 14, 14);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.kind === 'ammo' ? 'AMMO' : '+HP', p.x, p.y - 12 + bob);
    ctx.textAlign = 'left';
  }
  // Parked + traffic + cop cars.
  for (const c of [...S.cars, ...S.traffic, ...S.police.cops]) {
    if (c === S.player.inCar) drawCar(ctx, c, S.time);
    else drawCar(ctx, c, S.time);
  }
  // Enemies.
  for (const e of S.combat.enemies) {
    ctx.fillStyle = '#c22a5a';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(e.x - 10, e.y - 22, 20, 4);
    ctx.fillStyle = '#ff4a6a';
    ctx.fillRect(e.x - 10, e.y - 22, 20 * Math.max(0, e.hp / 70), 4);
    ctx.strokeStyle = '#c22a5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle) * 22, e.y + Math.sin(e.angle) * 22);
    ctx.stroke();
  }
  // Pedestrians.
  for (const p of S.peds) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of S.combat.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  // Particles.
  for (const p of S.particles.list) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.kind === 'smoke' ? '#888' : p.kind === 'spark' ? '#ffd94a' : '#7ab8ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Player on foot.
  const pl = S.player;
  if (!pl.inCar) {
    if (pl.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(255,40,40,0.35)';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2a6bff';
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.lineTo(pl.x + Math.cos(pl.aimAngle) * 34, pl.y + Math.sin(pl.aimAngle) * 34);
    ctx.stroke();
  }
}

function panel(ctx, viewW, viewH, w, h, title, lines, footer) {
  const x = (viewW - w) / 2, y = (viewH - h) / 2;
  ctx.fillStyle = 'rgba(6,8,12,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, viewW / 2, y + 52);
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  let ly = y + 92;
  for (const line of lines) {
    ctx.fillText(line, viewW / 2, ly);
    ly += 26;
  }
  if (footer) {
    ctx.fillStyle = '#9aa4b0';
    ctx.font = '14px monospace';
    ctx.fillText(footer, viewW / 2, y + h - 24);
  }
  ctx.textAlign = 'left';
  return { x, y, w, h };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function draw(S, screen) {
    const viewW = window.innerWidth, viewH = window.innerHeight;
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, viewW, viewH);
    const cam = S.cam;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawWorld(ctx, S, cam, viewW, viewH);
    drawEntities(ctx, S);
    ctx.restore();

    if (screen === SCREEN_PLAY) {
      drawHUD(ctx, S, viewW, viewH);
      const m = S.missions;
      if (m.completeFlash > 0 && m.lastTitle) {
        const def = currentDef(m);
        panel(ctx, viewW, viewH, 560, 300, 'MISSION COMPLETE', [
          m.lastTitle,
          `Payout  $${m.lastPayout}`,
          `Money  $${Math.floor(S.player.money)}`,
          `Missions done  ${S.stats.missionsDone} / 6`,
          def ? `Next: ${def.title}` : 'All missions done — free roam!',
        ], 'Driving on in a moment…');
      }
    } else if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(6,8,12,0.55)';
      ctx.fillRect(0, 0, viewW, viewH);
      const hasSave = !!S.save;
      panel(ctx, viewW, viewH, 640, 560, 'VELOR BAY', [
        'Open-world street story — a fictional coastal city.',
        'Kai Mercer is back to pay off his sister\'s debt.',
        'Walk, drive, steal cars, dodge the cops, run six jobs.',
        '',
        'WASD move / drive · Mouse aim · Click shoot · Space brake',
        'E enter / steal car · F exit car · P pause · M mute',
        `Best: ${S.best ? `$${S.best.money} · ${S.best.missions} missions` : 'no run yet'}`,
      ], hasSave ? 'Press Enter — New Game, or click Continue' : 'Press Enter or click New Game');
      // Buttons.
      const bw = 220, bh = 46;
      const bx = viewW / 2 - bw / 2;
      const by = viewH / 2 + 120;
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NEW GAME', viewW / 2, by + 30);
      S.ui.newGameBtn = { x: bx, y: by, w: bw, h: bh };
      if (hasSave) {
        ctx.fillStyle = '#2a6bff';
        ctx.fillRect(bx, by + 58, bw, bh);
        ctx.fillStyle = '#fff';
        ctx.fillText('CONTINUE', viewW / 2, by + 88);
        S.ui.continueBtn = { x: bx, y: by + 58, w: bw, h: bh };
      } else {
        S.ui.continueBtn = null;
      }
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_PAUSED) {
      drawHUD(ctx, S, viewW, viewH);
      ctx.fillStyle = 'rgba(6,8,12,0.6)';
      ctx.fillRect(0, 0, viewW, viewH);
      panel(ctx, viewW, viewH, 420, 220, 'PAUSED', ['Take a breath, Kai.', 'The city waits.'], 'P / Esc — resume · R — restart run');
    } else if (screen === SCREEN_BUSTED) {
      panel(ctx, viewW, viewH, 520, 280, 'BUSTED', [
        'The Velor Bay PD caught up with you.',
        `Money kept: $${Math.floor(S.player.money)}`,
        `Missions done: ${S.stats.missionsDone} / 6`,
      ], 'Press R to restart the run');
    } else if (screen === SCREEN_WASTED) {
      panel(ctx, viewW, viewH, 520, 280, 'WASTED', [
        'Kai went down in the streets of Velor Bay.',
        `Money kept: $${Math.floor(S.player.money)}`,
        `Missions done: ${S.stats.missionsDone} / 6`,
      ], 'Press R to restart the run');
    } else if (screen === SCREEN_VICTORY) {
      const st = S.stats;
      panel(ctx, viewW, viewH, 620, 380, 'THE LAST SCORE — DONE', [
        'The debt is paid. Velor Bay is yours, Kai.',
        '',
        `Money  $${Math.floor(S.player.money)}`,
        `Cars stolen  ${st.stolen} · Kills  ${st.kills}`,
        `Time played  ${Math.floor(S.time / 60)} min`,
        '',
        'Free roam continues — press R to keep driving.',
      ], 'R — free roam · the save keeps your money');
    }
  }

  return { draw, ctx };
}
