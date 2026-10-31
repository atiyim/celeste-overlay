import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { useUpdater } from "./updater";
import { ACCENTS, COLS, DEFAULT_THEME, DEFAULT_TH, FPS_HIDE_AFTER, HIDE_AFTER_OPTIONS, hideOf, type Theme, type Thresholds } from "./theme";
import { copyDiagnostics } from "./StatusBar";
import { TILT_HOURS, TILT_LOSSES, TILT_RR, fmtRr } from "./tilt";
import { DISCORD_URL } from "./community";
import { PanelHead, Row, Toggle } from "./ui";

const TH_FIELDS: { key: keyof Thresholds; label: string; hint: string; unit: string }[] = [
  { key: "hs", label: "Kafa avcısı", hint: "Kafa isabeti en az", unit: "%" },
  { key: "adr", label: "Yüksek hasar", hint: "Round başına hasar en az", unit: "" },
  { key: "fk", label: "Öncü", hint: "İlk kan, round oranı en az", unit: "%" },
  { key: "fd", label: "İlk ölen", hint: "İlk ölüm, round oranı en az", unit: "%" },
  { key: "lowHs", label: "Düşük HS", hint: "Kafa isabeti en çok", unit: "%" },
];

type Sec = "look" | "overlay" | "table" | "tilt" | "about";
const ic = (d: ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const SECS: { id: Sec; label: string; icon: ReactNode }[] = [
  { id: "look", label: "Görünüm", icon: ic(<><circle cx="8" cy="8" r="6" /><path d="M8 2v12" /></>) },
  { id: "overlay", label: "Overlay", icon: ic(<><path d="M8 2 2 5l6 3 6-3-6-3Z" /><path d="m2 8 6 3 6-3" /><path d="m2 11 6 3 6-3" /></>) },
  { id: "table", label: "Oyuncu tablosu", icon: ic(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 6.5V13" /></>) },
  { id: "tilt", label: "Tilt koruyucu", icon: ic(<path d="M1.5 8h3l1.5-4 3 8 1.5-4h4" />) },
  { id: "about", label: "Hakkında", icon: ic(<><circle cx="8" cy="8" r="6" /><path d="M8 7.5V11M8 5h.01" /></>) },
];
const SEC_KEY = "overlay-settings-sec";
const inTauri = "__TAURI_INTERNALS__" in window;
const OBS_URL = "http://127.0.0.1:7317/";

interface Props { onGuide: () => void; onOpen: (url: string) => void; updater: ReturnType<typeof useUpdater>; zoom: number; onZoom: (z: number) => void; zooms: number[]; theme: Theme; onChange: (t: Theme) => void; onToast: (t: string) => void; onClose: () => void; onFeedback: () => void }

export function Settings({ onGuide, onOpen, updater, zoom, onZoom, zooms, theme, onChange, onToast, onClose, onFeedback }: Props) {
  const [sec, setSecState] = useState<Sec>(() => {
    try { const v = localStorage.getItem(SEC_KEY) as Sec | null; return v && SECS.some((s) => s.id === v) ? v : "look"; } catch { return "look"; }
  });
  const setSec = (s: Sec) => { setSecState(s); try { localStorage.setItem(SEC_KEY, s); } catch { /* depolama kapalı */ } };
  const [thOpen, setThOpen] = useState(false);
  const hide = hideOf(theme);
  // F2 kısayolunun durumu: başka bir program tutuyorsa kullanıcı nedenini burada görür.
  const [hotkey, setHotkey] = useState<boolean | null>(null);
  useEffect(() => {
    if (!inTauri || sec !== "overlay") return;
    let live = true;
    const ask = () => invoke<boolean>("hotkey_ok").then((v) => live && setHotkey(v)).catch(() => undefined);
    ask();
    const t = window.setInterval(ask, 5000);
    return () => { live = false; window.clearInterval(t); };
  }, [sec]);
  const set = (p: Partial<Theme>) => onChange({ ...theme, ...p });
  const alphaPct = Math.round(theme.alpha * 100);

  const upText = updater.state.kind === "checking" ? "Denetleniyor…"
    : updater.state.kind === "none" ? "Güncel"
    : updater.state.kind === "available" ? `${updater.state.version} yayında`
    : updater.state.kind === "downloading" ? "İndiriliyor…"
    : updater.state.kind === "error" ? "Denetlenemedi" : null;

  return (
    <div className="panel sets" role="dialog" aria-label="Ayarlar">
      <PanelHead title="Ayarlar" sub="Değişiklikler anında uygulanır ve bu bilgisayarda kalır." onClose={onClose} />

      <div className="sset">
        <nav className="snav" aria-label="Ayar bölümleri">
          {SECS.map((s) => (
            <button key={s.id} type="button" className={sec === s.id ? "on" : ""} aria-current={sec === s.id ? "page" : undefined} onClick={() => setSec(s.id)}>
              {s.icon}<span>{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="sbody fade" key={sec}>
          {sec === "look" && (
            <>
              <section>
                <h3 className="h2">Önizleme</h3>
                <div className="prev" aria-hidden="true">
                  <div className="prevbg" />
                  <div className="prevov" style={{ background: `rgba(0, 0, 0, ${theme.alpha})` }}>
                    <span className="prevtab">Oyuncular</span>
                    <span className="prevrow">
                      <i className="prevav" />
                      <span className="prevn">Örnek oyuncu <small>#TR1</small></span>
                      <span className="rep">2. kez</span>
                    </span>
                    <span className="trk">Tracker</span>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="h2">Görünüm</h3>
                <div className="box">
                  <Row title="Vurgu rengi" desc="Seçili sekme, düğmeler ve tekrar karşılaşılan oyuncularda kullanılır.">
                    <span className="swatches">
                      {ACCENTS.map((c) => {
                        const on = c.toLowerCase() === theme.accent.toLowerCase();
                        return <button key={c} type="button" className={on ? "swatch on" : "swatch"} style={{ background: c, ["--c" as string]: c }} onClick={() => set({ accent: c })} aria-label={`Vurgu rengi ${c}`} aria-pressed={on} />;
                      })}
                      <label className="custom" title="Özel renk">
                        <input type="color" value={theme.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Özel renk seç" />
                        <span>Özel</span>
                      </label>
                    </span>
                  </Row>
                  <Row title="Yazı boyutu" desc="Bütün overlay'i büyütür ya da küçültür. Üstteki A− ve A+ ile aynı ayar.">
                    <span className="seg" role="group" aria-label="Yazı boyutu">
                      {zooms.map((z) => (
                        <button key={z} type="button" className={z === zoom ? "on" : ""} aria-pressed={z === zoom} onClick={() => onZoom(z)}>%{Math.round(z * 100)}</button>
                      ))}
                    </span>
                  </Row>
                  <Row title="Saydamlık" desc="Değer düştükçe arkadaki oyun görünür. Menüler her zaman tam opaktır.">
                    <span className="alpha">
                      <input type="range" min={30} max={100} step={2} value={alphaPct} onChange={(e) => set({ alpha: Number(e.target.value) / 100 })} aria-label="Arka plan opaklığı" style={{ ["--p" as string]: `${((alphaPct - 30) / 70) * 100}%` }} />
                      <span className="aval">%{alphaPct}</span>
                      <button className="ib" type="button" title="Renk ve saydamlığı varsayılana döndür" aria-label="Renk ve saydamlığı varsayılana döndür" onClick={() => set({ accent: DEFAULT_THEME.accent, alpha: DEFAULT_THEME.alpha })}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3v3.5H6" /><path d="M3 6.5A5.5 5.5 0 1 1 2.6 9.5" /></svg>
                      </button>
                    </span>
                  </Row>
                </div>
              </section>
            </>
          )}

          {sec === "overlay" && (
            <>
              <section>
                <h3 className="h2">Otomatik gizleme</h3>
                <div className="box">
                  <Row title="Maç başlayınca gizle" desc={theme.fps ? "FPS modu açıkken gizleme hep açık." : "Ajan seçiminde yeniden görünür. F2 ile açarsan o maç boyunca açık kalır; F2 ile gizlersen kendiliğinden dönmez."}>
                    <Toggle on={hide.on} disabled={theme.fps} label="Maç başlayınca gizle" onChange={(v) => set({ autoHide: v })} />
                  </Row>
                  <Row title="Gizleme süresi" desc="Maç başladıktan sonra ne kadar beklensin." dim={!hide.on}>
                    <select className="sel" value={hide.after} disabled={!hide.on || theme.fps} onChange={(e) => set({ hideAfter: Number(e.target.value) })} aria-label="Gizleme süresi">
                      {HIDE_AFTER_OPTIONS.map((s) => <option key={s} value={s}>{s} saniye</option>)}
                    </select>
                  </Row>
                </div>
              </section>
              <section>
                <h3 className="h2">Kısayol</h3>
                <div className="box">
                  <Row
                    title={<>F2 ile göster / gizle{hotkey !== null && <span className={hotkey ? "ustat ok" : "ustat bad"}><i />{hotkey ? "Çalışıyor" : "Çalışmıyor"}</span>}</>}
                    desc={hotkey === false
                      ? "Başka bir program F2'yi kullanıyor. O program kapanınca kendiliğinden çalışır; bu arada sistem tepsisindeki simgeye tıklayarak açıp kapatabilirsin."
                      : "Oyunun içindeyken de çalışır. Sistem tepsisindeki simgeye tıklamak da aynı işi yapar."}
                  />
                </div>
              </section>
              <section>
                <h3 className="h2">Yayın</h3>
                <div className="box">
                  <Row title="OBS kaynağı" desc="Yayında rankın, RR'ın ve bu seansın (galibiyet, mağlubiyet, RR) görünsün. OBS'te Kaynak ekle › Tarayıcı'yı seç, adresi yapıştır; genişlik 420, yükseklik 100. Sayfa yalnızca bu bilgisayardan açılır.">
                    <Toggle on={theme.obs} label="OBS kaynağı" onChange={(v) => set({ obs: v })} />
                  </Row>
                  {theme.obs && (
                    <Row title={<code className="obsurl">{OBS_URL}</code>} desc="Rank ve seans 2 dakikada bir ve her maçtan sonra yenilenir.">
                      <button className="x" type="button" onClick={() => { navigator.clipboard.writeText(OBS_URL).then(() => onToast("Adres kopyalandı"), () => onToast("Kopyalanamadı")); }}>Adresi kopyala</button>
                    </Row>
                  )}
                </div>
              </section>
              <section>
                <h3 className="h2">Performans</h3>
                <div className="box">
                  <Row title="FPS modu" desc={`Oyunda FPS düşüşü yaşıyorsan aç. Animasyonlar kapanır, overlay maçta en geç ${FPS_HIDE_AFTER} saniyede gizlenir ve gizliyken denetimler seyrekleşir. Gösterilen bilgiler değişmez.`}>
                    <Toggle on={theme.fps} label="FPS modu" onChange={(v) => { set({ fps: v }); onToast(v ? "FPS modu açık" : "FPS modu kapalı"); }} />
                  </Row>
                </div>
              </section>
              <section>
                <h3 className="h2">Takım tarafı</h3>
                <div className="box">
                  <Row title="Saldıran ve savunanı ters çevir" desc="Taraf, takım rengine göre belirlenir ve yalnızca ilk yarıda doğrudur. Oyundakinin tersi görünüyorsa aç.">
                    <Toggle on={theme.swapSides} label="Saldıran ve savunanı ters çevir" onChange={(v) => set({ swapSides: v })} />
                  </Row>
                </div>
              </section>
            </>
          )}

          {sec === "table" && (
            <>
              <section>
                <h3 className="h2">Görünen sütunlar<span className="hv">Kapattığın sütun kadar overlay daralır</span></h3>
                <div className="colstrip" aria-hidden="true">
                  <span className="cs main">Oyuncu</span>
                  {COLS.filter((c) => theme.cols[c.id]).map((c) => <span key={c.id} className="cs" style={{ flexGrow: c.px }}>{c.id === "tracker" ? "Tracker" : c.label}</span>)}
                </div>
                <div className="colgrid">
                  <span className="colc lock" title="Oyuncu sütunu her zaman açık">
                    <i className="cbx"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg></i>
                    Oyuncu
                  </span>
                  {COLS.map((c) => {
                    const on = theme.cols[c.id];
                    return (
                      <button key={c.id} type="button" className={on ? "colc on" : "colc"} aria-pressed={on} onClick={() => set({ cols: { ...theme.cols, [c.id]: !on } })}>
                        <i className="cbx">{on && <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>}</i>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section>
                <h3 className="h2">Rozetler</h3>
                <div className="box">
                  <Row title="Rozet eşikleri" desc="Rozetler, son rekabet maçlarında ölçülen değer bu sınırı aşınca çıkar.">
                    <button className={thOpen ? "x on" : "x"} type="button" aria-expanded={thOpen} onClick={() => setThOpen(!thOpen)}>{thOpen ? "Gizle" : "Sayıları düzenle"}</button>
                  </Row>
                  {thOpen && (
                    <div className="thg fade">
                      {TH_FIELDS.map((f) => (
                        <div className="thr" key={f.key}>
                          <label htmlFor={`th-${f.key}`}><b>{f.label}</b><small>{f.hint}{f.unit ? ` (${f.unit})` : ""}</small></label>
                          <input
                            id={`th-${f.key}`} type="number" min={0} value={theme.th[f.key]}
                            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) set({ th: { ...theme.th, [f.key]: v } }); }}
                          />
                        </div>
                      ))}
                      <div className="thr end"><button className="x" type="button" onClick={() => set({ th: DEFAULT_TH })}>Varsayılana dön</button></div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {sec === "tilt" && (
            <>
              <section>
                <div className="box">
                  <Row title="Zor bir seansta hatırlatma göster" desc="Yalnızca kendi rekabet maçlarına bakar.">
                    <Toggle on={theme.tilt.on} label="Zor bir seansta hatırlatma göster" onChange={(v) => set({ tilt: { ...theme.tilt, on: v } })} />
                  </Row>
                </div>
              </section>
              <section>
                <h3 className="h2">Eşikler<span className="hv">Seans: aralarında 100 dakikadan uzun ara olmayan maçlar</span></h3>
                <div className="box">
                  <Row title="Üst üste kayıp" dim={!theme.tilt.on}>
                    <select className="sel" value={theme.tilt.losses} disabled={!theme.tilt.on} aria-label="Üst üste kayıp sayısı" onChange={(e) => set({ tilt: { ...theme.tilt, losses: Number(e.target.value) } })}>
                      {TILT_LOSSES.map((n) => <option key={n} value={n}>{n} maç</option>)}
                    </select>
                  </Row>
                  <Row title="Seanstaki RR kaybı" dim={!theme.tilt.on}>
                    <select className="sel" value={theme.tilt.rr} disabled={!theme.tilt.on} aria-label="Seanstaki RR kaybı" onChange={(e) => set({ tilt: { ...theme.tilt, rr: Number(e.target.value) } })}>
                      {TILT_RR.map((n) => <option key={n} value={n}>{fmtRr(n)}</option>)}
                    </select>
                  </Row>
                  <Row title="Oyun süresi" dim={!theme.tilt.on}>
                    <select className="sel" value={theme.tilt.hours} disabled={!theme.tilt.on} aria-label="Oyun süresi" onChange={(e) => set({ tilt: { ...theme.tilt, hours: Number(e.target.value) } })}>
                      {TILT_HOURS.map((n) => <option key={n} value={n}>{n === 0 ? "Hatırlatma yok" : `${n} saat`}</option>)}
                    </select>
                  </Row>
                </div>
              </section>
              <section className={theme.tilt.on ? "" : "dim"}>
                <h3 className="h2">Hatırlatma böyle görünür</h3>
                <div className="tilt" aria-hidden="true"><span>3 saattir oynuyorsun. Biraz ara vermek iyi olabilir.</span><span className="x">Tamam</span></div>
              </section>
            </>
          )}

          {sec === "about" && (
            <>
              <section>
                <h3 className="h2">Güncelleme</h3>
                <div className="box">
                  <Row
                    title={<>Sürüm {updater.version || "–"}{upText && <span className={updater.state.kind === "error" ? "ustat bad" : updater.state.kind === "none" ? "ustat ok" : "ustat"}><i />{upText}</span>}</>}
                    desc={updater.state.kind === "error" ? <span className="err">{updater.state.msg}</span> : "Açılışta ve 6 saatte bir denetlenir."}
                  >
                    {updater.state.kind === "available"
                      ? <button className="x go" type="button" onClick={updater.install}>Güncelle ve yeniden başlat</button>
                      : <button className="x" type="button" onClick={updater.check} disabled={updater.state.kind === "checking" || updater.state.kind === "downloading"}>Şimdi denetle</button>}
                  </Row>
                </div>
              </section>
              <section>
                <h3 className="h2">Topluluk</h3>
                <div className="box">
                  <Row title="Discord" desc="Soru, hata bildirimi, öneri ve yeni sürümler orada. Beta sürümleri önce orada denenir.">
                    <span className="btns">
                      <button className="x" type="button" onClick={onFeedback}>Öneri / Hata bildir</button>
                      <button className="x go" type="button" onClick={() => onOpen(DISCORD_URL)}>Discord'a katıl</button>
                    </span>
                  </Row>
                </div>
              </section>
              <section>
                <h3 className="h2">Hakkında</h3>
                <div className="box">
                  <p className="snote">Celeste Overlay, Riot Games ile bağlantılı değildir. Oyuna dokunmaz, yalnızca açık Riot Client oturumunu okur. Etiketler ve notlar yalnızca bu bilgisayarda saklanır.</p>
                  <Row title="Sorun giderme">
                    <span className="btns">
                      <button className="x" type="button" onClick={onGuide}>Rehberi yeniden göster</button>
                      <button className="x" type="button" onClick={() => copyDiagnostics(updater.version, [], onToast)}>Tanı bilgisini kopyala</button>
                    </span>
                  </Row>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
