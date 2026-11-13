import { useEffect, useState } from "react";
import { DISCORD_URL } from "./community";
import { itemName, stopPreview, usePreview } from "./vip";

/* Kilitli bir tema ya da efekt önizlenirken altta çıkan şerit: süre, vazgeç ve rolün nasıl alınacağı. */
export function PreviewBar({ onOpen }: { onOpen: (url: string) => void }) {
  const pv = usePreview();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pv) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [pv]);
  if (!pv) return null;
  const left = Math.max(0, Math.ceil((pv.until - now) / 1000));
  return (
    <div className="pvbar" role="status">
      <span className="pvt"><b>Önizleme · {itemName(pv.id)}</b><small>{left} sn sonra eski görünüme döner</small></span>
      <button type="button" className="x" onClick={() => onOpen(DISCORD_URL)}>Rolü nasıl alırım?</button>
      <button type="button" className="x" onClick={stopPreview}>Vazgeç</button>
    </div>
  );
}
