// HUD and live minimap, drawn on the main canvas: money, health, ammo,
// wanted stars, clock, district, current objective, and a minimap with the
// player, police, mission marker and traffic dots.
import { CFG, clockString, districtAt } from './config.js';

function stars(n) {
  let s = '';
  for (let i = 0; i < CFG.maxWanted; i++) s += i < n ? '★' : '☆';
  return s;
}

export function drawHud(S, ctx, viewW, viewH) {
  const p = S.player;
  ctx.save();
  // Top-left: money + health + ammo.
  ctx.fillStyle = 'rgba(10,12,16,0.72)';
  ctx.fillRect(10, 10, 250, 86);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + S.money, 22, 38);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('♥ ' + Math.round(p.health) + ' / 100', 22, 62);
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('AMMO ' + p.ammo, 130, 62);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(clockString(S.time / 60) + '  •  ' + districtAt(p.x, p.y), 22, 86);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,12,16,0.72)';
  ctx.fillRect(viewW - 210, 10, 200, 44);
  ctx.fillStyle = S.wanted > 0 ? '#ffd23e' : '#8a8a8a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(stars(S.wanted), viewW - 22, 40);

  // Bottom-left: current objective.
  ctx.fillStyle = 'rgba(10,12,16,0.72)';
  const obj = S.missions.label();
  ctx.font = '15px system-ui, sans-serif';
  const w = ctx.measureText('▶ ' + obj).width + 24;
  ctx.fillRect(10, viewH - 46, w, 34);
  ctx.fillStyle = '#ffe08a';
  ctx.textAlign = 'left';
  ctx.fillText('▶ ' + obj, 22, viewH - 23);

  // Mission timer, when one is running.
  const st = S.missions.currentStep();
  if (st && st.type === 'timed') {
    ctx.fillStyle = 'rgba(120,20,20,0.8)';
    ctx.fillRect(viewW / 2 - 90, 10, 180, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏱ ' + Math.max(0, Math.ceil(S.missions.timer)) + 's', viewW / 2, 35);
  }

  // Flash message centre-top.
  if (S.flashText && S.flashT > 0) {
    ctx.globalAlpha = Math.min(1, S.flashT);
    ctx.fillStyle = 'rgba(10,12,16,0.8)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    const fw = ctx.measureText(S.flashText).width + 32;
    ctx.fillRect(viewW / 2 - fw / 2, 58, fw, 34);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(S.flashText, viewW / 2, 81);
    ctx.globalAlpha = 1;
  }

  // Controls hint, bottom-right.
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  ctx.fillRect(viewW - 330, viewH - 46, 320, 34);
  ctx.fillStyle = '#cfd8dc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive • E enter car • Click shoot • P pause', viewW - 22, viewH - 23);

  drawMinimap(S, ctx, viewW, viewH);
  ctx.restore();
}

function drawMinimap(S, ctx, viewW, viewH) {
  const size = 168;
  const x0 = viewW - size - 12;
  const y0 = viewH - size - 58;
  const sx = size / CFG.worldW;
  const sy = size / CFG.worldH;
  ctx.fillStyle = 'rgba(10,14,18,0.78)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#233026';
  ctx.fillRect(x0, y0, size, size);
  // Roads.
  ctx.fillStyle = '#5a5e66';
  for (const rx of S.city.xs) ctx.fillRect(x0 + rx * sx - 1, y0, 2, size);
  for (const ry of S.city.ys) ctx.fillRect(x0, y0 + ry * sy, size, 2);
  // Beach.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x0 + 3064 * sx, y0, size - 3064 * sx, size);
  // Mission marker (pulsing yellow diamond).
  const mk = S.missions.marker();
  if (mk) {
    const pulse = 5 + 2 * Math.sin(S.time * 5);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(x0 + mk.x * sx, y0 + mk.y * sy - pulse);
    ctx.lineTo(x0 + mk.x * sx + pulse, y0 + mk.y * sy);
    ctx.lineTo(x0 + mk.x * sx, y0 + mk.y * sy + pulse);
    ctx.lineTo(x0 + mk.x * sx - pulse, y0 + mk.y * sy);
    ctx.closePath();
    ctx.fill();
  }
  // Traffic dots.
  ctx.fillStyle = '#c2c2c2';
  for (const c of S.traffic) ctx.fillRect(x0 + c.x * sx - 1, y0 + c.y * sy - 1, 2, 2);
  // Police (red/blue).
  for (const c of S.policeCars) {
    ctx.fillStyle = Math.floor(S.time * 6) % 2 ? '#ff4040' : '#4080ff';
    ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
  }
  // Player (white arrow).
  const px = x0 + S.player.x * sx;
  const py = y0 + S.player.y * sy;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.stroke();
}
