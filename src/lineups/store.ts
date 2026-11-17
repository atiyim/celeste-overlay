import { useSyncExternalStore } from "react";
import type { Lineup } from "./api";

/* Kişisel lineup verisi bu bilgisayarda durur: Setim, öğrenme ilerlemesi (aralıklı tekrar), seri ve XP.
   Sunucuya gitmez; Celeste'yi kaldırınca silinir. */

const KEY = "overlay-lineup-me";
const DAY = 86_400_000;
/** Aralıklı tekrar kutuları: doğru bildikçe bir sonraki tekrar daha uzağa atılır (Leitner). */
const BOX_DAYS = [0, 1, 2, 4, 9, 21];
export const MASTER_BOX = 3;

export interface Card { box: number; due: number; seen: number; ok: number; last: number }
export interface Me {
  fav: string[];
  cards: Record<string, Card>;
  tried: Record<string, number>;
  xp: number;
  days: string[]; // pratik yapılan günler (en çok 60)
  daily: { day: string; ids: string[]; done: string[] } | null;
  mode: "self" | "celeste";
  voice: boolean;
  mains: string[]; // ajan kimlikleri
  seenIntro: boolean;
}
const EMPTY: Me = { fav: [], cards: {}, tried: {}, xp: 0, days: [], daily: null, mode: "celeste", voice: false, mains: [], seenIntro: false };

let me: Me = (() => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return EMPTY; } })();
const subs = new Set<() => void>();
function save(next: Me) {
  me = next;
  try { localStorage.setItem(KEY, JSON.stringify(me)); } catch { /* depolama dolu */ }
  subs.forEach((f) => f());
}
export const useMe = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => me);
export const getMe = () => me;
export const patchMe = (p: Partial<Me>) => save({ ...me, ...p });

export const today = (now = Date.now()) => new Date(now + 3 * 3_600_000).toISOString().slice(0, 10);

export function toggleFav(id: string) {
  save({ ...me, fav: me.fav.includes(id) ? me.fav.filter((x) => x !== id) : [...me.fav, id] });
  return me.fav.includes(id);
}
export function addFavs(ids: string[]) { save({ ...me, fav: [...new Set([...me.fav, ...ids])] }); }
export function markTried(id: string) { save({ ...me, tried: { ...me.tried, [id]: me.tried[id] ? 0 : Date.now() } }); }

function practiced(m: Me, xp: number): Me {
  const d = today();
  return { ...m, xp: m.xp + xp, days: m.days.includes(d) ? m.days : [...m.days, d].slice(-60) };
}

/** Kart sonucu: doğru bildiyse bir üst kutuya, bilemediyse başa. Kazanılan XP'yi döner. */
export function grade(id: string, ok: boolean, now = Date.now()): number {
  const c = me.cards[id] ?? { box: 0, due: 0, seen: 0, ok: 0, last: 0 };
  const box = ok ? Math.min(BOX_DAYS.length - 1, c.box + 1) : 0;
  const next: Card = { box, due: now + BOX_DAYS[box]! * DAY, seen: c.seen + 1, ok: c.ok + (ok ? 1 : 0), last: now };
  const xp = ok ? (c.box + 1 === MASTER_BOX ? 30 : 10) : 2;
  save(practiced({ ...me, cards: { ...me.cards, [id]: next } }, xp));
  return xp;
}
export function seen(id: string) {
  const c = me.cards[id];
  if (c) return;
  save(practiced({ ...me, cards: { ...me.cards, [id]: { box: 0, due: Date.now(), seen: 1, ok: 0, last: Date.now() } } }, 2));
}

export const mastered = (id: string) => (me.cards[id]?.box ?? 0) >= MASTER_BOX;
export const dueCards = (list: Lineup[], now = Date.now()) => list.filter((l) => me.cards[l.id] && me.cards[l.id]!.due <= now && !mastered(l.id));

/** Ardışık pratik günü (bugün ya da dün biten). */
export function streak(m: Me = me): number {
  const set = new Set(m.days);
  let d = new Date(`${today()}T00:00:00Z`);
  if (!set.has(today())) d = new Date(d.getTime() - DAY);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}

/** XP → seviye: her seviye bir öncekinden %18 uzun (Discord'daki Lineup Avı ile aynı ölçü). */
export function level(xp: number): { lv: number; into: number; need: number } {
  let lv = 1, need = 120, left = xp;
  while (left >= need) { left -= need; lv++; need = Math.round(need * 1.18); }
  return { lv, into: left, need };
}
/** Rütbe: Demir 1 … Radyant (25. seviye). */
export const RANKS = ["Demir", "Bronz", "Gümüş", "Altın", "Platin", "Elmas", "Yücelik", "Ölümsüzlük", "Radyant"];
export const rankOf = (lv: number) => { const t = Math.min(24, lv - 1); return t >= 24 ? "Radyant" : `${RANKS[Math.floor(t / 3)]} ${(t % 3) + 1}`; };

/**
 * Günün 3 lineup'ı: önce sevdiğin ajanlar ve Setim, sonra öğrenmediklerin; aynı gün hep aynı üçlü.
 * Liste değişip seçilenler kalktıysa yeniden seçilir.
 */
export function dailyThree(list: Lineup[]): { day: string; ids: string[]; done: string[] } {
  const d = today();
  if (me.daily?.day === d && me.daily.ids.every((id) => list.some((l) => l.id === id))) return me.daily;
  const seed = [...d].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const score = (l: Lineup) => (me.mains.includes(l.agent) ? 4 : 0) + (me.fav.includes(l.id) ? 2 : 0) + (mastered(l.id) ? -6 : 0) + (l.diff === 1 ? 1 : 0) + ((seed ^ [...l.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 7) / 7;
  const ids = [...list].sort((a, b) => score(b) - score(a)).slice(0, 3).map((l) => l.id);
  return { day: d, ids, done: [] as string[] };
}
/** Seçilen üçlüyü kaydeder (render dışında çağrılır). */
export function keepDaily(d: { day: string; ids: string[]; done: string[] }) {
  if (me.daily?.day === d.day && me.daily.ids.join() === d.ids.join()) return;
  save({ ...me, daily: d });
}
export function dailyDone(id: string): boolean {
  if (!me.daily || me.daily.day !== today() || !me.daily.ids.includes(id) || me.daily.done.includes(id)) return false;
  const done = [...me.daily.done, id];
  const all = done.length === me.daily.ids.length;
  save(practiced({ ...me, daily: { ...me.daily, done } }, all ? 25 : 0));
  return all;
}

/* ------------------------------------------------------------------ */
/* Paylaşım kodu: "CL1-" + lineup kimlikleri (her biri 10 karakter)     */
/* ------------------------------------------------------------------ */

export const shareCode = (ids: string[]) => `CL1-${ids.join("")}`;
export function readCode(code: string): string[] {
  const m = /CL1-([0-9a-z]+)/i.exec(code.trim());
  if (!m || m[1]!.length % 10) return [];
  return m[1]!.toLowerCase().match(/.{10}/g) ?? [];
}
