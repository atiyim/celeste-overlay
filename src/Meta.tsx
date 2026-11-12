import { useEffect, useMemo, useState } from "react";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { AgentIcon, PanelHead } from "./ui";

/* Meta: ajanların tier'ı ve haritalara göre performansı. Veri public/agent-tiers.json dosyasındadır;
   yama, kaynak ve tarih ekranda yazar. Tier her rolün kendi içinde verilir (kaynak böyle yayınlar).
   Haritada az maçı olan ajanın oranı gürültülüdür, bu yüzden en az MIN_MATCHES maç şartı aranır. */
interface AgentRow { a: string; role: string; tier: string; wr: number; pr: number; maps: Record<string, [number, number, number]> }
interface Data { patch: string; source: string; updated: string; mode: string; agents: AgentRow[] }

const MIN_MATCHES = 300;
const TIERS = ["S", "A", "B", "C", "D", "F"];
const ROLES: [string, string][] = [["Duelist", "Düellocu"], ["Initiator", "Öncü"], ["Controller", "Kontrolcü"], ["Sentinel", "Gözcü"]];
const up = (s: string) => s.toLocaleUpperCase("en");
const norm = (s: string) => s.toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
type Tab = "tier" | "map" | "agent";

interface Props { assets: Assets | null; currentMapId?: string | null; onClose: () => void }

