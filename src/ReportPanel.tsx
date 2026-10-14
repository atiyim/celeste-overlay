import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { MatchReport, ReportPlayer } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;
const NOT_READY = "Maç kaydı henüz hazır değil.";

const acs = (p: ReportPlayer) => (p.rounds ? Math.round(p.score / p.rounds) : 0);

export function ReportPanel({ assets, matchId, onClose }: { assets: Assets; matchId: string | null; onClose: () => void }) {
  const [rep, setRep] = useState<MatchReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  const load = useCallback(async () => {
    if (!matchId) return;
    if (!inTauri) { setErr("Maç raporu yalnızca masaüstü uygulamasında çalışır."); return; }
    try { setRep(await invoke<MatchReport>("get_match_report", { matchId })); setErr(null); }
    catch (e) { setErr(String(e)); setTries((t) => t + 1); }
  }, [matchId]);

  useEffect(() => { setRep(null); setErr(null); setTries(0); load(); }, [matchId, load]);

  // Maç kaydı bitişten sonra birkaç saniye gecikmeyle hazır olur: hazır olana dek tekrar dene.
  useEffect(() => {
    if (rep || err !== NOT_READY || tries > 15) return;
    const t = window.setTimeout(load, 8000);
    return () => window.clearTimeout(t);
  }, [rep, err, tries, load]);

  if (!matchId) {
    return (
      <div className="panel">
        <div className="ph"><div><h2 className="t">Son maç</h2><p className="m">Henüz bu oturumda bir maç görülmedi. Maç bitince rapor kendiliğinden açılır.</p></div><button className="x" type="button" onClick={onClose}>Kapat</button></div>
      </div>
    );
  }

  const myTeam = rep?.players.find((p) => p.isSelf)?.team ?? rep?.players[0]?.team;
  const top = rep ? Math.max(...rep.players.map(acs)) : 0;
  const nameOf = (p: ReportPlayer) =>
    p.name ?? (p.hidden ? "Oyuncu (isim gizli)" : "…");
  const labelFor = (id: string) => {
    const q = rep?.players.find((x) => x.puuid === id);
    return q ? assets.agents.get(lookup(q.agentId))?.name ?? "?" : "?";
  };

  const teams = rep
    ? [myTeam, ...rep.teams.map((t) => t.teamId).filter((t) => t !== myTeam)]
        .map((id) => ({ id, info: rep.teams.find((t) => t.teamId === id), list: rep.players.filter((p) => p.team === id).sort((a, b) => acs(b) - acs(a)) }))
        .filter((t) => t.list.length)
    : [];

  return (
    <div className="panel" role="dialog" aria-label="Maç raporu">
      <div className="ph">
        <div>
          <h2 className="t">Maç raporu{rep ? ` · ${assets.maps.get(lookup(rep.mapId)) ?? ""}` : ""}</h2>
          <p className="m">
            {rep
              ? `${teams.map((t) => t.info?.roundsWon ?? "?").join(" – ")} · ${teams[0]?.info?.won ? "Kazandın" : teams[0]?.info?.won === false ? "Kaybettin" : ""}`
              : err === NOT_READY ? "Maç kaydı hazırlanıyor, birkaç saniye içinde gelecek…" : err ?? "Yükleniyor…"}
          </p>
        </div>
        <span className="zoom">
          <button type="button" onClick={() => { setTries(0); load(); }}>Yenile</button>
          <button type="button" onClick={onClose}>Kapat</button>
        </span>
      </div>
      {rep && teams.map((t, ti) => (
        <section key={t.id}>
          <p className="s">{ti === 0 ? "Takımın" : "Rakipler"} · {t.info?.roundsWon ?? "?"} round {t.info?.won ? "· kazandı" : ""}</p>
          <div className="rg c">
            <div>Oyuncu</div><div>Rank</div><div>ACS</div><div>K/D/A</div><div>K/D</div><div>HS%</div><div>ADR</div><div>İK/İÖ</div><div>En çok öldürdü</div><div>En çok ölen</div>
          </div>
          {t.list.map((p) => {
            const ag = assets.agents.get(lookup(p.agentId));
            const tier = assets.tiers.get(p.tier);
            const shots = p.headshots + p.bodyshots + p.legshots;
            const a = acs(p);
            return (
              <div className={p.isSelf ? "rg rr me" : "rg rr"} key={p.puuid}>
                <div className="who2">
                  {ag && <img className="agent" src={ag.icon} alt={ag.name} />}
                  <span className="n">{nameOf(p)}{a === top && <span className="bd info">MVP</span>}</span>
                </div>
                <div className="tier">{tier && p.tier > 0 ? <img src={tier.icon} alt={tier.name} title={tier.name} /> : <span className="d">–</span>}</div>
                <div><b>{a}</b></div>
                <div>{p.kills}/{p.deaths}/{p.assists}</div>
                <div>{(p.deaths ? p.kills / p.deaths : p.kills).toFixed(2)}</div>
                <div>{shots ? `%${Math.round((100 * p.headshots) / shots)}` : "–"}</div>
                <div>{p.rounds ? Math.round(p.damage / p.rounds) : "–"}</div>
                <div>{p.firstKills}/{p.firstDeaths}</div>
                <div className="pair">{p.killed[0] ? `${labelFor(p.killed[0].puuid)} ×${p.killed[0].count}` : "–"}</div>
                <div className="pair">{p.killedBy[0] ? `${labelFor(p.killedBy[0].puuid)} ×${p.killedBy[0].count}` : "–"}</div>
              </div>
            );
          })}
        </section>
      ))}
      {rep && <p className="mode">ACS = round başına skor · İK/İÖ = ilk kan / ilk ölüm · "En çok" sütunları o oyuncunun en çok hangi rakibi öldürdüğünü / kimden en çok öldüğünü gösterir.</p>}
    </div>
  );
}
