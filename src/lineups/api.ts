import { useEffect, useSyncExternalStore } from "react";
import { SITE } from "../community";
import { authedPost } from "../feed";
import { tfetch } from "../net";

/* Lineup kütüphanesi: Celeste sunucusundaki /api/lineups uçları.
   Liste herkese açık ve önbellekli; yazma (gönderme, oy, yönetim) Akış oturumuyla yapılır. */

const API = `${SITE}/api/lineups`;
const CACHE_KEY = "overlay-lineups-cache";

export type Slot = "Grenade" | "Ability1" | "Ability2" | "Ultimate";
export type Side = "atk" | "def";
export type Kind = "postplant" | "retake" | "execute" | "default" | "entry" | "info" | "anti";
export type Throw = "stand" | "crouch" | "jump" | "run" | "walk" | "runjump";
export interface Pt { x: number; y: number }
export interface Step { img: string | null; text: string; aim: Pt | null }
export interface Clip { id: string; start: number; end: number }

/** Gönderilen alanlar. */
export interface LineupDraft {
  map: string; agent: string; slot: Slot; side: Side; site: string; kind: Kind; title: string; note: string;
  throw: Throw; diff: 1 | 2 | 3; stand: Pt | null; land: Pt | null; steps: Step[]; clip: Clip | null; patch: string; alt: string;
}
export interface Lineup extends Omit<LineupDraft, "stand" | "land"> {
  id: string; stand: Pt; land: Pt; status: "live" | "pending" | "rejected"; official: boolean; featured: boolean;
  by: string; up: number; works: number; broken: number; at: number; upd: number; reason?: string;
}

export const SLOT_KEY: Record<Slot, string> = { Grenade: "C", Ability1: "Q", Ability2: "E", Ultimate: "X" };
export const SIDES: [Side, string][] = [["atk", "Saldırı"], ["def", "Savunma"]];
export const SITES: [string, string][] = [["A", "A"], ["B", "B"], ["C", "C"], ["mid", "Orta"]];
export const KINDS: [Kind, string, string][] = [
  ["execute", "Giriş", "Siteye girmeden önce"],
  ["postplant", "Post-plant", "Spike kurulduktan sonra, çözmeyi engelle"],
  ["retake", "Retake", "Siteyi geri alırken"],
  ["default", "Varsayılan", "Raunt başı, alan tutmak için"],
  ["entry", "Alan açma", "Bir köşeyi temizle"],
  ["info", "Bilgi", "Rakibin yerini öğren"],
  ["anti", "Kurulum bozma", "Spike kurmayı engelle"],
];
export const THROWS: [Throw, string][] = [["stand", "Ayakta"], ["crouch", "Çömelerek"], ["jump", "Zıplayarak"], ["run", "Koşarak"], ["walk", "Yürüyerek"], ["runjump", "Koşup zıplayarak"]];
export const DIFFS: [1 | 2 | 3, string][] = [[1, "Kolay"], [2, "Orta"], [3, "Zor"]];
export const kindName = (k: string) => KINDS.find(([id]) => id === k)?.[1] ?? "Varsayılan";
export const throwName = (t: string) => THROWS.find(([id]) => id === t)?.[1] ?? "Ayakta";
export const siteName = (s: string) => (s === "mid" ? "Orta" : s ? `${s} Site` : "");
export const imgUrl = (id: string) => `${SITE}/api/lineups/img/${id}`;

/* ------------------------------------------------------------------ */
/* Liste: bellek + yerel önbellek; açılışta önce eldeki gösterilir      */
/* ------------------------------------------------------------------ */

interface State { list: Lineup[]; at: number; loading: boolean; error: string | null }
let state: State = (() => {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"); if (c && Array.isArray(c.list)) return { list: c.list, at: c.at ?? 0, loading: false, error: null }; } catch { /* yok */ }
  return { list: [], at: 0, loading: false, error: null };
})();
const subs = new Set<() => void>();
const set = (s: Partial<State>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };
const STALE_MS = 5 * 60_000;

export async function refreshLineups(force = false): Promise<void> {
  if (state.loading || (!force && Date.now() - state.at < STALE_MS && state.list.length)) return;
  set({ loading: true, error: null });
  try {
    const r = await tfetch(API);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error ?? (r.status === 404 ? "Lineup kütüphanesi henüz açılmadı." : `Hata (${r.status})`));
    const list = ((j as { lineups?: Lineup[] }).lineups ?? []).filter((l) => l && l.id && l.stand && l.land);
    set({ list, at: Date.now(), loading: false });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ list, at: Date.now() })); } catch { /* depolama dolu */ }
  } catch (e) {
    set({ loading: false, error: e instanceof Error ? e.message : String(e) });
  }
}

export function useLineups(): State {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
  useEffect(() => { void refreshLineups(); }, []);
  return s;
}
/** Oylardan sonra listedeki sayıları yerinde günceller (yeniden indirmeden). */
export function patchLineup(id: string, p: Partial<Lineup>) {
  set({ list: state.list.map((l) => (l.id === id ? { ...l, ...p } : l)) });
}

/* ------------------------------------------------------------------ */
/* Yazma                                                               */
/* ------------------------------------------------------------------ */

/** Ekran görüntüsünü küçültür (en uzun kenar 1600, WebP) ve yükler. */
export async function uploadShot(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca görsel dosyası ekleyebilirsin.");
  const bmp = await createImageBitmap(file);
  let blob: Blob | null = null;
  for (const side of [1600, 1280, 1024]) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.86, 0.76, 0.64, 0.52]) {
      blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", q));
      if (blob && blob.size <= 250_000) break;
    }
    if (blob && blob.size <= 250_000) break;
  }
  bmp.close();
  if (!blob || blob.size > 250_000) throw new Error("Görsel çok büyük.");
  const data = await new Promise<string>((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1] ?? ""); f.onerror = () => rej(new Error("Görsel okunamadı")); f.readAsDataURL(blob!); });
  return (await authedPost<{ id: string }>(`${API}/image`, { data })).id;
}

export const submitLineup = async (lineup: LineupDraft) => { const r = await authedPost<{ id: string; status: string }>(`${API}/submit`, { lineup }); void refreshLineups(true); return r; };
export const editLineup = async (id: string, lineup: LineupDraft) => { const r = await authedPost<{ id: string; status: string }>(`${API}/edit`, { id, lineup }); void refreshLineups(true); return r; };
export const voteLineup = (id: string, kind: "up" | "works" | "broken") => authedPost<{ on: boolean; up: number; works: number; broken: number }>(`${API}/vote`, { id, kind });
export const myLineups = () => authedPost<{ admin: boolean; lineups: Lineup[]; votes: string[] }>(`${API}/mine`, {});
export const adminLineups = <T = { ok: true }>(action: string, extra: object = {}) => authedPost<T>(`${API}/admin`, { action, ...extra });

/** YouTube bağlantısından klip: "youtu.be/ID?t=12", "watch?v=ID&t=1m5s", "shorts/ID". */
export function parseYoutube(raw: string): Clip | null {
  const s = raw.trim();
  if (!s) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1, 12);
  else if (host.endsWith("youtube.com")) id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? "";
  if (!/^[\w-]{11}$/.test(id)) return null;
  const t = u.searchParams.get("t") ?? u.searchParams.get("start") ?? "0";
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  const start = m ? (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0) : 0;
  return { id, start, end: start + 12 };
}
