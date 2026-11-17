// Tiny particle system: smoke puffs, sparks, muzzle flashes, cash sparkles.
export function createParticles() {
  const list = [];
  return {
    list,
    spawn(x, y, kind, n = 8) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = kind === 'smoke' ? 20 + Math.random() * 30 : 60 + Math.random() * 160;
        list.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: kind === 'smoke' ? 0.9 : 0.35 + Math.random() * 0.3,
          max: kind === 'smoke' ? 0.9 : 0.6,
          size: kind === 'smoke' ? 7 + Math.random() * 8 : 2 + Math.random() * 3,
          kind,
        });
      }
      if (list.length > 400) list.splice(0, list.length - 400);
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.96; p.vy *= 0.96;
        if (p.life <= 0) list.splice(i, 1);
      }
    },
    clear() { list.length = 0; },
  };
}
