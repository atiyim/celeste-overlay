import { useRef, useState } from "react";
import { lookup, resolveSkin, type Assets, type ResolvedSkin, type WeaponInfo } from "../../src/assets";
import type { Player, WeaponSlot } from "../../src/types";
import { useBackClose } from "./prefs";

/* Oyundaki Koleksiyon ekranının sırası: önce sınıf, sınıf içinde fiyat sırası. */
const CAT = ["Sidearm", "SMG", "Shotgun", "Rifle", "Sniper", "Heavy", "Melee"];
const ORDER = [
  "29a0cfab-485b-f5d5-779a-b59f85e204a8", "42da8ccc-40d5-affc-beec-15aa47b42eda", "44d4e95c-4157-0037-81b2-17841bf2e8e3", "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", "e336c6b8-418d-9340-d77f-7a9e4cfe0702",
  "f7e1b454-4ad4-1063-ec0a-159e56b58941", "462080d1-4035-2937-7c09-27aa2a5c27a7",
  "910be174-449b-c412-ab22-d0873436b21b", "ec845bf4-4f79-ddda-a3da-0db3774b2794",
  "ae3de142-4d85-2547-dd26-4e90bed35cf7", "4ade7faa-4cf1-8376-95ef-39884480959b", "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", "9c82e19d-4575-0200-1a81-3eacf00cf872",
  "c4883e50-4494-202c-3ec3-6b8a9284f00b", "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c", "a03b24d3-4319-996d-0f8c-94bbfba1dfc7",
  "55d8a0f4-4274-ca67-fe2c-06ab45efdf58", "63e6c2b6-4a8e-869c-3d4c-e38355226584",
  "2f59173c-4bed-b6c3-2191-dea9b58be9c7",
];
const rank = (w: WeaponInfo) => {
  const c = CAT.indexOf(w.category), o = ORDER.indexOf(w.id);
  return (c < 0 ? 99 : c) * 100 + (o < 0 ? 50 : o);
};

export interface Equipped { weapon: WeaponInfo; skin: ResolvedSkin; level: number; levels: number }

/** Takılı seviye: Riot'un gönderdiği seviye kimliğinin, kaplamanın seviye listesindeki sırası. */
function levelOf(a: Assets, slot?: WeaponSlot): [number, number] {
  if (!slot) return [0, 0];
  const ids = [slot.levelId, ...(slot.items ?? []), slot.skinId].filter(Boolean).map((x) => lookup(x as string));
  const main = ids.map((i) => a.levelToSkin.get(i)).find(Boolean);
  const levels = main ? a.skinMeta.get(main)?.levels ?? [] : [];
  if (levels.length < 2) return [0, 0];
  const idx = Math.max(...ids.map((i) => levels.indexOf(i)));
  return [idx >= 0 ? idx + 1 : 1, levels.length];
}

export function equipped(a: Assets, p: Player): Equipped[] {
  return [...a.weapons]
    .filter((w) => CAT.includes(w.category))
    .sort((x, y) => rank(x) - rank(y))
    .map((weapon) => {
      const slot = p.loadout.weapons.find((s) => lookup(s.weaponId) === weapon.id);
      const skin = resolveSkin(a, weapon, slot);
      const [level, levels] = skin.isDefault ? [0, 0] : levelOf(a, slot);
      return { weapon, skin, level, levels };
    });
}

const tierStyle = (s: ResolvedSkin) => (s.tier && !s.isDefault ? ({ "--tc": s.tier.color } as React.CSSProperties) : undefined);

function Dots({ level, levels }: { level: number; levels: number }) {
  if (levels < 2) return null;
  return <span className="dots" aria-label={`Seviye ${level} / ${levels}`}>{Array.from({ length: levels }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</span>;
}

/** Mağaza kutusu: seri rengine boyanmış zemin, köşede seri ikonu. Mağaza sekmesi de bunu kullanır. */
export function SkinTile({ name, sub, image, tier, dim, children, onClick, big }: {
  name: string; sub?: React.ReactNode; image?: string; tier?: ResolvedSkin["tier"]; dim?: boolean; children?: React.ReactNode; onClick?: () => void; big?: boolean;
}) {
  return (
    <button type="button" className={`tile${dim ? " dim" : ""}${big ? " big" : ""}`} style={tier ? ({ "--tc": tier.color } as React.CSSProperties) : undefined} onClick={onClick} disabled={!onClick}>
      {tier?.icon && <img className="tile-tier" src={tier.icon} alt={tier.name} />}
      <span className="tile-img">{image && <img src={image} alt="" loading="lazy" />}</span>
      <span className="tile-txt"><b>{name}</b>{sub && <small>{sub}</small>}</span>
      {children}
    </button>
  );
}

function Detail({ e, onBack }: { e: Equipped; onBack: () => void }) {
  const s = e.skin;
  return (
    <div className="detail" style={tierStyle(s)}>
      <button type="button" className="link" onClick={onBack}>‹ Bütün silahlar</button>
      <div className="detail-img"><img src={s.image} alt="" /></div>
      <h3>{s.name}</h3>
      <p className="detail-sub">{e.weapon.name}{s.tier && <> · {s.tier.icon && <img src={s.tier.icon} alt="" />}{s.tier.name}</>}</p>
      <dl>
        {e.levels > 1 && <div><dt>Seviye</dt><dd>{e.level} / {e.levels} <Dots level={e.level} levels={e.levels} /></dd></div>}
        {s.chromaName && <div><dt>Varyant</dt><dd>{s.swatch && <img className="sw" src={s.swatch} alt="" />}{s.chromaName}</dd></div>}
        {s.isDefault && <div><dt>Kaplama</dt><dd>Standart</dd></div>}
      </dl>
    </div>
  );
}

/** Alttan açılan panel: oyuncunun bütün kaplamaları, oyundaki sırayla. */
export function LoadoutSheet({ p, a, title, onClose }: { p: Player; a: Assets; title: React.ReactNode; onClose: () => void }) {
  const [pick, setPick] = useState<Equipped | null>(null);
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  useBackClose(true, onClose);
  const list = equipped(a, p);
  const custom = list.filter((x) => !x.skin.isDefault).length;

  // Tutamaçtan aşağı çekince kapanır.
  const drag = {
    onTouchStart: (e: React.TouchEvent) => { start.current = e.touches[0].clientY; },
    onTouchMove: (e: React.TouchEvent) => { if (start.current != null) setDy(Math.max(0, e.touches[0].clientY - start.current)); },
    onTouchEnd: () => { start.current = null; if (dy > 90) onClose(); else setDy(0); },
  };

  return (
    <div className="sheet-wrap" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="Kaplamalar" style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head" {...drag}>
          <span className="grip" />
          <div className="sheet-title">{title}<small>{custom} silahta özel kaplama</small></div>
          <button type="button" className="x" onClick={onClose} aria-label="Kapat">✕</button>
        </header>
        <div className="sheet-body">
          {pick ? <Detail e={pick} onBack={() => setPick(null)} /> : (
            <div className="grid">
              {list.map((e) => (
                <SkinTile key={e.weapon.id} name={e.skin.isDefault ? e.weapon.name : e.skin.name} sub={e.skin.isDefault ? "Standart" : e.weapon.name}
                  image={e.skin.image} tier={e.skin.isDefault ? undefined : e.skin.tier} dim={e.skin.isDefault} onClick={() => setPick(e)}>
                  {e.skin.swatch && <img className="tile-sw" src={e.skin.swatch} alt={e.skin.chromaName ?? ""} />}
                  <Dots level={e.level} levels={e.levels} />
                </SkinTile>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
