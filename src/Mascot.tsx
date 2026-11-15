import { forwardRef, useEffect, useRef, useState, type RefObject } from "react";

/* Celeste: küçük ay perisi (vektör çizim, dosya yok).
   Ağzı konuşmanın sesine göre açılıp kapanır, göz kırpar, sevinince zıplar, elindeki asayla ekranı gösterir. */
/** Elin karakter kutusu içindeki yeri (piksel) */
export const HAND = { x: 11, y: 79 };

export const Mascot = forwardRef<HTMLDivElement, { cheer?: boolean }>(function Mascot({ cheer }, ref) {
  return (
    <div ref={ref} className={`mascot${cheer ? " cheer" : ""}`} data-mouth="0" aria-hidden="true">
      <svg viewBox="0 0 96 116" width="96" height="116">
        <defs>
          <linearGradient id="mcHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f0ff" /><stop offset="1" stopColor="#b3a8ee" /></linearGradient>
          <linearGradient id="mcHairB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9aef0" /><stop offset="1" stopColor="#8478d2" /></linearGradient>
          <linearGradient id="mcDress" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3f9c" /><stop offset="1" stopColor="#1c1e52" /></linearGradient>
          <linearGradient id="mcEye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#231a55" /><stop offset=".55" stopColor="#5a3fb8" /><stop offset="1" stopColor="#f3c05e" /></linearGradient>
          <radialGradient id="mcSkin" cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#fff1e4" /><stop offset="1" stopColor="#ffd9bf" /></radialGradient>
        </defs>
        <ellipse cx="48" cy="111.5" rx="22" ry="3.2" fill="#000" opacity=".32" />
        {/* arka saç */}
        <path d="M15 44 C8 66 9 88 19 98 C25 93 28 85 30 76 L66 76 C68 85 71 93 77 98 C87 88 88 66 81 44 Z" fill="url(#mcHairB)" />
        {/* ayaklar */}
        <ellipse cx="41" cy="107" rx="6" ry="3.6" fill="#15173d" /><ellipse cx="55" cy="107" rx="6" ry="3.6" fill="#15173d" />
        {/* sağ kol */}
        <path d="M59 76 C66 78 69 84 69 90" fill="none" stroke="#2d318a" strokeWidth="7" strokeLinecap="round" />
        <circle cx="69" cy="92" r="3.6" fill="#ffe3cc" />
        {/* elbise */}
        <path d="M37 71 C32 83 27 95 26 102 Q48 109 70 102 C69 95 64 83 59 71 Z" fill="url(#mcDress)" />
        <path d="M26.3 100.5 Q48 107.5 69.7 100.5" fill="none" stroke="#f1c766" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="38" cy="92" r="1" fill="#f6d98a" opacity=".8" /><circle cx="57" cy="88" r=".8" fill="#f6d98a" opacity=".7" /><circle cx="50" cy="97" r=".7" fill="#f6d98a" opacity=".6" />
        {/* sol kol (asayı tutan) */}
        <path d="M38 76 C28 76 20 78 13 79" fill="none" stroke="#2d318a" strokeWidth="7" strokeLinecap="round" />
        <circle cx="11" cy="79" r="4" fill="#ffe3cc" />
        {/* yaka + yıldız */}
        <path d="M38 71 Q48 79 58 71 L56 68 Q48 73 40 68 Z" fill="#fbf7ff" />
        <path transform="translate(48 76)" d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2Z" fill="#f6c453" />
        {/* yüz */}
        <ellipse cx="48" cy="45" rx="30" ry="27" fill="url(#mcSkin)" />
        <ellipse cx="27" cy="58" rx="5.2" ry="3" fill="#ff9db3" opacity=".55" /><ellipse cx="69" cy="58" rx="5.2" ry="3" fill="#ff9db3" opacity=".55" />
        <g className="mc-eo">
          {[36, 60].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="50" rx="6.2" ry="8" fill="url(#mcEye)" />
              <path d={`M${x - 7} 46.5 Q${x} 39.5 ${x + 7} 46.5`} fill="none" stroke="#231a55" strokeWidth="2" strokeLinecap="round" />
              <circle cx={x - 2.2} cy="46.6" r="2.5" fill="#fff" /><circle cx={x + 2.6} cy="53.6" r="1.2" fill="#fff" opacity=".9" />
            </g>
          ))}
        </g>
        <g className="mc-ec" fill="none" stroke="#231a55" strokeWidth="2.2" strokeLinecap="round">
          <path d="M29.5 52 Q36 45 42.5 52" /><path d="M53.5 52 Q60 45 66.5 52" />
        </g>
        <path className="mc-m mc-m0" d="M44.6 60.5 Q48 63.6 51.4 60.5" fill="none" stroke="#b5475d" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse className="mc-m mc-m1" cx="48" cy="61.6" rx="3" ry="2.4" fill="#8a2440" />
        <g className="mc-m mc-m2"><ellipse cx="48" cy="62.4" rx="4.2" ry="4.3" fill="#8a2440" /><ellipse cx="48" cy="64.6" rx="2.6" ry="1.7" fill="#ff8fa6" /></g>
        {/* ön saç */}
        <path d="M16 50 C11 22 29 8 48 8 C67 8 85 22 80 50 C78.5 42 76 35 72 30 C70 35 65 38.5 59 39 C60.5 36 60.5 32.5 59.5 29.5 C54 35 46 38.5 38 39 C39.5 36 40 33 39.5 30 C34.5 35 28.5 38 22.5 38.5 C19.5 41.5 17.5 45.5 16 50 Z" fill="url(#mcHair)" />
        <path d="M17 42 C13 53 15 64 20 71 C23.5 64 23.5 53 22.5 43 Z" fill="url(#mcHair)" />
        <path d="M79 42 C83 53 81 64 76 71 C72.5 64 72.5 53 73.5 40 Z" fill="url(#mcHair)" />
        <path d="M47 9 C44 2 51 -1 56 3 C52 3.4 50 6 50.5 9.5 Z" fill="#e6e0ff" />
        <path d="M27 21 Q45 11.5 62 17" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
        {/* hilal toka */}
        <path d="M73 17 A8 8 0 1 0 78.5 30 A6.3 6.3 0 1 1 73 17 Z" fill="#f6c453" stroke="#c98f26" strokeWidth=".8" strokeLinejoin="round" />
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
