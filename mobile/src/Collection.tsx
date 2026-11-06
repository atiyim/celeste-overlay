import { useMemo, useState } from "react";
import type { Assets, SkinMeta } from "../../src/assets";
import { CAT, SkinDetail, SkinTile, Sheet, weaponRank } from "./Loadout";
import { useOwned, useWish } from "./data";
import { IconSearch } from "./icons";
import { t, type Key } from "./i18n";
import { SkeletonTiles } from "./Skeleton";

const CAT_KEY: Record<string, Key> = { Sidearm: "catSidearm", SMG: "catSMG", Shotgun: "catShotgun", Rifle: "catRifle", Sniper: "catSniper", Heavy: "catHeavy", Melee: "catMelee" };

/** Koleksiyon: sahip olunan kaplamalar ve istek listesi. Arama, tüm kaplamalarda yapılır (istek listesine eklemek için). */
export function Collection({ a }: { a: Assets }) {
  const owned = useOwned();
  const wish = useWish();
  const [view, setView] = useState<"owned" | "wish">("owned");
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<SkinMeta | null>(null);

  // Silah kimliği → sıralama ve sınıf.
  const weapons = useMemo(() => new Map(a.weapons.map((w) => [w.id, w])), [a]);
  const all = useMemo(() => [...a.skinMeta.values()].filter((s) => s.tierId && weapons.has(s.weaponId)), [a, weapons]);
  const ownedSkins = useMemo(() => {
    if (!owned.data) return [];
    const ids = new Set<string>();
    for (const lv of owned.data) { const m = a.levelToSkin.get(lv); if (m) ids.add(m); }
    return all.filter((s) => ids.has(s.id));
  }, [owned.data, all, a]);

  const query = q.trim().toLocaleLowerCase();
  const base = query ? all : view === "owned" ? ownedSkins : all.filter((s) => wish.has(s.id));
  const shown = base
    .filter((s) => !query || s.name.toLocaleLowerCase().includes(query))
    .filter((s) => !cat || weapons.get(s.weaponId)?.category === cat)
    .sort((x, y) => weaponRank(weapons.get(x.weaponId)!) - weaponRank(weapons.get(y.weaponId)!) || (a.contentTiers.get(y.tierId)?.rank ?? 0) - (a.contentTiers.get(x.tierId)?.rank ?? 0) || x.name.localeCompare(y.name));
  const ownedSet = new Set(ownedSkins.map((s) => s.id));
  const loading = view === "owned" && !query && !owned.data && !owned.error;

  return (
    <>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={view === "owned"} className={view === "owned" ? "on" : ""} onClick={() => setView("owned")}>{t("collection")}{owned.data ? ` · ${ownedSkins.length}` : ""}</button>
        <button type="button" role="tab" aria-selected={view === "wish"} className={view === "wish" ? "on" : ""} onClick={() => setView("wish")}>{t("wishlist")}{wish.size ? ` · ${wish.size}` : ""}</button>
      </div>
      <label className="search"><IconSearch /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchSkins")} /></label>
      <div className="chips" role="radiogroup">
        {["", ...CAT].map((c) => (
          <button key={c || "all"} type="button" role="radio" aria-checked={cat === c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c ? t(CAT_KEY[c]) : t("allCat")}</button>
        ))}
      </div>
      {view === "owned" && !query && owned.error && <p className="empty err">{owned.error}</p>}
      {loading ? <SkeletonTiles n={9} /> : shown.length === 0 ? (
        <p className="empty">{query ? t("noResults") : view === "owned" ? t("ownedEmpty") : t("wishEmpty")}</p>
      ) : (
        <div className="grid">
          {shown.slice(0, 300).map((s) => (
            <SkinTile key={s.id} name={s.name} sub={weapons.get(s.weaponId)?.name} image={s.icon} tier={a.contentTiers.get(s.tierId)}
              wished={wish.has(s.id)} onClick={() => setPick(s)} />
          ))}
        </div>
      )}
      {pick && (
        <Sheet title={<span className="st-name"><b>{pick.name}</b></span>} onClose={() => setPick(null)}>
          <SkinDetail name={pick.name} image={pick.icon} weapon={weapons.get(pick.weaponId)?.name ?? pick.weapon} tier={a.contentTiers.get(pick.tierId)} skinId={pick.id}
            extra={ownedSet.has(pick.id) ? <div><dt>{t("collection")}</dt><dd>{t("owned")}</dd></div> : undefined} />
        </Sheet>
      )}
    </>
  );
}
