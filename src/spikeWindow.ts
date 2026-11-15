import { emitTo, listen } from "@tauri-apps/api/event";
import { primaryMonitor } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentSpike, subscribeTimers } from "./timerStore";

/* Oyun üstü spike şeridi: ekranın üst ortasında, skor göstergesinin hemen altında duran küçük, saydam pencere.
   İlk spike sayacında bir kez açılır; sonra hep saydam ve tıklama geçirgen kalır (göster/gizle yok, oyundan odak çalmaz). */
export const STRIP_W = 300, STRIP_H = 58;
/** Üstten uzaklık (ekran yüksekliğine oran): Valorant'ın skor/süre göstergesinin altı. */
const TOP_RATIO = 0.105;
const KEY = "overlay-spike-strip";
export interface SpikeState { endsAt: number; done: boolean }

export const stripOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export function setStripOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* depolama kapalı */ }
  push(true);
}

let opening: Promise<void> | null = null;
let sent = "";

async function ensure() {
  if (await WebviewWindow.getByLabel("spike")) return;
  opening ??= (async () => {
    const m = await primaryMonitor();
    const sf = m?.scaleFactor ?? 1;
    const mw = (m?.size.width ?? 1920) / sf, mh = (m?.size.height ?? 1080) / sf;
    const mx = (m?.position.x ?? 0) / sf, my = (m?.position.y ?? 0) / sf;
    await new Promise<void>((ok, fail) => {
      const w = new WebviewWindow("spike", {
        url: "index.html#spike", title: "Celeste Spike",
        width: STRIP_W, height: STRIP_H, x: Math.round(mx + (mw - STRIP_W) / 2), y: Math.round(my + mh * TOP_RATIO),
        transparent: true, decorations: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, shadow: false, focus: false,
      });
      void w.once("tauri://created", () => ok());
      void w.once("tauri://error", (e) => fail(e.payload));
    });
  })().finally(() => { opening = null; });
  await opening;
}

/** Sayaç değiştiyse şeride bildirir. Şerit kapalıysa ya da sayaç yoksa boş durum gönderir. */
function push(force = false) {
  const t = stripOn() ? currentSpike() : null;
  const state: SpikeState | null = t ? { endsAt: t.endsAt, done: t.done } : null;
  const key = JSON.stringify(state);
  if (!force && key === sent) return;
  sent = key;
  void (async () => {
    try {
      if (state) await ensure();
      await emitTo("spike", "spike-state", state);
    } catch { /* şerit açılamadı: sayaç overlay içinde çalışmaya devam eder */ }
  })();
}

/** Ana pencerede bir kez çağrılır. Dönen işlev aboneliği kaldırır. */
export function initSpikeWindow(): () => void {
  const off = subscribeTimers(() => push());
  // Şerit yeni açıldığında hazır olduğunu söyler; o anki durum yeniden gönderilir.
  const un = listen("spike-ready", () => push(true));
  return () => { off(); void un.then((f) => f()); };
}
