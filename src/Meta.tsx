import { useEffect, useMemo, useState } from "react";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { AgentIcon, PanelHead } from "./ui";

/* Harita metası: ajanların tier'ı. Veri public/agent-tiers.json dosyasından okunur.
   "all": tüm haritalar için genel sıralama. "maps": varsa haritaya özel sıralama (harita adı → aynı biçim).
   Haritaya özel veri yoksa genel sıralama gösterilir ve ekranda böyle yazılır; sıralama uydurulmaz.
   Not: tier her rol içinde kendi ajanlarına göre verilmiştir (kaynak rol başına ayrı liste yayınlar). */
interface Entry { a: string; wr?: number; pr?: number }
type Tiers = Record<string, Entry[]>;
interface Data { patch: string | null; source: string | null; updated: string | null; all?: Tiers; maps: Record<string, Tiers> }
const ORDER = ["S", "A", "B", "C", "D", "F"];
const ALL = "__all";
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]/g, "");

interface Props { assets: Assets | null; currentMapId?: string | null; onClose: () => void }

export function Meta({ assets, currentMapId, onClose }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const maps = assets?.mapList ?? [];
  const curKey = currentMapId ? lookup(currentMapId) : null;
  const [pick, setPick] = useState<string>(curKey ?? ALL);

  useEffect(() => {
    fetch("/agent-tiers.json", { cache: "no-cache" }).then((r) => r.json()).then(setData).catch(() => setFailed(true));
  }, []);

  const active = pick === ALL ? null : maps.find((m) => lookup(m.key) === pick) ?? null;
  const own = useMemo(() => {
    if (!data || !active) return null;
    const hit = Object.entries(data.maps ?? {}).find(([k]) => norm(k) === norm(active.name));
    return hit ? hit[1] : null;
  }, [data, active]);
  const tiers = own ?? data?.all ?? null;

  const agentByName = (n: string) => [...(assets?.agents.values() ?? [])].find((a) => norm(a.name) === norm(n));

  return (
    <div className="panel" role="dialog" aria-label="Harita metası">
      <PanelHead title="Harita metası" sub="Ajanların güncel verideki tier'ı. Kaynak her rolü kendi içinde sıraladığı için tier'lar rol içinde geçerlidir." onClose={onClose} />
      <div className="seg metam" role="tablist" aria-label="Harita">
        <button type="button" role="tab" aria-selected={!active} className={!active ? "x on" : "x"} onClick={() => setPick(ALL)}>Tüm haritalar</button>
        {maps.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={active === m} className={active === m ? "x on" : "x"} onClick={() => setPick(lookup(m.key))}>
            {m.name}{curKey && lookup(m.key) === curKey ? " · maçın" : ""}
          </button>
        ))}
      </div>

      {failed || !data ? <p className="d none">{failed ? "Tier verisi okunamadı." : "Yükleniyor…"}</p> : !tiers ? (
        <p className="d none">Tier verisi henüz eklenmedi.</p>
      ) : (
        <>
          {active && !own && <p className="note-s">{active.name} için ayrı veri yok. Aşağıdaki sıralama tüm haritaları kapsar.</p>}
          <div className="box pad">
            {ORDER.filter((t) => tiers[t]?.length).map((t) => (
              <div className={`tierr t${t}`} key={t}>
                <b>{t}</b>
                <span className="tl">
                  {tiers[t].map((e) => {
                    const a = agentByName(e.a);
                    return (
                      <span className="ta" key={e.a} title={`${e.a}${e.wr != null ? ` · %${e.wr} kazanma` : ""}${e.pr != null ? ` · %${e.pr} seçilme` : ""}`}>
                        <AgentIcon icon={a?.icon} name={a?.name ?? e.a} />
                        <span className="tn2"><span>{a?.name ?? e.a}</span>{e.wr != null && <small>%{e.wr}</small>}</span>
                      </span>
                    );
                  })}
                </span>
              </div>
            ))}
            <small className="tsrc">{data.source ?? "kaynak yok"}{data.patch ? ` · Yama ${data.patch}` : ""}{data.updated ? ` · ${data.updated}` : ""}</small>
          </div>
        </>
      )}
    </div>
  );
}
