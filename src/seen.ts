/* Yalnızca bu bilgisayarda tutulan karşılaşma geçmişi ve kişisel notlar.
   İsim Riot'tan ayrıca sorgulanmaz; yalnızca lobide zaten görünen isim kaydedilir. Gizli isimli oyuncular için "label" kullanıcının kendi yazdığı nottur. */
const KEY = "overlay-seen";

export interface Encounter { matchId: string; mapId?: string | null; agentId: string; side: "ally" | "enemy"; at: number; name?: string }
export const TAGS = [
  { id: "iyi", label: "İyi", color: "#4ade80" },
  { id: "toksik", label: "Toksik", color: "#f87171" },
  { id: "supheli", label: "Şüpheli", color: "#fbbf24" },
] as const;
export type TagId = (typeof TAGS)[number]["id"];
export interface Entry { n: number; last: string; label?: string; tag?: TagId; history: Encounter[] }
export type Seen = Record<string, Entry>;

function load(): Seen {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Seen;
    for (const e of Object.values(s)) e.history ??= [];
    return s;
  } catch { return {}; }
}
function save(s: Seen) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* depolama dolu */ }
}

export function recordSeen(
  matchId: string,
  mapId: string | null,
  players: { puuid: string; agentId: string; side: "ally" | "enemy"; name?: string | null }[],
): Seen {
  const s = load();
  const at = Date.now();
  for (const p of players) {
    const enc: Encounter = { matchId, mapId, agentId: p.agentId, side: p.side, at, ...(p.name ? { name: p.name } : {}) };
    const e = s[p.puuid];
    if (!e) s[p.puuid] = { n: 1, last: matchId, history: [enc] };
    else if (e.last !== matchId) {
      e.n += 1;
      e.last = matchId;
      e.history = [...e.history, enc].slice(-8);
    }
  }
  save(s);
  return s;
}

export function setLabel(puuid: string, label: string): Seen {
  const s = load();
  const e = s[puuid] ?? { n: 1, last: "", history: [] };
  const v = label.trim();
  if (v) e.label = v; else delete e.label;
  s[puuid] = e;
  save(s);
  return s;
}

/* Etiket oyuncunun puuid'sine bağlıdır: isim gizli olsa da sonraki maçta aynı oyuncuda görünür. */
export function setTag(puuid: string, tag: TagId | null): Seen {
  const s = load();
  const e = s[puuid] ?? { n: 1, last: "", history: [] };
  if (tag) e.tag = tag; else delete e.tag;
  s[puuid] = e;
  save(s);
  return s;
}

/** İzleme listesinden çıkar: etiket ve not silinir, karşılaşma geçmişi kalır. */
export function clearWatch(puuid: string): Seen {
  const s = load();
  const e = s[puuid];
  if (e) { delete e.tag; delete e.label; }
  save(s);
  return s;
}

/** Etiketli ve notlu oyuncuları taşınabilir metne çevirir (başka hesap/bilgisayara aktarmak için). */
export function exportWatch(s: Seen): string {
  const out: Record<string, { tag?: TagId; label?: string; name?: string }> = {};
  for (const [id, e] of Object.entries(s)) {
    if (!e.tag && !e.label) continue;
    const name = [...e.history].reverse().find((h) => h.name)?.name;
    out[id] = { ...(e.tag ? { tag: e.tag } : {}), ...(e.label ? { label: e.label } : {}), ...(name ? { name } : {}) };
  }
  return JSON.stringify({ celesteWatch: 1, players: out });
}

/** Aktarılan metni mevcut listeyle birleştirir (var olan etiketlerin üzerine yazmaz). Eklenen sayısını döner. */
export function importWatch(text: string): { seen: Seen; added: number } | null {
  let data: { celesteWatch?: number; players?: Record<string, { tag?: string; label?: string; name?: string }> };
  try { data = JSON.parse(text); } catch { return null; }
  if (data?.celesteWatch !== 1 || !data.players || typeof data.players !== "object") return null;
  const s = load();
  let added = 0;
  for (const [id, v] of Object.entries(data.players).slice(0, 500)) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !v) continue;
    const tag = TAGS.find((t) => t.id === v.tag)?.id;
    const label = typeof v.label === "string" ? v.label.trim().slice(0, 60) : "";
    const e = s[id] ?? { n: 0, last: "", history: [] };
    if (e.tag || e.label) continue;
    if (tag) e.tag = tag;
    if (label) e.label = label;
    if (!tag && !label) continue;
    if (typeof v.name === "string" && !e.history.length) e.history = [{ matchId: "", mapId: null, agentId: "", side: "enemy", at: 0, name: v.name.slice(0, 40) }];
    s[id] = e;
    added++;
  }
  save(s);
  return { seen: s, added };
}
