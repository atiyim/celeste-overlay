import type { Assets } from "./assets";
import { lookup, resolveSkin } from "./assets";
import { TAGS, type Entry } from "./seen";
import type { Thresholds } from "./theme";
import { activityBadge, analyze, formBadge, styleBadge, type Badge } from "./playstyle";
import type { Player } from "./types";
import { agentPool, gunBadge, mapBadge, mmrBadge, poolBadge } from "./insights";

/* Lobi satırı ve oyuncu kartı aynı veriyi gösterir; hesap tek yerde yapılır. */

// Kaplaması gösterilecek silahlar (kimlikle bulunur, olmazsa isim/kategoriyle).
const THUMBS = [
  { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", name: "Vandal" },
  { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", name: "Phantom" },
  { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", name: "Operator" },
  { id: "2f59173c-4bed-b6c3-2191-dea9b58be9c7", name: "Melee", category: "Melee" },
];

export interface ViewCtx { assets: Assets; entry?: Entry; th: Thresholds; mapId?: string | null; mapName?: string; index: number }

export function playerView(p: Player, { assets, entry, th, mapId, mapName, index }: ViewCtx) {
  const agent = assets.agents.get(lookup(p.agentId));
  const cur = p.rank.current > 0 ? assets.tiers.get(p.rank.current) : undefined;
  const peak = p.rank.peak > 0 ? assets.tiers.get(p.rank.peak) : undefined;
  const anonymous = p.hiddenName && !p.isSelf;
  const label = entry?.label;
  const tag = TAGS.find((t) => t.id === entry?.tag);
  const name = anonymous ? label ?? `Oyuncu ${index + 1}` : p.name ?? "…";
  const copyName = anonymous ? label ?? null : p.name ?? null;

  // Önceki karşılaşma: şimdiki maç geçmişin sonundadır, bir öncekine bak.
  const prev = entry && entry.history.length >= 2 ? entry.history[entry.history.length - 2] : undefined;
  const prevText = prev
    ? "Geçen: " + [assets.maps.get(lookup(prev.mapId)), assets.agents.get(lookup(prev.agentId))?.name, prev.side === "ally" ? "takım" : "rakip", !anonymous && prev.name && prev.name !== p.name ? `adı: ${prev.name}` : null].filter(Boolean).join(" · ")
    : null;
  const times = !p.isSelf && entry && entry.n >= 2 ? entry.n : 0;

  // Tracker: görünen isim ya da (gizli isimlilerde) kullanıcının kendi notu "isim#etiket" biçimindeyse.
  const trackerName = anonymous ? (label && label.includes("#") ? label : null) : p.name ?? null;
  const trackerUrl = trackerName && trackerName.includes("#") ? `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(trackerName)}/overview` : null;

  // Kazanma oranı rekabet verisinden gelir; son act'te maç yoksa toplam rekabet oranı.
  const r = p.rank;
  const [w, g, scope] = r.games > 0 ? [r.wins, r.games, "son act"] : [r.totalWins, r.totalGames, "tüm act'ler"];
  const wrPct = g > 0 ? Math.round((100 * w) / g) : null;

  const thumbs = THUMBS.map((t) => {
    const weapon = assets.weapons.find((x) => x.id === t.id)
      ?? assets.weapons.find((x) => x.name === t.name)
      ?? (t.category ? assets.weapons.find((x) => x.category === t.category) : undefined);
    if (!weapon) return null;
    const slot = p.loadout.weapons.find((x) => lookup(x.weaponId) === weapon.id);
    return { weapon, skin: resolveSkin(assets, weapon, slot) };
  });
  const skinTip = thumbs.filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => `${t.weapon.name}: ${t.skin.name}${t.skin.chromaName ? ` (${t.skin.chromaName})` : ""}`).join("\n");
  const noLoadout = p.loadout.weapons.length === 0 && (p.loadout.allIds?.length ?? 0) === 0;

  const play = analyze(p);
  const pool = agentPool(p);
  // Önce maç içinde işe yarayanlar; satırda biri, fazlası "+N" ile.
  const badges: Badge[] = [poolBadge(p, agent?.name), gunBadge(p), mapBadge(p, mapId, mapName), mmrBadge(p, (t) => assets.tiers.get(t)?.name), formBadge(p), styleBadge(play, th), activityBadge(p)]
    .filter((b): b is Badge => !!b);
  // Zirve, şimdikinden en az bir kademe yüksekse belirtilir.
  const peakUp = peak && r.peak > r.current ? peak : undefined;

  return { agent, cur, peak, peakUp, anonymous, label, tag, name, copyName, prevText, times, trackerUrl, w, g, scope, wrPct, vandal: thumbs[0], skinTip, noLoadout, pool, badges };
}

/** Parti harfi → renk. Aynı partidekiler aynı renkte çizgiyle birleşir. */
const PARTY_COLORS = ["#f0a6ca", "#8fb4ff", "#f6cf7a", "#7ee2b8", "#c39cff", "#ffb38a"];
export const partyColor = (id: string) => PARTY_COLORS[Math.abs((id.toUpperCase().charCodeAt(0) || 65) - 65) % PARTY_COLORS.length];

/** "Prime Vandal" → "Prime": silah adı tekrarlanmasın. */
export function shortSkin(skin: string, weapon: string) {
  const s = skin.replace(new RegExp(`\\s*${weapon}\\s*$`, "i"), "").trim();
  return s || skin;
}

/** Aynı partidekiler yan yana dursun (ilk görünen üyenin yerinde). Parti yoksa sıra değişmez. */
export function groupParties(list: Player[]): Player[] {
  const first = new Map<string, number>();
  list.forEach((p, i) => { if (p.party && !first.has(p.party)) first.set(p.party, i); });
  return list.map((p, i) => ({ p, k: p.party ? first.get(p.party)! + (i - first.get(p.party)!) / 100 : i }))
    .sort((a, b) => a.k - b.k).map((x) => x.p);
}
