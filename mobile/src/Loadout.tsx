import { useRef, useState } from "react";
import { lookup, resolveSkin, type Assets, type ContentTier, type ResolvedSkin, type WeaponInfo } from "../../src/assets";
import type { Player, WeaponSlot } from "../../src/types";
import { agentPool } from "../../src/insights";
import { useBackClose } from "./prefs";
import { toggleWish, useWish } from "./data";
import { IconStar } from "./icons";
import { QUEUE, t } from "./i18n";

/* Oyundaki Koleksiyon ekranının sırası: önce sınıf, sınıf içinde fiyat sırası. */
export const CAT = ["Sidearm", "SMG", "Shotgun", "Rifle", "Sniper", "Heavy", "Melee"];
const ORDER = [
  "29a0cfab-485b-f5d5-779a-b59f85e204a8", "42da8ccc-40d5-affc-beec-15aa47b42eda", "44d4e95c-4157-0037-81b2-17841bf2e8e3", "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", "e336c6b8-418d-9340-d77f-7a9e4cfe0702",
  "f7e1b454-4ad4-1063-ec0a-159e56b58941", "462080d1-4035-2937-7c09-27aa2a5c27a7",
  "910be174-449b-c412-ab22-d0873436b21b", "ec845bf4-4f79-ddda-a3da-0db3774b2794",
  "ae3de142-4d85-2547-dd26-4e90bed35cf7", "4ade7faa-4cf1-8376-95ef-39884480959b", "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", "9c82e19d-4575-0200-1a81-3eacf00cf872",
  "c4883e50-4494-202c-3ec3-6b8a9284f00b", "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c", "a03b24d3-4319-996d-0f8c-94bbfba1dfc7",
  "55d8a0f4-4274-ca67-fe2c-06ab45efdf58", "63e6c2b6-4a8e-869c-3d4c-e38355226584",
  "2f59173c-4bed-b6c3-2191-dea9b58be9c7",
];
export const weaponRank = (w: WeaponInfo) => {
  const c = CAT.indexOf(w.category), o = ORDER.indexOf(w.id);
  return (c < 0 ? 99 : c) * 100 + (o < 0 ? 50 : o);
};

export interface Equipped { weapon: WeaponInfo; skin: ResolvedSkin; skinId?: string; level: number; levels: number }

/** Takılı seviye: Riot'un gönderdiği seviye kimliğinin, kaplamanın seviye listesindeki sırası. */
function levelOf(a: Assets, slot?: WeaponSlot): [number, number, string | undefined] {
  if (!slot) return [0, 0, undefined];
  const ids = [slot.levelId, ...(slot.items ?? []), slot.skinId].filter(Boolean).map((x) => lookup(x as string));
  const main = ids.map((i) => a.levelToSkin.get(i)).find(Boolean);
  const levels = main ? a.skinMeta.get(main)?.levels ?? [] : [];
  if (levels.length < 2) return [0, 0, main];
  const idx = Math.max(...ids.map((i) => levels.indexOf(i)));
  return [idx >= 0 ? idx + 1 : 1, levels.length, main];
}

export function equipped(a: Assets, p: Player): Equipped[] {
  return [...a.weapons]
    .filter((w) => CAT.includes(w.category))
    .sort((x, y) => weaponRank(x) - weaponRank(y))
    .map((weapon) => {
      const slot = p.loadout.weapons.find((s) => lookup(s.weaponId) === weapon.id);
      const skin = resolveSkin(a, weapon, slot);
      const [level, levels, skinId] = skin.isDefault ? [0, 0, undefined] : levelOf(a, slot);
      return { weapon, skin, skinId, level, levels };
    });
}

