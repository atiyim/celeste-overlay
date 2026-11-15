import { useEffect, useState } from "react";
import { PanelHead } from "./ui";
import { setStripOn, stripOn } from "./spikeWindow";
import { accelFromEvent, addTimer, clock, DEFUSE_FULL, DEFUSE_HALF, parseDuration, removeTimer, restartTimer, setSound, setSpikeKey, SPIKE_NAME, SPIKE_SECONDS, soundOn, spikePhase, spikePhaseOf, startSpike, stopSpike, useSpikeKey, useTimers, type Timer } from "./timerStore";

const PRESETS = [["30 sn", 30], ["45 sn", 45], ["1 dk", 60], ["2 dk", 120]] as const;

/* Spike göstergesi: her çizgi bir saniye. Geçenler söner, kalanlar aşamasının rengini alır.
   7 sn: tam çözme sınırı. 3,5 sn: yarım çözme sınırı. */
function SpikeGauge({ t }: { t: Timer }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (t.done) return; const id = window.setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, [t.done, t.endsAt]);
  const left = t.done ? 0 : Math.max(0, t.endsAt - now) / 1000;
  const ph = spikePhase(left * 1000);
  return (
    <div className={`spg ph-${t.done ? "boom" : ph.id}`} role="timer" aria-label={`Spike: ${Math.ceil(left)} saniye, ${ph.label}`}>
      <div className="spg-top">
        <b className="spg-n">{t.done ? "0.0" : left.toFixed(1)}<small>sn</small></b>
        <span className="spg-st"><b>{t.done ? "Patladı" : ph.label}</b><small>{t.done ? "Yeni raunt için tuşa yeniden bas." : ph.hint}</small></span>
      </div>
      <div className="spg-bar">
        {Array.from({ length: SPIKE_SECONDS }, (_, k) => {
          const sec = SPIKE_SECONDS - k; // bu çizginin temsil ettiği kalan saniye
          const gone = left <= sec - 1, cur = !gone && left < sec;
          return <i key={k} className={`z-${spikePhaseOf(sec - 0.01)}${gone ? " gone" : ""}${cur ? " cur" : ""}`} />;
        })}
      </div>
      <div className="spg-marks">
        <span className="z-half"><i />Son {DEFUSE_FULL} sn: yalnızca yarım çözülmüşse</span>
        <span className="z-dead"><i />Son {String(DEFUSE_HALF).replace(".", ",")} sn: çözülmez</span>
      </div>
    </div>
  );
}

export function Timers({ onClose }: { onClose: () => void }) {
  const [strip, setStrip] = useState(stripOn);
  const list = useTimers();
  const [name, setName] = useState("");
  const [dur, setDur] = useState("");
  const [sound, setSnd] = useState(soundOn);
  const spikeKey = useSpikeKey();
  const [capture, setCapture] = useState(false);
  const secs = parseDuration(dur);

  // "Tuş ata": basılan sonraki tuş kısayol olur. Esc vazgeçer.
  useEffect(() => {
    if (!capture) return;
    const on = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { setCapture(false); return; }
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      const a = accelFromEvent(e);
      if (a) { setSpikeKey(a); setCapture(false); }
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [capture]);
  const now = Date.now();
  const spike = list.find((t) => t.name === SPIKE_NAME);
  const others = list.filter((t) => t.name !== SPIKE_NAME);

  const add = () => { if (!secs) return; addTimer(name, secs); setDur(""); };

  return (
    <div className="panel" role="dialog" aria-label="Sayaçlar">
      <PanelHead
        title="Sayaçlar"
        sub="Kendi geri sayımların. Oyuna dokunmaz; bitince overlay'de bildirim çıkar."
        actions={<button className={sound ? "x on" : "x"} type="button" aria-pressed={sound} onClick={() => { setSound(!sound); setSnd(!sound); }}>Ses {sound ? "açık" : "kapalı"}</button>}
        onClose={onClose}
      />

      <div className={spike ? "spk live" : "spk"}>
        <div className="spk-row">
        <span className="spi"><b>Spike patlama sayacı</b><small>{SPIKE_SECONDS} saniye. Spike kurulunca tuşa bas ya da Başlat'a tıkla; oyundan otomatik okunmaz. Çizgiler çözmenin hâlâ yetişip yetişmediğini gösterir.</small></span>
        <button className="x go" type="button" onClick={startSpike}>{spike ? "Yeniden" : "Başlat"}</button>
        {spike && <button className="x" type="button" onClick={stopSpike}>Durdur</button>}
        <button className={strip ? "x on" : "x"} type="button" aria-pressed={strip} title="Sayaç çalışırken ekranın üst ortasında küçük bir şerit gösterir. Tıklamalar oyuna geçer." onClick={() => { setStripOn(!strip); setStrip(!strip); }}>Oyun üstü şerit {strip ? "açık" : "kapalı"}</button>
        <span className="spkey">
          <kbd>{capture ? "Bir tuşa bas…" : spikeKey ? spikeKey.replace("Control", "Ctrl") : "Atanmadı"}</kbd>
          <button className={capture ? "x on" : "x"} type="button" onClick={() => setCapture((c) => !c)}>{capture ? "Vazgeç" : "Tuş ata"}</button>
          {spikeKey && !capture && <button className="x" type="button" onClick={() => setSpikeKey("")}>Kaldır</button>}
        </span>
        </div>
        {spike && <SpikeGauge t={spike} />}
      </div>

      <div className="note">
        <input className="short" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Ad (ör. Ult)" aria-label="Sayaç adı" />
        <input className="short" value={dur} onChange={(e) => setDur(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); e.stopPropagation(); }} placeholder="1:30 ya da 90" aria-label="Süre" />
        <button className="x go" type="button" onClick={add} disabled={!secs}>Başlat</button>
        <span className="presets">
          {PRESETS.map(([label, s]) => <button key={label} className="x" type="button" onClick={() => addTimer(name, s)}>{label}</button>)}
        </span>
      </div>

      <h2 className="h">Çalışanlar<span className="hv">{others.length} sayaç</span></h2>
      <div className="box pad">
        {others.length === 0 && <p className="d none">Çalışan sayaç yok. Süre yazıp Başlat'a bas ya da hazır süreyi seç.</p>}
        {others.map((t) => {
          const left = t.done ? 0 : t.endsAt - now;
          return (
            <div className={t.done ? "tmr done" : "tmr"} key={t.id}>
              <span className="tn">{t.name}</span>
              <b className="tt">{t.done ? "Bitti" : clock(left)}</b>
              <i className="tmbar"><i style={{ width: `${t.done ? 100 : Math.max(0, 100 - (100 * left) / t.total)}%` }} /></i>
              <button className="x" type="button" onClick={() => restartTimer(t.id)}>Yeniden</button>
              <button className="x" type="button" onClick={() => removeTimer(t.id)} aria-label="Sayacı sil">Sil</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
