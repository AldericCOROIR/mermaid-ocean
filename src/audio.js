// Tiny procedural sound: ambient ocean pad, bubbles, chimes, whale song.
let ctx = null, master = null, enabled = true;

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = ctx.createGain();
  master.gain.value = enabled ? 0.6 : 0;
  master.connect(ctx.destination);
  ambient();
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.1);
}

function ambient() {
  // filtered noise "ocean" + a soft pad chord
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = ctx.createGain(); g.gain.value = 0.35;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.15;
  lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
  src.connect(lp); lp.connect(g); g.connect(master); src.start();

  const pad = ctx.createGain(); pad.gain.value = 0.045; pad.connect(master);
  const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 900; plp.connect(pad);
  [220, 277.18, 329.63, 440].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
    o.connect(plp); o.start();
  });
  // slowly drifting chord
  const chords = [[220, 277.18, 329.63, 440], [196, 246.94, 329.63, 392], [174.61, 220, 261.63, 349.23], [196, 261.63, 329.63, 392]];
  let ci = 0;
  setInterval(() => {
    ci = (ci + 1) % chords.length;
    let k = 0;
    // layer a soft new chord over the drone
    chords[ci].forEach((f) => softNote(f, 7.5, 0.025, 'sine', k++ * 0.05));
  }, 8000);
}

function softNote(freq, dur, vol, type = 'sine', delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + Math.min(1.5, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}

export function sfx(name) {
  if (!ctx || !enabled) return;
  const now = ctx.currentTime;
  if (name === 'bubble') {
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = 400 + Math.random() * 500;
    o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 2.5, now + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + 0.12);
  } else if (name === 'chime' || name === 'pearl') {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); const t0 = now + i * 0.08;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.7);
    });
  } else if (name === 'friend') {
    [659.25, 783.99, 987.77].forEach((f, i) => softNote(f, 0.7, 0.1, 'triangle', i * 0.1));
  } else if (name === 'talk') {
    for (let i = 0; i < 3; i++) softNote(500 + Math.random() * 300, 0.12, 0.06, 'sine', i * 0.07);
  } else if (name === 'fanfare') {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => softNote(f, 0.5, 0.12, 'triangle', i * 0.14));
  } else if (name === 'splash') {
    const len = ctx.sampleRate * 0.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.value = 0.4;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  } else if (name === 'whale') {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, now); o.frequency.linearRampToValueAtTime(320, now + 1.2); o.frequency.linearRampToValueAtTime(140, now + 3);
    const v = ctx.createOscillator(); v.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 8; v.connect(vg); vg.connect(o.frequency); v.start(now); v.stop(now + 3.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.25, now + 0.5); g.gain.linearRampToValueAtTime(0.0001, now + 3.1);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + 3.2);
  }
}
