// HUD: money, health, ammo, wanted stars, clock, district, objective bar,
// and a live minimap (player, cops, mission marker, traffic dots).
import { WORLD_W, WORLD_H, DISTRICTS } from './config.js';
import { districtAt } from './city.js';
import { objectiveText, missionMarker, currentDef } from './missions.js';

const MM = 168; // minimap size

export function drawHUD(ctx, S, viewW, viewH) {
  const p = S.player;
  const m = S.missions;
  ctx.save();
  ctx.textBaseline = 'top';

  // Top-left: money + health + ammo.
  ctx.fillStyle = 'rgba(8,10,14,0.88)';
  ctx.fillRect(12, 12, 250, 86);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`$${Math.floor(p.money)}`, 24, 20);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '15px monospace';
  ctx.fillText(`AMMO ${p.ammo}`, 24, 56);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(120, 58, 120, 12);
  ctx.fillStyle = p.hp > 35 ? '#4fd06a' : '#e84a4a';
  ctx.fillRect(120, 58, Math.max(0, 120 * p.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 120, 74);

  // Wanted stars, top centre.
  const cx = viewW / 2;
  ctx.fillStyle = 'rgba(8,10,14,0.88)';
  ctx.fillRect(cx - 110, 12, 220, 40);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < S.police.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.font = '26px sans-serif';
    ctx.fillText('★', cx - 100 + i * 42, 16);
  }

  // Clock + district, top-right above minimap.
  const hh = 8 + Math.floor(S.time / 3600) % 24;
  const mm = Math.floor(S.time / 60) % 60;
  ctx.fillStyle = 'rgba(8,10,14,0.88)';
  ctx.fillRect(viewW - MM - 24, 12, MM + 12, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${districtAt(p.x, p.y)}`, viewW - 20, 18);
  ctx.textAlign = 'left';

  // Objective bar, bottom-left.
  const def = currentDef(m);
  const obj = objectiveText(m);
  if (obj) {
    ctx.fillStyle = 'rgba(8,10,14,0.88)';
    const w = Math.min(560, 24 + ctx.measureText(obj).width + 180);
    ctx.fillRect(12, viewH - 58, w, 46);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(def ? `MISSION ${def.id}: ${def.title}` : 'FREE ROAM', 24, viewH - 50);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.fillText(obj, 24, viewH - 30);
  }

  // Mission message toast.
  if (m.messageT > 0 && m.message) {
    ctx.fillStyle = 'rgba(8,10,14,0.72)';
    ctx.fillRect(viewW / 2 - 300, viewH - 130, 600, 40);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(m.message, viewW / 2, viewH - 118);
    ctx.textAlign = 'left';
  }
  if (m.failedT > 0 && m.failed) {
    ctx.fillStyle = 'rgba(120,10,10,0.8)';
    ctx.fillRect(viewW / 2 - 300, viewH - 130, 600, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`MISSION FAILED — ${m.failed}`, viewW / 2, viewH - 118);
    ctx.textAlign = 'left';
  }
  if (S.police.resprayMsg > 0) {
    ctx.fillStyle = '#9fe8a8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RESPRAY — heat wiped clean ($150)', viewW / 2, 64);
    ctx.textAlign = 'left';
  }

  // Minimap.
  const mx = viewW - MM - 12, my = 52;
  const scale = MM / WORLD_W;
  ctx.fillStyle = 'rgba(8,12,16,0.78)';
  ctx.fillRect(mx - 4, my - 4, MM + 8, MM + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MM, MM);
  ctx.clip();
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(mx, my, MM, MM);
  // Water / beach strip.
  ctx.fillStyle = '#2a6f8f';
  ctx.fillRect(mx + 3060 * scale, my, MM - 3060 * scale, MM);
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(mx + 3000 * scale, my, 60 * scale, MM);
  // Roads.
  ctx.strokeStyle = '#3d3d46';
  ctx.lineWidth = 3;
  for (const l of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
    ctx.beginPath(); ctx.moveTo(mx + l * scale, my); ctx.lineTo(mx + l * scale, my + MM); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + l * scale); ctx.lineTo(mx + MM, my + l * scale); ctx.stroke();
  }
  // Districts tint.
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(mx, my, MM / 2, MM / 2);
  // Mission marker (pulsing).
  const marker = missionMarker(m, S);
  if (marker) {
    const pulse = 5 + Math.sin(S.time * 6) * 2;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(mx + marker.x * scale, my + marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Traffic dots.
  ctx.fillStyle = '#9aa4b0';
  for (const c of S.traffic) ctx.fillRect(mx + c.x * scale - 1, my + c.y * scale - 1, 2, 2);
  // Cops (red-blue).
  for (const c of S.police.cops) {
    ctx.fillStyle = Math.floor(S.time * 4) % 2 ? '#ff4a4a' : '#4a7dff';
    ctx.beginPath();
    ctx.arc(mx + c.x * scale, my + c.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player (white triangle).
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * scale, my + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4, my - 4, MM + 8, MM + 8);

  // Controls hint, bottom-right.
  ctx.fillStyle = 'rgba(8,10,14,0.85)';
  ctx.fillRect(viewW - 452, viewH - 34, 440, 22);
  ctx.fillStyle = '#c8c8c8';
  ctx.font = '12px monospace';
  ctx.fillText('WASD move/drive · E enter · F exit · P pause · M mute', viewW - 444, viewH - 28);
  ctx.restore();
}
