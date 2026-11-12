import { useMemo, useState } from "react";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { TAGS, type Seen } from "./seen";
import { PanelHead } from "./ui";

/* Oyuncu arama: Riot, isimden oyuncu bulmaya izin vermez (yalnızca kimlikle sorgulanır).
   Bu yüzden iki şey yapılır: karşılaştığın oyuncular arasında ara, ya da İsim#ETİKET yaz ve Tracker.gg'de aç. */
interface Props { assets: Assets | null; seen: Seen; onOpen: (url: string) => void; onCopy: (text: string, label?: string) => void; onClose: () => void }

const trackerUrl = (n: string) => `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(n)}/overview`;
const norm = (s: string) => s.toLocaleLowerCase("tr").trim();

export function Search({ assets, seen, onOpen, onCopy, onClose }: Props) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return Object.entries(seen).map(([puuid, e]) => {
      const last = e.history[e.history.length - 1];
      const name = [...e.history].reverse().find((h) => h.name)?.name ?? null;
      return { puuid, e, last, name, at: last?.at ?? 0 };
    }).filter((r) => r.name || r.e.label)
      .sort((a, b) => b.at - a.at);
  }, [seen]);

  const t = norm(q);
  const shown = (t ? rows.filter((r) => norm(`${r.name ?? ""} ${r.e.label ?? ""}`).includes(t)) : rows).slice(0, 30);
  const canTracker = q.includes("#") && q.indexOf("#") > 0 && q.indexOf("#") < q.length - 1;
  const when = (at: number) => { if (!at) return ""; const d = Math.floor((Date.now() - at) / 86400000); return d <= 0 ? "bugün" : d === 1 ? "dün" : `${d} gün önce`; };

  return (
    <div className="panel" role="dialog" aria-label="Oyuncu arama">
      <PanelHead title="Oyuncu arama" sub="Karşılaştığın oyuncular arasında ara. Tam bir Riot kimliği yazarsan Tracker.gg'de açabilirsin." onClose={onClose} />
      <div className="note">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="İsim ya da İsim#ETİKET" aria-label="Oyuncu ara" />
        {canTracker && <button className="x go" type="button" onClick={() => onOpen(trackerUrl(q.trim()))}>Tracker.gg'de aç</button>}
      </div>

      <h2 className="h">{t ? "Sonuçlar" : "Son karşılaştıklarım"}<span className="hv">{shown.length} oyuncu</span></h2>
      <div className="box pad">
        {shown.length === 0 && <p className="d none">{rows.length === 0 ? "Henüz kimseyle karşılaşmadın. Maçlara girdikçe oyuncular burada listelenir." : "Eşleşen oyuncu yok."}</p>}
        {shown.map(({ puuid, e, last, name }) => {
          const tag = TAGS.find((x) => x.id === e.tag);
          const agent = last ? assets?.agents.get(lookup(last.agentId))?.name : undefined;
          const map = last?.mapId ? assets?.maps.get(lookup(last.mapId)) : undefined;
          const shownName = name ?? e.label ?? "?";
          return (
            <div className="srow" key={puuid}>
              <span className="sn">
                <b>{shownName}</b>
                <small>
                  {e.n} kez karşılaştın · {when(last?.at ?? 0)}
                  {last ? ` · ${last.side === "ally" ? "takım" : "rakip"}` : ""}
                  {agent ? ` · ${agent}` : ""}{map ? ` · ${map}` : ""}
                  {name && e.label ? ` · notun: ${e.label}` : ""}
                </small>
              </span>
              {tag && <span className="tg" style={{ color: tag.color, borderColor: tag.color }}>{tag.label}</span>}
              <button className="x" type="button" onClick={() => onCopy(shownName, "İsim kopyalandı")}>Kopyala</button>
              {name?.includes("#") && <button className="x" type="button" onClick={() => onOpen(trackerUrl(name))}>Tracker</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
