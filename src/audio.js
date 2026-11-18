// Sons sintetizados (sem arquivos externos).
let ctx = null, master = null, motorOsc = null;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; }
}
function tone(f, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, hp = 800, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export const sfx = {
  click: () => tone(1800, 0.04, 'square', 0.08),
  ui: () => tone(1200, 0.05, 'sine', 0.12),
  snap: () => { noise(0.05, 0.4, 2500); tone(420, 0.06, 'square', 0.1); },
  screw: () => { for (let i = 0; i < 4; i++) noise(0.03, 0.15, 3000, i * 0.08); },
  tight: () => { tone(300, 0.08, 'square', 0.12); noise(0.04, 0.3, 1500); },
  cut: () => { noise(0.08, 0.5, 1200); tone(900, 0.05, 'square', 0.1); },
  crimp: () => { for (let i = 0; i < 5; i++) tone(220 + i * 30, 0.05, 'square', 0.08, 0, i * 0.12); },
  ok: () => { tone(660, 0.12, 'sine', 0.2); tone(990, 0.18, 'sine', 0.2, 0, 0.1); },
  err: () => { tone(220, 0.25, 'sawtooth', 0.15); tone(180, 0.3, 'sawtooth', 0.12, 0, 0.12); },
  beep: () => tone(2700, 0.18, 'sine', 0.15),
  clack: () => { noise(0.06, 0.6, 400); tone(140, 0.1, 'square', 0.2); },
  arc: () => { noise(0.6, 0.9, 200); noise(0.3, 0.6, 3000, 0.05); tone(90, 0.5, 'sawtooth', 0.3, -40); },
  trip: () => { noise(0.05, 0.6, 600); tone(300, 0.08, 'square', 0.15); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sine', 0.18, 0, i * 0.12)); },
};
export function motorSound(on, pitch = 1) {
  if (!ctx) return;
  if (on && !motorOsc) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 60 * pitch; o2.type = 'sine'; o2.frequency.value = 120 * pitch;
    g.gain.value = 0.0; g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.6);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); motorOsc = { o, o2, g };
  } else if (!on && motorOsc) {
    const m = motorOsc; motorOsc = null; m.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); setTimeout(() => { m.o.stop(); m.o2.stop(); }, 500);
  }
}