export function Meta({ assets, currentMapId, onClose }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("tier");
  const [role, setRole] = useState<string>("all");

  useEffect(() => {
    fetch("/agent-tiers.json", { cache: "no-cache" }).then((r) => r.json()).then(setData).catch(() => setFailed(true));
  }, []);

  // Verisi olan haritalar (dosyadaki adlarla). Haritası dosyada olmayan hiç gösterilmez.
  const dataMaps = useMemo(() => {
    const s = new Set<string>();
    data?.agents.forEach((a) => Object.keys(a.maps).forEach((m) => s.add(m)));
    return [...s].sort();
  }, [data]);
  const curName = currentMapId && assets ? assets.maps.get(lookup(currentMapId)) : undefined;
  const curData = curName ? dataMaps.find((m) => norm(m) === norm(curName)) : undefined;
  const [map, setMap] = useState<string | null>(null);
  const mapSel = map ?? curData ?? dataMaps[0] ?? "";
  const [agentSel, setAgentSel] = useState<string>("");

  const mapArt = (name: string) => {
    if (!assets) return "";
    for (const [u, n] of assets.maps) if (norm(n) === norm(name)) return assets.mapArt.get(u) ?? "";
    return "";
  };
  const icon = (n: string) => [...(assets?.agents.values() ?? [])].find((x) => norm(x.name) === norm(n))?.icon;

  if (failed || !data) {
    return (
      <div className="panel" role="dialog" aria-label="Meta"><PanelHead title="Meta" onClose={onClose} />
        <p className="d none">{failed ? "Tier verisi okunamadı." : "Yükleniyor…"}</p></div>
    );
  }

  const tile = (a: AgentRow, sub: string, accent?: string) => (
    <span className="mt2" key={a.a} title={`${up(a.a)} · %${a.wr} kazanma · %${a.pr} seçilme`} style={accent ? ({ "--ac": accent } as React.CSSProperties) : undefined}>
      <AgentIcon icon={icon(a.a)} name={a.a} />
      <b>{up(a.a)}</b>
      <small>{sub}</small>
    </span>
  );

  const byMap = dataMaps.length && mapSel
    ? data.agents.map((a) => ({ a, m: a.maps[mapSel] })).filter((x) => x.m && x.m[0] >= MIN_MATCHES && (role === "all" || x.a.role === role)).sort((x, y) => y.m[1] - x.m[1])
    : [];
  const agent = data.agents.find((a) => a.a === (agentSel || data.agents[0].a))!;
  const byAgent = Object.entries(agent.maps).filter(([, m]) => m[0] >= MIN_MATCHES).sort((x, y) => y[1][1] - x[1][1]);

  return (
    <div className="panel" role="dialog" aria-label="Meta">
      <PanelHead title="Meta" sub={`Yama ${data.patch} · ${data.source} · ${data.updated}. ${data.mode}.`} onClose={onClose} />

      <div className="seg metam" role="tablist" aria-label="Görünüm">
        {([["tier", "Tier listesi"], ["map", "Haritada en iyiler"], ["agent", "Ajana göre haritalar"]] as [Tab, string][]).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "x on" : "x"} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === "tier" && (
        <>
          <p className="note-s">Tier'lar her rolün kendi içinde verilir; farklı roldeki ajanları doğrudan kıyaslama.</p>
          <div className="rgrid">
            {ROLES.map(([id, label]) => (
              <section className="rcard" key={id}>
                <h3>{label}</h3>
                {TIERS.filter((t) => data.agents.some((a) => a.role === id && a.tier === t)).map((t) => (
                  <div className={`trow t${t}`} key={t}>
                    <i>{t}</i>
                    <span className="tgrid">
                      {data.agents.filter((a) => a.role === id && a.tier === t).sort((x, y) => y.wr - x.wr).map((a) => tile(a, `%${a.wr}`))}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      )}

      {tab === "map" && (
        <>
          <div className="seg metam" role="tablist" aria-label="Harita">
            {dataMaps.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mapSel === m} className={mapSel === m ? "x on" : "x"} onClick={() => setMap(m)}>
                {up(m)}{curData === m ? " · MAÇIN" : ""}
              </button>
            ))}
          </div>
          <div className="seg metam" role="tablist" aria-label="Rol">
            <button type="button" className={role === "all" ? "x on" : "x"} onClick={() => setRole("all")}>Tüm roller</button>
            {ROLES.map(([id, l]) => <button key={id} type="button" className={role === id ? "x on" : "x"} onClick={() => setRole(id)}>{l}</button>)}
          </div>
          <div className="mapban" key={mapSel} style={{ backgroundImage: mapArt(mapSel) ? `url(${mapArt(mapSel)})` : undefined }}>
            <span>{up(mapSel)}</span>
          </div>
          <div className="box pad mapres" key={`r-${mapSel}`}>
            {byMap.length === 0 && <p className="d none">Bu harita için yeterli maç verisi yok.</p>}
            {byMap.map(({ a, m }, i) => <MapLine key={a.a} n={i + 1} name={up(a.a)} icon={icon(a.a) ?? ""} wr={m[1]} matches={m[0]} pr={m[2]} />)}
            <small className="tsrc">Haritada en az {MIN_MATCHES} maçı olan ajanlar gösterilir; azı gürültülü olur. Kazanma oranı %50'nin üstü iyi, altı zayıf demektir.</small>
          </div>
        </>
      )}

      {tab === "agent" && (
        <>
          <div className="agpick">
            <div className="agsum">
              <AgentIcon icon={icon(agent.a)} name={agent.a} />
              <span><b>{up(agent.a)}</b><small>Tier {agent.tier} · %{agent.wr} kazanma · %{agent.pr} seçilme</small></span>
            </div>
            {ROLES.map(([id, l]) => (
              <div className="agrole" key={id}>
                <span className="agrl">{l}</span>
                <div className="agrid" role="listbox" aria-label={l}>
                  {data.agents.filter((a) => a.role === id).map((a) => (
                    <button key={a.a} type="button" role="option" aria-selected={a.a === agent.a} title={up(a.a)}
                      className={a.a === agent.a ? "agb on" : "agb"} onClick={() => setAgentSel(a.a)}>
                      <AgentIcon icon={icon(a.a)} name={a.a} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="box pad">
            {byAgent.length === 0 && <p className="d none">Yeterli maç verisi yok.</p>}
            {byAgent.map(([name, m], i) => <MapLine key={name} n={i + 1} name={up(name)} icon={null} wr={m[1]} matches={m[0]} pr={m[2]} />)}
            <small className="tsrc">En az {MIN_MATCHES} maç olan haritalar gösterilir.</small>
          </div>
        </>
      )}
    </div>
  );
}

/** Tek satır: sıra, ad, kazanma çubuğu (%40–60 arası ölçeklenir), maç sayısı. */
function MapLine({ n, name, icon, wr, matches, pr }: { n: number; name: string; icon: string | null; wr: number; matches: number; pr: number }) {
  const pct = Math.max(0, Math.min(100, ((wr - 40) / 20) * 100));
  const tone = wr >= 52 ? "good" : wr < 49 ? "bad" : "mid";
  return (
    <div className={`mline ${tone}`} title={`${matches.toLocaleString("tr")} maç · %${pr} seçilme`}>
      <em>{n}</em>
      {icon !== null ? <AgentIcon icon={icon} name={name} className="mlic" /> : <span />}
      <b>{name}</b>
      <i className="mbar"><i style={{ width: `${pct}%` }} /></i>
      <strong>%{wr}</strong>
      <small>{matches.toLocaleString("tr")} maç</small>
    </div>
  );
}
