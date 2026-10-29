import type { Badge } from "./playstyle";
import { isComp } from "./playstyle";
import type { Player } from "./types";

/* Maç içi kısa bilgiler. Hepsi Riot'un kayıtlarındaki gerçek sayılardan gelir; eşiğin altında hiçbir şey gösterilmez. */

const k = (s?: string | null) => (s ?? "").toLowerCase();
const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;

export const OPERATOR = "a03b24d3-4319-996d-0f8c-94bbfba1dfc7";
export const SHERIFF = "e336c6b8-418d-9340-d77f-7a9e4cfe0702";

/** Bu haritada rozet için gereken en az maç ve maç başı RR sınırı. */
export const MAP_MIN = 4;
export const MAP_AVG = 10;

export interface MapForm { n: number; of: number; rr: number; avg: number }

/** Son 20 rekabet maçı içinde bu haritada oynananlar ve toplam RR. */
export function mapForm(p: Player, mapId?: string | null): MapForm | null {
  const all = p.rrMaps ?? [];
  if (!mapId || !all.length) return null;
  const on = all.filter((m) => k(m.mapId) === k(mapId));
  if (!on.length) return { n: 0, of: all.length, rr: 0, avg: 0 };
  const rr = on.reduce((a, m) => a + m.rr, 0);
  return { n: on.length, of: all.length, rr, avg: rr / on.length };
}

export function mapBadge(p: Player, mapId?: string | null, mapName?: string): Badge | null {
  const f = mapForm(p, mapId);
  if (!f || f.n < MAP_MIN) return null;
  const tip = `${mapName ?? "Bu harita"}: son ${f.of} rekabet maçından ${f.n} tanesi bu haritada, toplam ${sign(f.rr)} RR (maç başı ${sign(Math.round(f.avg))}).`;
  if (f.avg >= MAP_AVG) return { text: "Haritada usta", tone: "gold", tip };
  if (f.avg <= -MAP_AVG) return { text: "Haritada zayıf", tone: "neg", tip };
  return null;
}

/** Silah alışkanlığı için gereken en az round ve oran. */
export const GUN_MIN_ROUNDS = 30;
const GUNS = [
  { id: OPERATOR, text: "Operator'cu", min: 0.25 },
  { id: SHERIFF, text: "Sheriff'çi", min: 0.2 },
];

export interface GunHabit { id: string; text: string; rounds: number; of: number; matches: number; pct: number }

/** Son rekabet maçlarında (tabanca round'ları hariç) en belirgin silah alışkanlığı. */
export function gunHabit(p: Player): GunHabit | null {
  const f = p.form.filter(isComp).filter((x) => (x.rounds ?? 0) > 0);
  if (f.length < 2) return null;
  const of = f.reduce((a, x) => a + Math.max(0, (x.rounds ?? 0) - ((x.rounds ?? 0) > 12 ? 2 : 1)), 0);
  if (of < GUN_MIN_ROUNDS) return null;
  for (const g of GUNS) {
    const rounds = f.reduce((a, x) => a + (x.bought ?? []).filter((b) => k(b.weaponId) === g.id).reduce((s, b) => s + b.count, 0), 0);
    const pct = rounds / of;
    if (pct >= g.min) return { id: g.id, text: g.text, rounds, of, matches: f.length, pct };
  }
  return null;
}

export function gunBadge(p: Player): Badge | null {
  const g = gunHabit(p);
  if (!g) return null;
  return { text: g.text, tone: "violet", tip: `Son ${g.matches} rekabet maçında, tabanca round'ları hariç ${g.of} round içinde ${g.rounds} kez aldı (%${Math.round(100 * g.pct)}).` };
}

/** Lobi özeti: bir takım için kısa, sayılabilir bilgiler. Boşsa hiç gösterilmez. */
export function teamSummary(list: Player[], mapId?: string | null): string[] {
  const out: string[] = [];
  const guns = new Map<string, number>();
  for (const p of list) { const g = gunHabit(p); if (g) guns.set(g.text, (guns.get(g.text) ?? 0) + 1); }
  for (const [t, n] of guns) out.push(`${n} ${t}`);
  const usta = list.filter((p) => mapBadge(p, mapId)?.tone === "gold").length;
  const zayif = list.filter((p) => mapBadge(p, mapId)?.tone === "neg").length;
  if (usta) out.push(`${usta} haritada usta`);
  if (zayif) out.push(`${zayif} haritada zayıf`);
  const parties = new Map<string, number>();
  for (const p of list) if (p.party && p.partySure) parties.set(p.party, (parties.get(p.party) ?? 0) + 1);
  for (const n of [...parties.values()].filter((n) => n >= 2).sort((a, b) => b - a)) out.push(`${n} kişilik parti`);
  return out;
}
