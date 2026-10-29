import { useEffect } from "react";
import { tfetch } from "./net";

/* Celeste topluluğu: Discord bağlantısı ve anonim kullanım sayımı.

   Sayım yalnızca şunu gönderir: bu kurulum için ilk açılışta üretilen rastgele bir kimlik ve uygulamanın sürümü.
   Riot hesabı, oyuncu adları, maç bilgisi, etiketler ve notlar gönderilmez. İstek Şeffaflık günlüğünde görünür;
   Ayarlar'dan kapatılabilir. Kapatınca kimlik de silinir (yeniden açılırsa yeni bir kimlik üretilir). */

export const SITE = "https://celeste-feed.celestimbenim.workers.dev";
/** Uygulamadaki Discord düğmesi: site, Celeste'nin oluşturduğu kalıcı davete yönlendirir. */
export const DISCORD_URL = `${SITE}/discord`;

const ID_KEY = "overlay-install-id";
const EVERY = 10 * 60_000;
const inTauri = "__TAURI_INTERNALS__" in window;

function installId(): string {
  try {
    const known = localStorage.getItem(ID_KEY);
    if (known && /^[0-9a-f]{32}$/.test(known)) return known;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function forgetId() {
  try { localStorage.removeItem(ID_KEY); } catch { /* depolama kapalı */ }
}

/** Uygulama açıkken 10 dakikada bir "buradayım" der (kapalıysa hiçbir şey göndermez). */
export function useUsagePing(enabled: boolean, version: string) {
  useEffect(() => {
    if (!enabled) { forgetId(); return; }
    if (!inTauri || !/^\d+\.\d+\.\d+$/.test(version)) return;
    const ping = () => {
      const id = installId();
      if (id) tfetch(`${SITE}/api/overlay/ping?id=${id}&v=${version}`).catch(() => undefined);
    };
    ping();
    const t = window.setInterval(ping, EVERY);
    return () => window.clearInterval(t);
  }, [enabled, version]);
}
