import { useEffect, useState } from "react";
import { tfetch } from "./net";

/* Celeste topluluğu: Discord bağlantısı ve anonim kullanım sayımı.

   Sayım yalnızca şunu gönderir: bu kurulum için ilk açılışta üretilen rastgele bir kimlik ve uygulamanın sürümü.
   Riot hesabı, oyuncu adları, maç bilgisi, etiketler ve notlar gönderilmez. İstek S.S.S & Panel'deki canlı kayıtta görünür. */

export const SITE = "https://celeste-feed.celestimbenim.workers.dev";
/** Uygulamadaki Discord düğmeleri: sunucunun kalıcı daveti (tarayıcı Discord uygulamasını açar). */
export const DISCORD_URL = "https://discord.gg/celestevlr";
/** Öneri / Hata formunun gönderildiği adres; Celeste buradan alıp yetkililerin kanalına koyar. */
export const FEEDBACK_API = `${SITE}/api/overlay/feedback`;

const ID_KEY = "overlay-install-id";
const EVERY = 10 * 60_000;
const inTauri = "__TAURI_INTERNALS__" in window;

export function installId(): string {
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

/** Uygulama açıkken 10 dakikada bir "buradayım" der. */
export function useUsagePing(version: string) {
  useEffect(() => {
    if (!inTauri || !/^\d+\.\d+\.\d+$/.test(version)) return;
    const ping = () => {
      const id = installId();
      if (id) tfetch(`${SITE}/api/overlay/ping?id=${id}&v=${version}`).catch(() => undefined);
    };
    ping();
    const t = window.setInterval(ping, EVERY);
    return () => window.clearInterval(t);
  }, [version]);
}

/* "Ele alındı" haberleri: yalnızca bu cihazdan son 30 günde bildirim gönderildiyse, 5 dakikada bir sorulur.
   İstek yalnızca cihazın rastgele kimliğini taşır; gelen haber bir kez gösterilir ve sunucudan silinir. */
export const SENT_KEY = "overlay-feedback-sent";
export const markFeedbackSent = () => { try { localStorage.setItem(SENT_KEY, String(Date.now())); } catch { /* depolama kapalı */ } };
export interface Notice { kind: "oneri" | "hata"; status?: "ele" | "plan" | "ekl" | "yok"; message?: string; at: number }

export function useNotices(): [Notice[], () => void] {
  const [list, setList] = useState<Notice[]>([]);
  useEffect(() => {
    if (!inTauri) return;
    const ask = async () => {
      let sent = 0;
      try { sent = Number(localStorage.getItem(SENT_KEY)) || 0; } catch { /* depolama kapalı */ }
      if (!sent || Date.now() - sent > 30 * 24 * 3_600_000) return;
      const id = installId();
      if (!id) return;
      try {
        const r = await tfetch(`${SITE}/api/overlay/notices?id=${id}`);
        if (!r.ok) return;
        const got = (await r.json()) as Notice[];
        if (Array.isArray(got) && got.length) setList((l) => [...l, ...got.filter((n) => n.kind === "oneri" || n.kind === "hata").map((n) => ({ ...n, message: typeof n.message === "string" ? n.message.slice(0, 300) : "" }))]);
      } catch { /* sonraki turda */ }
    };
    const t0 = window.setTimeout(ask, 20_000);
    const t = window.setInterval(ask, 5 * 60_000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, []);
  return [list, () => setList([])];
}
