import { useSyncExternalStore } from "react";
import { currentMe, subscribeMe, type Me } from "./feed";

/* Premium: rol sahiplerine açılan temalar ve rol efektleri.
   Rol yetkisi Akış oturumundan gelir (sunucu verir); burada yalnızca görünümü uygularız. */

export interface Skin { id: string; name: string; tag: string; accent: string }
export const SKINS: Skin[] = [
  { id: "obsidyen", name: "Obsidyen Altın", tag: "Siyah zemin, ince altın çizgiler", accent: "#e6c27a" },
  { id: "aurora", name: "Kuzey Işığı", tag: "Yavaşça akan yeşil ve mor ışık", accent: "#5eead4" },
  { id: "gunbatimi", name: "Gün Batımı", tag: "Erik zemin, sıcak ufuk çizgisi", accent: "#ff9e80" },
  { id: "kristal", name: "Kristal", tag: "Buz mavisi, buzlu cam", accent: "#9bd7ff" },
];
const PREVIEW_SECONDS = 15;

/** Rolü olan, yasaklı olmayan herkes premium'dur; yönetici de rol sayılır. */
export const isPremium = (m: Me | null) => !!m && !m.banned && (m.admin || m.roles.length > 0);
/** Efektlerde kullanılan ana rol rengi: yönetici varsa onunki, yoksa ilk rol. */
export const roleColor = (m: Me | null) => (m ? (m.roles.find((r) => r.admin) ?? m.roles[0])?.color : undefined);

export const useMe = () => useSyncExternalStore(subscribeMe, currentMe);

/* Önizleme: kilitli bir temayı kısa süre denetlemek için. Süre bitince kendiliğinden döner. */
interface Preview { id: string; until: number }
let preview: Preview | null = null;
let timer = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const startPreview = (id: string) => {
  window.clearTimeout(timer);
  preview = { id, until: Date.now() + PREVIEW_SECONDS * 1000 };
  timer = window.setTimeout(stopPreview, PREVIEW_SECONDS * 1000);
  emit();
};
export const stopPreview = () => { window.clearTimeout(timer); preview = null; emit(); };
export const usePreview = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => preview);

/** Temayı ve rol efektini kök öğeye uygular. `accent` tema yokken kullanılacak vurgu rengidir. */
export function applyLook(opts: { skin: string; accent: string; vipColor?: string }) {
  const el = document.documentElement;
  const sk = SKINS.find((s) => s.id === opts.skin);
  if (sk) el.dataset.skin = sk.id; else delete el.dataset.skin;
  el.style.setProperty("--accent", sk ? sk.accent : opts.accent);
  if (opts.vipColor) { el.dataset.vip = "1"; el.style.setProperty("--vip", opts.vipColor); }
  else { delete el.dataset.vip; el.style.removeProperty("--vip"); }
}
