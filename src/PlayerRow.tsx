import type { KeyboardEvent, MouseEvent } from "react";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { Entry } from "./seen";
import type { ColId, Thresholds } from "./theme";
import { tierColor } from "./LoadoutPanel";
import { isComp, modeName } from "./playstyle";
import type { Player } from "./types";
import { AgentIcon, NameLine } from "./ui";
import { partyInfo } from "./party";
import { Roles } from "./RoleBadge";
import type { Role } from "./feed";
import { Icon } from "./icons";
import { partyColor, playerView, shortSkin } from "./playerView";
import type { Badge } from "./playstyle";

export interface RowProps {
  p: Player;
  index: number;
  assets: Assets;
  entry?: Entry; // bu oyuncuyla karşılaşma geçmişi ve kişisel not
  cols: Record<ColId, boolean>;
  th: Thresholds;
  template: string;
  blur?: boolean;
  onOpen: () => void;
  onCopy: (name: string | null) => void;
  onTracker: (url: string) => void;
  mapId?: string | null;
  mapName?: string;
  lobby: Player[];
  /** Celeste rolleri (kendi rolün ya da lobideki diğer Celeste kullanıcılarının). */
  roles?: Role[];
  /** Premium isim plakası rengi (rolü bu özelliği açıyorsa). */
  plate?: string;
  /** Lobinin en yüksek rankı. */
  top?: boolean;
  /** Rakiplerin en tehlikelisi. */
  hot?: boolean;
  /** Celeste Overlay kullanıyor (rolü yoksa küçük ay işareti). */
  celeste?: boolean;
}

/** Rozet: yalnızca iyi/kötü renkli; diğerleri nötr, anlamı küçük bir renk noktasıyla. */
export function BadgePill({ b }: { b: Badge }) {
  const tone = b.tone === "pos" || b.tone === "neg" ? b.tone : `bdn ${b.tone}`;
  return <span className={`bd ${tone}`} title={b.tip}>{b.text}</span>;
}
/** Rolü olmayan Celeste kullanıcısı: adın yanında küçük ay. */
export const Moon = () => <span className="cmoon" title="Celeste Overlay kullanıyor" aria-label="Celeste Overlay kullanıyor"><Icon name="moon" size={11} stroke={2} /></span>;

export function MoreBadges({ list }: { list: Badge[] }) {
  if (!list.length) return null;
  return <span className="bd more" title={list.map((b) => `${b.text}: ${b.tip}`).join("\n\n")}>+{list.length}</span>;
}

/** Son 5 maç: harfsiz noktalar; rekabet dışı modlar soluk. */
export function FormDots({ p, assets }: { p: Player; assets: Assets }) {
  if (!p.form.length) return <span className="d">{p.formLoading ? "…" : "–"}</span>;
  return (
    <span className="fdots">
      {p.form.slice(0, 5).map((f, i) => (
        <i key={i} className={`${f.won ? "w" : "l"}${isComp(f) ? "" : " alt"}`} title={`${modeName(f.queue)} · ${f.won ? "Galibiyet" : "Mağlubiyet"} · ${assets.maps.get(lookup(f.mapId)) ?? "?"} · ${assets.agents.get(lookup(f.agentId))?.name ?? "?"} · ${f.kills}/${f.deaths}/${f.assists}`} />
      ))}
    </span>
  );
}

