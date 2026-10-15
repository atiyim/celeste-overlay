import { useEffect, useRef, useState } from "react";
import { CROSSHAIRS, type Crosshair } from "./crosshairs";
import { drawCrosshair } from "./crosshairRender";

/* Nişangah kütüphanesi: karta tıkla, kod panoya kopyalansın. Önizleme koddan çizilir (internet gerekmez).
   Oyunun ayar dosyasına yazılmaz, oyuna tuş vuruşu gönderilmez. */
interface Props { onCopy: (text: string, label?: string) => void; onClose: () => void }

/* Önce public/crosshairs/<no>.png (gerçek görsel) aranır; yoksa koddan çizilen yaklaşık önizleme gösterilir. */
function Preview({ code, n }: { code: string; n: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState(true);
  useEffect(() => { if (!img && ref.current) drawCrosshair(ref.current, code, 132); }, [code, img]);
  return img
    ? <img src={`/crosshairs/${n}.png`} alt="" onError={() => setImg(false)} />
    : <canvas ref={ref} aria-hidden="true" />;
}

export function Crosshairs({ onCopy, onClose }: Props) {
  return (
    <div className="panel" role="dialog" aria-label="Nişangah">
      <div className="ph">
        <div>
          <h2 className="t">Nişangah</h2>
          <p className="m">Karta tıkla, kod kopyalansın. Oyunda Ayarlar → Nişangah → Profil kodunu içe aktar'a yapıştır.</p>
        </div>
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>
      <div className="xgrid">
        {CROSSHAIRS.map((c: Crosshair, i: number) => (
          <button key={c.code} type="button" className="xc" onClick={() => onCopy(c.code, `${c.name} kopyalandı`)} aria-label={`${c.name}, kodu kopyala`} title={c.code}>
            <span className="xp"><Preview code={c.code} n={i + 1} /></span>
            <span className="xn">{c.name}</span>
            <span className="xk">Kodu kopyala</span>
          </button>
        ))}
      </div>
      <p className="m">Önizleme sabit duruşu gösterir; oyundaki boyut ve renk ekran ayarına göre biraz farklı görünebilir.</p>
    </div>
  );
}
