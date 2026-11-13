import type { Assets } from "./assets";
import { lookup } from "./assets";
import { mmrBadge } from "./insights";
import { formBadge } from "./playstyle";
import type { Player } from "./types";

/* Rakip tehlike puanı: yüksek K/D, galibiyet oranı, lobiye göre rank ve yükselen MMR / formu toplar.
   Veri yetersizse (az maç) puan verilmez; tahmin edilmez. */
const MIN_GAMES = 6;

export function threatScore(p: Player, avgTier: number): number | null {
  const g = p.rank.games > 0 ? p.rank.games : p.rank.totalGames;
  const w = p.rank.games > 0 ? p.rank.wins : p.rank.totalWins;
  if (p.kd == null || g < MIN_GAMES) return null;
  let s = (p.kd - 1) * 40 + (100 * w / g - 50) * 0.8;
  if (avgTier > 0 && p.rank.current > 0) s += Math.max(-8, Math.min(12, (p.rank.current - avgTier) * 3));
  const mmr = mmrBadge(p);
  if (mmr) s += mmr.tone === "pos" ? 6 : -4;
  const form = formBadge(p);
  if (form) s += form.tone === "pos" ? 5 : -5;
  return s;
}

/** Rakipler içinde en tehlikeli oyuncunun kimliği (eşik altındaysa hiçbiri). */
export function topThreat(list: Player[], avgTier: number): string | null {
  let best: { id: string; s: number } | null = null;
  for (const p of list) {
    const s = threatScore(p, avgTier);
    if (s != null && (!best || s > best.s)) best = { id: p.puuid, s };
  }
  return best && best.s >= 14 ? best.id : null;
}

/** Takımdaki rol dağılımı: [rolId, sayı]. */
export const ROLES = [
  { id: "dbe8757e-9e92-4ed4-b39f-9dfc589691d4", short: "Düellocu" },
  { id: "4ee40330-ecdd-4f2f-98a8-eb1243428373", short: "Kontrolcü" },
  { id: "1b47567f-8f7b-444b-aae3-b0c634622d10", short: "Başlatıcı" },
  { id: "5fc02f99-4091-4486-a531-98459a3e95e9", short: "Gözcü" },
] as const;

export function roleCounts(list: Player[], assets: Assets) {
  const n = new Map<string, number>();
  for (const p of list) {
    const id = assets.agents.get(lookup(p.agentId))?.roleId;
    if (id) n.set(id, (n.get(id) ?? 0) + 1);
  }
  return n;
}
