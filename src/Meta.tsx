import { useEffect, useMemo, useState } from "react";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { AgentIcon, PanelHead } from "./ui";

/* Harita metası: her haritada ajanların tier'ı. Veri public/agent-tiers.json dosyasından okunur.
   Dosyada yama numarası, kaynak ve tarih yazar; veri olmayan harita için uydurma sıralama gösterilmez.
   Biçim: { patch, source, updated, maps: { "<harita adı>": { "S": ["Clove"], "A": [...], "B": [], "C": [], "D": [] } } } */
type Tiers = Record<string, string[]>;
interface Data { patch: string | null; source: string | null; updated: string | null; maps: Record<string, Tiers> }
const ORDER = ["S", "A", "B", "C", "D"];
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]/g, "");

interface Props { assets: Assets | null; currentMapId?: string | null; onClose: () => void }

export function Meta({ assets, currentMapId, onClose }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const maps = assets?.mapList ?? [];
  const curKey = currentMapId ? lookup(currentMapId) : null;
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    fetch("/agent-tiers.json", { cache: "no-cache" }).then((r) => r.json()).then(setData).catch(() => setFailed(true));
  }, []);

  const active = maps.find((m) => lookup(m.key) === (pick ?? curKey)) ?? maps[0];
  const tiers = useMemo(() => {
    if (!data || !active) return null;
    const hit = Object.entries(data.maps).find(([k]) => norm(k) === norm(active.name));
    return hit ? hit[1] : null;
  }, [data, active]);

  const agentByName = (n: string) => [...(assets?.agents.values() ?? [])].find((a) => norm(a.name) === norm(n));

  return (
    <div className="panel" role="dialog" aria-label="Harita metası">
      <PanelHead title="Harita metası" sub="Seçili haritada ajanların güncel yamaya göre tier'ı." onClose={onClose} />
      <div className="seg metam" role="tablist" aria-label="Harita">
        {maps.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={active === m} className={active === m ? "x on" : "x"} onClick={() => setPick(lookup(m.key))}>
            {m.name}{curKey && lookup(m.key) === curKey ? " · maçın" : ""}
          </button>
        ))}
      </div>

      {failed || !data ? <p className="d none">{failed ? "Tier verisi okunamadı." : "Yükleniyor…"}</p> : !tiers ? (
        <p className="d none">{data.patch ? `${active?.name ?? "Bu harita"} için tier verisi yok.` : "Tier verisi henüz eklenmedi. Güncel yamanın harita verisi eklenince burada görünür."}</p>
      ) : (
        <div className="box pad">
          {ORDER.filter((t) => tiers[t]?.length).map((t) => (
            <div className={`tierr t${t}`} key={t}>
              <b>{t}</b>
              <span className="tl">
                {tiers[t].map((n) => { const a = agentByName(n); return <span className="ta" key={n} title={n}><AgentIcon icon={a?.icon} name={a?.name ?? n} /><small>{a?.name ?? n}</small></span>; })}
              </span>
            </div>
          ))}
          <small className="tsrc">Yama {data.patch ?? "?"} · {data.source ?? "kaynak yok"}{data.updated ? ` · ${data.updated}` : ""}</small>
        </div>
      )}
    </div>
  );
}
