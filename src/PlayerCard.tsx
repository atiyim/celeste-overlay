import type { KeyboardEvent } from "react";
import { tierColor } from "./LoadoutPanel";
import { partyInfo } from "./party";
import { Roles } from "./RoleBadge";
import { Icon } from "./icons";
import { NameLine } from "./ui";
import { partyColor, playerView } from "./playerView";
import { BadgePill, FormDots, Moon, MoreBadges, type RowProps } from "./PlayerRow";

/* Kart düzeni: ajan seçim ekranı gibi; her takım 5 dikey kart. Tıklayınca aynı ayrıntı paneli açılır. */
export function PlayerCard({ p, index, assets, entry, cols, th, onOpen, onCopy, onTracker, mapId, mapName, lobby, roles, plate, top, celeste }: Omit<RowProps, "template" | "blur">) {
  const v = playerView(p, { assets, entry, th, mapId, mapName, index });
  const party = cols.party && p.party ? partyInfo(p, lobby) : null;
  const [c1, c2] = v.agent?.colors ?? [];
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };
  const style = {
    "--i": index,
    ...(c1 ? { "--a1": c1, "--a2": c2 ?? c1 } : {}),
    ...(party ? { "--pc": partyColor(p.party!) } : {}),
    ...(plate ? { "--pl": plate } : {}),
  } as React.CSSProperties;

  return (
    <div className={`pcd${party ? " inparty" : ""}${plate ? " plate" : ""}${p.isSelf ? " pme" : ""}${v.times ? " again" : ""}`} style={style} role="button" tabIndex={0} onClick={onOpen} onKeyDown={key}>
      <div className="pcv">
        {v.agent?.portrait && <img className="pcport" src={v.agent.portrait} alt="" loading="lazy" />}
        <span className="pcrole">{v.agent?.name ?? "Seçiliyor…"}</span>
        {party && <span className="pcparty" title={`Parti ${p.party}: ${party.tip}`}>Parti {p.party}</span>}
        {v.times > 0 && <span className="pcagain" title={`Bu oyuncuyla ${v.times}. kez aynı maçtasın`}><Icon name="repeat" size={11} />{v.times}</span>}
      </div>
      <div className="pcb">
        <div className="pcn">
          <NameLine name={v.name}>{celeste && !roles?.length && <Moon />}</NameLine>
          <span className="qa" onClick={(e) => e.stopPropagation()}>
            {v.copyName && <button type="button" className="qb" title="Adı kopyala" aria-label="Adı kopyala" onClick={() => onCopy(v.copyName)}><Icon name="text" size={13} /></button>}
            {v.trackerUrl && <button type="button" className="qb" title="Tracker.gg'de aç" aria-label="Tracker.gg'de aç" onClick={() => onTracker(v.trackerUrl!)}><Icon name="link" size={13} /></button>}
          </span>
        </div>
        {(roles?.length || v.tag || v.anonymous) ? (
          <div className="pcm">
            {roles && roles.length > 0 && <Roles roles={roles} compact />}
            {v.tag && <span className="tg" style={{ color: v.tag.color, borderColor: v.tag.color }}>{v.tag.label}</span>}
            {v.anonymous && <small>İsim gizli</small>}
          </div>
        ) : null}
        <div className="pcr">
          {v.cur ? <span className="tico" style={{ "--tc": v.cur.color, "--rr": `${Math.min(100, p.rank.rr)}%` } as React.CSSProperties}><img src={v.cur.icon} alt="" /></span> : <i className="tier0" />}
          <span>
            <b style={v.cur ? { color: tierColor(v.cur.color) } : undefined}>{v.cur?.name ?? "Derecesiz"}</b>
            {top && <span className="ltop" title="Lobinin en yüksek rankı"><Icon name="crown" size={11} /></span>}
            <small>{v.cur ? `${p.rank.rr} RR` : "Rekabet yok"}{cols.peak && v.peakUp ? ` · zirve ${v.peakUp.name}` : ""}</small>
          </span>
        </div>
        <div className="pcs" title={v.g > 0 ? `${v.w} galibiyet, ${v.g} maç (${v.scope}, rekabet)` : "Rekabet verisi yok"}>
          <span><small>Kazanma</small><b>{v.wrPct != null ? `%${v.wrPct}` : "–"}</b></span>
          <span><small>K/D</small><b>{p.kd != null ? p.kd.toFixed(2) : "–"}</b></span>
        </div>
        <FormDots p={p} assets={assets} />
        <div className="pcbd">
          {v.badges[0] ? <BadgePill b={v.badges[0]} /> : <span className="d">–</span>}
          <MoreBadges list={v.badges.slice(1)} />
        </div>
      </div>
    </div>
  );
}
