import { useEffect, useState } from "react";

/* Telefonda kalan ayarlar. Depolama kapalıysa varsayılanlarla çalışır. */
export interface Prefs { interval: 3 | 5 | 10; keepAwake: boolean; enemySkins: boolean }
const KEY = "celeste-mobile-prefs";
const DEF: Prefs = { interval: 3, keepAwake: true, enemySkins: true };

function read(): Prefs {
  try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) }; } catch { return DEF; }
}
let cur = read();
const subs = new Set<(p: Prefs) => void>();

export function setPrefs(patch: Partial<Prefs>) {
  cur = { ...cur, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* depolama kapalı */ }
  subs.forEach((f) => f(cur));
}
export function usePrefs(): Prefs {
  const [p, setP] = useState(cur);
  useEffect(() => { subs.add(setP); return () => { subs.delete(setP); }; }, []);
  return p;
}

/* Maç sırasında ekran kararmasın. WebView desteklemiyorsa sessizce vazgeçer. */
type Lock = { release: () => Promise<void> };
export const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !wakeLockSupported) return;
    let lock: Lock | null = null, stop = false;
    const get = async () => {
      if (document.hidden || stop) return;
      try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<Lock> } }).wakeLock.request("screen"); } catch { /* izin yok */ }
    };
    get();
    const vis = () => { if (!document.hidden) get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; document.removeEventListener("visibilitychange", vis); lock?.release().catch(() => undefined); };
  }, [on]);
}

/* Android geri tuşu: açık panel ya da ekran geçmişe bir adım ekler; geri basınca o kapanır.
   Açık bir şey yoksa uygulama arka plana alınır (kapatılmaz). */
let openLayers = 0;
export const hasOpenLayer = () => openLayers > 0;
export function useBackClose(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    openLayers++;
    history.pushState({ sheet: true }, "");
    let popped = false;
    const pop = () => { popped = true; close(); };
    window.addEventListener("popstate", pop);
    return () => { openLayers--; window.removeEventListener("popstate", pop); if (!popped) history.back(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}
