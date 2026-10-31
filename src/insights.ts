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
  for (const p of list) if (p.party) parties.set(p.party, (parties.get(p.party) ?? 0) + 1);
  for (const n of [...parties.values()].filter((n) => n >= 2).sort((a, b) => b - a)) out.push(`${n} kişilik parti`);
  return out;
}

/* ---------- MMR göstergesi: son rekabet maçlarındaki RR kazanç ve kayıpları ----------
   Gizli MMR'ı Riot vermez. Ama kazanınca alınan RR kaybedince verilenden belirgin fazlaysa
   MMR rankın üstündedir (yükseliyor); azsa altındadır. Tahmin değil, ölçülen RR'dan hesaplanır. */
export const MMR_MIN = 3;   // en az bu kadar galibiyet ve bu kadar mağlubiyet
export const MMR_GAP = 5;   // ortalama kazanç ile kayıp arasındaki fark (RR)

export interface RrStats { wins: number; losses: number; gain: number; loss: number; diff: number }

export function rrStats(deltas: number[]): RrStats | null {
  const g = deltas.filter((x) => x > 0), l = deltas.filter((x) => x < 0);
  if (g.length < MMR_MIN || l.length < MMR_MIN) return null;
  const gain = g.reduce((a, b) => a + b, 0) / g.length;
  const loss = -l.reduce((a, b) => a + b, 0) / l.length;
  return { wins: g.length, losses: l.length, gain, loss, diff: gain - loss };
}

/** Sonraki rank için kabaca kaç galibiyet; Ölümsüzlük ve üstünde RR sınırı farklı olduğu için hesaplanmaz. */
export function nextRank(tier: number, rr: number, s: RrStats | null): { wins: number; tier: number } | null {
  if (!s || tier < 3 || tier >= 24 || s.gain <= 0) return null;
  return { wins: Math.max(1, Math.ceil((100 - rr) / s.gain)), tier: tier + 1 };
}

/** Bir mağlubiyette düşebilir mi (Demir 1'de düşülmez, Ölümsüzlük ve üstünde hesaplanmaz). */
export const derankRisk = (tier: number, rr: number, s: RrStats | null) => !!s && tier > 3 && tier < 24 && rr < s.loss;

export function mmrBadge(p: Player, tierName?: (t: number) => string | undefined): Badge | null {
  const s = rrStats((p.rrMaps ?? []).map((m) => m.rr));
  if (!s || Math.abs(s.diff) < MMR_GAP) return null;
  const nx = nextRank(p.rank.current, p.rank.rr, s);
  const tip = [
    `Son ${s.wins + s.losses} rekabet maçında kazanınca ort. +${Math.round(s.gain)} RR, kaybedince ort. −${Math.round(s.loss)} RR.`,
    s.diff > 0 ? "Kazanılan RR kaybedilenden fazla: gizli MMR rankının üstünde, yükseliyor." : "Kaybedilen RR kazanılandan fazla: gizli MMR rankının altında.",
    nx && tierName?.(nx.tier) ? `${tierName(nx.tier)} için yaklaşık ${nx.wins} galibiyet.` : "",
    derankRisk(p.rank.current, p.rank.rr, s) ? "Bir mağlubiyette düşebilir." : "",
  ].filter(Boolean).join(" ");
  return s.diff > 0 ? { text: "MMR ↑", tone: "pos", tip } : { text: "MMR ↓", tone: "neg", tip };
}

/* ---------- Ajan havuzu ---------- */

/** Havuz için gereken en az maç (ajanı bilinen). */
export const POOL_MIN = 3;
/** "Main" / "Alışık değil" etiketi için gereken en az maç. */
export const POOL_TAG_MIN = 5;

export interface Pool { n: number; top: { agentId: string; count: number }[]; counts: Map<string, number> }

/** Son maçlarında oynadığı ajanlar (bütün modlar). Ayrıntı açıldıysa daha uzun geçmiş kullanılır. */
export function agentPool(p: Player): Pool | null {
  const src = p.deep && p.deep.length > p.form.length ? p.deep : p.form;
  const list = src.filter((f) => !!f.agentId);
  if (list.length < POOL_MIN) return null;
  const counts = new Map<string, number>();
  for (const f of list) { const id = (f.agentId as string).toLowerCase(); counts.set(id, (counts.get(id) ?? 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([agentId, count]) => ({ agentId, count }));
  return { n: list.length, top, counts };
}

/** Şu anki ajanı mainiyse ya da hiç oynamadığı bir ajansa etiket. */
export function poolBadge(p: Player, agentName?: string): Badge | null {
  if (!p.agentId || p.isSelf) return null;
  const pool = agentPool(p);
  if (!pool || pool.n < POOL_TAG_MIN) return null;
  const c = pool.counts.get(p.agentId.toLowerCase()) ?? 0;
  const name = agentName ?? "Bu ajan";
  if (c / pool.n >= 0.5) return { text: "Main", tone: "gold", tip: `${name}: son ${pool.n} maçının ${c} tanesinde oynadı. Bu ajanı iyi biliyor.` };
  if (c === 0) return { text: "Alışık değil", tone: "gray", tip: `${name}: son ${pool.n} maçında bu ajanla hiç oynamamış.` };
  return null;
}

/* ---------- Act hedefi ---------- */

/** Hedef seçilebilen en yüksek rank: Ölümsüzlük 1 (üstünde RR sınırları bölgeye göre değişir). */
export const GOAL_MAX_TIER = 24;
export const points = (tier: number, rr: number) => tier * 100 + rr;

export interface GoalEta { left: number; wins: number | null; games: number | null; wr: number }

/** Hedefe kalan RR ve son rekabet maçlarındaki RR'a göre tahmin. */
export function goalEta(tier: number, rr: number, target: number, deltas: number[]): GoalEta | null {
  if (tier < 3 || tier >= GOAL_MAX_TIER || target <= tier) return null;
  const left = points(target, 0) - points(tier, rr);
  const s = rrStats(deltas);
  if (!s) return { left, wins: null, games: null, wr: 0 };
  const wr = s.wins / (s.wins + s.losses);
  const net = wr * s.gain - (1 - wr) * s.loss;
  return { left, wins: Math.ceil(left / s.gain), games: net > 0.5 ? Math.ceil(left / net) : null, wr };
}
