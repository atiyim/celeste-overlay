import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { tierColor } from "./LoadoutPanel";
import { trackerUrl } from "./profile";
import { TAGS, type Seen, type TagId } from "./seen";
import type { MatchReport, ReportPlayer } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;
const NOT_READY = "Maç kaydı henüz hazır değil.";
const QUEUE: Record<string, string> = {
  competitive: "Rekabetçi", unrated: "Derecesiz", swiftplay: "Hızlı oyun", premier: "Premier",
  spikerush: "Spike Rush", deathmatch: "Ölüm maçı", hurm: "Takım ölüm maçı",
};

const acs = (p: ReportPlayer) => (p.rounds ? Math.round(p.score / p.rounds) : 0);
const clock = (ms: number) => (ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "");

interface ReportProps {
  assets: Assets;
  matchId: string | null;
  seen: Seen;
  onTag: (puuid: string, tag: TagId | null) => void;
  onOpen: (url: string) => void;
  onClose: () => void;
}

export function ReportPanel({ assets, matchId, seen, onTag, onOpen, onClose }: ReportProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [rep, setRep] = useState<MatchReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  const load = useCallback(async () => {
    if (!matchId) return;
    if (!inTauri) { setErr("Maç raporu yalnızca masaüstü uygulamasında çalışır."); return; }
    try { setRep(await invoke<MatchReport>("get_match_report", { matchId })); setErr(null); }
    catch (e) { setErr(String(e)); setTries((t) => t + 1); }
  }, [matchId]);

  useEffect(() => { setRep(null); setErr(null); setTries(0); setOpenId(null); load(); }, [matchId, load]);

  // Maç kaydı bitişten birkaç saniye sonra hazır olur; hazır olana dek 8 saniyede bir denenir.
  useEffect(() => {
    if (rep || err !== NOT_READY || tries > 15) return;
    const t = window.setTimeout(load, 8000);
    return () => window.clearTimeout(t);
  }, [rep, err, tries, load]);

  const head = (sub: string, right?: React.ReactNode) => (
    <div className="ph">
      <div><h2 className="t">Maç raporu</h2><p className="m">{sub}</p></div>
      <div className="phr">{right}<button className="x" type="button" onClick={onClose}>Kapat</button></div>
    </div>
  );

  if (!matchId) {
    return <div className="panel fade">{head("Bu oturumda henüz maç oynanmadı. Maç bitince rapor kendiliğinden açılır.")}</div>;
  }
  if (!rep) {
    return (
      <div className="panel fade">
        {head(
          err === NOT_READY ? "Maç kaydı hazırlanıyor, birkaç saniye içinde gelecek." : err ?? "Yükleniyor…",
          <button className="x" type="button" onClick={() => { setTries(0); load(); }}>Yenile</button>,
        )}
      </div>
    );
  }

  const myTeam = rep.players.find((p) => p.isSelf)?.team ?? rep.players[0]?.team;
  const top = Math.max(...rep.players.map(acs));
  const teams = [myTeam, ...rep.teams.map((t) => t.teamId).filter((t) => t !== myTeam)]
    .map((id) => ({ id, info: rep.teams.find((t) => t.teamId === id), list: rep.players.filter((p) => p.team === id).sort((a, b) => acs(b) - acs(a)) }))
    .filter((t) => t.list.length);
  const mine = teams[0]?.info;
  const agentOf = (id: string) => {
    const q = rep.players.find((x) => x.puuid === id);
    return q ? assets.agents.get(lookup(q.agentId))?.name ?? "?" : "?";
  };
  const duel = (list: { puuid: string; count: number }[]) => (list[0] ? <>{agentOf(list[0].puuid)} <b>×{list[0].count}</b></> : <span className="d">–</span>);

  return (
    <div className="panel fade">
      {head(
        [assets.maps.get(lookup(rep.mapId)), QUEUE[rep.queue.toLowerCase()] ?? rep.queue, clock(rep.started)].filter(Boolean).join(" · "),
        <span className="score">
          <b className={mine?.won ? "pos" : "neg"}>{teams[0]?.info?.roundsWon ?? "?"}</b>
          <span className="d"> – </span>
          <b className={mine?.won ? "neg" : "pos"}>{teams[1]?.info?.roundsWon ?? "?"}</b>
          <span className={mine?.won ? "bd pos" : "bd neg"}>{mine?.won ? "Zafer" : "Yenilgi"}</span>
        </span>,
      )}
      {teams.map((t, ti) => (
        <section key={t.id} className="rteam">
          <div className="rg c">
            <div className="tm"><i className={t.info?.won ? "tbar pos" : "tbar neg"} />{ti === 0 ? "Takımın" : "Rakipler"}</div>
            <div className="num" title="Rank">Rank</div>
            <div className="num" title="Round başına ortalama skor">ACS</div>
            <div className="num">K / D / A</div>
            <div className="num">K/D</div>
            <div className="num" title="Kafa isabeti">HS</div>
            <div className="num" title="Round başına hasar">ADR</div>
            <div className="num" title="İlk kan / ilk ölüm">İlk kan</div>
            <div title="En çok öldürdüğü rakip">En çok öldürdüğü</div>
            <div title="Onu en çok öldüren rakip">Onu en çok öldüren</div>
          </div>
          {t.list.map((p) => {
            const ag = assets.agents.get(lookup(p.agentId));
            const tier = assets.tiers.get(p.tier);
            const shots = p.headshots + p.bodyshots + p.legshots;
            const a = acs(p);
            const tag = TAGS.find((x) => x.id === seen[p.puuid]?.tag);
            const url = p.hidden ? null : trackerUrl(p.name);
            const open = openId === p.puuid;
            return (
              <div className="rwrap" key={p.puuid}>
                <div
                  className={`${p.isSelf ? "rg rr me" : "rg rr"} click${open ? " open" : ""}`}
                  role="button" tabIndex={0} aria-expanded={open}
                  title={p.isSelf ? undefined : "Etiket koymak ve profiline gitmek için tıkla"}
                  onClick={() => !p.isSelf && setOpenId(open ? null : p.puuid)}
                  onKeyDown={(e) => { if (!p.isSelf && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpenId(open ? null : p.puuid); } }}
                >
                  <div className="who2">
                    {ag && <img className="agent" src={ag.icon} alt={ag.name} />}
                    <span className="n pn">{p.name ?? (p.hidden ? "İsim gizli" : "…")}</span>
                    {tag && <span className="tg" style={{ color: tag.color, borderColor: tag.color }}>{tag.label}</span>}
                    {p.party && <span className="p mini" title="Maçta aynı partideydi">{p.party}</span>}
                    {a === top && <span className="bd gold mvp">MVP</span>}
                  </div>
                  <div className="num">{tier && p.tier > 0 ? <img className="rk" src={tier.icon} alt={tier.name} title={tier.name} style={{ filter: `drop-shadow(0 0 4px ${tierColor(tier.color)}55)` }} /> : <span className="d">–</span>}</div>
                  <div className="num"><b>{a}</b></div>
                  <div className="num">{p.kills} / {p.deaths} / {p.assists}</div>
                  <div className="num">{(p.deaths ? p.kills / p.deaths : p.kills).toFixed(2)}</div>
                  <div className="num">{shots ? `%${Math.round((100 * p.headshots) / shots)}` : "–"}</div>
                  <div className="num">{p.rounds ? Math.round(p.damage / p.rounds) : "–"}</div>
                  <div className="num"><span className="teal">{p.firstKills}</span> / <span className="loss">{p.firstDeaths}</span></div>
                  <div className="pair">{duel(p.killed)}</div>
                  <div className="pair">{duel(p.killedBy)}</div>
                </div>
                {open && (
                  <div className="ract fade">
                    <span className="tagrow" title="Etiketler yalnızca bu bilgisayarda saklanır. İsim gizli olsa da aynı oyuncuyu sonraki maçta tanır.">
                      {TAGS.map((x) => (
                        <button
                          key={x.id} type="button" className={seen[p.puuid]?.tag === x.id ? "tg on" : "tg"}
                          style={{ color: x.color, borderColor: x.color }} aria-pressed={seen[p.puuid]?.tag === x.id}
                          onClick={() => onTag(p.puuid, seen[p.puuid]?.tag === x.id ? null : x.id)}
                        >{x.label}</button>
                      ))}
                    </span>
                    {url
                      ? <button type="button" className="trk" title="Tracker.gg'de aç" onClick={() => onOpen(url)}>Tracker'da aç</button>
                      : <span className="d">{p.hidden ? "İsmi gizli, profil bağlantısı yok" : "Profil bağlantısı için isim gerekli"}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
