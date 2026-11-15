import { DEFAULT_TILT, TILT_HOURS, TILT_LOSSES, TILT_RR, type TiltCfg } from "./tilt";

/* Kullanıcı ayarları (görünüm, taraf bilgisi, otomatik gizleme, sütunlar). Yalnızca bu bilgisayarda saklanır. */
export type ColId = "rank" | "peak" | "wr" | "form" | "skins" | "party" | "pool" | "badges" | "tracker";
/** inline: kendi sütunu yok, başka bir hücrenin içinde gösterilir (kazanma oranı Form hücresinde, parti avatarın yanındaki çizgide). */
export interface ColDef { id: ColId; label: string; px: number; inline?: boolean }

// "Oyuncu" sütunu her zaman açıktır ve kalan genişliği alır.
export const COLS: ColDef[] = [
  { id: "rank", label: "Rank", px: 128 },
  { id: "peak", label: "Peak rank", px: 116 },
  { id: "wr", label: "Kazanma oranı", px: 0, inline: true },
  { id: "form", label: "Form", px: 140 },
  { id: "skins", label: "Silahlar", px: 132 },
  { id: "party", label: "Parti", px: 0, inline: true },
  { id: "pool", label: "Ajanlar", px: 84 },
  { id: "badges", label: "Öne çıkan", px: 150 },
  { id: "tracker", label: "Tracker düğmesi", px: 64 },
];

/* Rozet eşikleri. Rozetler yalnızca ölçülen değerler bu sınırları aşınca çıkar. */
export interface Thresholds {
  hs: number;       // "Kafa avcısı": kafa isabeti % (en az)
  adr: number;      // "Yüksek hasar": round başına hasar (en az)
  fk: number;       // "Öncü": round'ların yüzde kaçında ilk kan (en az)
  fd: number;       // "İlk ölen": round'ların yüzde kaçında ilk ölüm (en az)
  lowHs: number;    // "Düşük HS": kafa isabeti % (en çok)
}
export const DEFAULT_TH: Thresholds = { hs: 28, adr: 165, fk: 15, fd: 15, lowHs: 12 };

export interface Theme {
  accent: string;
  alpha: number;
  swapSides: boolean;
  autoHide: boolean;
  hideAfter: number; // maç başladıktan kaç saniye sonra gizlensin
  cols: Record<ColId, boolean>;
  th: Thresholds;
  tilt: TiltCfg;
  /** FPS modu: animasyonlar kapanır, maçta hemen gizlenir, gizliyken denetimler seyrekleşir. */
  fps: boolean;
  /** Köşede Celeste görünsün mü */
  buddy: boolean;
  /** OBS tarayıcı kaynağı (yalnızca bu bilgisayardan erişilir). */
  obs: boolean;
  /** Discord'da "Celeste Overlay oynuyor" kartı. */
  discord: boolean;
  /** Yayıncı modu: Discord kartında rank, skor ve RR gizlenir. */
  streamer: boolean;
  /** Tema: "obsidyen" ana tema, "klasik" eski sade görünüm; diğerleri rol sahiplerine açık premium temalar. */
  skin: string;
  /** Vurgu rengi rolün rengi olsun (rol sahiplerine). */
  roleAccent: boolean;
  /** Kartlarda rol renginde ince parıltı ve üst çubukta rol rozeti (rol sahiplerine). */
  vipFx: boolean;
  /** Lobide diğer Celeste kullanıcılarının rol rozetini göster. */
  showRoles: boolean;
  /** Lobide başka Celeste kullanıcılarına "Celeste kullanıyor" işaretiyle görün. */
  showMe: boolean;
  /** Lobi düzeni: sade liste ya da oyuncu kartları. */
  layout: "list" | "cards" | "versus";
  /** Ayar şeması sürümü (yeni varsayılanları bir kez uygulamak için). */
  v: number;
}
/** v2: lobi sadeleşti; Vandal, Ajanlar ve Tracker sütunları varsayılan olarak kapalı (Ayarlar'dan açılır). */
/** v3: üç silah (Vandal, Phantom, Operator) sütunu geri geldi ve varsayılan açık. */
const THEME_V = 3;
const V2_OFF: ColId[] = ["pool", "tracker"];

const ALL_ON = Object.fromEntries(COLS.map((c) => [c.id, !V2_OFF.includes(c.id)])) as Record<ColId, boolean>;

export const DEFAULT_THEME: Theme = {
  accent: "#e6c27a",
  alpha: 0.94,
  swapSides: false,
  autoHide: true,
  hideAfter: 10,
  cols: ALL_ON,
  th: DEFAULT_TH,
  tilt: DEFAULT_TILT,
  fps: false,
  buddy: true,
  obs: false,
  discord: true,
  streamer: false,
  skin: "obsidyen",
  roleAccent: false,
  vipFx: true,
  showRoles: true,
  showMe: true,
  layout: "list",
  v: THEME_V,
};
/** Eski varsayılan vurgu: değiştirmemiş kullanıcılar yeni Celeste moruna geçer. */
const OLD_DEFAULT_ACCENTS = ["#38bdf8", "#b89cf5"];
export const ACCENTS = ["#e6c27a", "#8b9cff", "#b89cf5", "#f0a6ca", "#34d399", "#fbbf24", "#eceff6"];
export const HIDE_AFTER_OPTIONS = [5, 10, 15, 30];
/** FPS modunda overlay maç başladıktan en geç bu kadar saniye sonra gizlenir. */
export const FPS_HIDE_AFTER = 5;

