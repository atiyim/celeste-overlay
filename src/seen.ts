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
