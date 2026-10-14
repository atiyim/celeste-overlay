import type { useUpdater } from "./updater";
import { ACCENTS, COLS, DEFAULT_THEME, HIDE_AFTER_OPTIONS, type Theme } from "./theme";

interface Props { updater: ReturnType<typeof useUpdater>; theme: Theme; onChange: (t: Theme) => void; onClose: () => void }

export function Settings({ updater, theme, onChange, onClose }: Props) {
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
        </div>
      </div>
    </div>
  );
}
