import { useState } from "react";
import { PanelHead } from "./ui";
import { addTimer, clock, parseDuration, removeTimer, restartTimer, setSound, soundOn, useTimers } from "./timerStore";

const PRESETS = [["30 sn", 30], ["45 sn", 45], ["1 dk", 60], ["2 dk", 120]] as const;

export function Timers({ onClose }: { onClose: () => void }) {
  const list = useTimers();
  const [name, setName] = useState("");
  const [dur, setDur] = useState("");
  const [sound, setSnd] = useState(soundOn);
  const secs = parseDuration(dur);
  const now = Date.now();

  const add = () => { if (!secs) return; addTimer(name, secs); setDur(""); };

  return (
    <div className="panel" role="dialog" aria-label="Sayaçlar">
      <PanelHead
        title="Sayaçlar"
        sub="Kendi geri sayımların. Oyuna dokunmaz; bitince overlay'de bildirim çıkar."
        actions={<button className={sound ? "x on" : "x"} type="button" aria-pressed={sound} onClick={() => { setSound(!sound); setSnd(!sound); }}>Ses {sound ? "açık" : "kapalı"}</button>}
        onClose={onClose}
      />

      <div className="note">
        <input className="short" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Ad (ör. Ult)" aria-label="Sayaç adı" />
        <input className="short" value={dur} onChange={(e) => setDur(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); e.stopPropagation(); }} placeholder="1:30 ya da 90" aria-label="Süre" />
        <button className="x go" type="button" onClick={add} disabled={!secs}>Başlat</button>
        <span className="presets">
          {PRESETS.map(([label, s]) => <button key={label} className="x" type="button" onClick={() => addTimer(name, s)}>{label}</button>)}
        </span>
      </div>

      <h2 className="h">Çalışanlar<span className="hv">{list.length} sayaç</span></h2>
      <div className="box pad">
        {list.length === 0 && <p className="d none">Çalışan sayaç yok. Süre yazıp Başlat'a bas ya da hazır süreyi seç.</p>}
        {list.map((t) => {
          const left = t.done ? 0 : t.endsAt - now;
          return (
            <div className={t.done ? "tmr done" : "tmr"} key={t.id}>
              <span className="tn">{t.name}</span>
              <b className="tt">{t.done ? "Bitti" : clock(left)}</b>
              <i className="tb"><i style={{ width: `${t.done ? 100 : Math.max(0, 100 - (100 * left) / t.total)}%` }} /></i>
              <button className="x" type="button" onClick={() => restartTimer(t.id)}>Yeniden</button>
              <button className="x" type="button" onClick={() => removeTimer(t.id)} aria-label="Sayacı sil">Sil</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
