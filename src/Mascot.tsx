import { forwardRef, useEffect, useRef, useState, type RefObject } from "react";

/* Celeste: genç ay büyücüsü (vektör çizim, dosya yok).
   Ağzı konuşmanın sesine göre açılıp kapanır, göz kırpar, sevinince zıplar, elindeki asayla ekranı gösterir. */
/** Elin karakter kutusu içindeki yeri (piksel) */
export const HAND = { x: 17.4, y: 63 };

export const Mascot = forwardRef<HTMLDivElement, { cheer?: boolean }>(function Mascot({ cheer }, ref) {
  return (
    <div ref={ref} className={`mascot${cheer ? " cheer" : ""}`} data-mouth="0" aria-hidden="true">
      <svg viewBox="0 0 96 116" width="115" height="139">
        <defs>
          <linearGradient id="mcHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f0ff" /><stop offset="1" stopColor="#b3a8ee" /></linearGradient>
          <linearGradient id="mcHairB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9aef0" /><stop offset="1" stopColor="#8478d2" /></linearGradient>
          <linearGradient id="mcDress" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3f9c" /><stop offset="1" stopColor="#1c1e52" /></linearGradient>
          <linearGradient id="mcEye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#231a55" /><stop offset=".55" stopColor="#5a3fb8" /><stop offset="1" stopColor="#f3c05e" /></linearGradient>
          <radialGradient id="mcSkin" cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#fff1e4" /><stop offset="1" stopColor="#ffd9bf" /></radialGradient>
        </defs>
        <ellipse cx="48" cy="112" rx="21" ry="3" fill="#000" opacity=".32" />
        {/* arka saç */}
        <path d="M33 20 C25 42 25 66 30 82 C36 80 40 76 42 70 L54 70 C56 76 60 80 66 82 C71 66 71 42 63 20 Z" fill="url(#mcHairB)" />
        {/* ayakkabılar */}
        <ellipse cx="43" cy="109.5" rx="4.2" ry="2.2" fill="#15173d" /><ellipse cx="53" cy="109.5" rx="4.2" ry="2.2" fill="#15173d" />
        {/* etek */}
        <path d="M41.5 61 C38 78 31 95 28 106 Q48 112 68 106 C65 95 58 78 54.5 61 Z" fill="url(#mcDress)" />
        <path d="M28.4 104.6 Q48 110.6 67.6 104.6" fill="none" stroke="#f1c766" strokeWidth="2" strokeLinecap="round" />
        <circle cx="40" cy="92" r=".9" fill="#f6d98a" opacity=".8" /><circle cx="56" cy="86" r=".8" fill="#f6d98a" opacity=".7" /><circle cx="49" cy="99" r=".7" fill="#f6d98a" opacity=".6" /><circle cx="45" cy="78" r=".6" fill="#f6d98a" opacity=".6" />
        {/* sağ kol */}
        <path d="M56 46.5 C60.5 52 61.5 60 59.5 67" fill="none" stroke="#2d318a" strokeWidth="4.6" strokeLinecap="round" />
        <circle cx="59.3" cy="69.4" r="2.5" fill="#ffe3cc" />
        {/* gövde */}
        <path d="M39 45 C38.4 51 40 57 41.5 62 L54.5 62 C56 57 57.6 51 57 45 Q48 41.5 39 45 Z" fill="#30359a" />
        <path d="M41.3 61.5 L54.7 61.5" stroke="#f1c766" strokeWidth="2.4" strokeLinecap="round" />
        {/* boyun + yaka */}
        <path d="M45.6 37 L45.6 45 Q48 47.5 50.4 45 L50.4 37 Z" fill="#ffd9bf" />
        <path d="M42 43.4 L48 50 L54 43.4 L51 42.6 L48 46 L45 42.6 Z" fill="#fbf7ff" />
        <path transform="translate(48 53.5) scale(.62)" d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2Z" fill="#f6c453" />
        {/* sol kol (asayı tutan) */}
        <path d="M40 46.5 C33 50 25 52 17 52.5" fill="none" stroke="#2d318a" strokeWidth="4.6" strokeLinecap="round" />
        <circle cx="14.5" cy="52.5" r="2.8" fill="#ffe3cc" />
        {/* yüz */}
        <path d="M34.5 24 C34.5 35 41 41.5 48 41.5 C55 41.5 61.5 35 61.5 24 C61.5 12 34.5 12 34.5 24 Z" fill="url(#mcSkin)" />
        <ellipse cx="38.6" cy="33.2" rx="2.8" ry="1.5" fill="#ff9db3" opacity=".4" /><ellipse cx="57.4" cy="33.2" rx="2.8" ry="1.5" fill="#ff9db3" opacity=".4" />
        <g className="mc-eo">
          {[42, 54].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="28.6" rx="2.7" ry="3.3" fill="url(#mcEye)" />
              <path d={`M${x - 3.6} 27 Q${x} 23.6 ${x + 3.6} 27`} fill="none" stroke="#231a55" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx={x - 0.9} cy="27.3" r="1" fill="#fff" />
            </g>
          ))}
        </g>
        <g className="mc-ec" fill="none" stroke="#231a55" strokeWidth="1.4" strokeLinecap="round">
          <path d="M38.6 29.4 Q42 26 45.4 29.4" /><path d="M50.6 29.4 Q54 26 57.4 29.4" />
        </g>
        <path className="mc-m mc-m0" d="M45.8 35.4 Q48 37.2 50.2 35.4" fill="none" stroke="#b5475d" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse className="mc-m mc-m1" cx="48" cy="36" rx="1.9" ry="1.4" fill="#8a2440" />
        <g className="mc-m mc-m2"><ellipse cx="48" cy="36.4" rx="2.4" ry="2.5" fill="#8a2440" /><ellipse cx="48" cy="37.7" rx="1.5" ry="1" fill="#ff8fa6" /></g>
        {/* ön saç */}
        <path d="M33 31 C28 12 38 5 48 5 C58 5 68 12 63 31 C62.4 26 60.8 21.5 58.4 18.5 C56.5 22 52 24.2 47.4 24.6 C48.8 22.6 49.2 20.4 48.8 18.4 C45.2 22 40.6 24.4 36.2 25 C34.6 26.6 33.6 28.6 33 31 Z" fill="url(#mcHair)" />
        <path d="M33.4 25 C29.6 37 30.4 51 33.6 60 C36.4 51 36.6 37 36.2 25 Z" fill="url(#mcHair)" />
        <path d="M62.6 25 C66.4 37 65.6 51 62.4 60 C59.6 51 59.4 37 59.8 24 Z" fill="url(#mcHair)" />
        <path d="M39 11.5 Q48 7.5 56 10.5" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
        {/* hilal toka */}
        <path transform="translate(14 1.5) scale(.6)" d="M73 17 A8 8 0 1 0 78.5 30 A6.3 6.3 0 1 1 73 17 Z" fill="#f6c453" stroke="#c98f26" strokeWidth=".8" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Asa ve sihirli iz: el → (ışıkla gösterilen parça). Hedef yoksa asa havada bekler. */
export function Wand({ root, hand, aim }: { root: RefObject<HTMLElement>; hand: RefObject<HTMLElement>; aim: boolean }) {
  const [p, setP] = useState({ hx: 0, hy: 0, tx: 0, ty: 0, on: false });
  const cur = useRef({ tx: 0, ty: 0, hx: 0, hy: 0, init: false });
  const aimRef = useRef(aim); aimRef.current = aim;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const rootEl = root.current, handEl = hand.current;
      if (rootEl && handEl) {
        const r = rootEl.getBoundingClientRect(), h = handEl.getBoundingClientRect();
        const hx = h.left - r.left + HAND.x, hy = h.top - r.top + HAND.y;
        let gx = hx - 26, gy = hy - 70, on = false;
        if (aimRef.current) {
          let best = Infinity;
          rootEl.querySelectorAll<HTMLElement>(".gs-stage .lit").forEach((el) => {
            const b = el.getBoundingClientRect();
            const x = clamp(hx, b.left - r.left, b.right - r.left), y = clamp(hy, b.top - r.top, b.bottom - r.top);
            const d = Math.hypot(x - hx, y - hy);
            if (d < best) { best = d; gx = x; gy = y; on = true; }
          });
        }
        const c = cur.current;
        if (!c.init) { c.tx = gx; c.ty = gy; c.init = true; }
        c.tx += (gx - c.tx) * 0.2; c.ty += (gy - c.ty) * 0.2;
        if (Math.abs(c.tx - p.tx) > 0.4 || Math.abs(c.ty - p.ty) > 0.4 || Math.abs(hx - c.hx) > 0.4 || Math.abs(hy - c.hy) > 0.4 || on !== p.on) {
          c.hx = hx; c.hy = hy;
          setP({ hx, hy, tx: c.tx, ty: c.ty, on });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dx = p.tx - p.hx, dy = p.ty - p.hy, dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist, L = Math.min(34, dist);
  const wx = p.hx + ux * L, wy = p.hy + uy * L;
  return (
    <svg className="gs-wand" aria-hidden="true">
      {p.on && dist > 46 && <line className="gs-trail" x1={wx} y1={wy} x2={p.tx} y2={p.ty} />}
      <line x1={p.hx} y1={p.hy} x2={wx} y2={wy} stroke="#3a2610" strokeWidth="6" strokeLinecap="round" />
      <line x1={p.hx} y1={p.hy} x2={wx} y2={wy} stroke="#e9c46a" strokeWidth="3" strokeLinecap="round" />
      <path className="gs-wstar" transform={`translate(${wx} ${wy})`} d="M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6Z" />
      {p.on && <circle className="gs-ring" cx={p.tx} cy={p.ty} r="11" />}
    </svg>
  );
}
