import { invoke } from "@tauri-apps/api/core";

const inTauri = "__TAURI_INTERNALS__" in window;

export interface NetEntry {
  t: number; method: string; host: string; target: "local" | "riot" | "assets" | "github" | "celeste" | "other";
  what: string; path: string; kind: "okuma" | "sorgu" | "yazma"; status: number; ms: number;
}
export interface HostCount { host: string; target: NetEntry["target"]; count: number }
export interface NetReport {
  entries: NetEntry[]; total: number; reads: number; queries: number; writes: number; errors: number;
  lastMinute: number; hosts: HostCount[]; hiddenSkipped: number; since: number;
}

/* Arayüzün kendi attığı istekleri (sözlük dosyaları, güncelleme denetimi) Şeffaflık günlüğüne bildirir. */
export function noteNet(method: string, url: string, status: number, ms: number) {
  if (inTauri) invoke("net_note", { method, url, status, ms }).catch(() => undefined);
}

/** fetch ile aynı, ama isteği günlüğe de yazar. */
/* Uygulama sürümü: Akış istekleri sürümü taşır; sunucu eski sürümleri (zorunlu güncelleme) 426 ile geri çevirir. */
const inApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const versionP: Promise<string> = inApp
  ? import("@tauri-apps/api/app").then((m) => m.getVersion()).catch(() => "")
  : Promise.resolve("");
export const OUTDATED_EVENT = "celeste-outdated";

/* Resmi derleme imzası: Celeste sunucusuna giden her istek imzalanır. Anahtar yalnızca resmi derlemede, uygulamanın
   Rust tarafında bulunur (ayrıntı: riot-core/src/official.rs). Kaynak koddan derlenen kopyalarda anahtar yoktur;
   sunucu bu kopyaları Celeste servislerine almaz (LICENSE, madde 4). */
export const CELESTE_HOST = "celeste-feed.celestimbenim.workers.dev";

/** Bu derleme resmi mi? Tarayıcı önizlemesinde resmi sayılır (lisans ekranını denemek için: localStorage "dev-unofficial" = "1"). */
export const officialP: Promise<boolean> = inApp
  ? invoke<boolean>("build_official").catch(() => false)
  : Promise.resolve((() => { try { return localStorage.getItem("dev-unofficial") !== "1"; } catch { return true; } })());

const hexOf = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function bodyHash(body: RequestInit["body"]): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  let bytes: BufferSource;
  if (body == null) bytes = new Uint8Array(0);
  else if (typeof body === "string") bytes = new TextEncoder().encode(body);
  else if (body instanceof ArrayBuffer) bytes = body;
  else if (body instanceof Blob) bytes = await body.arrayBuffer();
  else return null; // imzalanamayan gövde türü (kullanılmıyor)
  return hexOf(await crypto.subtle.digest("SHA-256", bytes));
}

/** Celeste sunucusuna giden adrese sürümü ve imzayı ekler; başka adreslere dokunmaz. */
async function celesteUrl(url: string, init?: RequestInit): Promise<string> {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  if (u.host !== CELESTE_HOST || u.pathname.startsWith("/api/feed/img/")) return url;
  const v = await versionP;
  if (v && !u.searchParams.has("v")) u.searchParams.set("v", v);
  const pathQuery = u.pathname + u.search;
  if (!inApp) return u.origin + pathQuery;
  const hash = await bodyHash(init?.body);
  const b = hash ? await invoke<string | null>("sign_request", { method: (init?.method ?? "GET").toUpperCase(), pathQuery, bodyHash: hash }).catch(() => null) : null;
  return b ? `${u.origin}${pathQuery}${u.search ? "&" : "?"}b=${b}` : u.origin + pathQuery;
}

const UNOFFICIAL_BODY = JSON.stringify({ error: "Bu, Celeste Overlay'in resmi sürümü değil; Celeste servislerine bağlanamaz.", unofficial: true });
const isCeleste = (url: string) => { try { return new URL(url).host === CELESTE_HOST; } catch { return false; } };

const NET_ERROR = "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export async function tfetch(url: string, init?: RequestInit): Promise<Response> {
  // Resmi olmayan derleme Celeste sunucusuna hiç istek atmaz (LICENSE, madde 4).
  if (isCeleste(url) && !(await officialP)) return new Response(UNOFFICIAL_BODY, { status: 403, headers: { "content-type": "application/json" } });
  url = await celesteUrl(url, init);
  const method = (init?.method ?? "GET").toUpperCase();
  // Okuma istekleri ağ kesintisinde bir kez daha denenir (yazma istekleri çift gitmesin diye denenmez). Yanıt vermeyen istek 20 sn'de bırakılır.
  const tries = method === "GET" ? 2 : 1;
  let last: unknown;
  for (let n = 0; n < tries; n++) {
    if (n) await wait(700);
    const t0 = performance.now();
    const ctl = init?.signal ? null : new AbortController();
    const timer = ctl ? window.setTimeout(() => ctl.abort(), 20_000) : undefined;
    try {
      const r = await fetch(url, ctl ? { ...init, signal: ctl.signal } : init);
      noteNet(method, url, r.status, Math.round(performance.now() - t0));
      if (r.status === 426) window.dispatchEvent(new CustomEvent(OUTDATED_EVENT));
      return r;
    } catch (e) {
      last = e;
      noteNet(method, url, 0, Math.round(performance.now() - t0));
      if (init?.signal?.aborted) throw e;
    } finally { window.clearTimeout(timer); }
  }
  throw last instanceof TypeError || (last instanceof DOMException && last.name === "AbortError") ? new Error(NET_ERROR) : last;
}
