import { invoke } from "@tauri-apps/api/core";
import { SITE, installId } from "./community";
import { tfetch } from "./net";
import { highlights, score } from "./MatchCard";
import type { MyMatch } from "./types";

/* Akış: sitedeki /api/feed uçlarıyla konuşur. Gönderilen: yazı, maç kartı verisi, Riot ID, puuid ve kurulum kimliği. */

const inTauri = "__TAURI_INTERNALS__" in window;
const API = `${SITE}/api/feed`;
export const ADMIN_KEY = "overlay-feed-admin";

export interface FeedCard {
  mapId: string; agentId: string; queue: string; won: boolean; k: number; d: number; a: number; acs: number;
  score: [number, number] | null; hl: string[]; rr: number | null; tier: number | null; started: number | null;
}
export interface Post { id: number; riot: string; text: string; card: FeedCard | null; created: number; likes: number; comments: number; liked: boolean; mine: boolean; reports?: number; hidden?: boolean }
export interface Comment { id: number; riot: string; text: string; created: number; mine: boolean }
export interface AdminList { posts: Post[]; comments: (Comment & { post: number; reports: number; hidden: boolean })[]; bans: { riot: string; at: number }[] }

export function cardOf(m: MyMatch): FeedCard {
  return {
    mapId: m.mapId, agentId: m.agentId, queue: m.queue, won: m.won, k: m.kills, d: m.deaths, a: m.assists, acs: m.acs,
    score: score(m), hl: highlights(m), rr: m.rrDelta ?? null, tier: m.tierAfter ?? null, started: m.started,
  };
}

let ident: Promise<{ riot: string; puuid: string }> | null = null;
/** Riot ID ve puuid; Riot Client kapalıysa hata verir (bir sonraki denemede yeniden sorulur). */
export function identity(): Promise<{ riot: string; puuid: string }> {
  if (!inTauri) return Promise.resolve({ riot: "Deneme#TR1", puuid: "" });
  ident ??= Promise.all([invoke<string>("get_riot_id"), invoke<string>("get_my_puuid").catch(() => "")])
    .then(([riot, puuid]) => ({ riot, puuid }))
    .catch((e) => { ident = null; throw e; });
  return ident;
}

async function send<T>(path: string, body: object): Promise<T> {
  const r = await tfetch(`${API}/${path}`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) });
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
  getJson<{ posts: Post[]; banned?: boolean }>(`${API}?tab=${tab}&id=${installId()}${before ? `&before=${before}` : ""}`);
export const feedComments = (post: number) => getJson<{ comments: Comment[] }>(`${API}/comments?post=${post}&id=${installId()}`);

export async function feedPost(text: string, card: FeedCard | null) {
  const me = await identity();
  return send<{ id: number }>("post", { id: installId(), ...me, text, card });
}
export async function feedComment(post: number, text: string) {
  const me = await identity();
  return send<{ id: number }>("comment", { id: installId(), ...me, post, text });
}
export const feedLike = (post: number) => send<{ liked: boolean; likes: number }>("like", { id: installId(), post });
export const feedReport = (target: string) => send<{ ok: true }>("report", { id: installId(), target });
export const feedDelete = (target: string) => send<{ ok: true }>("delete", { id: installId(), target });

export function adminKey(): string { try { return localStorage.getItem(ADMIN_KEY) ?? ""; } catch { return ""; } }
export function setAdminKey(k: string) { try { if (k) localStorage.setItem(ADMIN_KEY, k); else localStorage.removeItem(ADMIN_KEY); } catch { /* depolama kapalı */ } }
export const feedAdmin = <T = { ok: true }>(action: string, extra: object = {}) => send<T>("admin", { key: adminKey(), action, ...extra });

export function ago(ms: number): string {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk`;
  if (m < 1440) return `${Math.floor(m / 60)} sa`;
  if (m < 7 * 1440) return `${Math.floor(m / 1440)} g`;
  return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
