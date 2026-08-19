/* ============================================================
   NEON XIANGQI - 3D Stereo Audio Engine (Web Audio API)
   Fully synthesized: no external sound files. Uses PannerNode
   (HRTF) for spatial positioning, a Convolver reverb, and an
   evolving ambient drone. Must be started from a user gesture.
   ============================================================ */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  let reverb = null;
  let reverbGain = null;
  let ambientNodes = null;
  let enabled = true;
  let started = false;

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function ensure() {
    if (ctx) return;
    const AC = global.AudioContext || global.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(2.4, 3.0);
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.32;
    reverb.connect(reverbGain);
    reverbGain.connect(master);
  }

  // Call once from a click/keydown to satisfy autoplay policies.
  function start() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function setEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.9 : 0.0;
    if (!v) stopAmbient();
    else if (started) startAmbient();
  }

  function isEnabled() { return enabled; }

  // Map a board position (0..1 on each axis) to a 3D panner.
  function pannerFor(nx, nz) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1;
    p.maxDistance = 20;
    p.rolloffFactor = 0.6;
    if (p.positionX) {
      p.positionX.value = (nx - 0.5) * 6;
      p.positionY.value = 0;
      p.positionZ.value = (nz - 0.5) * 6;
    } else {
      p.setPosition((nx - 0.5) * 6, 0, (nz - 0.5) * 6);
    }
    p.connect(master);
    p.connect(reverb);
    return p;
  }

  // Core tone synth.
  function tone(opts) {
    if (!started || !enabled) return;
    ensure();
    const {
      freq = 440, type = 'sine', dur = 0.18, gain = 0.25,
      attack = 0.005, release = 0.08, sweepTo = null,
      nx = 0.5, nz = 0.5, detune = 0,
    } = opts;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    const pan = pannerFor(nx, nz);
    osc.connect(g);
    g.connect(pan);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  // Short noise burst (used for captures / impacts).
  function noise(opts) {
    if (!started || !enabled) return;
    ensure();
    const { dur = 0.18, gain = 0.3, nx = 0.5, nz = 0.5, hp = 800, lp = 6000 } = opts;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = hp;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const pan = pannerFor(nx, nz);
    src.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(pan);
    src.start(t0);
  }

  // ---- Public sound events ----

  // nx,nz in 0..1 board coordinates for spatialisation.
  function playSelect(nx, nz) {
    tone({ freq: 660, type: 'triangle', dur: 0.07, gain: 0.18, release: 0.05, nx, nz });
  }

  function playMove(nx, nz) {
    tone({ freq: 320, type: 'square', dur: 0.10, gain: 0.20, sweepTo: 180, release: 0.06, nx, nz });
    tone({ freq: 640, type: 'sine', dur: 0.08, gain: 0.10, sweepTo: 420, release: 0.05, nx, nz });
  }

  function playCapture(nx, nz) {
    noise({ dur: 0.22, gain: 0.34, nx, nz, hp: 500, lp: 7000 });
    tone({ freq: 240, type: 'sawtooth', dur: 0.18, gain: 0.22, sweepTo: 90, release: 0.1, nx, nz });
    tone({ freq: 880, type: 'square', dur: 0.12, gain: 0.12, sweepTo: 1400, release: 0.08, nx, nz });
  }

  function playCheck(nx, nz) {
    tone({ freq: 520, type: 'sawtooth', dur: 0.16, gain: 0.22, nx, nz });
    setTimeout(() => tone({ freq: 780, type: 'sawtooth', dur: 0.16, gain: 0.22, nx, nz }), 160);
  }

  function playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.4, gain: 0.26, release: 0.3, nx: 0.5, nz: 0.5 }), i * 130));
  }

  function playLose() {
    const notes = [523.25, 392, 311.13, 233.08];
    notes.forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 0.45, gain: 0.22, release: 0.3, nx: 0.5, nz: 0.5 }), i * 150));
  }

  // Evolving ambient bed: two detuned drones + slow filtered noise + LFO.
  function startAmbient() {
    if (!started || !enabled || ambientNodes) return;
    ensure();
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 2.0);
    g.connect(master);
    g.connect(reverb);

    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.4;
    const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 110;
    const og = ctx.createGain(); og.gain.value = 0.5;
    o1.connect(og); o2.connect(og); o3.connect(og); og.connect(g);

    // slow LFO on a lowpass to give movement
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 400;
    og.disconnect(); og.connect(lpf); lpf.connect(g);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 220;
    lfo.connect(lfoG); lfoG.connect(lpf.frequency);

    // shimmer noise
    const len = Math.floor(ctx.sampleRate * 2);
    const nbuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * 0.04;
    const nsrc = ctx.createBufferSource(); nsrc.buffer = nbuf; nsrc.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.5;
    nsrc.connect(nf); nf.connect(ng); ng.connect(g);

    [o1, o2, o3, lfo, nsrc].forEach(o => o.start());
    ambientNodes = { g, nodes: [o1, o2, o3, lfo, nsrc] };
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    const { g, nodes } = ambientNodes;
    try {
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      nodes.forEach(n => { try { n.stop(ctx.currentTime + 0.5); } catch (e) {} });
    } catch (e) {}
    ambientNodes = null;
  }

  // ---- Chinese-classical background music (guzheng / guqin style) ----
  // Fully synthesised: a pentatonic (宫商角徵羽) melody of plucked-string voices
  // over a soft low drone, scheduled with Web Audio look-ahead for smoothness.
  let musicOn = false;
  let musicGain = null;
  let musicTimer = null;
  let nextNoteTime = 0;
  let melodyIdx = 9;           // current position on the scale (mid)
  let droneOsc = null;

  // D-based pentatonic across three octaves (Hz)
  const PENTA = [
    146.83, 164.81, 196.00, 220.00, 246.94,   // D3 E3 G3 A3 B3
    293.66, 329.63, 392.00, 440.00, 493.88,   // D4 E4 G4 A4 B4
    587.33, 659.25, 783.99, 880.00, 987.77,   // D5 E5 G5 A5 B5
  ];

  function ensureMusic() {
    if (musicGain) return;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
    musicGain.connect(reverb);
  }

  // One plucked-string note: triangle body + sine harmonic + sub, lowpass-warmed,
  // fast attack and exponential decay — reminiscent of a guzheng/guqin pluck.
  function pluckNote(freq, t, dur, gain) {
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
    const o2g = ctx.createGain(); o2g.gain.value = 0.22;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 0.5;
    const o3g = ctx.createGain(); o3g.gain.value = 0.35;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(7000, freq * 5); f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(g); o2.connect(o2g); o2g.connect(g); o3.connect(o3g); o3g.connect(g);
    g.connect(f); f.connect(musicGain);
    o1.start(t); o2.start(t); o3.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); o3.stop(t + dur + 0.05);
  }

  function scheduleMusic() {
    if (!musicOn) return;
    const lookahead = ctx.currentTime + 0.3;
    while (nextNoteTime < lookahead) {
      if (Math.random() > 0.16) {                 // occasional rest for breathing room
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2);
        melodyIdx = Math.max(0, Math.min(PENTA.length - 1, melodyIdx + step));
        const freq = PENTA[melodyIdx];
        const dur = 0.6 + Math.random() * 0.9;
        const gain = 0.16 + Math.random() * 0.10;
        pluckNote(freq, nextNoteTime, dur, gain);
        if (Math.random() < 0.28 && melodyIdx >= 3) { // a fifth/harmony beneath
          pluckNote(PENTA[melodyIdx - 3], nextNoteTime + 0.04, dur * 0.85, gain * 0.55);
        }
      }
      nextNoteTime += (Math.random() < 0.34) ? 0.30 : 0.56; // mix of beats & eighths
    }
    musicTimer = setTimeout(scheduleMusic, 60);
  }

  function startMusic() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    ensureMusic();
    if (musicOn) return;
    musicOn = true;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
    if (!droneOsc) {                                // sustained low drone (古琴 ambience)
      droneOsc = ctx.createOscillator(); droneOsc.type = 'sine'; droneOsc.frequency.value = 73.42; // D2
      const dg = ctx.createGain(); dg.gain.value = 0.10;
      const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 280;
      droneOsc.connect(df); df.connect(dg); dg.connect(musicGain);
      droneOsc.start();
    }
    nextNoteTime = ctx.currentTime + 0.1;
    scheduleMusic();
  }

  function stopMusic() {
    if (!musicOn) return;
    musicOn = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    if (musicGain) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    }
    if (droneOsc) { try { droneOsc.stop(ctx.currentTime + 0.7); } catch (e) {} droneOsc = null; }
  }

  function isMusicOn() { return musicOn; }

  const Audio = {
    start, setEnabled, isEnabled, startAmbient, stopAmbient,
    startMusic, stopMusic, isMusicOn,
    playSelect, playMove, playCapture, playCheck, playWin, playLose,
  };
  global.GameAudio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
