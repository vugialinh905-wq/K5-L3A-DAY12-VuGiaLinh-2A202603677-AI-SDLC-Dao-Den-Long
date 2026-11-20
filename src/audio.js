// Am thanh tong hop bang WebAudio (khong dung file ngoai): nhac nen dem + hieu ung.
// Chi chay tren trinh duyet; headless khong import file nay.
let ctx = null, master = null, musicBus = null, sfxBus = null, musicTimer = null, volume = 0.7;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
}
export function setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); }

function tone(freq, dur, { type = 'sine', vol = 0.25, when = 0, to = null, bus = null, attack = 0.005 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.2, when = 0, freq = 1200, to = null, q = 1, bus = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus || sfxBus);
  src.start(t);
}

export const sfx = {
  pickup() { tone(880, 0.12, { vol: 0.2, to: 1320 }); tone(1760, 0.18, { vol: 0.1, when: 0.05 }); },
  deposit() { tone(520, 0.15, { vol: 0.2, to: 700 }); },
  light() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, { vol: 0.2, when: i * 0.09, type: 'triangle' })); },
  pulse() { noise(0.5, { vol: 0.35, freq: 400, to: 3000, q: 0.8 }); tone(220, 0.5, { vol: 0.3, to: 880, type: 'sine' }); },
  hit() { tone(140, 0.35, { vol: 0.5, to: 50, type: 'sawtooth' }); noise(0.2, { vol: 0.3, freq: 300 }); },
  jump() { tone(300, 0.15, { vol: 0.15, to: 600 }); },
  dash() { noise(0.2, { vol: 0.25, freq: 2500, to: 600, q: 0.6 }); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.7, { vol: 0.25, when: i * 0.14, type: 'triangle' })); },
  lose() { [440, 370, 311, 247].forEach((f, i) => tone(f, 0.7, { vol: 0.25, when: i * 0.22, type: 'sawtooth' })); },
  spawn() { tone(70, 0.8, { vol: 0.35, to: 45, type: 'sawtooth' }); },
  tick() { tone(1000, 0.07, { vol: 0.18, type: 'square' }); },
  charm() { tone(660, 0.1, { vol: 0.2 }); tone(990, 0.25, { vol: 0.2, when: 0.08 }); },
  steal() { noise(0.35, { vol: 0.3, freq: 3000, to: 800, q: 2 }); },
  ui() { tone(600, 0.08, { vol: 0.15 }); },
  wind() { noise(1.8, { vol: 0.18, freq: 500, to: 1500, q: 0.5 }); },
  out() { tone(330, 0.6, { vol: 0.3, to: 110, type: 'triangle' }); noise(0.3, { vol: 0.15, freq: 600 }); },
};

// Nhac nen: be (pad) cham theo hop am + chuong don le ngau nhien (am giai ngu cung)
const CHORDS = [[110, 165, 220], [98, 147, 196], [87.3, 131, 175], [98, 147, 196]];
const BELLS = [440, 523.25, 587.33, 659.25, 783.99, 880];
let chordIdx = 0;
function musicBar() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const f of CHORDS[chordIdx++ % CHORDS.length]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12;
    lp.type = 'lowpass'; lp.frequency.value = 500;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 3); g.gain.linearRampToValueAtTime(0.0001, t + 8);
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 8.2);
  }
  for (let i = 0; i < 4; i++) {
    tone(BELLS[Math.floor(Math.random() * BELLS.length)], 2.2, { vol: 0.07, when: 0.5 + i * 1.7 + Math.random(), bus: musicBus, attack: 0.02, type: 'triangle' });
  }
}
export function startMusic() {
  if (!ctx || musicTimer) return;
  musicBar();
  musicTimer = setInterval(musicBar, 6000);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
// Tat tieng khi roi tab / thu nho cua so; bat lai khi quay lai
export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
