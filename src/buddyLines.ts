import type { Mood } from "./Mascot";
import type { Player, Snapshot } from "./types";
import { unseenTools, type ToolId } from "./toolTips";

/* Köşedeki Celeste'nin cümleleri. Maça göre olanlar yalnızca overlay'in zaten gösterdiği veriden çıkar. */
export interface Line { text: string; mood?: Mood; /** Tıklanınca açılacak araç (araç ipucu) */ tool?: ToolId }

const GENERAL: Line[] = [
  { text: "Derin nefes al, sıradaki raunt senin." },
  { text: "Nişangâh kafa hizasında, gerisi gelir." },
  { text: "Su içmeyi unutma." },
  { text: "Takımına bir \"iyi oyunlar\" yaz, fark eder.", mood: "happy" },
  { text: "Bana tıklarsan rehberi yeniden açarım.", mood: "wink" },
];
const FLIRT: Line[] = [
  { text: "Bugün de çok iyi görünüyorsun. Yani... nişanın.", mood: "flirt" },
  { text: "Seni izlemek maçtan daha keyifli.", mood: "flirt" },
  { text: "Hem iyi oynayıp hem tatlı olman biraz haksızlık.", mood: "flirt" },
  { text: "Kimseye söyleme ama en sevdiğim oyuncu sensin.", mood: "flirt" },
  { text: "Clutch'ı sen al, kalbimi zaten aldın.", mood: "flirt" },
];
const PHASE: Record<string, Line[]> = {
  offline: [{ text: "Valorant'ı açınca lobini göstereceğim." }],
  menu: [{ text: "Sıraya girince herkesi senin için çıkarırım." }, { text: "Hazır mısın? Ben hazırım.", mood: "happy" }],
  pregame: [{ text: "Ajanını seç, ben rakiplere bakıyorum." }],
  ingame: [{ text: "İyi oyunlar! Sakin kal, tek tek al.", mood: "happy" }, { text: "Sen oyna, gerisi bende.", mood: "wink" }],
};

const streak = (p: Player, won: boolean) => {
  const f = [...p.form].sort((a, b) => (b.started ?? 0) - (a.started ?? 0));
  let n = 0;
  for (const m of f) { if (m.won !== won) break; n++; }
  return n;
};

/** O anki maça / forma özel cümleler (yoksa boş). */
export function contextLines(snap: Snapshot): Line[] {
  const out: Line[] = [];
  const me = snap.players.find((p) => p.isSelf);
  if (!me) return out;
  const live = snap.phase === "pregame" || snap.phase === "ingame";
  if (live) {
    const groups = new Map<string, number>();
    for (const p of snap.players) if (p.team !== me.team && p.party) groups.set(p.party, (groups.get(p.party) ?? 0) + 1);
    const big = Math.max(0, ...groups.values());
    if (big >= 3) out.push({ text: `Karşıda ${big} kişilik parti var. Birlikte oynuyorlar, dikkat.`, mood: "surprised" });
    const mine = snap.players.filter((p) => p.team === me.team && p.party && p.party === me.party).length;
    if (mine >= 3) out.push({ text: `${mine} kişi beraber girmişsiniz. Güzel ekip.`, mood: "happy" });
  }
  if (!me.formLoading && me.form.length) {
    const w = streak(me, true), l = streak(me, false);
    if (w >= 2) out.push({ text: `${w} maçtır kazanıyorsun. Bu da gelir.`, mood: "happy" });
    if (l >= 2) out.push({ text: `Son ${l} maç kötü gitti, olur öyle. Bu maç yeni sayfa.`, mood: "sad" });
    const last = [...me.form].sort((a, b) => (b.started ?? 0) - (a.started ?? 0))[0];
    if (last && last.deaths > 0 && last.kills / last.deaths >= 1.5) out.push({ text: `Son maçta K/D ${(last.kills / last.deaths).toFixed(1)}. Formundasın.`, mood: "wink" });
  }
  if (me.played24h >= 6) out.push({ text: `Bugün ${me.played24h}${me.played24hCapped ? "+" : ""} maç oynadın. Kısa bir mola iyi gelir.`, mood: "sad" });
  return out;
}

/** Maç bittiğinde (oyundan menüye dönünce) söylenenler. */
export const AFTER_MATCH: Line[] = [
  { text: "Maç bitti. Bir su iç, omuzlarını gevşet." },
  { text: "Nasıl geçti? Ben hep senin tarafındayım.", mood: "wink" },
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/** Sıradaki cümle: çoğunlukla maça özel, arada genel, seyrek olarak flört. */
export function nextLine(snap: Snapshot, last: string): Line {
  const ctx = contextLines(snap), r = Math.random();
  // Maç dışında, henüz açılmamış araçlar varsa arada onları önerir (tıklayınca o araç açılır).
  const tools: Line[] = snap.phase === "menu" || snap.phase === "offline" ? unseenTools().map((t) => ({ text: t.say, mood: "wink", tool: t.id })) : [];
  const pool = (r < 0.18 ? FLIRT : r < 0.45 && tools.length ? tools : r < 0.7 && ctx.length ? ctx : [...(PHASE[snap.phase] ?? []), ...GENERAL]).filter((l) => l.text !== last);
  return pick(pool.length ? pool : GENERAL);
}
