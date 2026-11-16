import type React from "react";
import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { markAt, nextLastMark, SPIKE_SECONDS, spikePhase, spikePhaseOf } from "./timerStore";
import type { SpikeState } from "./spikeWindow";

/* Oyunun üstündeki spike şeridi. Sayaç yokken tamamen boş ve saydamdır; fare tıklamaları hep oyuna geçer. */
const BOOM_MS = 2500;

export function SpikeStrip() {
  const [st, setSt] = useState<SpikeState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Tarayıcı önizlemesi (Tauri yok): görünümü denemek için örnek bir sayaç gösterilir.
    if (!("__TAURI_INTERNALS__" in window)) { setSt({ endsAt: Date.now() + 9000, done: false }); return; }
    getCurrentWindow().setIgnoreCursorEvents(true).catch(() => undefined);
    const un = listen<SpikeState | null>("spike-state", (e) => setSt(e.payload));
    void un.then(() => emit("spike-ready"));
    return () => { void un.then((f) => f()); };
  }, []);
  useEffect(() => {
    if (!st) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [st]);

  if (!st) return null;
  const left = Math.max(0, st.endsAt - now) / 1000;
  const boom = st.done || left <= 0;
  if (boom && now - st.endsAt > BOOM_MS) return null;
  const ph = spikePhase(left * 1000);
  return (
    <div className={`sps ph-${boom ? "boom" : ph.id}`}>
      <b className="sps-n">{boom ? "0.0" : left.toFixed(1)}</b>
      <div className="sps-r">
        <span className="sps-l">{boom ? "Patladı" : (() => { const n = nextLastMark(left); return n && n.in <= 4 ? `Son an ${n.kind === "full" ? "(tek)" : "(yarım)"}: ${n.in.toFixed(1)} sn` : ph.label; })()}</span>
        <div className="sps-bar">
          {Array.from({ length: SPIKE_SECONDS }, (_, k) => {
            const sec = SPIKE_SECONDS - k;
            const m = markAt(sec);
            return <i key={k} className={`z-${spikePhaseOf(sec - 0.01)}${left <= sec - 1 ? " gone" : ""}${m ? " mk" : ""}`} style={m ? ({ "--at": `${m.at}%` } as React.CSSProperties) : undefined} />;
          })}
        </div>
      </div>
    </div>
  );
}
