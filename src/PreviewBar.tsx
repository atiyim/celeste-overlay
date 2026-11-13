import { useEffect, useState } from "react";
import { DISCORD_URL } from "./community";
import { SKINS, stopPreview, usePreview } from "./vip";

/* Kilitli bir tema önizlenirken altta çıkan şerit: süre, vazgeç ve rolün nasıl alınacağı. */
export function PreviewBar({ onOpen }: { onOpen: (url: string) => void }) {
  const pv = usePreview();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pv) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [pv]);
  const skin = pv ? SKINS.find((s) => s.id === pv.id) : undefined;
  if (!pv || !skin) return null;
  const left = Math.max(0, Math.ceil((pv.until - now) / 1000));
  return (
    <div className="pvbar" role="status">
      <span className="pvt"><b>Önizleme · {skin.name}</b><small>{left} sn sonra eski görünüme döner</small></span>
      <button type="button" className="x" onClick={() => onOpen(DISCORD_URL)}>Rolü nasıl alırım?</button>
      <button type="button" className="x" onClick={stopPreview}>Vazgeç</button>
    </div>
  );
}