/* FPS modu açıkken geçerli olan gizleme ayarları (kullanıcının kendi seçimi saklanır, mod kapanınca geri döner). */
export const hideOf = (t: Theme) => ({ on: t.autoHide || t.fps, after: t.fps ? Math.min(t.hideAfter, FPS_HIDE_AFTER) : t.hideAfter });

const KEY = "overlay-theme";

export function loadTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Theme> | null;
    if (!t) return DEFAULT_THEME;
    // Ana temaya ilk geçiş (bir kez): Obsidyen Altın altın vurguyla başlar. Sonradan seçilen renk korunur.
    if (!localStorage.getItem("overlay-gold") && t.skin !== "klasik") t.accent = DEFAULT_THEME.accent;
    localStorage.setItem("overlay-gold", "1");
    return {
      // Tema seçmemiş eski kayıt ana temaya (Obsidyen Altın) geçer; eski mor varsayılan vurgu da altına döner.
      accent: typeof t.accent === "string" && /^#[0-9a-f]{6}$/i.test(t.accent) && !OLD_DEFAULT_ACCENTS.includes(t.accent.toLowerCase()) && !(!t.skin && t.accent.toLowerCase() === "#8b9cff") ? t.accent : DEFAULT_THEME.accent,
      alpha: typeof t.alpha === "number" ? Math.min(1, Math.max(0.3, t.alpha)) : DEFAULT_THEME.alpha,
      swapSides: t.swapSides === true,
      autoHide: t.autoHide !== false,
      hideAfter: HIDE_AFTER_OPTIONS.includes(t.hideAfter as number) ? (t.hideAfter as number) : DEFAULT_THEME.hideAfter,
      cols: t.v === THEME_V ? { ...ALL_ON, ...(t.cols ?? {}) } : { ...ALL_ON, ...(t.cols ?? {}), ...((t.v ?? 0) < 2 ? Object.fromEntries(V2_OFF.map((c) => [c, false])) : {}), skins: true },
      th: Object.fromEntries(
        (Object.keys(DEFAULT_TH) as (keyof Thresholds)[]).map((k) => {
          const v = (t.th as Partial<Thresholds> | undefined)?.[k];
          return [k, typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DEFAULT_TH[k]];
        }),
      ) as unknown as Thresholds,
      tilt: {
        on: (t.tilt as Partial<TiltCfg> | undefined)?.on !== false,
        losses: TILT_LOSSES.includes((t.tilt as Partial<TiltCfg> | undefined)?.losses as number) ? (t.tilt as TiltCfg).losses : DEFAULT_TILT.losses,
        rr: TILT_RR.includes((t.tilt as Partial<TiltCfg> | undefined)?.rr as number) ? (t.tilt as TiltCfg).rr : DEFAULT_TILT.rr,
        hours: TILT_HOURS.includes((t.tilt as Partial<TiltCfg> | undefined)?.hours as number) ? (t.tilt as TiltCfg).hours : DEFAULT_TILT.hours,
      },
      fps: t.fps === true,
      buddy: t.buddy !== false,
      obs: t.obs === true,
      discord: t.discord !== false,
      streamer: t.streamer === true,
      skin: typeof t.skin === "string" && /^[a-z]{1,16}$/.test(t.skin) ? t.skin : "obsidyen",
      roleAccent: t.roleAccent === true,
      vipFx: t.vipFx !== false,
      showRoles: t.showRoles !== false,
      showMe: t.showMe !== false,
      layout: t.layout === "cards" || t.layout === "versus" ? t.layout : "list",
      v: THEME_V,
    };
  } catch { return DEFAULT_THEME; }
}

export function applyTheme(t: Theme) {
  const r = document.documentElement.style;
  // Vurgu rengini applyLook (vip.ts) yazar: burada yazılırsa her ayar değişiminde temanın/rolün rengini ezerdi.
  r.setProperty("--alpha", String(t.alpha));
  document.documentElement.classList.toggle("fps", t.fps);
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* depolama dolu */ }
}

/** Tabloda kendi sütunu olan açık sütunlar (sırasıyla). */
export const gridCols = (cols: Record<ColId, boolean>) => COLS.filter((c) => cols[c.id] && !c.inline);

export const gridTemplate = (cols: Record<ColId, boolean>) =>
  ["minmax(0, 1fr)", ...gridCols(cols).map((c) => `${c.px}px`)].join(" ");

/* Açık sütunlara göre pencere genişliği (CSS px). */
/* Sol menü 56, kenar boşlukları 32, takım kartı ve satır iç boşlukları 28, oyuncu sütunu en az 190. */
export function overlayWidth(cols: Record<ColId, boolean>, layout: Theme["layout"] = "list"): number {
  if (layout === "versus") return 1180; // iki takım yan yana
  if (layout === "cards") return 1000; // 5 kart × ~170 + menü ve boşluklar
  const on = gridCols(cols);
  return Math.max(760, 56 + 32 + 28 + 190 + on.reduce((a, c) => a + c.px, 0) + 12 * on.length);
}
