/* Küçük efekt sesleri: dosya yok, Web Audio ile üretilir. Hepsi kısa ve alçak sesli. */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function note(c: AudioContext, f0: number, f1: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, c.currentTime + at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + at + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at);
  o.stop(c.currentTime + at + dur + 0.05);
}
export const sfx: Record<"whoosh" | "tick" | "chime" | "fanfare", () => void> = {
  /** Adım geçişi: yumuşak yükselen "vınk". */
  whoosh() { const c = ac(); if (c) note(c, 420, 840, 0, 0.16, 0.025); },
  /** Düğme / seçim. */
  tick() { const c = ac(); if (c) note(c, 1250, 1250, 0, 0.05, 0.035, "triangle"); },
  /** Doğru yapılan adım: iki notalı küçük çan. */
  chime() { const c = ac(); if (!c) return; note(c, 880, 880, 0, 0.22, 0.04, "triangle"); note(c, 1318, 1318, 0.09, 0.3, 0.04, "triangle"); },
  /** Rehber sonu: yükselen üçlü. */
  fanfare() { const c = ac(); if (!c) return; [660, 880, 1100, 1318].forEach((f, k) => note(c, f, f, k * 0.09, 0.35, 0.04, "triangle")); },
};

/* ---- Ek efektler ---- */
function noise(c: AudioContext, at: number, dur: number, gain: number, type: BiquadFilterType, f0: number, f1 = f0, dest: AudioNode = c.destination) {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = 0.9;
  f.frequency.setValueAtTime(f0, c.currentTime + at);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, c.currentTime + at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + at + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(c.currentTime + at);
}
/** Adım geçişi: havalı süpürme + iki notalı ışıltı. Sessizliği doldurur, "devam ediyor" hissi verir. */
sfx.whoosh = () => {
  const c = ac(); if (!c) return;
  noise(c, 0, 0.32, 0.05, "bandpass", 500, 3200);
  note(c, 1046, 1046, 0.12, 0.14, 0.03, "triangle");
  note(c, 1568, 1568, 0.2, 0.2, 0.03, "triangle");
};
/** Konfeti patlaması. */
export function pop() {
  const c = ac(); if (!c) return;
  noise(c, 0, 0.18, 0.07, "highpass", 1800);
  note(c, 520, 180, 0, 0.14, 0.06);
  [1318, 1568, 2093].forEach((f, k) => note(c, f, f, 0.05 + k * 0.06, 0.25, 0.03, "triangle"));
}

/* ---- Arka plan müziği: sakin bir lo-fi hip-hop döngüsü (84 BPM), tamamen koddan. Çok kısık çalar; Celeste konuşurken daha da kısılır. ---- */
const BPM = 84;
const STEP = 60 / BPM / 4; // 16'lık
// Fmaj7 – Em7 – Dm7 – Cmaj7
const CHORDS = [[174.61, 220, 261.63, 329.63], [164.81, 196, 246.94, 293.66], [146.83, 174.61, 220, 261.63], [130.81, 164.81, 196, 246.94]];
const BASS = [87.31, 82.41, 73.42, 65.41];
const KICK = [0, 7, 10], SNARE = [4, 12];
const VOL = 0.5, DUCK = 0.2;
let bus: GainNode | null = null;
let loop: number | undefined;
let nextAt = 0, stepNo = 0;

function hit(c: AudioContext, t: number, s: number, bar: number) {
  const at = t - c.currentTime;
  if (KICK.includes(s)) note2(c, 130, 42, at, 0.26, 0.5);
  if (SNARE.includes(s)) { noise(c, at, 0.16, 0.16, "bandpass", 1900, 1900, bus!); note2(c, 210, 150, at, 0.09, 0.1); }
  if (s % 2 === 0) noise(c, at + (s % 4 === 2 ? STEP * 0.18 : 0), 0.04, s % 4 === 2 ? 0.05 : 0.03, "highpass", 7500, 7500, bus!);
  if (s === 0 || s === 10) note2(c, BASS[bar], BASS[bar], at, STEP * (s === 0 ? 7 : 4), 0.22);
  if (s === 0) for (const f of CHORDS[bar]) { note2(c, f * 2, f * 2, at, STEP * 15, 0.035, "triangle"); note2(c, f * 2.003, f * 2.003, at, STEP * 15, 0.02, "sine"); }
  if (s === 6 || s === 14) note2(c, CHORDS[bar][s === 6 ? 2 : 3] * 4, CHORDS[bar][s === 6 ? 2 : 3] * 4, at, 0.3, 0.02, "sine");
}
function note2(c: AudioContext, f0: number, f1: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const o = c.createOscillator(), g = c.createGain();
  const t = c.currentTime + Math.max(0, at);
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus!);
  o.start(t); o.stop(t + dur + 0.05);
}
export const music = {
  start() {
    const c = ac(); if (!c || loop !== undefined) return;
    bus = c.createGain(); bus.gain.setValueAtTime(0.0001, c.currentTime); bus.gain.exponentialRampToValueAtTime(VOL * 0.16, c.currentTime + 1.2);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; // lo-fi: tizler kısık
    bus.connect(lp).connect(c.destination);
    nextAt = c.currentTime + 0.1; stepNo = 0;
    loop = window.setInterval(() => {
      while (nextAt < c.currentTime + 0.25) { hit(c, nextAt, stepNo % 16, Math.floor(stepNo / 16) % 4); nextAt += STEP; stepNo++; }
    }, 60);
  },
  /** Celeste konuşurken kısılır. */
  duck(on: boolean) {
    const c = ctx; if (!c || !bus) return;
    bus.gain.cancelScheduledValues(c.currentTime);
    bus.gain.setTargetAtTime((on ? DUCK : VOL) * 0.16, c.currentTime, 0.18);
  },
  stop(fade = 0.8) {
    if (loop === undefined) return;
    window.clearInterval(loop); loop = undefined;
    const c = ctx, b = bus; bus = null;
    if (!c || !b) return;
    b.gain.cancelScheduledValues(c.currentTime);
    b.gain.setTargetAtTime(0.0001, c.currentTime, fade / 4);
    window.setTimeout(() => b.disconnect(), fade * 1000 + 300);
  },
};
