import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { hideSpot, spotHidden, unseenTools, type ToolId } from "./toolTips";

/* "Araçları keşfet": maç yokken lobide görünen, henüz açılmamış araçları sırayla tanıtan kart.
   Bütün araçlar bir kez açılınca ya da "Gizle"ye basılınca (7 gün) kaybolur. */
const ROTATE_MS = 9000;

export function ToolSpot({ onOpen }: { onOpen: (id: ToolId) => void }) {
  const [tips] = useState(unseenTools);
  const [hidden, setHidden] = useState(spotHidden);
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold || tips.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % tips.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [hold, tips.length]);
  if (hidden || tips.length === 0) return null;
  const t = tips[i % tips.length];
  return (
    <div className="tspot" role="region" aria-label="Araçları keşfet" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <span className="tspot-ic" key={t.id}><Icon name={t.icon} size={18} /></span>
      <span className="tspot-tx" key={`t${t.id}`}>
        <small>Araçları keşfet · {i % tips.length + 1}/{tips.length}</small>
        <b>{t.title}</b>
        <span>{t.text}</span>
      </span>
      <span className="tspot-dots" aria-hidden="true">{tips.map((x, k) => <i key={x.id} className={k === i % tips.length ? "on" : ""} onClick={() => setI(k)} />)}</span>
      <button className="x go" type="button" onClick={() => onOpen(t.id)}>Dene</button>
      <button className="x" type="button" onClick={() => { hideSpot(); setHidden(true); }} title="7 gün gösterme">Gizle</button>
    </div>
  );
}
