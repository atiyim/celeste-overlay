import type { KeyboardEvent } from "react";
import { tierColor } from "./LoadoutPanel";
import { Roles } from "./RoleBadge";
import { Icon, type IconName } from "./icons";
import { lookup, type Assets, type Tier } from "./assets";
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
  let w = 0, g = 0, fw = 0, fg = 0;
  for (const p of list) for (const f of p.form.slice(0, 5)) { fg++; if (f.won) fw++; }
  for (const p of list) { const r = p.rank; if (r.games > 0) { w += r.wins; g += r.games; } else { w += r.totalWins; g += r.totalGames; } }
  return {
    tier: ranked.length ? ranked.reduce((a, p) => a + p.rank.current, 0) / ranked.length : null,
    kd: kds.length ? kds.reduce((a, p) => a + (p.kd ?? 0), 0) / kds.length : null,
    wr: g > 0 ? (100 * w) / g : null,
    form: fg > 0 ? (100 * fw) / fg : null,
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

function Team({ kind, title, side, tier, list, assets }: { kind: "ally" | "foe"; title: string; side?: string | null; tier?: Tier; list: Player[]; assets: Assets }) {
  return (
    <div className={`vstn ${kind}`}>
      {tier ? <img className="vstr" src={tier.icon} alt="" /> : <i className="vstr none" />}
      <span className="vstt">
        <b>{title}</b>
        <small>
          {side && <Icon name={/savun/i.test(side) ? "shield" : "bolt"} size={12} />}
          {[side, tier?.name].filter(Boolean).join(" · ") || "Derecesiz"}
        </small>
      </span>
      <Agents list={list} assets={assets} />
    </div>
  );
}

export function Versus({ allies, enemies, cell, assets, mapId, mapName, allySide, foeSide }: {
  allies: Player[]; enemies: Player[]; cell: (p: Player, list: Player[]) => CellProps;
  assets: Assets; mapId?: string | null; mapName?: string; allySide?: string | null; foeSide?: string | null;
}) {
  const a = teamNumbers(allies), e = teamNumbers(enemies);
  const tier = (t: number | null) => (t ? assets.tiers.get(Math.round(t)) : undefined);
  const art = mapId ? assets.mapArt.get(lookup(mapId)) : undefined;
  const pct = (n: number | null) => (n != null ? `%${Math.round(n)}` : "–");
  const stats: (Stat & { icon: IconName })[] = [
    { label: "K/D", icon: "target", left: a.kd != null ? a.kd.toFixed(2) : "–", right: e.kd != null ? e.kd.toFixed(2) : "–", share: share(a.kd, e.kd) },
    { label: "Kazanma", icon: "chart", left: pct(a.wr), right: pct(e.wr), share: share(a.wr, e.wr) },
    { label: "Son maçlar", icon: "bolt", left: pct(a.form), right: pct(e.form), share: share(a.form, e.form) },
  ];
  return (
    <div className="vs">
      <div className="vsh">
        {art && <span className="vshbg" style={{ backgroundImage: `url(${art})` }} aria-hidden="true" />}
        <div className="vst">
          <Team kind="ally" title="Takımın" side={allySide} tier={tier(a.tier)} list={allies} assets={assets} />
          <span className="vsvs"><b aria-hidden="true">VS</b>{mapName && <small>{mapName}</small>}</span>
          <Team kind="foe" title="Rakipler" side={foeSide} tier={tier(e.tier)} list={enemies} assets={assets} />
        </div>
        <div className="vsk">
          {stats.map((s) => {
            const lead = s.share == null || s.share === 50 ? "" : s.share > 50 ? "l" : "r";
            return (
              <div className="vsm" key={s.label} role="img" aria-label={`${s.label}: takımın ${s.left}, rakipler ${s.right}`}>
                <b className={lead === "l" ? "lead" : ""}>{s.left}</b>
                <span className="vsml"><Icon name={s.icon} size={12} />{s.label}</span>
                <b className={lead === "r" ? "lead" : ""}>{s.right}</b>
                <span className="vstug"><i className="lf" style={{ flexGrow: s.share ?? 50 }} /><i className="rt" style={{ flexGrow: s.share != null ? 100 - s.share : 50 }} /></span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="vsg">
        <div className="vscol"><span className="vsct ally"><i />Takımın</span>{allies.map((p) => <Cell key={p.puuid} {...cell(p, allies)} side="ally" />)}</div>
        <div className="vscol"><span className="vsct foe"><i />Rakipler</span>{enemies.map((p) => <Cell key={p.puuid} {...cell(p, enemies)} side="foe" />)}</div>
      </div>
    </div>
  );
}
