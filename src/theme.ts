import { DEFAULT_TILT, TILT_HOURS, TILT_LOSSES, TILT_RR, type TiltCfg } from "./tilt";

/* Kullanıcı ayarları (görünüm, taraf bilgisi, otomatik gizleme, sütunlar). Yalnızca bu bilgisayarda saklanır. */
export type ColId = "rank" | "peak" | "wr" | "form" | "skins" | "party" | "pool" | "badges" | "tracker";
/** inline: kendi sütunu yok, başka bir hücrenin içinde gösterilir (peak rank hücresinde, parti avatarın yanındaki çizgide). */
export interface ColDef { id: ColId; label: string; px: number; inline?: boolean }

// "Oyuncu" sütunu her zaman açıktır ve kalan genişliği alır.
export const COLS: ColDef[] = [
  { id: "rank", label: "Rank", px: 158 },
  { id: "peak", label: "Peak rank", px: 0, inline: true },
  { id: "wr", label: "Kazanma", px: 74 },
  { id: "form", label: "Son 5 maç", px: 118 },
  { id: "skins", label: "Vandal", px: 168 },
  { id: "party", label: "Parti çizgisi", px: 0, inline: true },
  { id: "pool", label: "Ajanlar", px: 84 },
  { id: "badges", label: "Öne çıkan", px: 132 },
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
  /** OBS tarayıcı kaynağı (yalnızca bu bilgisayardan erişilir). */
  obs: boolean;
  /** Discord'da "Celeste Overlay oynuyor" kartı. */
  discord: boolean;
  /** Yayıncı modu: Discord kartında rank, skor ve RR gizlenir. */
  streamer: boolean;
  /** Premium tema kimliği ("" = Celeste varsayılanı). Yalnızca rol sahiplerinde uygulanır. */
  skin: string;
  /** Vurgu rengi rolün rengi olsun (rol sahiplerine). */
  roleAccent: boolean;
  /** Kartlarda rol renginde ince parıltı ve üst çubukta rol rozeti (rol sahiplerine). */
  vipFx: boolean;
  /** Lobide diğer Celeste kullanıcılarının rol rozetini göster. */
  showRoles: boolean;
}

const ALL_ON = Object.fromEntries(COLS.map((c) => [c.id, true])) as Record<ColId, boolean>;

export const DEFAULT_THEME: Theme = {
  accent: "#8b9cff",
  alpha: 0.94,
  swapSides: false,
  autoHide: true,
  hideAfter: 10,
  cols: ALL_ON,
  th: DEFAULT_TH,
  tilt: DEFAULT_TILT,
  fps: false,
  obs: false,
  discord: true,
  streamer: false,
  skin: "",
  roleAccent: false,
  vipFx: true,
  showRoles: true,
};
/** Eski varsayılan vurgu: değiştirmemiş kullanıcılar yeni Celeste moruna geçer. */
const OLD_DEFAULT_ACCENTS = ["#38bdf8", "#b89cf5"];
export const ACCENTS = ["#8b9cff", "#b89cf5", "#f0a6ca", "#34d399", "#fbbf24", "#eceff6"];
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
    return {
      accent: typeof t.accent === "string" && /^#[0-9a-f]{6}$/i.test(t.accent) && !OLD_DEFAULT_ACCENTS.includes(t.accent.toLowerCase()) ? t.accent : DEFAULT_THEME.accent,
      alpha: typeof t.alpha === "number" ? Math.min(1, Math.max(0.3, t.alpha)) : DEFAULT_THEME.alpha,
      swapSides: t.swapSides === true,
      autoHide: t.autoHide !== false,
      hideAfter: HIDE_AFTER_OPTIONS.includes(t.hideAfter as number) ? (t.hideAfter as number) : DEFAULT_THEME.hideAfter,
      cols: { ...ALL_ON, ...(t.cols ?? {}) },
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
      obs: t.obs === true,
      discord: t.discord !== false,
      streamer: t.streamer === true,
      skin: typeof t.skin === "string" && /^[a-z]{0,16}$/.test(t.skin) ? t.skin : "",
      roleAccent: t.roleAccent === true,
      vipFx: t.vipFx !== false,
      showRoles: t.showRoles !== false,
    };
  } catch { return DEFAULT_THEME; }
}

export function applyTheme(t: Theme) {
  const r = document.documentElement.style;
  r.setProperty("--accent", t.accent);
  r.setProperty("--alpha", String(t.alpha));
  document.documentElement.classList.toggle("fps", t.fps);
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* depolama dolu */ }
}

/** Tabloda kendi sütunu olan açık sütunlar (sırasıyla). */
export const gridCols = (cols: Record<ColId, boolean>) => COLS.filter((c) => cols[c.id] && !c.inline);

export const gridTemplate = (cols: Record<ColId, boolean>) =>
  ["minmax(0, 1fr)", ...gridCols(cols).map((c) => `${c.px}px`)].join(" ");

/* Açık sütunlara göre pencere genişliği (CSS px). */
/* Sol menü 64, kenar boşlukları 44, takım kartı ve satır iç boşlukları 32, oyuncu sütunu en az 210. */
export function overlayWidth(cols: Record<ColId, boolean>): number {
  const on = gridCols(cols);
  return Math.max(820, 64 + 44 + 32 + 210 + on.reduce((a, c) => a + c.px, 0) + 12 * on.length);
}