export function PlayerRow({ p, index, assets, entry, cols, th, template, blur, onOpen, onCopy, onTracker, mapId, mapName, lobby, roles, plate, top, hot, celeste }: RowProps) {
  const v = playerView(p, { assets, entry, th, mapId, mapName, index });
  const party = cols.party && p.party ? partyInfo(p, lobby) : null;
  const sub = [v.anonymous ? (v.label ? "İsim gizli, kendi notun" : "İsim gizli") : null, v.prevText, p.level != null ? `Seviye ${p.level}` : null].filter(Boolean).join(" · ");

  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };

  return (
    <div className={`g r${v.times ? " again" : ""}${party ? " inparty" : ""}${hot ? " hot" : ""}`} style={{ gridTemplateColumns: template, "--i": index, ...(party ? { "--pc": partyColor(p.party!) } : {}) } as React.CSSProperties} role="button" tabIndex={0} onClick={onOpen} onKeyDown={key}>
      <div className={plate ? "who plate" : "who"} style={plate ? ({ "--pl": plate } as React.CSSProperties) : undefined} title={blur ? undefined : sub || undefined}>
        {party && <i className={party.soft ? "pbar soft" : "pbar"} title={`Parti ${p.party}: ${party.tip}`} />}
        <span className="agw"><AgentIcon className="agent" icon={v.agent?.icon} name={v.agent?.name} /></span>
        <span className="n">
          {v.copyName
            ? <button type="button" className="nmc" title="Adı kopyala" onClick={stop(() => onCopy(v.copyName))}><NameLine name={v.name}>{celeste && !roles?.length && <Moon />}</NameLine></button>
            : <NameLine name={v.name}>{celeste && !roles?.length && <Moon />}</NameLine>}
          <span className="sub2">
            {roles && roles.length > 0 && <Roles roles={roles} compact />}
            {v.tag && <span className="tg" style={{ color: v.tag.color, borderColor: v.tag.color }}>{v.tag.label}</span>}
            {v.times > 0 && <span className="rep" title={`Bu oyuncuyla ${v.times}. kez aynı maçtasın`}>{v.times}. kez</span>}
            {party && <span className="pchip">Parti {p.party}</span>}
            <small className="pn">{[v.agent?.name, v.anonymous ? "İsim gizli" : p.level != null ? `Sv. ${p.level}` : null].filter(Boolean).join(" · ")}</small>
          </span>
        </span>
      </div>
      {cols.rank && (
        <div className="tier">
          {v.cur
            ? <span className="tico" style={{ "--tc": v.cur.color, "--rr": `${Math.min(100, p.rank.rr)}%` } as React.CSSProperties}><img src={v.cur.icon} alt="" /></span>
            : <i className="tier0" />}
          <span className="n">
            <span className="rkn">
              <span style={v.cur ? { color: tierColor(v.cur.color) } : undefined}>{v.cur ? v.cur.name : "Derecesiz"}</span>
              {top && <span className="ltop" title="Lobinin en yüksek rankı"><Icon name="crown" size={12} /></span>}
            </span>
            <small>
              {v.cur ? `${p.rank.rr} RR` : "Rekabet verisi yok"}
              {cols.peak && v.peakUp && <span className="pk" title={`Zirve: ${v.peakUp.name}`}> · <Icon name="collapse" size={10} /> <span style={{ color: tierColor(v.peakUp.color) }}>{v.peakUp.name}</span></span>}
            </small>
          </span>
        </div>
      )}
      {cols.form && (
        <div className="lfm" title={v.g > 0 ? `${v.w} galibiyet, ${v.g} maç (${v.scope}, rekabet)` : "Rekabet verisi yok"}>
          <span className="fl">
            {cols.wr && <b>{v.wrPct != null ? `%${v.wrPct}` : "–"}</b>}
            {p.kd != null && <small title="Son rekabet maçlarının K/D'si">K/D {p.kd.toFixed(2)}</small>}
            {cols.wr && v.g > 0 && <small>{v.g} maç</small>}
          </span>
          <FormDots p={p} assets={assets} />
        </div>
      )}
      {cols.skins && (
        <div className="skin1" title={v.noLoadout ? undefined : v.skinTip}>
          {v.noLoadout ? <span className="d">Oyunda görünür</span> : v.vandal ? (
            <>
              <img
                className={v.vandal.skin.isDefault ? "th dim" : v.vandal.skin.tier ? `th tr t${v.vandal.skin.tier.rank}` : "th"}
                style={v.vandal.skin.tier && !v.vandal.skin.isDefault ? ({ "--tc": v.vandal.skin.tier.color } as React.CSSProperties) : undefined}
                src={v.vandal.skin.image}
                alt=""
                loading="lazy"
                onError={(e) => { const el = e.currentTarget; if (el.dataset.fb !== "1" && v.vandal!.weapon.icon) { el.dataset.fb = "1"; el.src = v.vandal!.weapon.icon; } }}
              />
              <span className="skn">{v.vandal.skin.isDefault ? "Varsayılan" : shortSkin(v.vandal.skin.name, v.vandal.weapon.name)}</span>
            </>
          ) : <span className="d">–</span>}
        </div>
      )}
      {cols.pool && (
        <div className="pool" title={v.pool ? `Son ${v.pool.n} maçında oynadığı ajanlar (ölüm maçı hariç)` : undefined}>
          {v.pool ? v.pool.top.map((a) => {
            const ag = assets.agents.get(lookup(a.agentId));
            const now = !!p.agentId && lookup(p.agentId) === lookup(a.agentId);
            return (
              <span key={a.agentId} className={now ? "pa now" : "pa"} title={`${ag?.name ?? "?"}: ${v.pool!.n} maçın ${a.count} tanesi`}>
                <AgentIcon icon={ag?.icon} name={ag?.name} />
                <small>{a.count}</small>
              </span>
            );
          }) : <span className="d">{p.formLoading ? "…" : "–"}</span>}
        </div>
      )}
      {cols.badges && (
        <div className="bdg">
          {v.badges[0] && <BadgePill b={v.badges[0]} />}
          <MoreBadges list={v.badges.slice(1)} />
        </div>
      )}
      {v.trackerUrl && !cols.tracker && (
        <span className="qa">
          <button type="button" className="qb" title="Tracker.gg'de aç" aria-label="Tracker.gg'de aç" onClick={stop(() => onTracker(v.trackerUrl!))}><Icon name="link" size={14} /><span>Tracker</span></button>
        </span>
      )}
      {cols.tracker && (
        <div>
          {v.trackerUrl && <button className="trk" type="button" title="Tracker.gg'de aç" onClick={stop(() => onTracker(v.trackerUrl!))}>Tracker</button>}
        </div>
      )}
    </div>
  );
}
