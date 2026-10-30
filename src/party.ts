import type { Player } from "./types";

/* Parti harfinin nereden geldiğini anlatan kısa açıklama ve görünüm. */
export function partyInfo(p: Player, lobby: Player[]): { soft: boolean; tip: string } {
  if (p.partySure || p.partySrc === "live") return { soft: false, tip: "Aynı partide (Riot Client'tan, kesin)" };
  const mates = p.together.filter((t) => lobby.some((x) => x.puuid === t.puuid && x.party && x.party === p.party));
  if (p.partySrc === "last" || mates.some((t) => t.last)) return { soft: false, tip: "Bir önceki maçlarını aynı partide oynadılar ve şimdi yine aynı takımdalar." };
  const best = mates.reduce((a, t) => (t.count > a.count ? t : a), { count: 0, of: 0 } as { count: number; of: number });
  const tip = best.count
    ? `Son ${best.of} maçından ${best.count} tanesinde aynı partideydiler (bütün modlar). Bu maçta da birlikte girdikleri çıkarımdır.`
    : "Son maçlarında aynı partide oynadılar.";
  return { soft: best.count < 2, tip };
}
