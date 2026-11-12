import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { Toggle } from "./ui";

/* Üst çubuktaki "Hızlı ayarlar": oyun sırasında en çok değiştirilenler tek yerde.
   Dışarı tıklayınca ya da Esc ile kapanır. */
interface Props {
  protect: boolean; onProtect: (v: boolean) => void;
  blur: boolean; onBlur: (v: boolean) => void;
  fps: boolean; onFps: (v: boolean) => void;
  zoom: number; zooms: number[]; onZoom: (z: number) => void;
  onAll: () => void;
}

export function QuickMenu({ protect, onProtect, blur, onBlur, fps, onFps, zoom, zooms, onZoom, onAll }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: globalThis.MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const i = Math.max(0, zooms.indexOf(zoom));
  const active = protect || blur || fps;

  return (
    <span className="qm" ref={ref}>
      <button
        type="button"
        className={open || active ? "ib on" : "ib"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Hızlı ayarlar"
        title="Hızlı ayarlar"
        onClick={() => setOpen(!open)}
      >
        <Icon name="sliders" size={17} />
      </button>
      {open && (
        <div className="qpop" role="dialog" aria-label="Hızlı ayarlar">
          <h5>Hızlı ayarlar</h5>
          <div className="qi">
            <Icon name="eyeoff" size={17} />
            <span><b>Kayıtta gizle</b><small>Sen görürsün, yayında ve kayıtta görünmez</small></span>
            <Toggle on={protect} onChange={onProtect} label="Kayıtta gizle" />
          </div>
          <div className="qi">
            <Icon name="blur" size={17} />
            <span><b>İsimleri bulanıklaştır</b><small>Video çekerken başkalarını gizler</small></span>
            <Toggle on={blur} onChange={onBlur} label="İsimleri bulanıklaştır" />
          </div>
          <div className="qi">
            <Icon name="bolt" size={17} />
            <span><b>FPS modu</b><small>Efektler kapanır, maçta hemen gizlenir</small></span>
            <Toggle on={fps} onChange={onFps} label="FPS modu" />
          </div>
          <div className="qi">
            <Icon name="text" size={17} />
            <span><b>Yazı boyutu</b><small>%{Math.round(zoom * 100)}</small></span>
            <span className="qz" role="group" aria-label="Yazı boyutu">
              <button type="button" aria-label="Küçült" disabled={i === 0} onClick={() => onZoom(zooms[i - 1])}><Icon name="minus" size={14} /></button>
              <button type="button" aria-label="Büyüt" disabled={i === zooms.length - 1} onClick={() => onZoom(zooms[i + 1])}><Icon name="plus" size={14} /></button>
            </span>
          </div>
          <button type="button" className="qall" onClick={() => { setOpen(false); onAll(); }}>
            Bütün ayarlar <Icon name="chevron" size={14} />
          </button>
        </div>
      )}
    </span>
  );
}
