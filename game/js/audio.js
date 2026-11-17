// Fully synthesised WebAudio soundscape — no audio files, no network.
// Engine hum follows speed, two-tone siren, gunshots, pickup blips,
// mission jingles and an A-minor bassline + hat loop.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  let musicTimer = null, musicStep = 0, enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      // Siren: square wave alternating two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function beep(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!ensure() || !enabled) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  function noise(dur, vol = 0.3, freq = 1200) {
    if (!ensure() || !enabled) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    } catch { /* best-effort */ }
  }

  // A-minor bassline + hat: 8th-note scheduler, 100 BPM.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!enabled || !ctx) return;
      const f = BASS[musicStep % BASS.length];
      if (f) beep(f, 0.22, 'triangle', 0.16);
      if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
      musicStep += 1;
    }, 300);
  }

  return {
    resume, startMusic,
    setEnabled(v) { enabled = v; },
    engine(speed01, on) {
      if (!ensure()) return;
      try {
        engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
        engineOsc.frequency.value = 50 + speed01 * 130;
      } catch { /* best-effort */ }
    },
    siren(on, dt) {
      if (!ensure()) return;
      try {
        sirenGain.gain.value = on ? 0.045 : 0;
        if (on) {
          sirenTimer += dt;
          if (sirenTimer > 0.42) {
            sirenTimer = 0; sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 880 : 660;
          }
        }
      } catch { /* best-effort */ }
    },
    shot() { noise(0.12, 0.4, 1800); beep(180, 0.08, 'square', 0.2); },
    enemyShot() { noise(0.1, 0.2, 1400); },
    hit() { beep(120, 0.15, 'sawtooth', 0.25); },
    blip() { beep(880, 0.09, 'sine', 0.25); beep(1320, 0.12, 'sine', 0.2, 0.09); },
    honk() { beep(370, 0.18, 'square', 0.12); beep(466, 0.18, 'square', 0.1); },
    jingle(win) {
      if (win) [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'triangle', 0.25, i * 0.13));
      else [392, 330, 262, 196].forEach((f, i) => beep(f, 0.25, 'triangle', 0.22, i * 0.15));
    },
    busted() { beep(220, 0.4, 'sawtooth', 0.25); beep(165, 0.6, 'sawtooth', 0.25, 0.35); },
  };
}
