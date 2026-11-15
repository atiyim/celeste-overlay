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
export const sfx = {
  /** Adım geçişi: yumuşak yükselen "vınk". */
  whoosh() { const c = ac(); if (c) note(c, 420, 840, 0, 0.16, 0.025); },
  /** Düğme / seçim. */
  tick() { const c = ac(); if (c) note(c, 1250, 1250, 0, 0.05, 0.035, "triangle"); },
  /** Doğru yapılan adım: iki notalı küçük çan. */
  chime() { const c = ac(); if (!c) return; note(c, 880, 880, 0, 0.22, 0.04, "triangle"); note(c, 1318, 1318, 0.09, 0.3, 0.04, "triangle"); },
  /** Rehber sonu: yükselen üçlü. */
  fanfare() { const c = ac(); if (!c) return; [660, 880, 1100, 1318].forEach((f, k) => note(c, f, f, k * 0.09, 0.35, 0.04, "triangle")); },
};
