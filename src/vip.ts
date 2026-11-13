import { useSyncExternalStore } from "react";
import { currentMe, premiumInfo, subscribeMe, type Me, type Role } from "./feed";

/* Premium: rol sahiplerine açılan temalar ve efektler.
   Rol yetkisi Akış oturumundan gelir (sunucu verir). Hangi özelliğin hangi rolü istediğini yönetici belirler
   (/api/feed/premium); seçilmemişse herhangi bir Celeste rolü yeter. */

export interface Skin { id: string; name: string; tag: string; accent: string }
export const SKINS: Skin[] = [
  { id: "obsidyen", name: "Obsidyen Altın", tag: "Siyah zemin, ince altın çizgiler", accent: "#e6c27a" },
  { id: "aurora", name: "Kuzey Işığı", tag: "Yavaşça akan yeşil ve mor ışık", accent: "#5eead4" },
  { id: "gunbatimi", name: "Gün Batımı", tag: "Erik zemin, sıcak ufuk çizgisi", accent: "#ff9e80" },
  { id: "kristal", name: "Kristal", tag: "Buz mavisi, buzlu cam", accent: "#9bd7ff" },
];

/** Özellikler. `seen`: başkaları da görür (lobi, Akış, Discord). */
export type ItemId = `skin:${string}` | "fx:accent" | "fx:glow" | "fx:plate" | "fx:name" | "fx:post" | "discord";
export interface Item { id: ItemId; name: string; text: string; seen?: string }
export const EFFECTS: Item[] = [
  { id: "fx:plate", name: "Lobi isim plakası", text: "Lobide adının arkasında rol renginde bir plaka ve rozet.", seen: "Lobideki Celeste kullanıcıları görür" },
  { id: "fx:name", name: "Akış isim stili", text: "Akış'ta adın rol renginde, ışıltılı yazılır.", seen: "Akış'taki herkes görür" },
  { id: "fx:post", name: "Paylaşım çerçevesi", text: "Paylaşımların rol renginde ince bir çerçeve ve ışıkla öne çıkar.", seen: "Akış'taki herkes görür" },
  { id: "fx:glow", name: "Profil parıltısı", text: "Profil kartların rol renginde parlar, üzerinden yavaşça ışık geçer." },
  { id: "fx:accent", name: "Rol rengi vurgu", text: "Sekmeler, düğmeler ve halkalar rolünün rengini alır." },
  { id: "discord", name: "Discord rolü", text: "Hesabını bağla; overlay rolün Celeste Discord'unda da görünür.", seen: "Discord sunucusunda herkes görür" },
];
export const SAMPLE = "#e6c27a";
const PREVIEW_SECONDS = 15;

/** Rolü olan, yasaklı olmayan herkes premium'dur; yönetici de rol sayılır. */
export const isPremium = (m: Me | null) => !!m && !m.banned && (m.admin || m.roles.length > 0);
/** Efektlerde kullanılan ana rol rengi: yönetici varsa onunki, yoksa ilk rol. */
export const roleColor = (m: Me | null) => (m ? (m.roles.find((r) => r.admin) ?? m.roles[0])?.color : undefined);

export const useMe = () => useSyncExternalStore(subscribeMe, currentMe);

/* Gerekli roller: sunucudan gelir, son bilinen hâli saklanır. */
export interface PremiumCfg { req: Partial<Record<ItemId, number>>; roles: { id: number; name: string; color: string; icon?: string }[] }
const CFG_KEY = "overlay-premium-cfg";
const CFG_TTL = 10 * 60_000;
let cfg: PremiumCfg = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) ?? "") as PremiumCfg; } catch { return { req: {}, roles: [] }; } })();
if (!cfg || typeof cfg.req !== "object" || !Array.isArray(cfg.roles)) cfg = { req: {}, roles: [] };
let cfgAt = 0;
const cfgSubs = new Set<() => void>();
export async function loadPremiumCfg(force = false) {
  if (!force && Date.now() - cfgAt < CFG_TTL) return;
  cfgAt = Date.now();
  try {
    const j = await premiumInfo();
    cfg = { req: j.req ?? {}, roles: Array.isArray(j.roles) ? j.roles : [] };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* depolama kapalı */ }
    cfgSubs.forEach((f) => f());
  } catch { /* son bilinen ayar kullanılır */ }
}
export const usePremiumCfg = () => useSyncExternalStore((f) => { cfgSubs.add(f); return () => { cfgSubs.delete(f); }; }, () => cfg);
export const reqRole = (c: PremiumCfg, item: ItemId) => (c.req[item] ? c.roles.find((r) => r.id === c.req[item]) : undefined);

/** Bir rol listesi bu özelliği açar mı? Yönetici her şeyi açar. Lobi ve Akış'ta başkaları için de kullanılır. */
export function rolesUnlock(roles: Role[] | undefined, item: ItemId, c: PremiumCfg = cfg): boolean {
  if (!roles?.length) return false;
  if (roles.some((r) => r.admin)) return true;
  const need = c.req[item];
  return need ? roles.some((r) => r.id === need) : true;
}
export const unlocked = (m: Me | null, item: ItemId, c: PremiumCfg = cfg) => isPremium(m) && (m!.admin || rolesUnlock(m!.roles, item, c));
/** Efekt rengi: özelliği açan rol (yoksa yönetici, yoksa ilk rol). */
export function fxColor(roles: Role[] | undefined, item: ItemId, c: PremiumCfg = cfg): string | undefined {
  if (!roles?.length) return undefined;
  const need = c.req[item];
  return (roles.find((r) => need && r.id === need) ?? roles.find((r) => r.admin) ?? roles[0]).color;
}

/* Önizleme: kilitli bir özelliği kısa süre denemek için. Süre bitince kendiliğinden döner. */
interface Preview { id: ItemId; until: number }
let preview: Preview | null = null;
let timer = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const startPreview = (id: ItemId) => {
  window.clearTimeout(timer);
  preview = { id, until: Date.now() + PREVIEW_SECONDS * 1000 };
  timer = window.setTimeout(stopPreview, PREVIEW_SECONDS * 1000);
  emit();
};
export const stopPreview = () => { window.clearTimeout(timer); preview = null; emit(); };
export const usePreview = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => preview);
export const itemName = (id: ItemId) => (id.startsWith("skin:") ? SKINS.find((s) => `skin:${s.id}` === id)?.name : EFFECTS.find((e) => e.id === id)?.name) ?? "Premium";

/** Temayı ve rol efektini kök öğeye uygular. `accent` tema yokken kullanılacak vurgu rengidir. */
export function applyLook(opts: { skin: string; accent: string; vipColor?: string }) {
  const el = document.documentElement;
  const sk = SKINS.find((s) => s.id === opts.skin);
  if (sk) el.dataset.skin = sk.id; else delete el.dataset.skin;
  el.style.setProperty("--accent", sk ? sk.accent : opts.accent);
  if (opts.vipColor) { el.dataset.vip = "1"; el.style.setProperty("--vip", opts.vipColor); }
  else { delete el.dataset.vip; el.style.removeProperty("--vip"); }
}
