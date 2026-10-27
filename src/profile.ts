import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { ActRank, FormEntry, Player } from "./types";
import { isComp } from "./playstyle";

/* Oyuncu ayrıntısındaki "Geçmiş" sekmesinin hesapları. Hepsi Riot'un verdiği maç kayıtlarından çıkarılır; tahmin yoktur. */

/** Derin geçmiş yüklendiyse o, yoksa satırdaki son maçlar. */
export const pool = (p: Player): FormEntry[] => (p.deep && p.deep.length ? p.deep : p.form);

export interface Tally { matches: number; wins: number; kills: number; deaths: number }
export const tally = (list: FormEntry[]): Tally =>
  list.reduce((t, f) => ({ matches: t.matches + 1, wins: t.wins + (f.won ? 1 : 0), kills: t.kills + f.kills, deaths: t.deaths + f.deaths }), { matches: 0, wins: 0, kills: 0, deaths: 0 });
export const winPct = (t: Tally) => (t.matches ? Math.round((100 * t.wins) / t.matches) : null);
export const kdOf = (t: Tally) => (t.deaths ? t.kills / t.deaths : t.kills);

export interface Bucket { id: string; name: string; icon?: string; t: Tally }

/** Ajan başına maç, galibiyet ve K/D; en çok oynanan başta. */
export function agentBuckets(list: FormEntry[], assets: Assets): Bucket[] {
  const by = new Map<string, FormEntry[]>();
  for (const f of list) {
    const id = lookup(f.agentId);
    if (!id) continue;
    by.set(id, [...(by.get(id) ?? []), f]);
  }
  return [...by.entries()]
    .map(([id, fs]) => ({ id, name: assets.agents.get(id)?.name ?? "?", icon: assets.agents.get(id)?.icon, t: tally(fs) }))
    .sort((a, b) => b.t.matches - a.t.matches || kdOf(b.t) - kdOf(a.t));
}

/** Rol başına maç sayısı (rol adı valorant-api'den gelir). Rolü bilinmeyen ajan sayılmaz. */
export function roleBuckets(list: FormEntry[], assets: Assets): Bucket[] {
  const by = new Map<string, { icon?: string; fs: FormEntry[] }>();
  for (const f of list) {
    const ag = assets.agents.get(lookup(f.agentId));
    if (!ag?.role) continue;
    const cur = by.get(ag.role) ?? { icon: ag.roleIcon, fs: [] };
    cur.fs.push(f);
    by.set(ag.role, cur);
  }
  return [...by.entries()].map(([name, v]) => ({ id: name, name, icon: v.icon, t: tally(v.fs) })).sort((a, b) => b.t.matches - a.t.matches);
}

/** Tek ajan oyuncusu: en az 6 maçta tek ajanın payı %70 ve üstü. */
export function oneTrick(buckets: Bucket[]): Bucket | null {
  const total = buckets.reduce((a, b) => a + b.t.matches, 0);
  const top = buckets[0];
  return top && total >= 6 && top.t.matches / total >= 0.7 ? top : null;
}

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const monthYear = (ms: number) => { const d = new Date(ms); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

export interface ActRow extends ActRank { label: string; when: string; start: number }

/** Act geçmişi, en yeniden eskiye. Ad gelmezse tarih aralığı gösterilir. */
export function actRows(p: Player, assets: Assets): ActRow[] {
  return (p.rank.acts ?? [])
    .map((a) => {
      const s = assets.seasons.get(lookup(a.seasonId));
      const when = s?.start ? (s.end ? `${monthYear(s.start)} – ${monthYear(s.end)}` : `${monthYear(s.start)} –`) : "";
      return { ...a, label: s?.name || when || "Bilinmeyen act", when: s?.name ? when : "", start: s?.start ?? 0 };
    })
    .sort((a, b) => b.start - a.start);
}

/** Maçı olan acts arasında en eskisi (başlangıç zamanı bilinenler arasından). */
export function firstAct(rows: ActRow[]): ActRow | null {
  const known = rows.filter((r) => r.start > 0);
  return known.length ? known.reduce((a, b) => (b.start < a.start ? b : a)) : null;
}

export const trackerUrl = (name?: string | null) =>
  name && name.includes("#") ? `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(name)}/overview` : null;

export const compOnly = (list: FormEntry[]) => list.filter(isComp);
