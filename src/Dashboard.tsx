import { useMemo, useState } from "react";
import type { Assets } from "./assets";
import { agentArt, lookup } from "./assets";
import type { MyMatch, Rank } from "./types";
import { queueName } from "./queues";
import { tierColor } from "./LoadoutPanel";
import { AgentIcon, Ring } from "./ui";

/* Profilim → İstatistik ana ekranı. Her sayı Riot'un verdiği son maçlardan hesaplanır;
   kariyer toplamı (toplam saat, tüm zamanların kill'i) yerel bağlantıdan gelmediği için gösterilmez. */

interface Props {
  matches: MyMatch[];
  rank: Rank;
  assets: Assets;
  onCard: (m: MyMatch) => void;
}

interface Agg { n: number; w: number; k: number; d: number; a: number; acs: number }
const agg = (ms: MyMatch[]): Agg =>
  ms.reduce((t, m) => ({ n: t.n + 1, w: t.w + (m.won ? 1 : 0), k: t.k + m.kills, d: t.d + m.deaths, a: t.a + m.assists, acs: t.acs + m.acs }), { n: 0, w: 0, k: 0, d: 0, a: 0, acs: 0 });
const kd = (t: Agg) => (t.d ? t.k / t.d : t.k);
const pct = (t: Agg) => (t.n ? Math.round((100 * t.w) / t.n) : 0);
const num = (n: number) => n.toLocaleString("tr-TR");

