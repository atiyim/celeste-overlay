import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { SITE, installId } from "./community";
import { tfetch } from "./net";
import { highlights, score } from "./MatchCard";
import type { MyMatch } from "./types";

/* Akış: sitedeki /api/feed uçlarıyla konuşur.
   Giriş: Riot Client'ın verdiği, Riot'un imzaladığı kimlik belirteci siteye bir kez gider; site imzayı doğrular,
   belirteci saklamaz ve kendi oturumunu verir. Sonraki isteklerde yalnızca bu oturum gider. */

const inTauri = "__TAURI_INTERNALS__" in window;
const API = `${SITE}/api/feed`;
const SESSION_KEY = "overlay-feed-session";

export interface Role { id?: number; name: string; color: string; admin?: boolean; icon?: string; glow?: boolean }
export interface FeedCard {
  mapId: string; agentId: string; queue: string; won: boolean; k: number; d: number; a: number; acs: number;
  score: [number, number] | null; hl: string[]; rr: number | null; tier: number | null; started: number | null;
  mapName?: string; agentName?: string; tierName?: string;
  /** Skor tablosu (isimsiz): a = ajan, as = asist. */
  board?: { a: string; k: number; d: number; as: number; acs: number; me: boolean; ally: boolean }[];
}
export interface Post { id: number; riot: string; text: string; card: FeedCard | null; created: number; likes: number; comments: number; liked: boolean; mine: boolean; pinned?: boolean; roles: Role[]; reports?: number; hidden?: boolean;
  reacts?: Record<string, number>; myReacts?: string[]; clip?: Clip | null;
  /** Son 2 yorum (akışta tıklamadan görünür). */
  preview?: { id: number; riot: string; text: string; created: number }[] }
export interface Clip { url: string; kind: "youtube" | "tiktok" | "medal" | "twitch"; id: string }
export interface Note { id: number; kind: "gg" | "react" | "comment" | "mention" | "weekly"; post: number; by: string; text: string; at: number; seen: boolean }
export interface Profile { riot: string; puuid: string; roles: Role[]; tier: { tier: number; name: string } | null; stats: { posts: number; gg: number; comments: number; since: number | null }; agents: { agentId: string; name: string; n: number; w: number }[]; posts: Post[] }
export const REACTS = [["fire", "🔥"], ["skull", "💀"], ["lol", "😂"], ["clap", "👏"]] as const;
export interface Comment { id: number; riot: string; text: string; created: number; mine: boolean; roles: Role[] }
export interface RoleDef { id: number; name: string; color: string; icon?: string; glow?: boolean; members: { puuid: string; riot: string }[] }
export interface AdminList { posts: Post[]; comments: (Comment & { post: number; reports: number; hidden: boolean })[]; bans: { riot: string; at: number }[]; roles: RoleDef[]; adminColor?: string }
export interface Me { session: string; riot: string; puuid: string; verifiedName: boolean; admin: boolean; banned: boolean; roles: Role[] }

/** `rank`: şu anki rankın; maçın kendi rank bilgisi yoksa (derecesiz, tam gaz…) o gösterilir. */
export function cardOf(m: MyMatch, assets?: Assets, rank?: number): FeedCard {
  const t = m.tierAfter || (rank && rank > 2 ? rank : 0) || null;
  const tier = t ? assets?.tiers.get(t) : undefined;
  return {
    mapId: m.mapId, agentId: m.agentId, queue: m.queue, won: m.won, k: m.kills, d: m.deaths, a: m.assists, acs: m.acs,
    score: score(m), hl: highlights(m), rr: m.rrDelta ?? null, tier: t, started: m.started,
    mapName: assets?.maps.get(lookup(m.mapId)), agentName: assets?.agents.get(lookup(m.agentId))?.name, tierName: tier?.name,
    board: (m.board ?? []).map((r) => ({ a: r.agentId, k: r.kills, d: r.deaths, as: r.assists, acs: r.acs, me: r.me, ally: r.ally })),
  };
}

let me: Me | null = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Me | null; } catch { return null; } })();
export const currentMe = () => me;
const meSubs = new Set<() => void>();
export const subscribeMe = (f: () => void) => { meSubs.add(f); return () => { meSubs.delete(f); }; };
const notifyMe = () => meSubs.forEach((f) => f());

/** Riot ile doğrulayıp akış oturumu açar (her açılışta yenilenir: ban, rol ve yönetici durumu güncel gelir). */
export async function login(): Promise<Me> {
  if (!inTauri) throw new Error("Akış'ta paylaşım yalnızca masaüstü uygulamasında yapılır.");
  const [token, riot] = await Promise.all([invoke<string>("get_id_token"), invoke<string>("get_riot_id").catch(() => "")]);
  const r = await tfetch(`${API}/login`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ id: installId(), token, riot }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? (r.status === 404 ? "Akış servisi şu an kapalı." : `Giriş yapılamadı (${r.status})`));
  me = j as Me;
  notifyMe();
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(me)); } catch { /* depolama kapalı */ }
  return me;
}

