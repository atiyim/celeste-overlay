import { useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";
import { AFTER_MATCH, contextLines, nextLine, type Line } from "./buddyLines";
import type { Snapshot } from "./types";
import type { ToolId } from "./toolTips";

/* Köşedeki Celeste: durum çubuğunun arkasından başını uzatır, arada bir kısa bir şey söyler.
   Maça göre konuşur, yüz ifadesi cümleye uyar. Tıklanınca rehberi yeniden açar. FPS modunda ve rehber açıkken görünmez. */
const SHOW_MS = 6500, FIRST_MS = 5000, PHASE_MS = 2500, GAP_MS = [70000, 130000];

export function Buddy({ snap, onGuide, onOpen }: { snap: Snapshot; onGuide: () => void; onOpen: (tool: ToolId) => void }) {
  const [line, setLine] = useState<Line | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const snapRef = useRef(snap); snapRef.current = snap;
  const last = useRef("");
  const timer = useRef(0);
  const prevPhase = useRef(snap.phase);

  const schedule = (ms: number, make: () => Line) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const l = make();
      last.current = l.text; setLine(l);
      timer.current = window.setTimeout(() => {
        setLine(null);
        schedule(GAP_MS[0] + Math.random() * (GAP_MS[1] - GAP_MS[0]), () => nextLine(snapRef.current, last.current));
      }, SHOW_MS);
    }, ms);
  };

  useEffect(() => {
    schedule(FIRST_MS, () => nextLine(snapRef.current, last.current));
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aşama değişince (maç bulundu, maç bitti) duruma özel bir cümle
  useEffect(() => {
    const from = prevPhase.current; prevPhase.current = snap.phase;
    if (from === snap.phase) return;
    if (from === "ingame" && snap.phase === "menu") schedule(PHASE_MS, () => AFTER_MATCH[Math.floor(Math.random() * AFTER_MATCH.length)]);
    else if (snap.phase === "pregame" || snap.phase === "ingame") schedule(PHASE_MS + 2500, () => { const c = contextLines(snapRef.current); return c[0] ?? nextLine(snapRef.current, last.current); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase]);

  // Konuşurken ağız oynar
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!line) { el.dataset.mouth = "0"; return; }
    const seq = [1, 2, 1, 0, 2, 1, 0], t0 = Date.now();
    const id = window.setInterval(() => { el.dataset.mouth = Date.now() - t0 > 2400 ? "0" : String(seq[Math.floor((Date.now() - t0) / 130) % seq.length]); }, 130);
    return () => { clearInterval(id); el.dataset.mouth = "0"; };
  }, [line]);

  return (
    <div className="buddy-anchor">
      <button className={`buddy${line ? " talk" : ""}`} type="button" data-mood={line?.mood ?? ""} onClick={() => { if (line?.tool) { onOpen(line.tool); setLine(null); } else onGuide(); }} aria-label={line?.tool ? "Celeste: aracı aç" : "Celeste: rehberi aç"}>
        <span className="buddy-bub" role="status">{line?.text ?? "Rehberi aç"}{line?.tool && <b className="buddy-go">Aç</b>}</span>
        <span className="buddy-win"><Mascot ref={ref} mood={line?.mood} /></span>
      </button>
    </div>
  );
}
