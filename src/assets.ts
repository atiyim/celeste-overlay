import type { Loadout, WeaponSlot } from "./types";

const BASE = "https://valorant-api.com/v1";
const LANG = "language=tr-TR";

/* Büyük JSON'lar (kaplamalar vb.) Cache API'de tutulur; oyun sürümü değişince temizlenir. */
export async function cachedJson<T>(path: string): Promise<T> {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}${LANG}`;
  try {
    const cache = await caches.open("valo-assets");
    const hit = await cache.match(url);
    if (hit) return (await hit.json()).data as T;
    const res = await fetch(url);
    if (res.ok) {
      await cache.put(url, res.clone());
      return (await res.json()).data as T;
    }
  } catch { /* önbellek yoksa doğrudan dene */ }
  return (await (await fetch(url)).json()).data as T;
}

async function invalidateOnNewVersion() {
  try {
    const res = await fetch(`${BASE}/version`);
    const v = (await res.json()).data?.version as string | undefined;
    if (v && localStorage.getItem("valo-version") !== v) {
      await caches.delete("valo-assets");
      localStorage.setItem("valo-version", v);
    }
  } catch { /* çevrimdışı: eldeki önbellek kullanılır */ }
}

export interface Img { name: string; icon: string }
export interface Tier { name: string; icon: string; color: string }
export interface WeaponInfo { id: string; name: string; category: string; icon: string; defaultSkinId: string }
export interface SkinInfo { name: string; icon: string }
export interface SkinMeta { id: string; name: string; icon: string; weapon: string; tierId: string; levels: string[] }
export interface ContentTier { name: string; color: string; rank: number }
export interface ChromaInfo { name: string; render: string; swatch: string; index: number }

export interface Assets {
  agents: Map<string, Img>;
  weapons: WeaponInfo[];
  skins: Map<string, SkinInfo>; // skin, seviye ve chroma kimliklerinin hepsi buradan çözülür
  chromas: Map<string, ChromaInfo>;
  charms: Map<string, Img>; // charm ve charm-seviye kimlikleri
  sprays: Map<string, Img>; // sprey ve sprey-seviye kimlikleri
  flex: Map<string, Img>;
  cards: Map<string, { small: string; wide: string }>;
  titles: Map<string, string>;
  tiers: Map<number, Tier>;
  maps: Map<string, string>;
  skinMeta: Map<string, SkinMeta>; // yalnızca ana kaplama kimliği
  levelToSkin: Map<string, string>; // seviye ve chroma kimliği → ana kaplama kimliği
  contentTiers: Map<string, ContentTier>;
}

const k = (s?: string | null) => (s ?? "").toLowerCase();

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadAssets(): Promise<Assets> {
  await invalidateOnNewVersion();
  const [agents, weapons, buddies, sprays, cards, titles, tiers, maps, flex, ctiers] = await Promise.all([
    cachedJson<any[]>("/agents?isPlayableCharacter=true"),
    cachedJson<any[]>("/weapons"),
    cachedJson<any[]>("/buddies"),
    cachedJson<any[]>("/sprays"),
    cachedJson<any[]>("/playercards"),
    cachedJson<any[]>("/playertitles"),
    cachedJson<any[]>("/competitivetiers"),
    cachedJson<any[]>("/maps"),
    cachedJson<any[]>("/flex").catch(() => [] as any[]),
    cachedJson<any[]>("/contenttiers").catch(() => [] as any[]),
  ]);

  const a: Assets = {
    agents: new Map(), weapons: [], skins: new Map(), chromas: new Map(), charms: new Map(),
    sprays: new Map(), flex: new Map(), cards: new Map(), titles: new Map(), tiers: new Map(), maps: new Map(),
    skinMeta: new Map(), levelToSkin: new Map(), contentTiers: new Map(),
  };
  const TIER_RANK: Record<string, number> = { Select: 1, Deluxe: 2, Premium: 3, Ultra: 4, Exclusive: 5 };
  for (const t of ctiers ?? []) a.contentTiers.set(k(t.uuid), { name: t.displayName, color: `#${String(t.highlightColor ?? "888888").slice(0, 6)}`, rank: TIER_RANK[t.devName] ?? 0 });

  for (const x of agents) a.agents.set(k(x.uuid), { name: x.displayName, icon: x.displayIcon });

  for (const w of weapons) {
    a.weapons.push({
      id: k(w.uuid), name: w.displayName, category: String(w.category ?? "").split("::").pop() ?? "",
      icon: w.displayIcon, defaultSkinId: k(w.defaultSkinUuid),
    });
    for (const s of w.skins ?? []) {
      const info: SkinInfo = { name: s.displayName, icon: s.displayIcon ?? s.chromas?.[0]?.fullRender ?? "" };
      a.skins.set(k(s.uuid), info);
      a.skinMeta.set(k(s.uuid), { id: k(s.uuid), name: info.name, icon: info.icon, weapon: w.displayName, tierId: k(s.contentTierUuid), levels: (s.levels ?? []).map((l: any) => k(l.uuid)) });
      a.levelToSkin.set(k(s.uuid), k(s.uuid));
      for (const l of s.levels ?? []) { a.skins.set(k(l.uuid), { name: info.name, icon: l.displayIcon ?? info.icon }); a.levelToSkin.set(k(l.uuid), k(s.uuid)); }
      (s.chromas ?? []).forEach((c: any, i: number) => {
        a.chromas.set(k(c.uuid), {
          name: c.displayName, render: c.fullRender ?? c.displayIcon ?? info.icon, swatch: c.swatch ?? "", index: i,
        });
        a.skins.set(k(c.uuid), { name: info.name, icon: c.fullRender ?? c.displayIcon ?? info.icon });
        a.levelToSkin.set(k(c.uuid), k(s.uuid));
      });
    }
  }

  for (const b of buddies) {
    a.charms.set(k(b.uuid), { name: b.displayName, icon: b.displayIcon });
    for (const l of b.levels ?? []) a.charms.set(k(l.uuid), { name: b.displayName, icon: l.displayIcon ?? b.displayIcon });
  }
  for (const s of sprays) {
    const icon = s.fullTransparentIcon ?? s.displayIcon;
    a.sprays.set(k(s.uuid), { name: s.displayName, icon });
    for (const l of s.levels ?? []) a.sprays.set(k(l.uuid), { name: s.displayName, icon: l.displayIcon ?? icon });
  }
  for (const f of flex) a.flex.set(k(f.uuid), { name: f.displayName, icon: f.displayIcon });
  for (const c of cards) a.cards.set(k(c.uuid), { small: c.smallArt, wide: c.wideArt });
  for (const t of titles) a.titles.set(k(t.uuid), t.titleText ?? t.displayName);

  const latest = tiers[tiers.length - 1];
  for (const t of latest?.tiers ?? []) {
    a.tiers.set(t.tier, { name: t.tierName, icon: t.smallIcon, color: `#${String(t.color ?? "888888").slice(0, 6)}` });
  }
  for (const m of maps) a.maps.set(k(m.mapUrl), m.displayName);
  return a;
}