async function send<T>(path: string, body: object, retry = true): Promise<T> {
  if (!me) await login();
  const r = await tfetch(`${API}/${path}`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ session: me!.session, ...body }) });
  if (r.status === 401 && retry) { me = null; notifyMe(); await login(); return send<T>(path, body, false); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? (r.status === 404 ? "Akış servisi şu an kapalı." : `Hata (${r.status})`));
  return j as T;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await tfetch(url);
  if (r.status === 404) throw new Error("Akış servisi şu an kapalı. Biraz sonra tekrar dene.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Hata (${r.status})`);
  return j as T;
}

export type Tab = "new" | "top" | "mine";
export const feedList = (tab: Tab, before?: number) =>
  getJson<{ posts: Post[] }>(`${API}?tab=${tab}&p=${me?.puuid ?? ""}${before ? `&before=${before}` : ""}`);
export const feedComments = (post: number) => getJson<{ comments: Comment[] }>(`${API}/comments?post=${post}&p=${me?.puuid ?? ""}`);

/** Yazmadan önce: Riot Client'taki hesap değiştiyse yeniden giriş (başkasının adıyla yazılmasın). */
async function fresh() {
  if (!inTauri || !me) return;
  const now = await invoke<string>("get_riot_id").catch(() => "");
  if (now && now.toLocaleLowerCase("tr-TR") !== me.riot.toLocaleLowerCase("tr-TR")) await login();
}
export const feedPost = async (text: string, card: FeedCard | null, clip?: string) => { await fresh(); return send<{ id: number }>("post", { text, card, clip: clip || undefined }); };
export const feedReact = (post: number, kind: string) => send<{ on: boolean; count: number }>("react", { post, kind });
export const feedNotes = (seen = false) => send<{ unseen: number; notes: Note[] }>("notes", { seen });
export const feedProfile = (riot: string) => getJson<Profile>(`${API}/profile?riot=${encodeURIComponent(riot)}&p=${me?.puuid ?? ""}`);
export const feedComment = async (post: number, text: string) => { await fresh(); return send<{ id: number }>("comment", { post, text }); };
export const feedLike = (post: number) => send<{ liked: boolean; likes: number }>("like", { post });
export const feedReport = (target: string) => send<{ ok: true }>("report", { target });
export const feedDelete = (target: string) => send<{ ok: true }>("delete", { target });
export const feedAdmin = <T = { ok: true }>(action: string, extra: object = {}) => send<T>("admin", { action, ...extra });

export function ago(ms: number): string {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk`;
  if (m < 1440) return `${Math.floor(m / 60)} sa`;
  if (m < 7 * 1440) return `${Math.floor(m / 1440)} g`;
  return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/* Akış düğmesindeki "N yeni" sayacı: son görülen paylaşımdan sonra gelenler (2 dakikada bir, overlay açıkken). */
const SEEN_KEY = "overlay-feed-seen";
export function useFeedBadge(open: boolean): [number, () => void, number] {
  const [n, setN] = useState(0);
  const [notes, setNotes] = useState(0);
  const [top, setTop] = useState(0);
  const seen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
  const mark = useCallback(() => {
    try { if (top) localStorage.setItem(SEEN_KEY, String(top)); } catch { /* depolama kapalı */ }
    setN(0);
  }, [top]);
  useEffect(() => {
    const ask = async () => {
      if (document.hidden) return;
      try {
        const r = await getJson<{ posts: Post[] }>(`${API}?tab=new`);
        const ids = r.posts.map((p) => p.id);
        const max = ids.length ? Math.max(...ids) : 0;
        setTop(max);
        const s = seen();
        if (!s && max) { try { localStorage.setItem(SEEN_KEY, String(max - Math.min(ids.length, 3))); } catch { /* */ } }
        setN(ids.filter((id) => id > (seen() || max)).length);
        // Giriş yapılmışsa: paylaşımlarına gelen GG, tepki, yorum ve etiketler.
        if (me && !me.banned) setNotes((await feedNotes()).unseen);
      } catch { /* sessiz */ }
    };
    const t0 = window.setTimeout(ask, 3_000);
    const t = window.setInterval(ask, 120_000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, []);
  useEffect(() => { if (open) mark(); }, [open, top]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const clear = () => setNotes(0);
    window.addEventListener("feed-notes-seen", clear);
    return () => window.removeEventListener("feed-notes-seen", clear);
  }, []);
  return [n, mark, notes];
}
