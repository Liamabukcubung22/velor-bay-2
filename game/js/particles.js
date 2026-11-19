// Tiny particle system: bursts of fading dots for impacts, pickups and
// exhaust puffs. No allocations matter at this scale; dead particles are
// filtered every frame.
export function makeParticles() {
  const list = [];
  return {
    list,
    burst(x, y, color, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (speed || 140) * (0.4 + Math.random() * 0.8);
        list.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.5 + Math.random() * 0.4,
          max: 0.9,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    },
    puff(x, y) {
      list.push({
        x, y,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20 - 12,
        life: 0.5, max: 0.5,
        color: '#9a9a9a', size: 3,
      });
    },
    update(dt) {
      for (const p of list) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 1.6 * dt;
        p.vy *= 1 - 1.6 * dt;
        p.life -= dt;
      }
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].life <= 0) list.splice(i, 1);
      }
    },
    draw(ctx, cam) {
      for (const p of list) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - cam.x - p.size / 2, p.y - cam.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    },
  };
}
