// All canvas drawing: the world (roads, beach, buildings, trees, cars,
// people, bullets, pickups, markers) and the screens (title, pause,
// busted/wasted, mission complete, victory). Top-down, procedural art only.
import { CFG } from './config.js';
import { clamp } from './random.js';

function drawCar(ctx, car, cam, time) {
  const w = (car.model && car.model.w) || 38;
  const h = (car.model && car.model.h) || 21;
  ctx.save();
  ctx.translate(car.x - cam.x, car.y - cam.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 5);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(-w * 0.18, -h * 0.32, w * 0.3, h * 0.64);
  ctx.fillStyle = 'rgba(160,210,240,0.7)';
  ctx.fillRect(w * 0.22, -h * 0.34, 3, h * 0.68);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 2, 4);
  ctx.fillRect(w / 2 - 2, h / 2 - 6, 2, 4);
  if (car.police) {
    // Flashing lightbar.
    const red = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = red ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -h / 2 - 2, 8, 4);
    ctx.fillStyle = red ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, h / 2 - 2, 8, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2 + 4, -2, w - 8, 4);
  }
  if (car.target) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.7 + 4 * Math.sin(time * 5), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, cam, down) {
  ctx.save();
  ctx.translate(x - cam.x, y - cam.y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(3, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -3, 5, 6);
  }
  ctx.restore();
}

export function drawWorld(S, ctx, viewW, viewH) {
  const cam = S.camera;
  ctx.fillStyle = '#4d7a3d';
  ctx.fillRect(0, 0, viewW, viewH);
  // Beach + sea on the east edge.
  ctx.fillStyle = '#d9c48a';
  ctx.fillRect(3064 - cam.x, -cam.y, CFG.worldW - 3064, CFG.worldH);
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(3136 - cam.x, -cam.y, CFG.worldW - 3136, CFG.worldH);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let y = 0; y < CFG.worldH; y += 160) {
    ctx.fillRect(3124 - cam.x, y - cam.y + Math.sin(S.time * 1.5 + y) * 6, 10, 3);
  }
  // Parks.
  for (const pk of S.city.parks) {
    ctx.fillStyle = '#5d8a45';
    ctx.fillRect(pk.x - cam.x, pk.y - cam.y, pk.w, pk.h);
  }
  // Roads.
  ctx.fillStyle = CFG.colors.asphalt;
  for (const rx of S.city.xs) ctx.fillRect(rx - CFG.roadW / 2 - cam.x, -cam.y, CFG.roadW, CFG.worldH);
  for (const ry of S.city.ys) ctx.fillRect(-cam.x, ry - CFG.roadW / 2 - cam.y, CFG.worldW, CFG.roadW);
  // Lane dashes.
  ctx.fillStyle = CFG.colors.asphaltLine;
  for (const rx of S.city.xs) {
    for (let y = 0; y < CFG.worldH; y += 64) ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 28);
  }
  for (const ry of S.city.ys) {
    for (let x = 0; x < CFG.worldW; x += 64) ctx.fillRect(x - cam.x, ry - 2 - cam.y, 28, 4);
  }
  // Sidewalks.
  ctx.fillStyle = CFG.colors.sidewalk;
  for (const rx of S.city.xs) {
    ctx.fillRect(rx - CFG.roadW / 2 - 10 - cam.x, -cam.y, 10, CFG.worldH);
    ctx.fillRect(rx + CFG.roadW / 2 - cam.x, -cam.y, 10, CFG.worldH);
  }
  for (const ry of S.city.ys) {
    ctx.fillRect(-cam.x, ry - CFG.roadW / 2 - 10 - cam.y, CFG.worldW, 10);
    ctx.fillRect(-cam.x, ry + CFG.roadW / 2 - cam.y, CFG.worldW, 10);
  }
  // Buildings with roof detail.
  for (const b of S.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 4 - cam.x, b.y + 4 - cam.y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 8 - cam.x, b.y + 8 - cam.y, b.w - 16, b.h * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + b.w / 2 - 8 - cam.x, b.y + b.h / 2 - 6 - cam.y, 16, 12);
  }
  // Trees.
  for (const t of S.city.trees) {
    ctx.fillStyle = '#2e5d23';
    ctx.beginPath();
    ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#69a84f';
    ctx.beginPath();
    ctx.arc(t.x - cam.x - 2, t.y - cam.y - 2, t.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Story locations: garage, bank, safehouse, respray.
  const L = S.city.locations;
  drawPlace(ctx, L.garage.x - cam.x, L.garage.y - cam.y, 'GARAGE', '#3f7d3a');
  drawPlace(ctx, L.bank.x - cam.x, L.bank.y - cam.y, 'BANK', '#7d6a2a');
  drawPlace(ctx, L.safehouse.x - cam.x, L.safehouse.y - cam.y, 'SAFEHOUSE', '#2a6a7d');
  drawPlace(ctx, L.respray.x - cam.x, L.respray.y - cam.y, 'RESPRAY $150', '#7d2a6a');
  drawPlace(ctx, L.alley.x - cam.x, L.alley.y - cam.y, 'ALLEY', '#4a4a4a');
  drawPlace(ctx, L.cargo.x - cam.x, L.cargo.y - cam.y, 'DOCKS', '#5a5a7d');
  // Mission marker: bouncing yellow diamond + beam.
  const mk = S.missions.marker();
  if (mk) {
    const bob = Math.sin(S.time * 4) * 5;
    ctx.fillStyle = 'rgba(255,210,62,0.25)';
    ctx.beginPath();
    ctx.arc(mk.x - cam.x, mk.y - cam.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.save();
    ctx.translate(mk.x - cam.x, mk.y - cam.y + bob - 26);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
  // Pickups.
  for (const pk of S.pickups) {
    ctx.fillStyle = pk.kind === 'health' ? '#ffffff' : '#ffd23e';
    ctx.fillRect(pk.x - cam.x - 9, pk.y - cam.y - 9, 18, 18);
    ctx.fillStyle = pk.kind === 'health' ? '#d82e2e' : '#222';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : 'A', pk.x - cam.x, pk.y - cam.y + 5);
  }
  // Parked + traffic + police cars.
  for (const c of S.parkedCars) drawCar(ctx, c, cam, S.time);
  for (const c of S.traffic) drawCar(ctx, c, cam, S.time);
  for (const c of S.policeCars) drawCar(ctx, c, cam, S.time);
  if (S.playerCar) drawCar(ctx, S.playerCar, cam, S.time);
  // Pedestrians and gang enemies.
  for (const p of S.peds) drawPerson(ctx, p.x, p.y, p.angle, p.color, cam, p.down);
  for (const e of S.enemies) {
    drawPerson(ctx, e.x, e.y, e.angle, '#8a1f1f', cam, false);
    ctx.fillStyle = '#222';
    ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 20, 28, 5);
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 20, 28 * clamp(e.hp / 60, 0, 1), 5);
  }
  // Player on foot (not drawn while driving — the car is the player).
  if (!S.playerCar) {
    const p = S.player;
    drawPerson(ctx, p.x, p.y, p.angle, '#2e6fc2', cam, false);
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(p.x - cam.x, p.y - cam.y);
    ctx.lineTo(p.x - cam.x + Math.cos(S.aimAngle) * 34, p.y - cam.y + Math.sin(S.aimAngle) * 34);
    ctx.stroke();
  }
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of S.bullets) {
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  S.particles.draw(ctx, cam);
}

