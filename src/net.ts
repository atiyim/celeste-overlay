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

export async function tfetch(url: string, init?: RequestInit): Promise<Response> {
  if (url.includes("/api/feed")) {
    const v = await versionP;
    if (v) url += `${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
  }
  const t0 = performance.now();
  const method = init?.method ?? "GET";
  try {
    const r = await fetch(url, init);
    noteNet(method, url, r.status, Math.round(performance.now() - t0));
    if (r.status === 426) window.dispatchEvent(new CustomEvent(OUTDATED_EVENT));
    return r;
  } catch (e) {
    noteNet(method, url, 0, Math.round(performance.now() - t0));
    throw e;
  }
}