function Dots({ level, levels }: { level: number; levels: number }) {
  if (levels < 2) return null;
  return <span className="dots" aria-label={`${t("level")} ${level} / ${levels}`}>{Array.from({ length: levels }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</span>;
}

/** Mağaza kutusu: seri rengine boyanmış zemin, köşede seri ikonu. Mağaza ve Koleksiyon da bunu kullanır. */
export function SkinTile({ name, sub, image, tier, dim, children, onClick, big, wished }: {
  name: string; sub?: React.ReactNode; image?: string; tier?: ContentTier; dim?: boolean; children?: React.ReactNode; onClick?: () => void; big?: boolean; wished?: boolean;
}) {
  return (
    <button type="button" className={`tile${dim ? " dim" : ""}${big ? " big" : ""}${wished ? " wished" : ""}`} style={tier ? ({ "--tc": tier.color } as React.CSSProperties) : undefined} onClick={onClick} disabled={!onClick}>
      {tier?.icon && <img className="tile-tier" src={tier.icon} alt={tier.name} />}
      {wished && <span className="tile-wish" aria-label={t("inWishlist")}><IconStar on /></span>}
      <span className="tile-img">{image && <img src={image} alt="" loading="lazy" />}</span>
      <span className="tile-txt"><b>{name}</b>{sub && <small>{sub}</small>}</span>
      {children}
    </button>
  );
}

/** Tek kaplamanın büyük hali: görsel, seri, seviye, varyant ve istek listesi düğmesi. */
export function SkinDetail({ name, image, weapon, tier, level, levels, chromaName, swatch, isDefault, skinId, extra, onBack }: {
  name: string; image?: string; weapon: string; tier?: ContentTier; level?: number; levels?: number; chromaName?: string; swatch?: string; isDefault?: boolean; skinId?: string; extra?: React.ReactNode; onBack?: () => void;
}) {
  const wish = useWish();
  const on = !!skinId && wish.has(skinId);
  return (
    <div className="detail" style={tier && !isDefault ? ({ "--tc": tier.color } as React.CSSProperties) : undefined}>
      {onBack && <button type="button" className="link" onClick={onBack}>‹ {t("allWeapons")}</button>}
      <div className="detail-img">{image && <img src={image} alt="" />}</div>
      <div className="detail-head">
        <span><h3>{name}</h3><p className="detail-sub">{weapon}{tier && !isDefault && <> · {tier.icon && <img src={tier.icon} alt="" />}{tier.name}</>}</p></span>
        {skinId && !isDefault && (
          <button type="button" className={on ? "wish on" : "wish"} onClick={() => toggleWish(skinId)} aria-pressed={on} aria-label={on ? t("removeWish") : t("addWish")}>
            <IconStar on={on} />
          </button>
        )}
      </div>
      <dl>
        {!!levels && levels > 1 && <div><dt>{t("level")}</dt><dd>{level} / {levels} <Dots level={level ?? 0} levels={levels} /></dd></div>}
        {chromaName && <div><dt>{t("variant")}</dt><dd>{swatch && <img className="sw" src={swatch} alt="" />}{chromaName}</dd></div>}
        {isDefault && <div><dt>{t("skin")}</dt><dd>{t("standard")}</dd></div>}
        {extra}
      </dl>
    </div>
  );
}

/** Alttan açılan panel. Aşağı çekince, boşluğa ya da geri tuşuna basınca kapanır. */
export function Sheet({ title, sub, onClose, children }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  useBackClose(true, onClose);
  const drag = {
    onTouchStart: (e: React.TouchEvent) => { start.current = e.touches[0].clientY; },
    onTouchMove: (e: React.TouchEvent) => { if (start.current != null) setDy(Math.max(0, e.touches[0].clientY - start.current)); },
    onTouchEnd: () => { start.current = null; if (dy > 90) onClose(); else setDy(0); },
  };
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <section className="sheet" role="dialog" style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head" {...drag}>
          <span className="grip" />
          <div className="sheet-title">{title}{sub && <small>{sub}</small>}</div>
          <button type="button" className="x" onClick={onClose} aria-label={t("close")}>✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}

/* ---------- Oyuncu: maçlar (lobide zaten yüklenen son maçlardan; ek istek yok) ---------- */
function Matches({ p, a }: { p: Player; a: Assets }) {
  const f = p.form;
  if (!f.length) return <p className="empty">{t("noForm")}</p>;
  const sum = (k: (x: (typeof f)[number]) => number) => f.reduce((n, x) => n + k(x), 0);
  const k = sum((x) => x.kills), d = sum((x) => x.deaths);
  const shots = sum((x) => (x.headshots ?? 0) + (x.bodyshots ?? 0) + (x.legshots ?? 0));
  const rounds = sum((x) => x.rounds ?? 0);
  const wins = f.filter((x) => x.won).length;
  const pool = agentPool(p);
  const stat = (label: string, v: string) => <div className="st"><b>{v}</b><small>{label}</small></div>;
  return (
    <div className="pm">
      <div className="stats">
        {stat(t("winRate"), `%${Math.round((100 * wins) / f.length)}`)}
        {stat(t("kd"), d ? (k / d).toFixed(2) : String(k))}
        {shots > 0 && stat(t("hs"), `%${Math.round((100 * sum((x) => x.headshots ?? 0)) / shots)}`)}
        {rounds > 0 && stat(t("adr"), String(Math.round(sum((x) => x.damage ?? 0) / rounds)))}
      </div>
      <small className="fine">{[t("lastN", { n: f.length }), p.played24h ? t("played24", { n: p.played24h }) : null].filter(Boolean).join(" · ")}</small>
      {pool && (
        <div className="pm-pool">
          {pool.top.map((x) => { const ag = a.agents.get(lookup(x.agentId)); return ag ? <span key={x.agentId}><img src={ag.icon} alt="" /><b>{ag.name}</b><small>{x.count}</small></span> : null; })}
        </div>
      )}
      {p.rrTrend.length > 0 && (
        <div className="rr-row"><small>{t("rrLast")}</small>{p.rrTrend.map((r, i) => <b key={i} className={r >= 0 ? "pos" : "neg"}>{r > 0 ? "+" : ""}{r}</b>)}</div>
      )}
      {f.map((m, i) => {
        const ag = a.agents.get(lookup(m.agentId ?? ""));
        return (
          <div key={i} className={m.won ? "mm win" : "mm loss"}>
            {ag ? <img src={ag.icon} alt="" /> : <span />}
            <span className="mm-t"><b>{a.maps.get(lookup(m.mapId ?? "")) ?? t("map")}</b><small>{QUEUE(m.queue)}</small></span>
            <span className="mm-k">{m.kills}/{m.deaths}/{m.assists}</span>
            <span className="mm-rr">{m.won ? t("won") : t("lost")}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Oyuncu paneli: Kaplamalar (oyundaki sırayla) ve Maçlar sekmeleri. */
export function PlayerSheet({ p, a, title, onClose }: { p: Player; a: Assets; title: React.ReactNode; onClose: () => void }) {
  const [tab, setTab] = useState<"skins" | "matches">("skins");
  const [pick, setPick] = useState<Equipped | null>(null);
  const wish = useWish();
  const list = equipped(a, p);
  const custom = list.filter((x) => !x.skin.isDefault).length;
  return (
    <Sheet title={title} sub={p.loadout.weapons.length ? t("customOn", { n: custom }) : undefined} onClose={onClose}>
      <div className="seg sheet-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "skins"} className={tab === "skins" ? "on" : ""} onClick={() => { setTab("skins"); setPick(null); }}>{t("skins")}</button>
        <button type="button" role="tab" aria-selected={tab === "matches"} className={tab === "matches" ? "on" : ""} onClick={() => setTab("matches")}>{t("matches")}</button>
      </div>
      {tab === "matches" ? <Matches p={p} a={a} /> : !p.loadout.weapons.length ? <p className="empty">{t("noLoadout")}</p> : pick ? (
        <SkinDetail name={pick.skin.name} image={pick.skin.image} weapon={pick.weapon.name} tier={pick.skin.tier} level={pick.level} levels={pick.levels}
          chromaName={pick.skin.chromaName} swatch={pick.skin.swatch} isDefault={pick.skin.isDefault} skinId={pick.skinId} onBack={() => setPick(null)} />
      ) : (
        <div className="grid">
          {list.map((e) => (
            <SkinTile key={e.weapon.id} name={e.skin.isDefault ? e.weapon.name : e.skin.name} sub={e.skin.isDefault ? t("standard") : e.weapon.name}
              image={e.skin.image} tier={e.skin.isDefault ? undefined : e.skin.tier} dim={e.skin.isDefault} wished={!!e.skinId && wish.has(e.skinId)} onClick={() => setPick(e)}>
              {e.skin.swatch && <img className="tile-sw" src={e.skin.swatch} alt={e.skin.chromaName ?? ""} />}
              <Dots level={e.level} levels={e.levels} />
            </SkinTile>
          ))}
        </div>
      )}
    </Sheet>
  );
}