function drawPlace(ctx, x, y, label, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 46, y - 18, 92, 36);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 46, y - 18, 92, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 4);
}

function panel(ctx, viewW, viewH, w, h) {
  ctx.fillStyle = 'rgba(8,10,14,0.88)';
  ctx.fillRect(viewW / 2 - w / 2, viewH / 2 - h / 2, w, h);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.strokeRect(viewW / 2 - w / 2, viewH / 2 - h / 2, w, h);
}

function titleText(ctx, viewW, y, text, size, color) {
  ctx.fillStyle = color || '#ffffff';
  ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, viewW / 2, y);
}

function bodyText(ctx, viewW, y, text, size, color) {
  ctx.fillStyle = color || '#d7dee8';
  ctx.font = size + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, viewW / 2, y);
}

export function drawTitle(S, ctx, viewW, viewH) {
  ctx.fillStyle = '#101c26';
  ctx.fillRect(0, 0, viewW, viewH);
  // Sun + sea stripes as a cheap title backdrop (sun off to the side so it
  // never sits behind the title text).
  ctx.fillStyle = '#f2a541';
  ctx.beginPath();
  ctx.arc(viewW - 190, 120, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(0, 250, viewW, 60);
  ctx.fillStyle = '#d9c48a';
  ctx.fillRect(0, 310, viewW, 18);
  titleText(ctx, viewW, 130, 'VELOR BAY', 64, '#ffd23e');
  bodyText(ctx, viewW, 170, 'Open-World Street Story', 22, '#ffffff');
  bodyText(ctx, viewW, 380, 'Kai Mercer is back. His little brother owes the wrong people money.', 17);
  bodyText(ctx, viewW, 406, 'Drive, steal, fight and run jobs across five districts to pay it off.', 17);
  bodyText(ctx, viewW, 452, 'WASD move / drive   •   SHIFT run   •   E enter or steal a car   •   SPACE handbrake', 16, '#9fd8ff');
  bodyText(ctx, viewW, 478, 'MOUSE aim   •   CLICK shoot   •   F punch   •   P pause   •   R restart', 16, '#9fd8ff');
  bodyText(ctx, viewW, 524, 'Stealing, shooting and hitting people raises your wanted level.', 16, '#ffb0b0');
  bodyText(ctx, viewW, 550, 'Hide, or pay $150 at the Respray shop to clear it.', 16, '#ffb0b0');
  const hasSave = !!S.savedGame;
  const by = viewH - 90;
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(viewW / 2 - 190, by - 34, 380, 52);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hasSave ? '[ CLICK ]  CONTINUE' : '[ CLICK ]  NEW GAME', viewW / 2, by + 2);
  bodyText(ctx, viewW, by + 76, hasSave ? 'Save found: $' + S.savedGame.money + ' • ' + S.savedGame.missionsDone + ' missions done' : 'No save yet — a new story begins', 15, '#9fb3c8');
}

