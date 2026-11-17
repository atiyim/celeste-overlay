import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import type { Assets, MapInfo } from "../assets";
import type { Lineup, Pt } from "./api";

/* İnteraktif harita: küçük harita görseli üstünde lineup'lar.
   Her lineup'ın düştüğü yerde yetenek simgesi durur; seçilince duracağın yer, ajan simgesi ve atış yayı çizilir.
   Tekerlekle yakınlaş, sürükleyerek gez, çift tıkla sıfırla. Düzenleyicide tıklanan nokta bildirilir. */

const V = 1000;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function abilityOf(assets: Assets | null, l: { agent: string; slot: string }) {
  return assets?.agents.get(l.agent)?.abilities?.find((a) => a.slot === l.slot);
}

/** Durma noktasından düşme noktasına kavisli yay (SVG yolu). */
export function arcPath(a: Pt, b: Pt, bend = 0.22) {
  const ax = a.x * V, ay = a.y * V, bx = b.x * V, by = b.y * V;
  const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * len * bend, cy = my + (dx / len) * len * bend;
  return `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

interface Props {
  map: MapInfo;
  assets: Assets | null;
  lineups: Lineup[];
  selected?: string | null;
  hover?: string | null;
  onPick?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Düzenleyici: tıklanan nokta. */
  pick?: "stand" | "land" | null;
  onPoint?: (p: Pt) => void;
  /** Düzenleyicide gösterilecek taslak. */
  draft?: { stand: Pt | null; land: Pt | null; agent: string; slot: string; side: string } | null;
  callouts?: boolean;
  /** Seçilen lineup'a yaklaş. */
  focus?: boolean;
  compact?: boolean;
  /** Öğrenme sınavı: işaretler gizli, tıklanan noktada iğne. */
  quiz?: { pin: Pt | null; answer: Pt | null };
  done?: (id: string) => boolean;
}

export function MapBoard({ map, assets, lineups, selected, hover, onPick, onHover, pick, onPoint, draft, callouts, focus, compact, quiz, done }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const sel = lineups.find((l) => l.id === selected) ?? null;
  const hov = lineups.find((l) => l.id === hover) ?? null;

  // Seçilen lineup'a yumuşakça yaklaş (yay ekranın ortasında kalsın).
  useEffect(() => {
    if (!focus) return;
    if (!sel) { setView({ k: 1, x: 0, y: 0 }); return; }
    const cx = (sel.stand.x + sel.land.x) / 2, cy = (sel.stand.y + sel.land.y) / 2;
    const span = Math.max(Math.abs(sel.stand.x - sel.land.x), Math.abs(sel.stand.y - sel.land.y), 0.12);
    const k = clamp(0.62 / span, 1, 2.6);
    setView({ k, x: clamp(0.5 - cx * k, 1 - k, 0), y: clamp(0.5 - cy * k, 1 - k, 0) });
  }, [focus, sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sahne (harita görseli) yakınlaştırmayla birlikte ölçeklenir: tıklanan nokta doğrudan görsele göre hesaplanır.
  const toLocal = (e: { clientX: number; clientY: number }): Pt | null => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };

  const onWheel = (e: WheelEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    setView((v) => {
      const k = clamp(v.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18), 1, 4);
      const x = clamp(px - ((px - v.x) / v.k) * k, 1 - k, 0), y = clamp(py - ((py - v.y) / v.k) * k, 1 - k, 0);
      return { k, x, y };
    });
  };
  const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; };
  const move = (e: PointerEvent) => {
    const d = drag.current, r = box.current?.getBoundingClientRect();
    if (!d || !r || view.k === 1) return;
    const dx = (e.clientX - d.x) / r.width, dy = (e.clientY - d.y) / r.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.01) d.moved = true;
    setView((v) => ({ ...v, x: clamp(d.vx + dx, 1 - v.k, 0), y: clamp(d.vy + dy, 1 - v.k, 0) }));
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) return;
    if ((pick || quiz) && onPoint) { const p = toLocal(e); if (p) onPoint(p); }
  };

  // Aynı noktaya düşen lineup'lar üst üste binmesin: hafif yelpaze.
  const spread = useMemo(() => {
    const out = new Map<string, Pt>();
    const placed: Pt[] = [];
    for (const l of lineups) {
      let p = { ...l.land };
      for (let i = 0; i < 6 && placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.022); i++) p = { x: l.land.x + Math.cos(i * 2.1) * 0.024, y: l.land.y + Math.sin(i * 2.1) * 0.024 };
      placed.push(p);
      out.set(l.id, p);
    }
    return out;
  }, [lineups]);

  const agentIcon = (id: string) => assets?.agents.get(id)?.icon ?? "";
  const style = { "--k": view.k, transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.k})` } as CSSProperties;
  const active = sel ?? hov;
  const drawArc = (l: { stand: Pt; land: Pt; side: string }, key: string, live: boolean) => (
    <g key={key} className={`lb-arc ${l.side}${live ? " live" : ""}`}>
      <path d={arcPath(l.stand, l.land)} className="lb-arc-glow" />
      <path d={arcPath(l.stand, l.land)} className="lb-arc-line" pathLength={1} />
    </g>
  );

  return (
    <div
      ref={box}
      className={`lb${compact ? " compact" : ""}${pick ? ` picking ${pick}` : ""}${quiz ? " quizzing" : ""}${view.k > 1 ? " zoomed" : ""}`}
      onWheel={onWheel}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={() => { drag.current = null; }}
      onDoubleClick={() => setView({ k: 1, x: 0, y: 0 })}
      role="application"
      aria-label={`${map.name} haritası`}
    >
      <div className="lb-in" style={style}>
        <div className="lb-st" ref={stage}>
        <img className="lb-map" src={map.icon} alt="" draggable={false} />
        <svg className="lb-svg" viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
          <defs>
            <radialGradient id="lbGlow"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          </defs>
          {callouts && map.callouts.map((c) => (
            <text key={`${c.name}${c.x}`} x={c.x * V} y={c.y * V} className="lb-callout">{c.name}</text>
          ))}
          {active && !quiz && drawArc(active, `a-${active.id}`, true)}
          {draft?.stand && draft.land && drawArc({ stand: draft.stand, land: draft.land, side: draft.side }, "draft", true)}
          {quiz?.pin && quiz.answer && <line x1={quiz.pin.x * V} y1={quiz.pin.y * V} x2={quiz.answer.x * V} y2={quiz.answer.y * V} className="lb-miss" />}
        </svg>

        {!quiz && lineups.map((l) => {
          const p = spread.get(l.id) ?? l.land;
          const ab = abilityOf(assets, l);
          const on = l.id === selected, hv = l.id === hover;
          return (
            <button
              key={l.id}
              type="button"
              className={`lb-pin ${l.side}${on ? " on" : ""}${hv ? " hv" : ""}${sel && !on ? " dim" : ""}${done?.(l.id) ? " done" : ""}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => onPick?.(l.id)}
              onMouseEnter={() => onHover?.(l.id)}
              onMouseLeave={() => onHover?.(null)}
              aria-label={l.title}
              aria-pressed={on}
            >
              {ab?.icon ? <img src={ab.icon} alt="" draggable={false} /> : <i />}
              {l.featured && <span className="lb-star" aria-hidden="true" />}
            </button>
          );
        })}

        {active && !quiz && (
          <span key={`s-${active.id}`} className={`lb-stand ${active.side}`} style={{ left: `${active.stand.x * 100}%`, top: `${active.stand.y * 100}%` }}>
            <img src={agentIcon(active.agent)} alt="" draggable={false} />
            <em>Burada dur</em>
          </span>
        )}
        {active && !quiz && <span key={`l-${active.id}`} className={`lb-land ${active.side}`} style={{ left: `${active.land.x * 100}%`, top: `${active.land.y * 100}%` }} />}

        {draft?.stand && (
          <span className={`lb-stand ${draft.side} draft`} style={{ left: `${draft.stand.x * 100}%`, top: `${draft.stand.y * 100}%` }}>
            {draft.agent && <img src={agentIcon(draft.agent)} alt="" draggable={false} />}<em>Duruş</em>
          </span>
        )}
        {draft?.land && (
          <span className={`lb-pin ${draft.side} on fixed`} style={{ left: `${draft.land.x * 100}%`, top: `${draft.land.y * 100}%` }}>
            {abilityOf(assets, draft)?.icon ? <img src={abilityOf(assets, draft)!.icon} alt="" /> : <i />}
          </span>
        )}

        {quiz?.pin && <span className="lb-qpin" style={{ left: `${quiz.pin.x * 100}%`, top: `${quiz.pin.y * 100}%` }} />}
        {quiz?.answer && <span className="lb-land atk reveal" style={{ left: `${quiz.answer.x * 100}%`, top: `${quiz.answer.y * 100}%` }} />}
        </div>
      </div>
      {pick && <span className="lb-hint">{pick === "stand" ? "Duracağın yere tıkla" : "Yeteneğin düşeceği yere tıkla"}</span>}
      {view.k > 1 && !compact && <button type="button" className="lb-reset" onClick={() => setView({ k: 1, x: 0, y: 0 })} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>Sıfırla</button>}
    </div>
  );
}
