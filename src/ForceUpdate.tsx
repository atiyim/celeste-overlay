import { useEffect, useState } from "react";
import { SITE } from "./community";
import { OUTDATED_EVENT, tfetch } from "./net";
import type { useUpdater } from "./updater";

/* Zorunlu güncelleme: yönetici en düşük sürümü yükseltince eski sürümler bu ekranla durur.
   Sunucu iki yoldan söyler: açılışta ve yarım saatte bir sorulan /api/overlay/version, ya da Akış isteklerine 426. */
const RELEASES = "https://github.com/atiyim/celeste-overlay/releases/latest";
const inTauri = "__TAURI_INTERNALS__" in window;

export function useOutdated(version: string) {
  const [state, setState] = useState<{ min: string | null; message?: string } | null>(null);
  useEffect(() => {
    if (!inTauri || !/^\d+\.\d+\.\d+$/.test(version)) return;
    let stop = false;
    const ask = async () => {
      try {
        const r = await tfetch(`${SITE}/api/overlay/version?v=${version}`);
        const d = (await r.json()) as { min: string | null; outdated?: boolean; message?: string };
        if (!stop) setState(d.outdated ? { min: d.min, message: d.message } : null);
      } catch { /* internet yoksa engelleme */ }
    };
    void ask();
    const t = window.setInterval(ask, 30 * 60_000);
    const on = () => { void ask(); };
    window.addEventListener(OUTDATED_EVENT, on);
    return () => { stop = true; window.clearInterval(t); window.removeEventListener(OUTDATED_EVENT, on); };
  }, [version]);
  return state;
}

export function ForceUpdate({ info, updater, onOpen }: { info: { min: string | null; message?: string }; updater: ReturnType<typeof useUpdater>; onOpen: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  const s = updater.state;
  const busy = s.kind === "checking" || s.kind === "downloading";
  const start = async () => { setFailed(false); if (!(await updater.force())) setFailed(true); };
  // Ekran açılınca güncellemeyi kendiliğinden başlat (maç bitmiş olsun diye beklemeye gerek yok: uygulama zaten kullanılamıyor).
  useEffect(() => { void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fupd" role="alertdialog" aria-label="Güncelleme gerekli">
      <div className="fupc">
        <span className="fupi" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11" /><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" /></svg>
        </span>
        <h2>Güncelleme gerekli</h2>
        <p>Bu sürüm ({updater.version || "eski"}) artık desteklenmiyor{info.min ? <>; en az <b>v{info.min}</b> gerekiyor</> : null}. Güncelleme birkaç saniye sürer, ayarların ve notların korunur.</p>
        {s.kind === "downloading"
          ? <div className="fupbar" aria-label="İndiriliyor"><i style={{ width: `${s.pct ?? 35}%` }} className={s.pct == null ? "ind" : ""} /><span>İndiriliyor {s.pct != null ? `%${s.pct}` : "…"}</span></div>
          : <button className="x go fupb" type="button" disabled={busy} onClick={start}>{s.kind === "checking" ? "Denetleniyor…" : "Şimdi güncelle"}</button>}
        {(failed || s.kind === "error") && (
          <p className="fupe">Otomatik güncelleme yapılamadı. <button className="lnk" type="button" onClick={() => onOpen(RELEASES)}>Yeni sürümü indir</button> ve kur.</p>
        )}
      </div>
    </div>
  );
}