export function drawPause(S, ctx, viewW, viewH) {
  panel(ctx, viewW, viewH, 480, 300);
  titleText(ctx, viewW, viewH / 2 - 90, 'PAUSED', 44, '#ffd23e');
  bodyText(ctx, viewW, viewH / 2 - 40, 'Press P or Esc to resume', 18);
  bodyText(ctx, viewW, viewH / 2 - 6, 'M — mute   •   R — restart run', 16);
  bodyText(ctx, viewW, viewH / 2 + 34, 'Money $' + S.money + '   •   Missions ' + S.missionsDone + '/6', 16, '#9fd8ff');
  bodyText(ctx, viewW, viewH / 2 + 70, 'Stolen ' + (S.stats.stolen || 0) + '   •   Kills ' + (S.stats.kills || 0), 16, '#9fd8ff');
}

export function drawEnd(S, ctx, viewW, viewH, kind) {
  const busted = kind === 'busted';
  ctx.fillStyle = busted ? 'rgba(20,40,90,0.88)' : 'rgba(90,10,10,0.88)';
  ctx.fillRect(0, 0, viewW, viewH);
  titleText(ctx, viewW, viewH / 2 - 60, busted ? 'BUSTED' : 'WASTED', 72, busted ? '#7db8ff' : '#ff5a5a');
  bodyText(ctx, viewW, viewH / 2, busted ? 'The Velor Bay police caught up with Kai.' : 'Kai did not make it out of Velor Bay.', 19);
  bodyText(ctx, viewW, viewH / 2 + 40, 'Money $' + S.money + '   •   Missions ' + S.missionsDone + '/6   •   Stolen ' + (S.stats.stolen || 0), 17, '#d7dee8');
  bodyText(ctx, viewW, viewH / 2 + 92, 'Press R to restart', 20, '#ffd23e');
}

export function drawMissionComplete(S, ctx, viewW, viewH) {
  panel(ctx, viewW, viewH, 560, 320);
  titleText(ctx, viewW, viewH / 2 - 100, 'MISSION COMPLETE', 40, '#7dff8a');
  bodyText(ctx, viewW, viewH / 2 - 56, S.lastMissionName || '', 22, '#ffffff');
  titleText(ctx, viewW, viewH / 2 - 4, '+$' + (S.lastPayout || 0), 44, '#ffd23e');
  bodyText(ctx, viewW, viewH / 2 + 40, 'Money $' + S.money + '   •   Missions ' + S.missionsDone + '/6', 17);
  bodyText(ctx, viewW, viewH / 2 + 70, 'Stolen ' + (S.stats.stolen || 0) + '   •   Kills ' + (S.stats.kills || 0) + '   •   Earned $' + (S.stats.earned || 0), 16, '#9fd8ff');
  bodyText(ctx, viewW, viewH / 2 + 116, 'Press ENTER or click to continue', 17, '#ffd23e');
}

export function drawVictory(S, ctx, viewW, viewH) {
  panel(ctx, viewW, viewH, 620, 380);
  titleText(ctx, viewW, viewH / 2 - 130, 'THE LAST SCORE — DONE', 38, '#ffd23e');
  titleText(ctx, viewW, viewH / 2 - 84, '★ VICTORY ★', 44, '#7dff8a');
  bodyText(ctx, viewW, viewH / 2 - 36, 'The debt is paid. Velor Bay is Kai\u2019s again.', 18);
  bodyText(ctx, viewW, viewH / 2 + 6, 'Money $' + S.money + '   •   Missions 6/6', 18);
  bodyText(ctx, viewW, viewH / 2 + 38, 'Cars stolen ' + (S.stats.stolen || 0) + '   •   Gang dealt with ' + (S.stats.kills || 0), 17);
  bodyText(ctx, viewW, viewH / 2 + 68, 'Distance driven ' + Math.round((S.stats.distance || 0) / 1000 * 10) / 10 + ' km (in-game)', 17);
  bodyText(ctx, viewW, viewH / 2 + 118, 'Press ENTER or click — keep playing in free roam', 17, '#ffd23e');
}
