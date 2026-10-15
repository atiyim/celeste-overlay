import type { KeyboardEvent, MouseEvent } from "react";
import type { Assets } from "./assets";
import { lookup, resolveSkin } from "./assets";
import { TAGS, type Entry } from "./seen";
import type { ColId, Thresholds } from "./theme";
import { tierColor } from "./LoadoutPanel";
import { activityBadge, analyze, formBadge, styleBadge } from "./playstyle";
import type { Player } from "./types";

interface Props {
  p: Player;
  index: number;
  assets: Assets;
  entry?: Entry; // bu oyuncuyla karşılaşma geçmişi ve kişisel not
  cols: Record<ColId, boolean>;
  th: Thresholds;
  template: string;
  onOpen: () => void;
  onCopy: (name: string | null) => void;
  onTracker: (url: string) => void;
}

// Satırda kaplaması gösterilecek silahlar (kimlikle bulunur, olmazsa isim/kategoriyle).
const THUMBS = [
  { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", name: "Vandal" },
  { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", name: "Phantom" },
  { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", name: "Operator" },
  { id: "2f59173c-4bed-b6c3-2191-dea9b58be9c7", name: "Melee", category: "Melee" },
];

export function PlayerRow({ p, index, assets, entry, cols, th, template, onOpen, onCopy, onTracker }: Props) {
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

  const play = analyze(p);
  const badges = [formBadge(p), styleBadge(play, th), activityBadge(p)].filter((b): b is NonNullable<typeof b> => !!b).slice(0, 2); // satır sade kalsın: en önemli iki rozet

  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };

  return (
    <div className={times ? "g r again" : "g r"} style={{ gridTemplateColumns: template }} role="button" tabIndex={0} onClick={onOpen} onKeyDown={key}>
      <button className="who" type="button" onClick={stop(() => onCopy(anonymous ? label ?? null : p.name ?? null))} title={sub || "Kullanıcı adını kopyala"}>
        {agent && <img className="agent" src={agent.icon} alt={agent.name} loading="lazy" />}
        <span className="n">
          {name}
          {times > 0 && <span className="rep" title={`Bu oyuncuyla ${times}. kez aynı maçtasın`}>{times}. kez</span>}
          {tag && <span className="tg" style={{ color: tag.color, borderColor: tag.color }}>{tag.label}</span>}
          {sub && <small>{sub}</small>}
        </span>
      </button>
      {cols.rank && (
        <div className="tier">
          {cur ? (
            <>
              <img src={cur.icon} alt="" />
              <span className="n"><span style={{ color: tierColor(cur.color) }}>{cur.name}</span>{p.rank.current > 0 && <small>{p.rank.rr} RR</small>}</span>
            </>
          ) : "Derecesiz"}
        </div>
      )}
      {cols.peak && <div className="tier d">{peak && r.peak > 0 ? <><img src={peak.icon} alt="" /><span style={{ color: tierColor(peak.color) }}>{peak.name}</span></> : "–"}</div>}
      {cols.wr && (
        <div className="k" title={g > 0 ? `${w} galibiyet, ${g} maç (${scope}, rekabet)` : "Rekabet verisi yok"}>
          {wr}
          {g > 0 && <small>{g} maç</small>}
        </div>
      )}
      {cols.form && (
        <div className="form">
          {p.form.length > 0 ? (
            <>
              <span className="chips">
                {p.form.map((f, i) => (
                  <span key={i} className={f.won ? "fc win" : "fc loss"} title={`${f.won ? "Galibiyet" : "Mağlubiyet"} · ${assets.maps.get(lookup(f.mapId)) ?? "?"} · ${assets.agents.get(lookup(f.agentId))?.name ?? "?"} · ${f.kills}/${f.deaths}/${f.assists}`}>
                    {f.won ? "W" : "L"}
                  </span>
                ))}
                {p.formLoading && <span className="d">…</span>}
              </span>
              {p.kd != null && <small>K/D {p.kd.toFixed(2)}</small>}
            </>
          ) : p.formLoading ? <span className="d">…</span> : <span className="d">–</span>}
        </div>
      )}
      {cols.skins && (
        <div className="thumbs">
          {p.loadout.weapons.length === 0 && (p.loadout.allIds?.length ?? 0) === 0 ? <span className="d">Oyun başlayınca görünür</span> : thumbs.map((t, i) =>
            t ? (
              <img
                key={i}
                className={t.skin.isDefault ? "th dim" : "th"}
                src={t.skin.image}
                alt={`${t.weapon.name}: ${t.skin.name}`}
                title={`${t.weapon.name}: ${t.skin.name}${t.skin.chromaName ? ` (${t.skin.chromaName})` : ""}`}
                loading="lazy"
                onError={(e) => { const el = e.currentTarget; if (el.dataset.fb !== "1" && t.weapon.icon) { el.dataset.fb = "1"; el.src = t.weapon.icon; } }}
              />
            ) : <span key={i} className="th" />,
          )}
        </div>
      )}
      {cols.party && (
        <div>
          {p.party ? (
            <span
              className={p.partySure ? "p" : "p soft"}
              title={p.partySure ? "Aynı partide (Riot verisi)" : "Son rekabet maçlarında sık birlikte girdiler (şu an aynı partide olduklarının kanıtı değil)"}
            >{p.party}</span>
          ) : null}
        </div>
      )}
      {cols.badges && (
        <div className="bdg">
          {badges.map((b) => <span key={b.text} className={`bd ${b.tone}`} title={b.tip}>{b.text}</span>)}
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
