import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { noteNet } from "./net";

const inTauri = "__TAURI_INTERNALS__" in window;

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "downloading"; pct: number | null }
  | { kind: "error"; msg: string };

/* Güncelleme denetimi: açılışta ve 6 saatte bir sessizce bakar. Kurulum her zaman senin onayınla başlar
   (maç sırasında kendiliğinden kurulup uygulamayı kapatmaz). */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const [version, setVersion] = useState("");
  const upd = useRef<Update | null>(null);

  useEffect(() => { if (inTauri) getVersion().then(setVersion).catch(() => undefined); }, []);

  const run = useCallback(async (quiet: boolean) => {
    if (!inTauri) return;
    if (!quiet) setState({ kind: "checking" });
    try {
      const t0 = performance.now();
      const u = await check();
      noteNet("GET", "https://github.com/releases/latest/download/latest.json", 200, Math.round(performance.now() - t0));
      upd.current = u;
      if (u) setState({ kind: "available", version: u.version, notes: u.body });
      else if (!quiet) setState({ kind: "none" });
    } catch (e) {
      // Sessiz denetimde hata göstermeyiz (internet yok, depo henüz ayarlanmamış vb.).
      if (!quiet) setState({ kind: "error", msg: String(e) });
    }
  }, []);

  useEffect(() => {
    const t0 = window.setTimeout(() => run(true), 8000);
    const t = window.setInterval(() => run(true), 6 * 3600 * 1000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, [run]);

  const install = useCallback(async () => {
    const u = upd.current;
    if (!u) return;
    let total = 0, got = 0;
    setState({ kind: "downloading", pct: null });
    try {
      await u.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        else if (ev.event === "Progress") {
          got += ev.data.chunkLength;
          setState({ kind: "downloading", pct: total ? Math.min(100, Math.round((100 * got) / total)) : null });
        }
      });
      await relaunch();
    } catch (e) {
      setState({ kind: "error", msg: String(e) });
    }
  }, []);

  return { state, version, check: () => run(false), install };
}