const DAY = 86_400_000;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function dayLabel(ms: number): string {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (ms >= start.getTime()) return "Bugün";
  if (ms >= start.getTime() - DAY) return "Dün";
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const LIST_MIN = 7;

export function Dashboard({ matches, rank, assets, onCard }: Props) {
  // Mod sekmeleri: yalnızca son maçlarda bulunan modlar, en çok oynanan başta.
  const modes = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of matches) c.set(m.queue, (c.get(m.queue) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([q]) => q);
  }, [matches]);
  const [mode, setMode] = useState<string>(() => (modes.includes("competitive") ? "competitive" : "all"));
  const [more, setMore] = useState(false);
  const ms = useMemo(() => (mode === "all" ? matches : matches.filter((m) => m.queue === mode)), [matches, mode]);

  const all = agg(ms);
  const agents = useMemo(() => {
    const by = new Map<string, MyMatch[]>();
    for (const m of ms) { const id = lookup(m.agentId); by.set(id, [...(by.get(id) ?? []), m]); }
    return [...by.entries()].map(([id, list]) => ({ id, list, t: agg(list) })).sort((a, b) => b.t.n - a.t.n || pct(b.t) - pct(a.t));
  }, [ms]);
  const top = agents[0];
  const topInfo = top ? assets.agents.get(top.id) : undefined;
  // Baş ajanın en iyi haritası: en az 2 maç, sonra kazanma oranı.
  const bestMap = useMemo(() => {
    if (!top) return null;
    const by = new Map<string, MyMatch[]>();
    for (const m of top.list) { const id = lookup(m.mapId); by.set(id, [...(by.get(id) ?? []), m]); }
    const rows = [...by.entries()].map(([id, l]) => ({ id, t: agg(l) })).filter((r) => r.t.n >= 2).sort((a, b) => pct(b.t) - pct(a.t) || b.t.n - a.t.n);
    return rows[0] ? { name: assets.maps.get(rows[0].id) ?? "?", t: rows[0].t } : null;
  }, [top, assets]);

  const rr = ms.reduce((x, m) => x + (m.rrDelta ?? 0), 0);
  const hasRr = ms.some((m) => m.rrDelta != null);
  const most = ms.reduce((x, m) => Math.max(x, m.kills), 0);
  const cur = assets.tiers.get(rank.current);
  const peak = assets.tiers.get(rank.peak);
  const ranked = rank.current > 0 && cur;

  const shown = more ? ms : ms.slice(0, LIST_MIN);
  const groups: { day: string; list: MyMatch[] }[] = [];
  for (const m of shown) {
    const day = dayLabel(m.started);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.list.push(m); else groups.push({ day, list: [m] });
  }

  return (
    <div className="dashw">
      <div className="modes" role="tablist" aria-label="Oyun modu">
        {[...modes, "all"].map((q) => (
          <button key={q} type="button" role="tab" aria-selected={mode === q} className={mode === q ? "on" : ""} onClick={() => { setMode(q); setMore(false); }}>
            {q === "all" ? "Tümü" : queueName(q, true)}
          </button>
        ))}
        <span className="mscope">Son {ms.length} maç</span>
      </div>

      {ms.length === 0 ? <p className="d none">Bu modda maç yok.</p> : (
        <div className="dash">
          {/* En çok oynanan ajan */}
          {top && (
            <section className="dc dhero" style={{ "--ac": "var(--accent)" } as React.CSSProperties}>
              {agentArt(topInfo) && <img className={`hport${topInfo?.mastery ? " mast" : ""}`} src={agentArt(topInfo)} alt="" loading="lazy" />}
              <div className="hx">
                <span className="dk">En çok oynadığın ajan</span>
                <h3 className="hname">{topInfo?.name ?? "?"}</h3>
                <span className="hsub">{top.t.n} maç · {top.t.w} galibiyet{topInfo?.role ? ` · ${topInfo.role}` : ""}</span>
                <hr />
                <div className="hstats">
                  <div><small>Kazanma</small><b>%{pct(top.t)}</b></div>
                  <div><small>K/D</small><b>{kd(top.t).toFixed(2)}</b></div>
                  <div><small>Ort. ACS</small><b>{Math.round(top.t.acs / top.t.n)}</b></div>
                </div>
                <div className="hstats sm">
                  <div><small>Ort. K / Ö / A</small><b>{(top.t.k / top.t.n).toFixed(1)} / {(top.t.d / top.t.n).toFixed(1)} / {(top.t.a / top.t.n).toFixed(1)}</b></div>
                  {bestMap && <div><small>En iyi haritan</small><b>{bestMap.name} <em>%{pct(bestMap.t)}</em></b></div>}
                </div>
              </div>
            </section>
          )}

          {/* Diğer iki ajan */}
          <div className="dside">
            {agents.slice(1, 3).map((a) => {
              const info = assets.agents.get(a.id);
              return (
                <section className="dc dmini" key={a.id}>
                  {agentArt(info) && <img className={`mport${info?.mastery ? " mast" : ""}`} src={agentArt(info)} alt="" loading="lazy" />}
                  <div className="dmx">
                    <h4>{info?.name ?? "?"}</h4>
                    <small>Kazanma</small>
                    <b>%{pct(a.t)}</b>
                    <small className="dmn">{a.t.n} maç · K/D {kd(a.t).toFixed(2)}</small>
                  </div>
                </section>
              );
            })}
            {agents.length < 2 && <section className="dc dmini dempty"><small>Başka ajanla maç yok</small></section>}
          </div>

          {/* Genel bakış */}
          <section className="dc ov2">
            <div className="dh"><h3>Genel bakış</h3><span>{mode === "all" ? "Tüm modlar" : queueName(mode)}</span></div>
            <div className="ovtop">
              <Ring pct={pct(all)} value={`%${pct(all)}`} label="Kazanma" />
              <div className="wl">
                <span className="wlw"><b>{all.w}</b> galibiyet</span>
                <span className="wll"><b>{all.n - all.w}</b> mağlubiyet</span>
              </div>
            </div>
            <div className="tiles">
              <div><small>Kill</small><b>{num(all.k)}</b></div>
              <div><small>Ölüm</small><b>{num(all.d)}</b></div>
              <div><small>Asist</small><b>{num(all.a)}</b></div>
              <div><small>K/D</small><b>{kd(all).toFixed(2)}</b></div>
              <div><small>Ort. ACS</small><b>{Math.round(all.acs / all.n)}</b></div>
              <div><small>{hasRr ? "Net RR" : "En çok kill"}</small><b className={hasRr ? (rr >= 0 ? "pos" : "neg") : ""}>{hasRr ? `${rr > 0 ? "+" : ""}${rr}` : most}</b></div>
            </div>
          </section>

          {/* Rank */}
          <section className="dc rankc" style={ranked ? ({ "--tc": tierColor(cur!.color) } as React.CSSProperties) : undefined}>
            <span className="dk">Derece</span>
            {ranked ? <img src={cur!.icon} alt="" /> : <i className="tier0 dbig" />}
            <b>{ranked ? cur!.name : "Derecesiz"}</b>
            {ranked && (
              <>
                <span className="rrbar" title={`${rank.rr} / 100 RR`}><i style={{ width: `${Math.min(100, rank.rr)}%` }} /></span>
                <small>{rank.rr} RR</small>
              </>
            )}
            {peak && rank.peak > 0 && <small className="pk">Peak <span style={{ color: tierColor(peak.color) }}>{peak.name}</span></small>}
          </section>

          {/* Son maçlar */}
          <section className="dc last">
            <div className="dh"><h3>Son maçlar</h3>{ms.length > LIST_MIN && <button type="button" className="dlnk" onClick={() => setMore((v) => !v)}>{more ? "Daha az" : `Tümü (${ms.length})`}</button>}</div>
            <div className="lgs">
              {groups.map((g) => (
                <div className="lg" key={g.day}>
                  <span className="lday"><i />{g.day}</span>
                  {g.list.map((m) => {
                    const ag = assets.agents.get(lookup(m.agentId));
                    const art = assets.mapBanner.get(lookup(m.mapId));
                    const t = m.tierAfter ? assets.tiers.get(m.tierAfter) : undefined;
                    return (
                      <button type="button" key={m.matchId} className={m.won ? "lm lw" : "lm ll"} onClick={() => onCard(m)} title={`${queueName(m.queue)} · maç kartını aç`}
                        style={art ? ({ "--art": `url(${art})` } as React.CSSProperties) : undefined}>
                        <AgentIcon icon={ag?.icon ?? ""} name={ag?.name ?? "?"} className="lai" />
                        <span className="lmap"><b>{assets.maps.get(lookup(m.mapId)) ?? "?"}</b>{m.score ? <em><i className="s1">{m.score[0]}</i> : <i className="s2">{m.score[1]}</i></em> : <em>{m.won ? "Galibiyet" : "Mağlubiyet"}</em>}</span>
                        <span className="lkda"><small>K / Ö / A</small><b>{m.kills} / {m.deaths} / {m.assists}</b></span>
                        <span className="lend">
                          {t ? <img src={t.icon} alt={t.name} title={t.name} /> : null}
                          {m.rrDelta != null && <small className={m.rrDelta >= 0 ? "pos" : "neg"}>{m.rrDelta > 0 ? "+" : ""}{m.rrDelta}</small>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
