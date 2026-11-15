import { useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";

/* Köşedeki Celeste: durum çubuğunun arkasından başını uzatır, arada bir kısa bir şey söyler.
   Tıklanınca rehberi yeniden açar. FPS modunda ve rehber açıkken görünmez. */
const ANY = [
  "Derin nefes al, sıradaki raunt senin.",
  "Nişangâh kafa hizasında, gerisi gelir.",
  "Su içmeyi unutma.",
  "Kaybettiysen takılma, sıradaki maça bak.",
  "Takımına bir \"iyi oyunlar\" yaz, fark eder.",
  "Bugün formundasın, hissediyorum.",
  "Bana tıklarsan rehberi yeniden açarım.",
];
const BY_PHASE: Record<string, string[]> = {
  offline: ["Valorant'ı açınca lobini göstereceğim.", "Ben buradayım, oyunu bekliyorum."],
  menu: ["Sıraya girince herkesi senin için çıkarırım.", "Hazır mısın? Ben hazırım."],
  pregame: ["Ajanını seç, ben rakiplere bakıyorum.", "İyi bir kadro gibi duruyor."],
  ingame: ["İyi oyunlar! Sakin kal, tek tek al.", "Sen oyna, gerisi bende."],
};
const SHOW_MS = 6500, FIRST_MS = 5000, GAP_MS = [70000, 130000];

export function Buddy({ phase, onGuide }: { phase: string; onGuide: () => void }) {
  const [line, setLine] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const last = useRef("");

  useEffect(() => {
    let t = 0, stop = false;
    const say = () => {
      if (stop) return;
      const pool = [...(BY_PHASE[phaseRef.current] ?? []), ...ANY].filter((l) => l !== last.current);
      const l = pool[Math.floor(Math.random() * pool.length)];
      last.current = l; setLine(l);
      t = window.setTimeout(() => { setLine(null); t = window.setTimeout(say, GAP_MS[0] + Math.random() * (GAP_MS[1] - GAP_MS[0])); }, SHOW_MS);
    };
    t = window.setTimeout(say, FIRST_MS);
    return () => { stop = true; clearTimeout(t); };
  }, []);

  // Konuşurken ağız oynar
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!line) { el.dataset.mouth = "0"; return; }
    const seq = [1, 2, 1, 0, 2, 1, 0], t0 = Date.now();
    const id = window.setInterval(() => { el.dataset.mouth = Date.now() - t0 > 2400 ? "0" : String(seq[Math.floor((Date.now() - t0) / 130) % seq.length]); }, 130);
    return () => clearInterval(id);
  }, [line]);

  return (
    <div className="buddy-anchor">
      <button className={`buddy${line ? " talk" : ""}`} type="button" onClick={onGuide} aria-label="Celeste: rehberi aç">
        <span className="buddy-bub" role="status">{line ?? "Rehberi aç"}</span>
        <span className="buddy-win"><Mascot ref={ref} /></span>
      </button>
    </div>
  );
}
