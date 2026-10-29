import { useEffect, useState } from "react";
import { BRAND_PATHS } from "./brands";

/* bneceleste'nin hesapları: alt şeritte iki saniyede bir sırayla görünür, tıklayınca profil açılır.
   Fare üstündeyken ya da pencere gizliyken durur; FPS modunda geçiş efekti olmadan değişir. */
const SOCIALS = [
  { id: "kick", label: "Kick", url: "https://kick.com/bneceleste", bg: "#53FC19", fg: "#000" },
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/bneceleste", bg: "#FF0069", fg: "#fff" },
  { id: "youtube", label: "YouTube", url: "https://www.youtube.com/@bneceleste", bg: "#FF0000", fg: "#fff" },
  { id: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@bneceleste", bg: "#000", fg: "#fff" },
] as const;
const HANDLE = "bneceleste";
const EVERY = 2000;

export function Socials({ onOpen }: { onOpen: (url: string) => void }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold) return;
    const t = window.setInterval(() => { if (!document.hidden) setI((x) => (x + 1) % SOCIALS.length); }, EVERY);
    return () => window.clearInterval(t);
  }, [hold]);

  const s = SOCIALS[i];
  return (
    <span className="socw" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
      <button key={s.id} type="button" className="soc" title={`${s.label}: ${HANDLE}`} aria-label={`${s.label} profilini aç: ${HANDLE}`} onClick={() => onOpen(s.url)}>
        <span className={`socl ${s.id}`} style={{ background: s.bg, color: s.fg }}>
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d={BRAND_PATHS[s.id]} /></svg>
        </span>
        <span className="socn">{HANDLE}</span>
        <span className="socp">{s.label}</span>
      </button>
      <span className="socd" aria-hidden="true">{SOCIALS.map((x, j) => <i key={x.id} className={j === i ? "on" : ""} />)}</span>
    </span>
  );
}
