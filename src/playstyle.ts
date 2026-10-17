import { DEFAULT_TH, type Thresholds } from "./theme";
import type { Player } from "./types";

/* Oyuncunun son rekabet maçlarından (en fazla 5) çıkarılan ölçülmüş oynayış verisi. Tahmin yok:
   her rakam Riot'un maç kaydındaki gerçek sayılardan hesaplanır. */
export interface WeaponStat { id: string; count: number }
export interface Play {
  matches: number;
  rounds: number;
  shots: number;
  hsPct: number | null;
  adr: number | null;
  firstKills: number;
  firstDeaths: number;
  fkRate: number;
  fdRate: number;
  killWeapons: WeaponStat[];
  bought: WeaponStat[];
}

const merge = (lists: { weaponId: string; count: number }[][]): WeaponStat[] => {
  const m = new Map<string, number>();
  for (const l of lists) for (const w of l) m.set(w.weaponId.toLowerCase(), (m.get(w.weaponId.toLowerCase()) ?? 0) + w.count);
  return [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
};

/* Oyun modları: Riot kuyruk kimliği → ekranda görünen ad ve filtre grubu. */
export type ModeGroup = "competitive" | "unrated" | "spikerush" | "other";
export const MODE_NAMES: Record<string, string> = {
  competitive: "Rekabet", unrated: "Derecesiz", spikerush: "Tam gaz", swiftplay: "Hızlı oyun", premier: "Premier",
  deathmatch: "Ölüm maçı", hurm: "Takım ölüm maçı", ggteam: "Tırmanış", onefa: "Kopya", snowball: "Kartopu savaşı",
};
export const modeName = (q?: string | null) => (q ? MODE_NAMES[q.toLowerCase()] ?? "Diğer mod" : "Diğer mod");
export const modeGroup = (q?: string | null): ModeGroup => {
  const k = (q ?? "").toLowerCase();
  return k === "competitive" ? "competitive" : k === "unrated" ? "unrated" : k === "spikerush" ? "spikerush" : "other";
};
export const isComp = (f: { queue?: string | null }) => (f.queue ?? "").toLowerCase() === "competitive";

/* Varsayılan olarak yalnızca rekabet maçları sayılır (rozetler ve satır özeti); profilde mod seçilince o modun maçları verilir. */
export function analyze(p: Player, forms: Player["form"] = p.form.filter(isComp)): Play | null {
  const f = forms.filter((x) => (x.rounds ?? 0) > 0);
  if (!f.length) return null;
  const sum = (g: (x: (typeof f)[number]) => number) => f.reduce((a, x) => a + g(x), 0);
  const rounds = sum((x) => x.rounds ?? 0);
  const hs = sum((x) => x.headshots ?? 0), body = sum((x) => x.bodyshots ?? 0), leg = sum((x) => x.legshots ?? 0);
  const shots = hs + body + leg;
  const dmg = sum((x) => x.damage ?? 0);
  const fk = sum((x) => x.firstKills ?? 0), fd = sum((x) => x.firstDeaths ?? 0);
  return {
    matches: f.length,
    rounds,
    shots,
    hsPct: shots >= 40 ? (100 * hs) / shots : null,
    adr: dmg > 0 ? dmg / rounds : null,
    firstKills: fk,
    firstDeaths: fd,
    fkRate: fk / rounds,
    fdRate: fd / rounds,
    killWeapons: merge(f.map((x) => x.weaponKills ?? [])),
    bought: merge(f.map((x) => x.bought ?? [])),
  };
}

export interface Badge { text: string; tone: "pos" | "neg" | "gold" | "orange" | "teal" | "violet" | "gray"; tip: string }

/* Nişan / oynayış rozeti: ölçülen eşikleri aşan en belirgin özellik. */
export function styleBadge(play: Play | null, th: Thresholds = DEFAULT_TH): Badge | null {
  if (!play) return null;
  const scope = `son ${play.matches} rekabet maçı, ${play.rounds} round`;
  if (play.hsPct != null && play.hsPct >= th.hs)
    return { text: "Kafa avcısı", tone: "gold", tip: `Kafa isabeti %${play.hsPct.toFixed(0)} (${scope}). Eşik: %${th.hs} ve üstü.` };
  if (play.adr != null && play.adr >= th.adr)
    return { text: "Yüksek hasar", tone: "orange", tip: `Round başına ${play.adr.toFixed(0)} hasar (${scope}). Eşik: ${th.adr} ve üstü.` };
  if (play.fkRate * 100 >= th.fk)
    return { text: "Öncü", tone: "teal", tip: `${play.rounds} round'un ${play.firstKills}'inde ilk kanı aldı (${scope}). Eşik: %${th.fk} ve üstü.` };
  if (play.fdRate * 100 >= th.fd)
    return { text: "İlk ölen", tone: "neg", tip: `${play.rounds} round'un ${play.firstDeaths}'inde ilk ölen oldu (${scope}). Eşik: %${th.fd} ve üstü.` };
  if (play.hsPct != null && play.hsPct <= th.lowHs)
    return { text: "Düşük HS", tone: "neg", tip: `Kafa isabeti %${play.hsPct.toFixed(0)} (${scope}). Eşik: %${th.lowHs} ve altı.` };
  return null;
}

/* Form / tilt: art arda sonuçlar ve son rekabet maçlarındaki RR toplamı. */
export function formBadge(p: Player): Badge | null {
  let win = 0, loss = 0;
  for (const f of p.form.filter(isComp)) { if (f.won) { if (loss) break; win++; } else { if (win) break; loss++; } }
  const rr = p.rrTrend.length >= 3 ? p.rrTrend.reduce((a, b) => a + b, 0) : null;
  const rrText = rr != null ? `${rr > 0 ? "+" : ""}${rr} RR` : "";
  if (loss >= 3 || (rr != null && rr <= -45)) {
    const why = [loss >= 3 ? `art arda ${loss} mağlubiyet` : "", rr != null ? `son ${p.rrTrend.length} rekabet maçı ${rrText}` : ""].filter(Boolean).join(" · ");
    return { text: `Düşüşte ${rrText || `${loss}L`}`.trim(), tone: "neg", tip: why };
  }
  if (win >= 3 || (rr != null && rr >= 45)) {
    const why = [win >= 3 ? `art arda ${win} galibiyet` : "", rr != null ? `son ${p.rrTrend.length} rekabet maçı ${rrText}` : ""].filter(Boolean).join(" · ");
    return { text: `Formda ${rrText || `${win}W`}`.trim(), tone: "pos", tip: why };
  }
  return null;
}

/* Son 24 saatteki maç sayısı: uzun seansları gösterir. Satırda yalnızca 8 ve üstünde rozet çıkar. */
export function activityBadge(p: Player): Badge | null {
  if (p.played24h < 8) return null;
  return { text: `24 saatte ${p.played24h}${p.played24hCapped ? "+" : ""} maç`, tone: "gray", tip: "Son 24 saatte oynadığı maç sayısı (son 25 maç içinden, tüm modlar). Uzun seans: yorgun ya da tilt'te olabilir." };
}

export function ago(ms?: number | null): string {
  if (!ms) return "–";
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 60) return `${m} dk`;
  if (m < 1440) return `${Math.floor(m / 60)} sa ${m % 60} dk`;
  return `${Math.floor(m / 1440)} gün`;
}
