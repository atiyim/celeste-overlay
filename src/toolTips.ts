import type { IconName } from "./icons";

/* Araçların tanıtımı: lobide dönen "Araçları keşfet" kartı ve köşedeki Celeste'nin ipuçları buradan beslenir.
   Bir aracı bir kez açan kişiye o araç bir daha tanıtılmaz. */
export type ToolId = "chat" | "cross" | "device" | "timers" | "search" | "watch" | "meta";
export interface ToolTip { id: ToolId; icon: IconName; title: string; text: string; say: string }

export const TOOL_TIPS: ToolTip[] = [
  { id: "timers", icon: "timer", title: "Spike sayacı", text: "Tek tuşla başlar, oyunun üstünde küçük bir şerit çıkar. Çözmeye yetişir mi, renginden anlarsın.", say: "Spike sayacını denedin mi? Çözmeye yetişir mi, ben söylerim." },
  { id: "cross", icon: "target", title: "Nişangah", text: "Hazır nişangahlar. Beğendiğinin kodunu kopyala, oyunda yapıştır.", say: "Yeni bir nişangah ister misin? Bende hazırları var." },
  { id: "chat", icon: "chat", title: "Hızlı mesajlar", text: "Sık yazdığın mesajları kaydet, tek tıkla kopyala.", say: "Aynı mesajı her maç yazma. Hızlı mesajlara kaydet." },
  { id: "watch", icon: "eye", title: "İzleme listesi", text: "Etiketlediğin oyuncu lobine girince uyarır.", say: "Bir oyuncuyu etiketle, lobine girince sana haber veririm." },
  { id: "search", icon: "search", title: "Oyuncu arama", text: "Daha önce karşılaştığın oyuncuları isimle bul.", say: "\"Bu adamı tanıyorum\" mu dedin? Oyuncu aramada bakabilirsin." },
  { id: "device", icon: "mouse", title: "DPI / eDPI", text: "DPI ve duyarlılığından eDPI ile 360° dönüş mesafeni hesapla.", say: "eDPI'nı biliyor musun? Araçlar'da hesaplayabilirsin." },
  { id: "meta", icon: "layers", title: "Meta", text: "Hangi haritada hangi ajanlar öne çıkıyor, son yamaya göre.", say: "Bu haritada kim güçlü? Meta'da yazıyor." },
];

const SEEN = "overlay-tools-seen", HIDE = "overlay-toolspot-hide";
const HIDE_DAYS = 7;
const read = (): string[] => { try { const v = JSON.parse(localStorage.getItem(SEEN) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

export function markToolSeen(id: string) {
  const s = read();
  if (s.includes(id)) return;
  try { localStorage.setItem(SEEN, JSON.stringify([...s, id])); } catch { /* depolama kapalı */ }
}
/** Henüz hiç açılmamış araçlar. */
export const unseenTools = (): ToolTip[] => { const s = read(); return TOOL_TIPS.filter((t) => !s.includes(t.id)); };
export const spotHidden = () => { try { return Date.now() < Number(localStorage.getItem(HIDE) ?? 0); } catch { return false; } };
export const hideSpot = () => { try { localStorage.setItem(HIDE, String(Date.now() + HIDE_DAYS * 86400000)); } catch { /* depolama kapalı */ } };
