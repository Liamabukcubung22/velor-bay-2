// All sound is synthesized with WebAudio: no audio files, no network.
// A tiny engine hum follows speed, a two-tone siren follows wanted level,
// plus one-shots for shots, pickups and mission jingles, over a quiet
// A-minor bass + hat loop.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = 0;
  let beat = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch (err) {
      ctx = null;
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass || 1800;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    shot() {
      noise(0.12, 0.5, 3200);
      tone(180, 0.09, 'square', 0.22, 60);
    },
    enemyShot() {
      noise(0.1, 0.25, 2400);
    },
    punch() {
      noise(0.08, 0.35, 900);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.25);
      setTimeout(() => tone(1318, 0.14, 'sine', 0.25), 70);
    },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.28), i * 110));
    },
    fail() {
      tone(220, 0.4, 'sawtooth', 0.2, 110);
    },
    horn() {
      tone(370, 0.16, 'square', 0.14);
      tone(466, 0.16, 'square', 0.12);
    },
    bust() {
      tone(440, 0.5, 'sawtooth', 0.25, 220);
    },
    // Called every frame with live state.
    update(dt, speedRatio, wanted, driving) {
      if (!ctx || muted) return;
      if (engineGain) {
        engineGain.gain.value = driving ? 0.03 + 0.05 * speedRatio : 0.015;
        engineOsc.frequency.value = 50 + 130 * speedRatio;
      }
      if (sirenGain) {
        if (wanted > 0) {
          sirenGain.gain.value = 0.035;
          sirenTimer += dt;
          if (sirenTimer > 0.42) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 880 : 660;
          }
        } else {
          sirenGain.gain.value = 0;
        }
      }
      // Ambient loop: A-minor bass notes + a soft hat tick, 100 bpm.
      musicTimer += dt;
      const stepDur = 60 / 100 / 2;
      if (musicTimer >= stepDur) {
        musicTimer -= stepDur;
        beat = (beat + 1) % 16;
        const bassNotes = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 61.7, 0, 65.4, 0];
        const n = bassNotes[beat];
        if (n) tone(n, stepDur * 0.9, 'triangle', 0.11);
        if (beat % 2 === 0) noise(0.03, 0.05, 6000);
      }
    },
  };
}
