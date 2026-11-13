import type { KeyboardEvent } from "react";
import { tierColor } from "./LoadoutPanel";
import { Roles } from "./RoleBadge";
import { Icon, type IconName } from "./icons";
import { lookup, type Assets } from "./assets";
import { AgentIcon, NameLine } from "./ui";
import { partyColor, playerView } from "./playerView";
import { BadgePill, Moon, type RowProps } from "./PlayerRow";
import { isComp } from "./playstyle";
import type { Player } from "./types";

/* Karşı karşıya düzeni: takımın solda, rakipler sağda ayna gibi; üstte iki takımın karşılaştırması.
   Geniş pencere ister; dar alanda iki takım alt alta geçer. */
export type CellProps = Omit<RowProps, "template" | "blur">;

interface Stat { label: string; left: string; right: string; share: number | null }

/** İki değerin payı (sol tarafın yüzdesi); veri yoksa null. */
const share = (a: number | null, b: number | null) => (a == null || b == null || a + b <= 0 ? null : Math.round((100 * a) / (a + b)));

export function teamNumbers(list: Player[]) {
  const ranked = list.filter((p) => p.rank.current > 0);
  const kds = list.filter((p) => p.kd != null);
  let w = 0, g = 0;
  for (const p of list) { const r = p.rank; if (r.games > 0) { w += r.wins; g += r.games; } else { w += r.totalWins; g += r.totalGames; } }
  return {
    tier: ranked.length ? ranked.reduce((a, p) => a + p.rank.current, 0) / ranked.length : null,
    kd: kds.length ? kds.reduce((a, p) => a + (p.kd ?? 0), 0) / kds.length : null,
    wr: g > 0 ? (100 * w) / g : null,
  };
}

function FormBars({ p }: { p: Player }) {
  if (!p.form.length) return <span className="vsf none" aria-hidden="true" />;
  const list = p.form.slice(0, 5);
  const wins = list.filter((f) => f.won).length;
  return (
    <span className="vsf" role="img" aria-label={`Son ${list.length} maç: ${wins} galibiyet`} title={`Son ${list.length} maç: ${wins} galibiyet, ${list.length - wins} mağlubiyet`}>
      {list.map((f, i) => <i key={i} className={`${f.won ? "w" : "l"}${isComp(f) ? "" : " alt"}`} />)}
    </span>
  );
}

