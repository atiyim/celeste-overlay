import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { lookup, skinDetail, type Assets, type SkinDetail } from "./assets";
import type { Account, Player } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;

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
function useOwned(self: boolean) {
  const [owned, setOwned] = useState<{ levels: Set<string>; chromas: Set<string> } | null>(null);
  useEffect(() => {
    if (!self || !inTauri) { setOwned(null); return; }
    let live = true;
    invoke<Account>("get_account")
      .then((a) => { if (live) setOwned({ levels: new Set(a.owned.skins.map(lookup)), chromas: new Set(a.owned.chromas.map(lookup)) }); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [self]);
  return owned;
}

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

function Showcase({ d, owned, self }: { d: SkinDetail; owned: { levels: Set<string>; chromas: Set<string> } | null; self: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => setPreview(null), [d.weapon.id, d.skinId]);
  const shown = d.chromas.find((c) => c.id === preview);
  const img = shown?.render ?? d.image;
  const eqChroma = d.chromas.find((c) => c.id === d.chromaId);
  // Renk açık mı: kendi hesabında kesin; başkasında yalnızca taktığı renk (ve orijinal) kesin açıktır, gerisi bilinmez.
  const ownedOf = (id: string, i: number): boolean | null => {
    if (i === 0 || id === d.chromaId) return true;
    if (self && owned) return owned.chromas.has(id);
    return null;
  };
  const levelOwned = (id: string, n: number): boolean | null => {
    if (d.level != null && n <= d.level) return true;
    if (self && owned) return owned.levels.has(id);
    return null;
  };
  const tierIcon = d.tier?.icon;
  return (
    <div className="ks-shw" style={d.tier ? ({ "--tc": d.tier.color } as React.CSSProperties) : undefined}>
      <div className="ks-shwv">
        <img key={img} className="ks-shwi" src={img} alt="" />
        {shown && shown.id !== d.chromaId && <span className="ks-shwpv">Önizleme · takılı değil</span>}
      </div>
      <div className="ks-shwx">
        <span className="ks-shwt">
          {tierIcon && <img src={tierIcon} alt="" />}
          {d.isDefault ? "Standart" : d.tier?.name ?? "Kaplama"}<em>{d.weapon.name}</em>
        </span>
        <h3 className="ks-shwn">{d.isDefault ? `Standart ${d.weapon.name}` : d.name}</h3>

        {d.levels.length > 0 && (
          <div className="ks-shwb">
            <span className="ks-shwh">Seviye<b>{d.level != null ? `${d.level} / ${d.levels.length}` : `? / ${d.levels.length}`}</b></span>
            <ol className="ks-lvl">
              {d.levels.map((l) => {
                const o = levelOwned(l.id, l.n);
                return (
                  <li key={l.id} className={[l.n === d.level ? "eq" : "", d.level != null && l.n <= d.level ? "on" : "", o === false ? "lock" : ""].filter(Boolean).join(" ")}>
                    <i>{l.n}</i><span>{l.label}</span>
                    {l.n === d.level && <small>takılı</small>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {d.chromas.length > 1 && (
          <div className="ks-shwb">
            <span className="ks-shwh">Renkler<b>{eqChroma ? eqChroma.label : "–"}</b></span>
            <Swatches d={d} size="l" active={preview ?? d.chromaId} onPick={(id) => setPreview(id === d.chromaId ? null : id)} ownedOf={ownedOf} />
            <small className="ks-shwn2">
              {self && owned ? "Kilitli renkler soluk görünür." : "Riot yalnızca taktığı rengi gösterir; diğer renklerin açık olup olmadığı bilinmez. Tıklayınca önizlenir."}
            </small>
          </div>
        )}

        <div className="ks-shwb">
          <span className="ks-shwh">Uğurluk</span>
          {d.charm ? (
            <span className="ks-shwc"><img src={d.charm.icon} alt="" /><span>{d.charm.name}{d.charm.level != null && <small>Seviye {d.charm.level}</small>}</span></span>
          ) : <small className="d">Uğurluk takılı değil</small>}
        </div>
      </div>
    </div>
  );
}

export function SkinsTab({ p, assets }: { p: Player; assets: Assets }) {
  const owned = useOwned(p.isSelf);
  const all = useMemo(() => assets.weapons.map((w) => skinDetail(assets, w, p.loadout.weapons.find((x) => lookup(x.weaponId) === w.id))), [assets, p.loadout]);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [p.puuid]);
  // Vitrin: seçilen silah; seçilmediyse en değerli özel kaplama.
  const best = [...all].filter((d) => !d.isDefault).sort((a, b) => (b.tier?.rank ?? 0) - (a.tier?.rank ?? 0) || (b.level ?? 0) - (a.level ?? 0))[0];
  const sel = all.find((d) => d.weapon.id === pick) ?? best ?? all[0];

  const noLoadout = p.loadout.weapons.length === 0 && (p.loadout.allIds?.length ?? 0) === 0;
  if (noLoadout) return <p className="d none">Kaplamalar oyun başlayınca görünür.</p>;
  const custom = all.filter((d) => !d.isDefault).length;
  const charms = all.filter((d) => d.charm).length;
  const by = (cat: string) => all.filter((d) => d.weapon.category === cat).sort((a, b) => armory(a) - armory(b));

  return (
    <div className="ks-skt fade">
      {sel && <Showcase d={sel} owned={owned} self={p.isSelf} />}
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
                  <button key={d.weapon.id} type="button" className={`ks-skd${d.isDefault ? " std" : ""}${sel?.weapon.id === d.weapon.id ? " on" : ""}`}
                    style={d.tier ? ({ "--tc": d.tier.color } as React.CSSProperties) : undefined} onClick={() => setPick(d.weapon.id)}
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
