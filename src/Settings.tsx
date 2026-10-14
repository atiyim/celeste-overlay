import type { useUpdater } from "./updater";
import { Fragment } from "react";
import { ACCENTS, COLS, DEFAULT_THEME, DEFAULT_TH, HIDE_AFTER_OPTIONS, type Theme, type Thresholds } from "./theme";
import { copyDiagnostics } from "./StatusBar";

const TH_FIELDS: { key: keyof Thresholds; label: string; hint: string; unit: string }[] = [
  { key: "hs", label: "Kafa avcısı", hint: "Kafa isabeti en az", unit: "%" },
  { key: "adr", label: "Yüksek hasar", hint: "Round başına hasar en az", unit: "" },
  { key: "fk", label: "Öncü", hint: "İlk kan, round oranı en az", unit: "%" },
  { key: "fd", label: "İlk ölen", hint: "İlk ölüm, round oranı en az", unit: "%" },
  { key: "lowHs", label: "Düşük HS", hint: "Kafa isabeti en çok", unit: "%" },
  { key: "smurfLevel", label: "Smurf: seviye", hint: "Bu seviyenin altı + Altın üstü rank", unit: "" },
  { key: "smurfWr", label: "Smurf: kazanma", hint: "Bu orandan yüksek, en az 10 maç", unit: "%" },
];

interface Props { updater: ReturnType<typeof useUpdater>; theme: Theme; onChange: (t: Theme) => void; onToast: (t: string) => void; onClose: () => void }

export function Settings({ updater, theme, onChange, onToast, onClose }: Props) {
  return (
    <div className="panel" role="dialog" aria-label="Ayarlar">
      <div className="ph">
        <div>
          <h2 className="t">Ayarlar</h2>
          <p className="m">Değişiklikler anında uygulanır ve bu bilgisayarda saklanır.</p>
        </div>
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>

      <div className="setgrid">
        <div>
          <h2 className="h">Vurgu rengi</h2>
          <div className="swatches">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                className={c.toLowerCase() === theme.accent.toLowerCase() ? "swatch on" : "swatch"}
                style={{ background: c }}
                onClick={() => onChange({ ...theme, accent: c })}
                aria-label={`Vurgu rengi ${c}`}
                aria-pressed={c.toLowerCase() === theme.accent.toLowerCase()}
              />
            ))}
            <label className="custom">
              <input type="color" value={theme.accent} onChange={(e) => onChange({ ...theme, accent: e.target.value })} aria-label="Özel renk seç" />
              <span>Özel renk</span>
            </label>
          </div>

          <h2 className="h">Saydamlık</h2>
          <div className="alpha">
            <input
              type="range"
              min={30}
              max={100}
              step={2}
              value={Math.round(theme.alpha * 100)}
              onChange={(e) => onChange({ ...theme, alpha: Number(e.target.value) / 100 })}
              aria-label="Arka plan opaklığı"
            />
            <span>%{Math.round(theme.alpha * 100)} opak</span>
          </div>
          <div className="note">
            <button className="x" type="button" onClick={() => onChange({ ...theme, accent: DEFAULT_THEME.accent, alpha: DEFAULT_THEME.alpha })}>
              Varsayılana dön
            </button>
          </div>

          <h2 className="h">Saldıran / Savunan</h2>
          <label className="chk">
            <input type="checkbox" checked={theme.swapSides} onChange={(e) => onChange({ ...theme, swapSides: e.target.checked })} />
            <span>Taraf oyundakinin tersi görünüyorsa değiştir</span>
          </label>
          <p className="m">Taraf, takım rengine göre belirlenir ve yalnızca ilk yarıda doğrudur.</p>

          <h2 className="h">Rozet eşikleri</h2>
          <details className="ths">
            <summary>Sayıları düzenle</summary>
            <div className="thg">
              {TH_FIELDS.map((f) => (
                <Fragment key={f.key}>
                  <label htmlFor={`th-${f.key}`}>{f.label}<small>{f.hint}{f.unit ? ` (${f.unit})` : ""}</small></label>
                  <input
                    id={`th-${f.key}`}
                    type="number"
                    min={0}
                    value={theme.th[f.key]}
                    onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) onChange({ ...theme, th: { ...theme.th, [f.key]: v } }); }}
                  />
                </Fragment>
              ))}
            </div>
            <div className="note"><button className="x" type="button" onClick={() => onChange({ ...theme, th: DEFAULT_TH })}>Varsayılana dön</button></div>
          </details>
          <p className="m">Rozetler, son 5 maçta ölçülen değer bu sınırı aşınca çıkar.</p>

        </div>

        <div>
          <h2 className="h">Otomatik gizleme</h2>
          <label className="chk">
            <input type="checkbox" checked={theme.autoHide} onChange={(e) => onChange({ ...theme, autoHide: e.target.checked })} />
            <span>Maç başlayınca overlay'i gizle</span>
          </label>
          <label className="chk">
            <span>Gizleme süresi</span>
            <select
              value={theme.hideAfter}
              disabled={!theme.autoHide}
              onChange={(e) => onChange({ ...theme, hideAfter: Number(e.target.value) })}
              aria-label="Gizleme süresi"
            >
              {HIDE_AFTER_OPTIONS.map((s) => <option key={s} value={s}>{s} saniye</option>)}
            </select>
          </label>
          <p className="m">Ajan seçiminde yeniden görünür. F2 ile açarsan o maç boyunca açık kalır; F2 ile gizlersen kendiliğinden dönmez.</p>

          <h2 className="h">Güncelleme</h2>
          <p className="m">
            Sürüm {updater.version || "–"}, {" "}
            {updater.state.kind === "checking" ? "denetleniyor"
              : updater.state.kind === "none" ? "güncel"
              : updater.state.kind === "available" ? `${updater.state.version} yayında`
              : updater.state.kind === "downloading" ? "indiriliyor"
              : updater.state.kind === "error" ? "denetlenemedi" : "açılışta ve 6 saatte bir denetlenir"}
          </p>
          <p className="m">
            <button className="x" type="button" onClick={updater.check}>Şimdi denetle</button>
            {updater.state.kind === "available" && <button className="x" type="button" style={{ marginLeft: 8 }} onClick={updater.install}>Güncelle ve yeniden başlat</button>}
          </p>
          {updater.state.kind === "error" && <p className="m err">{updater.state.msg}</p>}

          <h2 className="h">Sütunlar</h2>
          <label className="chk"><input type="checkbox" checked disabled /><span>Oyuncu (kapatılamaz)</span></label>
          {COLS.map((c) => (
            <label className="chk" key={c.id}>
              <input
                type="checkbox"
                checked={theme.cols[c.id]}
                onChange={(e) => onChange({ ...theme, cols: { ...theme.cols, [c.id]: e.target.checked } })}
              />
              <span>{c.label}</span>
            </label>
          ))}
          <p className="m">Kapattığın sütun kadar overlay daralır.</p>

          <h2 className="h">Hakkında</h2>
          <p className="m">Celeste Overlay, Riot Games ile bağlantılı değildir. Oyuna dokunmaz; yalnızca açık Riot Client oturumunu okur. Etiketler ve notlar yalnızca bu bilgisayarda saklanır.</p>
          <p className="m"><button className="x" type="button" onClick={() => copyDiagnostics(updater.version, [], onToast)}>Tanı bilgisini kopyala</button></p>
        </div>
      </div>
    </div>
  );
}
