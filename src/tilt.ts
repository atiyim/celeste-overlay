import type { MyMatch } from "./types";

/* Tilt koruyucu: yalnızca senin kendi rekabet maçlarına bakar. Hiçbir şey göndermez, yalnızca sakin bir hatırlatma gösterir. */
export interface TiltCfg { on: boolean; losses: number; rr: number; hours: number }
export const DEFAULT_TILT: TiltCfg = { on: true, losses: 3, rr: -40, hours: 3 };
export const TILT_LOSSES = [2, 3, 4, 5];
export const TILT_RR = [-25, -40, -60, -80];
export const TILT_HOURS = [0, 2, 3, 4]; // 0: kapalı

export interface Session { games: number; wins: number; losses: number; rr: number; lossStreak: number; minutes: number }
export interface TiltAlert { key: string; text: string }

const GAP_MS = 100 * 60_000;   // iki maç başlangıcı arası bundan uzunsa yeni seans
const OPEN_MS = 3 * 3_600_000; // son maçın üzerinden bu kadar geçtiyse seans bitmiştir

/** Bugünkü seans: aralarında 100 dakikadan uzun boşluk olmayan en yeni maçlar. Seans yoksa null. */
export function sessionOf(all: MyMatch[], now = Date.now()): Session | null {
  const ms = all.filter((m) => m.started > 0).sort((a, b) => b.started - a.started);
  if (!ms.length || now - ms[0].started > OPEN_MS) return null;
  const run: MyMatch[] = [ms[0]];
  for (let i = 1; i < ms.length; i++) {
    if (run[run.length - 1].started - ms[i].started > GAP_MS) break;
    run.push(ms[i]);
  }
  const comp = run.filter((m) => m.queue.toLowerCase() === "competitive");
  let streak = 0;
  for (const m of comp) { if (m.won) break; streak++; }
  return {
    games: comp.length,
    wins: comp.filter((m) => m.won).length,
    losses: comp.filter((m) => !m.won).length,
    rr: comp.reduce((a, m) => a + (m.rrDelta ?? 0), 0),
    lossStreak: streak,
    minutes: Math.max(0, Math.round((now - run[run.length - 1].started) / 60_000)),
  };
}

export const fmtRr = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} RR`;
export const fmtDur = (min: number) => (min < 60 ? `${min} dk` : `${Math.floor(min / 60)} sa ${min % 60} dk`);

/** Uyarı gerekiyor mu? En fazla bir uyarı döner; öncelik: seri, RR, süre. */
export function alertOf(s: Session | null, cfg: TiltCfg, newest: string): TiltAlert | null {
  if (!s || !cfg.on) return null;
  if (s.lossStreak >= cfg.losses) {
    return { key: `streak:${newest}`, text: `${s.lossStreak} maç üst üste kaybettin${s.rr < 0 ? `, bu seansta ${fmtRr(s.rr)}` : ""}. Kısa bir mola iyi gelir.` };
  }
  if (s.rr <= cfg.rr) {
    return { key: `rr:${newest}`, text: `Bu seansta ${fmtRr(s.rr)} verdin. Bir mola vermek ister misin?` };
  }
  if (cfg.hours > 0 && s.minutes >= cfg.hours * 60) {
    return { key: `time:${Math.floor(s.minutes / 60)}`, text: `${Math.floor(s.minutes / 60)} saattir oynuyorsun. Biraz ara vermek iyi olabilir.` };
  }
  return null;
}
