import { useState } from "react";
import type { Assets } from "./assets";
import { GOAL_MAX_TIER, goalEta, points } from "./insights";
import { tierColor } from "./LoadoutPanel";

/* Act hedefi: hedef rankı ve seçildiği andaki puanı yalnızca bu bilgisayarda saklar. */
const KEY = "overlay-goal";
interface Saved { target: number; from: number }

function load(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    return v && typeof v.target === "number" && typeof v.from === "number" ? v : null;
  } catch { return null; }
}
function save(v: Saved) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* depolama kapalı */ } }

export function Goal({ assets, tier, rr, deltas }: { assets: Assets; tier: number; rr: number; deltas: number[] }) {
  const now = points(tier, rr);
  const [g, setG] = useState<Saved | null>(load);

  // Hedef yoksa ya da ulaşıldıysa bir sonraki rank önerilir (kaydedilmez, seçince kaydedilir).
  const reached = !!g && g.target <= tier;
  const target = g && !reached ? g.target : Math.min(tier + 1, GOAL_MAX_TIER);
  const from = g && !reached ? Math.min(g.from, now) : points(tier, 0);

  if (tier < 3) return null;
  if (tier >= GOAL_MAX_TIER) {
    return (
      <div className="goal box pad">
        <div className="glh"><b>Act hedefi</b></div>
        <p className="d">Ölümsüzlük ve üstünde rank sınırları bölgedeki sıralamaya göre değiştiği için hedef hesaplanmıyor.</p>
      </div>
    );
  }

  const eta = goalEta(tier, rr, target, deltas);
  const t = assets.tiers.get(target);
  const span = Math.max(1, points(target, 0) - from);
  const pct = Math.max(0, Math.min(100, Math.round((100 * (now - from)) / span)));
  const options = Array.from({ length: GOAL_MAX_TIER - tier }, (_, i) => tier + 1 + i).filter((x) => assets.tiers.get(x)?.name);

  return (
    <div className="goal box pad">
      <div className="glh">
        <b>Act hedefi</b>
        <select className="sel" value={target} aria-label="Hedef rank" onChange={(e) => { const v = { target: Number(e.target.value), from: now }; save(v); setG(v); }}>
          {options.map((x) => <option key={x} value={x}>{assets.tiers.get(x)!.name}</option>)}
        </select>
      </div>
      <div className="glm">
        {t && <img src={t.icon} alt="" />}
        <div className="glt">
          <span><b style={{ color: t ? tierColor(t.color) : undefined }}>{t?.name ?? "Hedef"}</b> için <b>{eta?.left ?? "?"} RR</b> kaldı</span>
          <div className="gbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          <small className="d">
            {eta?.wins != null
              ? <>Galibiyet başına ortalaman ile yaklaşık <b>{eta.wins} galibiyet</b>{eta.games != null ? <>, kazanma oranınla (%{Math.round(eta.wr * 100)}) yaklaşık <b>{eta.games} maç</b></> : <>. Şu anki kazanma oranınla (%{Math.round(eta.wr * 100)}) RR toplamın artmıyor</>}. Tahmini, son rekabet maçlarından.</>
              : "Tahmin için son maçlarında en az 3 galibiyet ve 3 mağlubiyet gerekiyor."}
          </small>
        </div>
      </div>
    </div>
  );
}
