import { useSyncExternalStore } from "react";

/* Sayaçlar: yalnızca kendi geri sayımların. Oyuna dokunmaz, oyundan veri okumaz.
   Sekme değişse de sayaçlar çalışmaya devam eder; yalnızca çalışan sayaç varken zamanlayıcı döner. */
export interface Timer { id: number; name: string; total: number; endsAt: number; done: boolean }

const SOUND_KEY = "overlay-timer-sound";
let list: Timer[] = [];
let tick: number | undefined;
let alertFn: ((t: Timer) => void) | null = null;
const subs = new Set<() => void>();

const emit = () => { list = [...list]; subs.forEach((f) => f()); };

export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } };
export const setSound = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* depolama kapalı */ } };

function beep(notes: number[] = [784, 988]) {
  if (!soundOn()) return;
  try {
    const ctx = new AudioContext();
    notes.forEach((hz, i) => {
      const at = i * 0.22;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.22);
    });
    window.setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch { /* ses açılamadı */ }
}

function run() {
  if (tick !== undefined) return;
  tick = window.setInterval(() => {
    const now = Date.now();
    for (const t of list) {
      if (!t.done && t.endsAt <= now) { t.done = true; beep(t.name === SPIKE_NAME ? [330, 247, 196] : undefined); alertFn?.(t); }
      else if (!t.done && t.name === SPIKE_NAME) {
        // Aşama değişince kısa uyarı: 7 sn (tam çözme biter) ve 3,5 sn (yarım çözme de biter)
        const ph = spikePhase(t.endsAt - now).id;
        if (ph !== lastPhase) { if (ph === "half") beep([660]); else if (ph === "dead") beep([520, 392]); lastPhase = ph; }
      }
    }
    if (!list.some((t) => !t.done)) { window.clearInterval(tick); tick = undefined; }
    emit();
  }, 250);
}

export function addTimer(name: string, seconds: number) {
  const total = Math.max(1, Math.round(seconds)) * 1000;
  list = [...list, { id: Date.now() + Math.random(), name: name.trim() || "Sayaç", total, endsAt: Date.now() + total, done: false }];
  run(); emit();
}
export function restartTimer(id: number) {
  list = list.map((t) => (t.id === id ? { ...t, endsAt: Date.now() + t.total, done: false } : t));
  run(); emit();
}
export function removeTimer(id: number) { list = list.filter((t) => t.id !== id); emit(); }
/* Spike: Valorant'ta spike 45 saniyede patlar. Oyundan plant bilgisi okunmaz; sayaç senin bastığın tuşla ya da düğmeyle başlar. */
export const SPIKE_NAME = "Spike";
export const SPIKE_SECONDS = 45;
const SPIKE_KEY = "overlay-spike-key";
let spikeKey = (() => { try { return localStorage.getItem(SPIKE_KEY) ?? ""; } catch { return ""; } })();
const keySubs = new Set<() => void>();
/** Çözme süreleri: tam 7 sn, yarıdan devam 3,5 sn. */
export const DEFUSE_FULL = 7, DEFUSE_HALF = 3.5, SPIKE_HURRY = 12;
export type SpikePhaseId = "safe" | "hurry" | "half" | "dead";
export interface SpikePhase { id: SpikePhaseId; label: string; hint: string }
const PHASES: Record<SpikePhaseId, SpikePhase> = {
  safe: { id: "safe", label: "Çözülebilir", hint: "Tam çözmeye rahatça vakit var." },
  hurry: { id: "hurry", label: "Acele et", hint: "Tam çözme için son saniyeler. Şimdi başlamalısın." },
  half: { id: "half", label: "Sadece yarım çözülmüşse", hint: "Sıfırdan çözme yetişmez. Yarısı çözülmüşse hâlâ yetişir." },
  dead: { id: "dead", label: "Artık çözülmez", hint: "Yarım çözme bile yetişmez. Uzaklaş." },
};
export const spikePhaseOf = (sec: number): SpikePhaseId => (sec <= DEFUSE_HALF ? "dead" : sec <= DEFUSE_FULL ? "half" : sec <= SPIKE_HURRY ? "hurry" : "safe");
export const spikePhase = (leftMs: number): SpikePhase => PHASES[spikePhaseOf(leftMs / 1000)];
let lastPhase: SpikePhaseId = "safe";
export function stopSpike() { list = list.filter((t) => t.name !== SPIKE_NAME); emit(); }
export function startSpike() {
  lastPhase = "safe";
  list = list.filter((t) => t.name !== SPIKE_NAME);
  addTimer(SPIKE_NAME, SPIKE_SECONDS);
}
export function setSpikeKey(k: string) {
  spikeKey = k;
  try { localStorage.setItem(SPIKE_KEY, k); } catch { /* depolama kapalı */ }
  keySubs.forEach((f) => f());
}
export function useSpikeKey(): string {
  return useSyncExternalStore((f) => { keySubs.add(f); return () => { keySubs.delete(f); }; }, () => spikeKey);
}
/** Basılan tuşu global kısayol biçimine çevirir ("Control+Shift+F6"). Desteklenmeyen tuşta null. F2 overlay'e ayrılmıştır. */
export function accelFromEvent(e: KeyboardEvent): string | null {
  const c = e.code;
  const key = /^Key([A-Z])$/.exec(c)?.[1] ?? /^Digit(\d)$/.exec(c)?.[1] ?? (/^F([1-9]|1[0-9]|2[0-4])$/.test(c) ? c : null);
  if (!key || key === "F2" && !e.ctrlKey && !e.altKey && !e.shiftKey) return null;
  return [e.ctrlKey && "Control", e.altKey && "Alt", e.shiftKey && "Shift", key].filter(Boolean).join("+");
}

export function onTimerDone(fn: ((t: Timer) => void) | null) { alertFn = fn; }

export function useTimers(): Timer[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => list);
}

/** "1:05", "45" (saniye) ya da "2:30" → saniye. Geçersizse 0. */
export function parseDuration(s: string): number {
  const t = s.trim();
  if (/^\d+$/.test(t)) return Math.min(+t, 3599);
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  return m ? Math.min(+m[1] * 60 + +m[2], 3599) : 0;
}
export const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
