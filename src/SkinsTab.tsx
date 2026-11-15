import { useMemo } from "react";
import { lookup, skinDetail, type Assets, type SkinDetail } from "./assets";
import type { Player } from "./types";


/* Oyuncu paneli › Kaplamalar: VALORANT mağazası gibi kartlar; seçilen kaplamanın bütün ayrıntısı üstte vitrinde.
   Her bilgi Riot'un gönderdiği kimliklerden gelir: takılı seviye, takılı renk ve uğurluk kesindir.
   Hangi renklerin açık olduğu yalnızca kendi hesabında bilinir (diğer oyuncular için Riot bunu göndermez). */

/* Oyun içi alım menüsü (B tuşu) ile aynı düzen: yan silahlar | hafif makineli + pompalı | tüfek + yakın dövüş | keskin nişancı + makineli. */
const LAYOUT: [string, string][][] = [
  [["Sidearm", "Yan silahlar"]],
  [["SMG", "Hafif makineliler"], ["Shotgun", "Pompalılar"]],
  [["Rifle", "Tüfekler"], ["Melee", "Yakın dövüş"]],
  [["Sniper", "Keskin nişancılar"], ["Heavy", "Makineli tüfekler"]],
];
/* Her kategoride silahlar oyundaki gibi fiyata göre, ucuzdan pahalıya. */
const ORDER = [
  "classic", "shorty", "frenzy", "ghost", "bandit", "sheriff",
  "stinger", "spectre", "bucky", "judge",
  "bulldog", "guardian", "warden", "phantom", "vandal",
  "marshal", "outlaw", "operator", "ares", "odin",
];
const armory = (d: SkinDetail) => { const i = ORDER.indexOf(d.weapon.name.toLowerCase()); return i < 0 ? 99 : i; };

/** Kendi hesabın: sahip olunan kaplama seviyeleri ve renkler (yalnızca kendi panelinde, bir kez sorulur). */
function Swatches({ d, active, onPick, ownedOf, size = "s" }: { d: SkinDetail; active?: string | null; onPick?: (id: string) => void; ownedOf?: (id: string, i: number) => boolean | null; size?: "s" | "l" }) {
  if (d.chromas.length < 2) return null;
  return (
    <span className={`ks-swl ${size}`}>
      {d.chromas.map((c, i) => {
        const on = c.id === d.chromaId;
        const own = ownedOf?.(c.id, i);
        const cls = ["ks-swb", on ? "eq" : "", active === c.id ? "pv" : "", own === false ? "lock" : ""].filter(Boolean).join(" ");
        const tip = `${c.label}${on ? " · takılı" : own === true ? " · açık" : own === false ? " · kilitli" : ""}`;
        return onPick
          ? <button key={c.id} type="button" className={cls} title={tip} aria-label={tip} aria-pressed={active === c.id} onClick={() => onPick(c.id)}>{c.swatch ? <img src={c.swatch} alt="" /> : <i />}</button>
          : <span key={c.id} className={cls} title={tip}>{c.swatch ? <img src={c.swatch} alt="" /> : <i />}</span>;
      })}
    </span>
  );
}

export function SkinsTab({ p, assets }: { p: Player; assets: Assets }) {
  const all = useMemo(() => assets.weapons.map((w) => skinDetail(assets, w, p.loadout.weapons.find((x) => lookup(x.weaponId) === w.id))), [assets, p.loadout]);
  const noLoadout = p.loadout.weapons.length === 0 && (p.loadout.allIds?.length ?? 0) === 0;
  if (noLoadout) return <p className="d none">Kaplamalar oyun başlayınca görünür.</p>;
  const custom = all.filter((d) => !d.isDefault).length;
  const charms = all.filter((d) => d.charm).length;
  const by = (cat: string) => all.filter((d) => d.weapon.category === cat).sort((a, b) => armory(a) - armory(b));

  return (
    <div className="ks-skt fade">
      <div className="ks-skh">
        <span className="ks-skc"><b>{custom}</b> özel kaplama<span className="sep" /><b>{charms}</b> uğurluk<span className="sep" />Oyundaki alım menüsüyle aynı sıra</span>
      </div>
      <div className="ks-buy">
        {LAYOUT.map((col, i) => (
          <div className="ks-bcol" key={i}>
            {col.map(([cat, name]) => (
              <section key={cat}>
                <h3 className="ks-bh">{name}</h3>
                {by(cat).map((d) => (
                  <button key={d.weapon.id} type="button" className={`ks-skd${d.isDefault ? " std" : ""}`}
                    style={d.tier ? ({ "--tc": d.tier.color } as React.CSSProperties) : undefined}
                    title={`${d.weapon.name}: ${d.isDefault ? "Standart" : d.name}`}>
                    <span className="ks-skt1">
                      <small>{d.weapon.name}</small>
                      {d.charm && <img className="ks-skch" src={d.charm.icon} alt="" title={`Uğurluk: ${d.charm.name}`} />}
                      {d.tier?.icon && <img className="ks-skti" src={d.tier.icon} alt="" />}
                    </span>
                    <img className="ks-skim" src={d.image} alt="" loading="lazy" />
                    <span className="ks-skn">{d.isDefault ? "Standart" : d.name}</span>
                    {!d.isDefault && (
                      <span className="ks-skm">
                        {d.levels.length > 1 ? <small>Sv. {d.level ?? "?"}/{d.levels.length}</small> : <small />}
                        <Swatches d={d} />
                      </span>
                    )}
                  </button>
                ))}
              </section>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
