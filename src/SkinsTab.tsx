import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { lookup, skinDetail, type Assets, type SkinDetail } from "./assets";
import type { Account, Player } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;

/* Oyuncu paneli › Kaplamalar: VALORANT mağazası gibi kartlar; seçilen kaplamanın bütün ayrıntısı üstte vitrinde.
   Her bilgi Riot'un gönderdiği kimliklerden gelir: takılı seviye, takılı renk ve uğurluk kesindir.
   Hangi renklerin açık olduğu yalnızca kendi hesabında bilinir (diğer oyuncular için Riot bunu göndermez). */

/* Oyun içi cephanelik sırası (ucuzdan pahalıya), yakın dövüş en sonda. */
const ORDER = [
  "classic", "shorty", "frenzy", "ghost", "bandit", "sheriff",
  "stinger", "spectre", "bucky", "judge",
  "bulldog", "guardian", "warden", "phantom", "vandal",
  "marshal", "outlaw", "operator", "ares", "odin",
];
const armory = (d: SkinDetail) => (d.weapon.category === "Melee" ? 100 : (() => { const i = ORDER.indexOf(d.weapon.name.toLowerCase()); return i < 0 ? 99 : i; })());

type Sort = "value" | "weapon";
const SORT_KEY = "overlay-skin-sort";

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
  const [sort, setSort] = useState<Sort>(() => { try { return localStorage.getItem(SORT_KEY) === "weapon" ? "weapon" : "value"; } catch { return "value"; } });
  const owned = useOwned(p.isSelf);
  const all = useMemo(() => assets.weapons.map((w) => skinDetail(assets, w, p.loadout.weapons.find((x) => lookup(x.weaponId) === w.id))), [assets, p.loadout]);
  const custom = all.filter((d) => !d.isDefault || d.charm);
  const plain = all.filter((d) => d.isDefault && !d.charm).sort((a, b) => armory(a) - armory(b));
  const list = [...custom].sort(sort === "weapon"
    ? (a, b) => armory(a) - armory(b)
    : (a, b) => (b.tier?.rank ?? 0) - (a.tier?.rank ?? 0) || (b.level ?? 0) - (a.level ?? 0) || armory(a) - armory(b));
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [p.puuid]);
  const sel = all.find((d) => d.weapon.id === pick) ?? list[0] ?? all[0];
  const setS = (s: Sort) => { setSort(s); try { localStorage.setItem(SORT_KEY, s); } catch { /* depolama kapalı */ } };

  const noLoadout = p.loadout.weapons.length === 0 && (p.loadout.allIds?.length ?? 0) === 0;
  if (noLoadout) return <p className="d none">Kaplamalar oyun başlayınca görünür.</p>;
  const charms = all.filter((d) => d.charm).length;

  return (
    <div className="ks-skt fade">
      {sel && <Showcase d={sel} owned={owned} self={p.isSelf} />}
      <div className="ks-skh">
        <span className="ks-skc"><b>{all.length - plain.length}</b> özel kaplama<span className="sep" /><b>{charms}</b> uğurluk</span>
        <span className="seg" role="group" aria-label="Sıralama">
          <button type="button" className={sort === "value" ? "on" : ""} aria-pressed={sort === "value"} onClick={() => setS("value")}>Değere göre</button>
          <button type="button" className={sort === "weapon" ? "on" : ""} aria-pressed={sort === "weapon"} onClick={() => setS("weapon")}>Silaha göre</button>
        </span>
      </div>
      <div className="ks-skg">
        {list.map((d) => (
          <button key={d.weapon.id} type="button" className={`ks-skd${d.isDefault ? " std" : ""}${sel?.weapon.id === d.weapon.id ? " on" : ""}`}
            style={d.tier ? ({ "--tc": d.tier.color } as React.CSSProperties) : undefined} onClick={() => setPick(d.weapon.id)}>
            <span className="ks-skt1">
              {d.tier?.icon && <img className="ks-skti" src={d.tier.icon} alt="" />}
              <small>{d.weapon.name}</small>
              {d.charm && <img className="ks-skch" src={d.charm.icon} alt="" title={`Uğurluk: ${d.charm.name}`} />}
            </span>
            <img className="ks-skim" src={d.image} alt="" loading="lazy" />
            <span className="ks-skn">{d.isDefault ? "Standart" : d.name}</span>
            <span className="ks-skm">
              {d.levels.length > 1 && <small>Sv. {d.level ?? "?"}/{d.levels.length}</small>}
              <Swatches d={d} />
            </span>
          </button>
        ))}
      </div>
      {plain.length > 0 && (
        <div className="ks-skp">
          <span className="ks-skph">Standart</span>
          {plain.map((d) => (
            <button key={d.weapon.id} type="button" className={sel?.weapon.id === d.weapon.id ? "on" : ""} title={`${d.weapon.name}: Standart`} onClick={() => setPick(d.weapon.id)}>
              {d.weapon.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
