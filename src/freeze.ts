import { getCurrentWindow } from "@tauri-apps/api/window";

/* Arka planda dondurma: overlay öndeyken (odaktayken) efektler oynar; oyun ya da başka bir pencere öndeyken
   bütün animasyon ve geçişler durur. Böylece overlay görünür kalsa bile ekran kartına sürekli çizim yükü bindirmez.
   Görünüm değişmez: süren efektler son hâlinde kalır, öne gelince kaldığı yerden devam eder. */
const inTauri = "__TAURI_INTERNALS__" in window;
let frozen = false;
const subs = new Set<(f: boolean) => void>();

function set(next: boolean) {
  if (next === frozen) return;
  frozen = next;
  document.documentElement.classList.toggle("frozen", next);
  subs.forEach((f) => f(next));
}

/** Overlay şu an arka planda mı (efektler durdu mu). */
export const isFrozen = () => frozen;

/** Durum değişince haber verir; aboneliği kaldıran işlevi döner. */
export function onFreeze(f: (frozen: boolean) => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** Uygulama açılırken bir kez çağrılır. */
export function initFreeze() {
  const sync = (focused: boolean) => set(document.hidden || !focused);
  window.addEventListener("focus", () => sync(true));
  window.addEventListener("blur", () => sync(false));
  document.addEventListener("visibilitychange", () => sync(document.hasFocus()));
  sync(document.hasFocus());
  if (!inTauri) return;
  // Pencerenin kendi odak bilgisi: WebView'in odak olayları kaçarsa (oyun öne geçerken) bu yakalar.
  const w = getCurrentWindow();
  w.isFocused().then(sync).catch(() => undefined);
  w.onFocusChanged(({ payload }) => sync(payload)).catch(() => undefined);
}
