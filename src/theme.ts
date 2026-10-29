import { DEFAULT_TILT, TILT_HOURS, TILT_LOSSES, TILT_RR, type TiltCfg } from "./tilt";

/* Kullanıcı ayarları (görünüm, taraf bilgisi, otomatik gizleme, sütunlar). Yalnızca bu bilgisayarda saklanır. */
export type ColId = "rank" | "peak" | "wr" | "form" | "skins" | "party" | "badges" | "tracker";
export interface ColDef { id: ColId; label: string; px: number }

// "Oyuncu" sütunu her zaman açıktır ve kalan genişliği alır.
export const COLS: ColDef[] = [
  { id: "rank", label: "Rank", px: 140 },
  { id: "peak", label: "Peak", px: 140 },
  { id: "wr", label: "Kazanma", px: 60 },
  { id: "form", label: "Son maçlar", px: 120 },
  { id: "skins", label: "Kaplamalar", px: 172 },
  { id: "party", label: "Parti", px: 28 },
  { id: "badges", label: "Rozetler", px: 190 },
  { id: "tracker", label: "Tracker düğmesi", px: 56 },
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
}

const ALL_ON = Object.fromEntries(COLS.map((c) => [c.id, true])) as Record<ColId, boolean>;

export const DEFAULT_THEME: Theme = {
  accent: "#38bdf8",
  alpha: 0.94,
  swapSides: false,
  autoHide: true,
  hideAfter: 10,
  cols: ALL_ON,
  th: DEFAULT_TH,
  tilt: DEFAULT_TILT,
  fps: false,
};
export const ACCENTS = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#ededed"];
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
      accent: typeof t.accent === "string" && /^#[0-9a-f]{6}$/i.test(t.accent) ? t.accent : DEFAULT_THEME.accent,
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

export const gridTemplate = (cols: Record<ColId, boolean>) =>
  ["minmax(0, 1fr)", ...COLS.filter((c) => cols[c.id]).map((c) => `${c.px}px`)].join(" ");

/* Açık sütunlara göre pencere genişliği (CSS px). */
export function overlayWidth(cols: Record<ColId, boolean>): number {
  const on = COLS.filter((c) => cols[c.id]);
  return Math.max(720, 48 + 190 + on.reduce((a, c) => a + c.px, 0) + 12 * on.length);
}
