import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import type { useUpdater } from "./updater";
import { copyDiagnostics } from "./StatusBar";
import { DISCORD_URL, INSTAGRAM_URL, OWNER_DISCORD_URL, OWNER_NAME, REPO_URL, SITE } from "./community";
import { feedAdmin } from "./feed";
import { tfetch } from "./net";
import { useMe } from "./vip";
import { Icon } from "./icons";
import { PanelHead, Row } from "./ui";

/* Hakkında: geliştirici atfı, sürüm/güncelleme, topluluk ve sorun giderme. (Eskiden Ayarlar'daydı.)
   Atıf bloğu LICENSE gereği türev sürümlerde de kalmak zorundadır. */

const inTauri = "__TAURI_INTERNALS__" in window;
const open = (url: string) => { if (inTauri) openUrl(url).catch(() => undefined); else window.open(url, "_blank"); };

interface Props {
  updater: ReturnType<typeof useUpdater>;
  onOpen: (url: string) => void;
  onFeedback: () => void;
  onGuide: () => void;
  onToast: (t: string) => void;
  onClose: () => void;
}

export function AboutPanel({ updater, onOpen, onFeedback, onGuide, onToast, onClose }: Props) {
  const upText = updater.state.kind === "checking" ? "Denetleniyor…"
    : updater.state.kind === "none" ? "Güncel"
    : updater.state.kind === "available" ? `${updater.state.version} yayında`
    : updater.state.kind === "downloading" ? "İndiriliyor…"
    : updater.state.kind === "error" ? "Denetlenemedi" : null;
  return (
    <div className="panel fade">
      <PanelHead title="Hakkında" sub="Geliştirici, sürüm ve topluluk" onClose={onClose} />
      <div className="ab">
        <section className="ab-credit" aria-label="Geliştirici">
          <img className="ab-logo" src="/celeste-mark.png" alt="" draggable={false} />
          <div className="ab-txt">
            <span className="ab-kicker">Celeste Overlay</span>
            <h3 className="ab-by">
              <button type="button" className="ab-name" onClick={() => open(OWNER_DISCORD_URL)} title="Discord profilini aç">{OWNER_NAME}</button> tarafından geliştirildi
            </h3>
            <p className="ab-sub">Açık kaynak, <b>Celeste Overlay Atıf Lisansı</b> ile yayınlanır: kullanabilir ve geliştirebilirsin, ama kendi eserin gibi tanıtamaz ve Celeste adıyla yayınlayamazsın.</p>
            <div className="ab-links">
              <button type="button" className="ab-lk dc" onClick={() => open(OWNER_DISCORD_URL)}><Icon name="chat" size={15} />Discord profilim</button>
              <button type="button" className="ab-lk" onClick={() => open(INSTAGRAM_URL)}><Icon name="user" size={15} />@bneceleste</button>
              <button type="button" className="ab-lk" onClick={() => open(REPO_URL)}><Icon name="link" size={15} />Kaynak kodu</button>
            </div>
          </div>
        </section>
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
        <MinVersion current={updater.version} onToast={onToast} />
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
          <h3 className="h2">Gizlilik ve sorun giderme</h3>
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
      </div>
    </div>
  );
}

const cmpVer = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

/** Yönetici: zorunlu güncelleme. Bu sürümün altındakiler uygulamayı güncellemeden kullanamaz. */
function MinVersion({ current, onToast }: { current: string; onToast: (t: string) => void }) {
  const me = useMe();
  const [min, setMin] = useState<string | null | undefined>(undefined);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!me?.admin) return;
    tfetch(`${SITE}/api/overlay/version`).then((r) => r.json()).then((d: { min: string | null }) => { setMin(d.min); setV(d.min ?? ""); }).catch(() => setMin(null));
  }, [me?.admin]);
  if (!me?.admin) return null;
  const save = async (val: string) => {
    if (val && !/^\d+\.\d+\.\d+$/.test(val)) { onToast("Sürüm 0.7.3 biçiminde olmalı"); return; }
    if (val && current && cmpVer(val, current) > 0) { onToast("Kendi sürümünden yüksek olamaz; önce güncelle"); return; }
    setBusy(true);
    try { const r = await feedAdmin<{ min: string | null }>("min_version", { version: val }); setMin(r.min); setV(r.min ?? ""); onToast(r.min ? `v${r.min} altı artık güncellemeden kullanılamaz` : "Zorunlu güncelleme kapatıldı"); }
    catch (e) { onToast(e instanceof Error ? e.message : "Kaydedilemedi"); }
    setBusy(false);
  };
  return (
    <section>
      <h3 className="h2">Zorunlu güncelleme<span className="hv">Yalnızca yönetici görür</span></h3>
      <div className="box">
        <Row title="En düşük sürüm" desc={min ? <>Şu an <b>v{min}</b> altındakiler engelli: uygulama güncelleme ekranında durur, Akış ve roller çalışmaz.</> : "Kapalı: her sürüm kullanılabilir."}>
          <span className="btns">
            <input className="inp" style={{ width: 92 }} value={v} placeholder={current || "0.7.3"} onChange={(e) => setV(e.target.value.trim())} onKeyDown={(e) => e.stopPropagation()} aria-label="En düşük sürüm" />
            <button className="x go" type="button" disabled={busy || v === (min ?? "")} onClick={() => save(v)}>Kaydet</button>
            {min && <button className="x" type="button" disabled={busy} onClick={() => save("")}>Kapat</button>}
          </span>
        </Row>
      </div>
    </section>
  );
}
