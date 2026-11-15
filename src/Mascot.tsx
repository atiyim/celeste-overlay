import { forwardRef, useEffect, useMemo, useRef, useState, type RefObject } from "react";

/* Celeste: piksel sanatı küçük ay perisi. Tamamen koddan çizilir (ASCII ızgara → SVG), dosya yok.
   Ağzı konuşmanın sesine göre açılıp kapanır, göz kırpar, sevinince zıplar, elindeki asayla ekranı gösterir. */
const SC = 4;
const PAL: Record<string, string> = {
  o: "#12142e", h: "#2a2f6b", H: "#4a52a8", s: "#ffe0c2", S: "#f0b896", b: "#ff9db3", e: "#1a1d3d", w: "#ffffff",
  g: "#f6c453", G: "#c98f26", c: "#3b43a0", C: "#6a73d8", m: "#c4435a", M: "#5a1426",
};
// Sol yarılar (10 sütun); sağ yarı yansıtılır.
const HALF = [
  "......hhhh", "....hhhHHh", "...hhHHhhh", "..hhHHHhhh", "..hhhhhhhh", ".hhhhhhhhh", ".hhhhhhhhh", ".hhhhsssss",
  ".hhhssssss", ".hhsssssss", ".hhsssssss", ".hhsssssss", ".hhsbbssss", "..hsssssss", "...sssssss", "....sssSSS",
  "..........", "....ccccGG", "...cccccGG", "...ccCCccc", "..cccCCccc", "..cccccccc", ".ccccccccc", ".GGGGGGGGG", "...hhhh...",
];
const mirror = (s: string) => s + [...s].reverse().join("");
const W = 20, H = HALF.length, PAD = 1;

function build() {
  const g: string[][] = HALF.map((r) => [...mirror(r)]);
  const set = (r: number, c: number, v: string) => { g[r][c] = v; };
  // Saç tokası: sağda altın hilal
  set(2, 13, "g"); set(3, 14, "g"); set(4, 14, "g"); set(5, 13, "g");
  // Sol kol (asayı tutan): kol yukarı-sola, el en solda
  set(18, 2, "c"); set(17, 1, "c"); set(17, 2, "c");
  for (const [r, c] of [[15, 0], [15, 1], [16, 0], [16, 1]]) set(r, c, "s");
  // Çerçeve + otomatik kontur
  const P = Array.from({ length: H + PAD * 2 }, (_, r) => Array.from({ length: W + PAD * 2 }, (_, c) => (g[r - PAD]?.[c - PAD] ?? ".")));
  const out = P.map((r) => [...r]);
  for (let r = 0; r < P.length; r++) for (let c = 0; c < P[0].length; c++) {
    if (P[r][c] !== ".") continue;
    if ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([y, x]) => (P[y]?.[x] ?? ".") !== ".")) out[r][c] = "o";
  }
  return out;
}
const runs = (grid: string[][]) => {
  const rects: { x: number; y: number; w: number; f: string }[] = [];
  grid.forEach((row, y) => { let x = 0; while (x < row.length) { const ch = row[x]; if (ch === ".") { x++; continue; } let n = 1; while (row[x + n] === ch) n++; rects.push({ x, y, w: n, f: PAL[ch] }); x += n; } });
  return rects;
};
const cells = (list: [number, number, string][]) => list.map(([r, c, ch]) => ({ x: c + PAD, y: r + PAD, w: 1, f: PAL[ch] }));
const eyeOpen = (c0: number, shineLeft: boolean) => {
  const l: [number, number, string][] = [];
  for (let r = 9; r <= 11; r++) { l.push([r, c0, "e"]); l.push([r, c0 + 1, "e"]); }
  l.push([9, shineLeft ? c0 : c0 + 1, "w"]);
  return l;
};
const EYES_OPEN = cells([...eyeOpen(5, false), ...eyeOpen(13, true)]);
const EYES_SHUT = cells([[10, 5, "e"], [10, 6, "e"], [10, 13, "e"], [10, 14, "e"]]);
const MOUTH = [
  cells([[12, 9, "m"], [12, 10, "m"]]),
  cells([[12, 9, "M"], [12, 10, "M"], [13, 9, "m"], [13, 10, "m"]]),
  cells([[12, 8, "M"], [12, 9, "M"], [12, 10, "M"], [12, 11, "M"], [13, 8, "M"], [13, 9, "m"], [13, 10, "m"], [13, 11, "M"]]),
];
/** Elin sprite içindeki yeri (piksel) */
export const HAND = { x: 2 * SC, y: 17 * SC };

const R = ({ list }: { list: { x: number; y: number; w: number; f: string }[] }) => <>{list.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.f} />)}</>;

export const Mascot = forwardRef<HTMLDivElement, { cheer?: boolean }>(function Mascot({ cheer }, ref) {
  const body = useMemo(() => runs(build()), []);
  return (
    <div ref={ref} className={`mascot${cheer ? " cheer" : ""}`} data-mouth="0" aria-hidden="true">
      <svg viewBox={`0 0 ${W + PAD * 2} ${H + PAD * 2}`} width={(W + PAD * 2) * SC} height={(H + PAD * 2) * SC} shapeRendering="crispEdges">
        <g className="mc-body"><R list={body} /></g>
        <g className="mc-eo"><R list={EYES_OPEN} /></g>
        <g className="mc-ec"><R list={EYES_SHUT} /></g>
        {MOUTH.map((m, i) => <g key={i} className={`mc-m mc-m${i}`}><R list={m} /></g>)}
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