function Cell({ p, index, assets, entry, cols, th, onOpen, mapId, mapName, roles, top, hot, celeste, side }: CellProps & { side: "ally" | "foe" }) {
  const v = playerView(p, { assets, entry, th, mapId, mapName, index });
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };
  const party = cols.party && p.party ? p.party : null;
  return (
    <div className={`vsc ${side}${p.isSelf ? " pme" : ""}${hot ? " hot" : ""}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={key}
      style={party ? ({ "--pc": partyColor(party) } as React.CSSProperties) : undefined}>
      <span className="vsa"><AgentIcon className="agent" icon={v.agent?.icon} name={v.agent?.name} />{v.agent?.roleIcon && <img className="vsro" src={v.agent.roleIcon} alt="" title={v.agent.role} />}</span>
      <span className="vsn">
        <span className="vsl">
          <NameLine name={v.name}>{celeste && !roles?.length && <Moon />}</NameLine>
          {hot && <span className="vshot" title="Rakipler içinde en tehlikeli" aria-label="En tehlikeli rakip"><Icon name="bolt" size={12} /></span>}
        </span>
        <span className="vss">
          {roles && roles.length > 0 && <Roles roles={roles} compact />}
          {party && <span className="vsp" title={`Parti ${party}`}>Parti {party}</span>}
          <small className="pn">{[v.agent?.name ?? "Ajan seçiyor", v.anonymous ? "İsim gizli" : p.level != null ? `Sv. ${p.level}` : null].filter(Boolean).join(" · ")}</small>
        </span>
      </span>
      {v.badges[0] && <span className="vsb"><BadgePill b={v.badges[0]} /></span>}
      <FormBars p={p} />
      <span className="vsw" title={v.g > 0 ? `${v.w} galibiyet, ${v.g} maç (${v.scope}, rekabet)` : "Rekabet verisi yok"}>
        <b className={v.wrPct == null ? "" : v.wrPct >= 55 ? "pos" : v.wrPct < 48 ? "neg" : ""}>{v.wrPct != null ? `%${v.wrPct}` : "–"}</b>
        <small>{p.kd != null ? p.kd.toFixed(2) : "–"}</small>
      </span>
      <span className="vsr">
        {v.cur ? <img className="vsri" src={v.cur.icon} alt="" /> : <i className="tier0" />}
        <span>
          <b style={v.cur ? { color: tierColor(v.cur.color) } : undefined}>{v.cur?.name ?? "Derecesiz"}{top && <Icon name="crown" size={11} />}</b>
          <small>{v.cur ? `${p.rank.rr} RR` : "–"}</small>
        </span>
      </span>
    </div>
  );
}

function Agents({ list, assets }: { list: Player[]; assets: Assets }) {
  return (
    <span className="vsag" aria-hidden="true">
      {list.map((p) => {
        const a = assets.agents.get(lookup(p.agentId));
        return a?.icon ? <img key={p.puuid} src={a.icon} alt="" /> : <i key={p.puuid} />;
      })}
    </span>
  );
}

const SideIcon = ({ side }: { side?: string | null }) => (side ? <span className="vssi" title={side}><Icon name={/savun/i.test(side) ? "shield" : "bolt"} size={12} /></span> : null);

export function Versus({ allies, enemies, cell, assets, mapId, mapName, allySide, foeSide }: {
  allies: Player[]; enemies: Player[]; cell: (p: Player, list: Player[]) => CellProps;
  assets: Assets; mapId?: string | null; mapName?: string; allySide?: string | null; foeSide?: string | null;
}) {
  const a = teamNumbers(allies), e = teamNumbers(enemies);
  const tier = (t: number | null) => (t ? assets.tiers.get(Math.round(t)) : undefined);
  const art = mapId ? assets.mapArt.get(lookup(mapId)) : undefined;
  const ta = tier(a.tier), te = tier(e.tier);
  const stats: (Stat & { icon: IconName; li?: string; ri?: string })[] = [
    { label: "Ortalama rank", icon: "crown", li: ta?.icon, ri: te?.icon, left: ta?.name ?? "–", right: te?.name ?? "–", share: share(a.tier, e.tier) },
    { label: "K/D", icon: "target", left: a.kd != null ? a.kd.toFixed(2) : "–", right: e.kd != null ? e.kd.toFixed(2) : "–", share: share(a.kd, e.kd) },
    { label: "Kazanma", icon: "chart", left: a.wr != null ? `%${Math.round(a.wr)}` : "–", right: e.wr != null ? `%${Math.round(e.wr)}` : "–", share: share(a.wr, e.wr) },
  ];
  return (
    <div className="vs">
      <div className="vsh">
        {art && <span className="vshbg" style={{ backgroundImage: `url(${art})` }} aria-hidden="true" />}
        <div className="vst">
          <span className="vstn ally">
            <Agents list={allies} assets={assets} />
            <span className="vstt"><b><i />Takımın</b>{allySide ? <small><SideIcon side={allySide} />{allySide}</small> : null}</span>
          </span>
          <span className="vsvs"><small>{mapName ?? ""}</small><b aria-hidden="true">VS</b></span>
          <span className="vstn foe">
            <span className="vstt"><b>Rakipler<i /></b>{foeSide ? <small>{foeSide}<SideIcon side={foeSide} /></small> : null}</span>
            <Agents list={enemies} assets={assets} />
          </span>
        </div>
        {stats.map((s) => (
          <div className="vsm" key={s.label}>
            <span className={`vsv l${s.share != null && s.share > 50 ? " lead" : ""}`}>{s.li && <img src={s.li} alt="" />}<b>{s.left}</b></span>
            <span className="vsmid">
              <span className="vsml"><Icon name={s.icon} size={11} />{s.label}</span>
              <span className="vstug" role="img" aria-label={`${s.label}: ${s.left} - ${s.right}`}>
                <i className="lf" style={{ width: `${s.share ?? 50}%` }} />
                <i className="rt" style={{ width: `${s.share != null ? 100 - s.share : 50}%` }} />
                <em style={{ left: `${s.share ?? 50}%` }} />
              </span>
            </span>
            <span className={`vsv r${s.share != null && s.share < 50 ? " lead" : ""}`}><b>{s.right}</b>{s.ri && <img src={s.ri} alt="" />}</span>
          </div>
        ))}
      </div>
      <div className="vsg">
        <div className="vscol"><span className="vsct ally"><i />Takımın</span>{allies.map((p) => <Cell key={p.puuid} {...cell(p, allies)} side="ally" />)}</div>
        <div className="vscol"><span className="vsct foe"><i />Rakipler</span>{enemies.map((p) => <Cell key={p.puuid} {...cell(p, enemies)} side="foe" />)}</div>
      </div>
    </div>
  );
}