/* Bir silah yuvasını görsel + isme çevirir. Yuvadaki tüm kimlikler görsel veritabanında aranır;
   takılı chroma varsa o rengin render'ı döner. */
export interface ResolvedSkin { name: string; image: string; swatch?: string; chromaName?: string; isDefault: boolean }

const slotIds = (slot?: WeaponSlot) =>
  [...(slot?.items ?? []), slot?.chromaId, slot?.skinId, slot?.levelId, slot?.charmId, slot?.charmLevelId]
    .filter(Boolean)
    .map((x) => k(x as string));

export function resolveSkin(a: Assets, w: { id: string; defaultSkinId: string; icon: string }, slot?: WeaponSlot): ResolvedSkin {
  const fallback: ResolvedSkin = { name: "Standart", image: w.icon, isDefault: true };
  if (!slot) return fallback;
  const ids = slotIds(slot);
  const chromaId = ids.find((i) => a.chromas.has(i));
  const chroma = chromaId ? a.chromas.get(chromaId) : undefined;
  const skinId = ids.find((i) => a.skins.has(i) && !a.chromas.has(i));
  const skin = (skinId ? a.skins.get(skinId) : undefined) ?? (chromaId ? a.skins.get(chromaId) : undefined);
  if (!skin) return fallback;
  const isDefault = ids.includes(w.defaultSkinId) || /^(standart|standard)/i.test(skin.name);
  return {
    name: isDefault ? "Standart" : skin.name,
    image: chroma?.render || skin.icon || w.icon,
    swatch: chroma && chroma.index > 0 ? chroma.swatch : undefined,
    chromaName: chroma && chroma.index > 0 ? chroma.name : undefined,
    isDefault,
  };
}

export function charmIcon(a: Assets, slot?: WeaponSlot) {
  const id = slotIds(slot).find((i) => a.charms.has(i));
  return id ? a.charms.get(id) : undefined;
}
export const lookup = k;

const uniqueByName = (list: Img[]) => {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)));
};

/* Sprey ve flex kimlikleri alt ağaçtaki tüm UUID'lerden çözülür (yanıtın yapısına bağımlı değil). */
export function resolveSprays(a: Assets, l: Loadout): Img[] {
  const ids = [...(l.sprayIds ?? []), ...(l.allIds ?? []), ...l.sprays.flatMap((s) => [s.sprayId, s.levelId ?? ""])];
  return uniqueByName(ids.map((i) => a.sprays.get(k(i))).filter((x): x is Img => !!x));
}
export function resolveFlex(a: Assets, l: Loadout): Img[] {
  return uniqueByName([...(l.expressionIds ?? []), ...(l.allIds ?? [])].map((i) => a.flex.get(k(i))).filter((x): x is Img => !!x));
}
