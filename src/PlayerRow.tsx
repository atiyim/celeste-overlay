import type { KeyboardEvent, MouseEvent } from "react";
import type { Assets } from "./assets";
import { lookup, resolveSkin } from "./assets";
import { TAGS, type Entry } from "./seen";
import type { ColId, Thresholds } from "./theme";
import { tierColor } from "./LoadoutPanel";
import { activityBadge, analyze, formBadge, isComp, modeName, styleBadge } from "./playstyle";
import type { Player } from "./types";
import { NameLine } from "./ui";
import { agentPool, gunBadge, mapBadge, mmrBadge, poolBadge } from "./insights";
import { partyInfo } from "./party";

interface Props {
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
}

// Satırda kaplaması gösterilecek silahlar (kimlikle bulunur, olmazsa isim/kategoriyle).
const THUMBS = [
  { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", name: "Vandal" },
  { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", name: "Phantom" },
  { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", name: "Operator" },
  { id: "2f59173c-4bed-b6c3-2191-dea9b58be9c7", name: "Melee", category: "Melee" },
];

export function PlayerRow({ p, index, assets, entry, cols, th, template, blur, onOpen, onCopy, onTracker, mapId, mapName, lobby }: Props) {
  const agent = assets.agents.get(lookup(p.agentId));
  const cur = assets.tiers.get(p.rank.current);
  const peak = assets.tiers.get(p.rank.peak);
  const anonymous = p.hiddenName && !p.isSelf;
  const label = entry?.label;
  const tag = TAGS.find((t) => t.id === entry?.tag);
  const name = anonymous ? label ?? `Oyuncu ${index + 1}` : p.name ?? "…";

  // Önceki karşılaşma: şimdiki maç history'nin sonundadır, bir öncekine bak.
  const prev = entry && entry.history.length >= 2 ? entry.history[entry.history.length - 2] : undefined;
  const prevText = prev
    ? "Geçen: " + [assets.maps.get(lookup(prev.mapId)), assets.agents.get(lookup(prev.agentId))?.name, prev.side === "ally" ? "takım" : "rakip", !anonymous && prev.name && prev.name !== p.name ? `adı: ${prev.name}` : null].filter(Boolean).join(" · ")
    : null;
  const times = !p.isSelf && entry && entry.n >= 2 ? entry.n : 0; // bu oyuncuyla kaçıncı karşılaşma

  // Tracker bağlantısı: görünen isim ya da (gizli isimlilerde) kullanıcının kendi yazdığı not, "isim#etiket" biçimindeyse.
  const trackerName = anonymous ? (label && label.includes("#") ? label : null) : p.name ?? null;
  const trackerUrl =
    trackerName && trackerName.includes("#")
      ? `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(trackerName)}/overview`
      : null;

  const sub = [
    anonymous ? (label ? "İsim gizli, kendi notun" : "İsim gizli") : null,
    prevText,
    p.level != null ? `Seviye ${p.level}` : null,
  ].filter(Boolean).join(" · ");

  // Kazanma oranı rekabet verisinden gelir; son act'te maç yoksa toplam rekabet oranı gösterilir.
  const r = p.rank;
  const [w, g, scope] = r.games > 0 ? [r.wins, r.games, "son act"] : [r.totalWins, r.totalGames, "tüm act'ler"];
  const wr = g > 0 ? `%${Math.round((100 * w) / g)}` : "–";

  const thumbs = THUMBS.map((t) => {
    const weapon = assets.weapons.find((x) => x.id === t.id)
      ?? assets.weapons.find((x) => x.name === t.name)
      ?? (t.category ? assets.weapons.find((x) => x.category === t.category) : undefined);
    if (!weapon) return null;
    const slot = p.loadout.weapons.find((x) => lookup(x.weaponId) === weapon.id);
    return { weapon, skin: resolveSkin(assets, weapon, slot) };
  });
  const vandal = thumbs[0];
  const skinTip = thumbs.filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => `${t.weapon.name}: ${t.skin.name}${t.skin.chromaName ? ` (${t.skin.chromaName})` : ""}`).join("\n");
  const noLoadout = p.loadout.weapons.length === 0 && (p.loadout.allIds?.length ?? 0) === 0;

  const play = analyze(p);
  // Satır sade kalsın: en önemli rozet görünür, kalanlar "+N" üstünde yazar. Önce maç içinde işe yarayanlar.
  const pool = agentPool(p);
  const badges = [poolBadge(p, agent?.name), gunBadge(p), mapBadge(p, mapId, mapName), mmrBadge(p, (t) => assets.tiers.get(t)?.name), formBadge(p), styleBadge(play, th), activityBadge(p)].filter((b): b is NonNullable<typeof b> => !!b).slice(0, 3);
  const party = cols.party && p.party ? partyInfo(p, lobby) : null;

  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };

  return (
    <div className={times ? "g r again" : "g r"} style={{ gridTemplateColumns: template, "--i": index } as React.CSSProperties} role="button" tabIndex={0} onClick={onOpen} onKeyDown={key}>
      <button className="who" type="button" onClick={stop(() => onCopy(anonymous ? label ?? null : p.name ?? null))} title={blur ? "Kullanıcı adını kopyala" : sub || "Kullanıcı adını kopyala"}>
        {party && (
          <i
            className={party.soft ? "pbar soft" : "pbar"}
            style={{ "--pc": partyColor(p.party!) } as React.CSSProperties}
            title={`Parti ${p.party}: ${party.tip}`}
          />
        )}
        <span className="agw">{agent ? <img className="agent" src={agent.icon} alt={agent.name} loading="lazy" /> : <i className="agent" />}</span>
        <span className="n">
          <NameLine name={name} />
          {(times > 0 || tag || sub) && (
            <span className="sub2">
              {tag && <span className="tg" style={{ color: tag.color, borderColor: tag.color }}>{tag.label}</span>}
              {times > 0 && <span className="rep" title={`Bu oyuncuyla ${times}. kez aynı maçtasın`}>{times}. kez aynı maçta</span>}
              {sub && <small className="pn">{sub}</small>}
            </span>
          )}
        </span>
      </button>
      {cols.rank && (
        <div className="tier">
          {cur && p.rank.current > 0 ? <img src={cur.icon} alt="" /> : <i className="tier0" />}
          <span className="n">
            <span style={cur && p.rank.current > 0 ? { color: tierColor(cur.color) } : undefined}>{cur && p.rank.current > 0 ? cur.name : "Derecesiz"}</span>
            <small>
              {p.rank.current > 0 ? `${p.rank.rr} RR` : null}
              {cols.peak && peak && r.peak > 0 ? <>{p.rank.current > 0 ? " · " : ""}Peak <span style={{ color: tierColor(peak.color) }}>{peak.name}</span></> : null}
            </small>
          </span>
        </div>
      )}
      {cols.wr && (
        <div className="wrc" title={g > 0 ? `${w} galibiyet, ${g} maç (${scope}, rekabet)` : "Rekabet verisi yok"}>
          <span>{wr}{g > 0 && <small>{g} maç</small>}</span>
          {g > 0 && <i className="wbar"><i style={{ width: `${Math.round((100 * w) / g)}%` }} /></i>}
        </div>
      )}
      {cols.form && (
        <div className="form">
          {p.form.length > 0 ? (
            <>
              <span className="chips">
                {p.form.slice(0, 5).map((f, i) => (
                  <span key={i} className={`${f.won ? "fdot win" : "fdot loss"}${isComp(f) ? "" : " alt"}`} title={`${modeName(f.queue)} · ${f.won ? "Galibiyet" : "Mağlubiyet"} · ${assets.maps.get(lookup(f.mapId)) ?? "?"} · ${assets.agents.get(lookup(f.agentId))?.name ?? "?"} · ${f.kills}/${f.deaths}/${f.assists}`} />
                ))}
                {p.formLoading && <span className="d">…</span>}
              </span>
              {p.kd != null && <small title="Son rekabet maçlarının K/D'si">K/D {p.kd.toFixed(2)}</small>}
            </>
          ) : p.formLoading ? <span className="d">…</span> : <span className="d">–</span>}
        </div>
      )}
      {cols.skins && (
        <div className="skin1" title={noLoadout ? undefined : skinTip}>
          {noLoadout ? <span className="d">Oyunda görünür</span> : vandal ? (
            <>
              <img
                className={vandal.skin.isDefault ? "th dim" : vandal.skin.tier ? `th tr t${vandal.skin.tier.rank}` : "th"}
                style={vandal.skin.tier && !vandal.skin.isDefault ? ({ "--tc": vandal.skin.tier.color } as React.CSSProperties) : undefined}
                src={vandal.skin.image}
                alt=""
                loading="lazy"
                onError={(e) => { const el = e.currentTarget; if (el.dataset.fb !== "1" && vandal.weapon.icon) { el.dataset.fb = "1"; el.src = vandal.weapon.icon; } }}
              />
              <span className="skn">{vandal.skin.isDefault ? "Varsayılan" : shortSkin(vandal.skin.name, vandal.weapon.name)}</span>
            </>
          ) : <span className="d">–</span>}
        </div>
      )}
      {cols.pool && (
        <div className="pool" title={pool ? `Son ${pool.n} maçında oynadığı ajanlar (ölüm maçı hariç)` : undefined}>
          {pool ? pool.top.map((a) => {
            const ag = assets.agents.get(lookup(a.agentId));
            const now = !!p.agentId && lookup(p.agentId) === lookup(a.agentId);
            return (
              <span key={a.agentId} className={now ? "pa now" : "pa"} title={`${ag?.name ?? "?"}: ${pool.n} maçın ${a.count} tanesi`}>
                {ag ? <img src={ag.icon} alt={ag.name} loading="lazy" /> : <i />}
                <small>{a.count}</small>
              </span>
            );
          }) : <span className="d">{p.formLoading ? "…" : "–"}</span>}
        </div>
      )}
      {cols.badges && (
        <div className="bdg">
          {badges[0] && <span className={`bd ${badges[0].tone}`} title={badges[0].tip}>{badges[0].text}</span>}
          {badges.length > 1 && <span className="bd more" title={badges.slice(1).map((b) => `${b.text}: ${b.tip}`).join("\n")}>+{badges.length - 1}</span>}
        </div>
      )}
      {cols.tracker && (
        <div>
          {trackerUrl && (
            <button className="trk" type="button" title="Tracker.gg'de aç" onClick={stop(() => onTracker(trackerUrl))}>
              Tracker
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Parti harfi → renk. Aynı partidekiler aynı renkte çizgiyle birleşir. */
const PARTY_COLORS = ["#f0a6ca", "#8fb4ff", "#f6cf7a", "#7ee2b8", "#c39cff", "#ffb38a"];
export const partyColor = (id: string) => PARTY_COLORS[Math.abs((id.toUpperCase().charCodeAt(0) || 65) - 65) % PARTY_COLORS.length];

/** "Prime Vandal" → "Prime": silah adı tekrarlanmasın. */
function shortSkin(skin: string, weapon: string) {
  const s = skin.replace(new RegExp(`\\s*${weapon}\\s*$`, "i"), "").trim();
  return s || skin;
}
