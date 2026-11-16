import { useEffect, useRef, useState } from "react";
import { REPO_URL } from "./community";
import { officialP } from "./net";

/* Resmi olmayan derleme (kaynak koddan derlenmiş ya da değiştirilmiş kopya) için lisans ekranı.
   Lisans okunup kabul edilmeden uygulama açılmaz. Bu ekran ve alttaki "resmi olmayan derleme" şeridi
   lisans gereği kaldırılamaz (LICENSE, madde 2d). Resmi sürümde hiç görünmez. */
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const RELEASES_URL = `${REPO_URL}/releases/latest`;
export const CREDIT = "Based on Celeste Overlay by Res (bneceleste)";
/** Lisans metni değişince artırılır: herkes yeniden onaylar. */
const LICENSE_V = "1.1";
const KEY = "overlay-license-ok";
/** Düğme açılmadan önce metnin ekranda kalacağı en kısa süre. */
const READ_SECONDS = 20;

const TERMS: { t: string; d: string }[] = [
  { t: "Atıf kalır", d: `Uygulamanın içinde (Hakkında bölümünde) ve indirme sayfanın en başında "${CREDIT}" yazısı, ${REPO_URL} bağlantısıyla birlikte görünür olmalıdır. Kodda bulunan atıf satırları silinemez, gizlenemez, küçültülemez.` },
  { t: "Ad ve logo kullanılamaz", d: "\"Celeste\", \"Celeste Overlay\" ve \"bneceleste\" adları ile projenin logo, ikon ve görselleri bu lisansın kapsamında değildir. Kendi sürümüne açıkça farklı bir ad ve kendi ikonunu vermek zorundasın." },
  { t: "Kendi eserin gibi sunamazsın", d: "Sürümün \"resmi olmayan, değiştirilmiş sürüm\" olarak tanıtılmalıdır. \"Ben yaptım\" diyemez, yapımcısı olduğunu öne süremez, Celeste'nin bu sürümü onayladığı ya da işlettiği izlenimini veremezsin. Atıf olmadan tanıtım ve reklam yapmak ihlaldir." },
  { t: "Celeste sunucuları kapalıdır", d: "Akış, roller ve rozetler, Premium, hesap bağlama ve diğer Celeste servisleri yalnızca resmi sürümlere açıktır. Bu kopya onlara bağlanamaz. Resmi sürüm imzasını kopyalamak, çıkarmak ya da taklit etmek yasaktır; kendi sürümün için kendi sunucularını kurmalısın." },
  { t: "Bu ekran kaldırılamaz", d: "Bu lisans ekranı ve uygulamadaki \"resmi olmayan derleme\" işareti türev sürümlerde aynen kalmalıdır; kaldırılamaz, kapatılamaz, atlanamaz." },
];

export function useLicenseGate(version: string): { gate: boolean; unofficial: boolean; accept: () => void } {
  const [official, setOfficial] = useState<boolean | null>(null);
  const [ok, setOk] = useState(false);
  const stamp = `${LICENSE_V}|${version}`;
  useEffect(() => { void officialP.then(setOfficial); }, []);
  useEffect(() => { try { setOk(!!version && localStorage.getItem(KEY) === stamp); } catch { setOk(false); } }, [stamp, version]);
  return {
    // Resmi mi belli olana ve sürüm okunana kadar bekle: resmi olmayan kopya bir an bile lisanssız açılmasın.
    gate: official === false && !ok,
    unofficial: official === false,
    accept: () => { try { localStorage.setItem(KEY, stamp); } catch { /* depolama kapalı: her açılışta yeniden sorulur */ } setOk(true); },
  };
}

export function LicenseGate({ onAccept, onQuit, onOpen }: { onAccept: () => void; onQuit: () => void; onOpen: (url: string) => void }) {
  const [left, setLeft] = useState(READ_SECONDS);
  const [end, setEnd] = useState(false);
  const [agree, setAgree] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const onScroll = () => { const el = box.current; if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setEnd(true); };
  // Metin kutuya sığıyorsa kaydırmaya gerek yoktur.
  useEffect(onScroll, []);
  const ready = end && agree && left <= 0;
  const why = !end ? "Devam etmek için metni sonuna kadar oku" : left > 0 ? `Lütfen oku · ${left} sn` : !agree ? "Devam etmek için kutuyu işaretle" : "";
  return (
    <div className="lic" role="alertdialog" aria-label="Lisans şartları">
      <div className="lic-h">
        <span className="lic-tag">Resmi olmayan derleme</span>
        <h2>Bu, Celeste Overlay'in resmi sürümü değil</h2>
        <p>Bu kopya kaynak koddan derlenmiş ya da değiştirilmiş. Kod, <b>Celeste Overlay Atıf Lisansı</b> ile paylaşılır: kullanabilir, değiştirebilir ve dağıtabilirsin; ancak aşağıdaki şartların <b>tamamına</b> uymak zorundasın.</p>
      </div>
      <div className="lic-box" ref={box} onScroll={onScroll} tabIndex={0}>
        <ol>
          {TERMS.map((x) => <li key={x.t}><b>{x.t}.</b> {x.d}</li>)}
        </ol>
        <div className="lic-warn">
          <b>Uymazsan</b>
          <span>Lisanstan doğan bütün hakların kendiliğinden sona erer. Kopyalarının yayınlandığı platformlardan (GitHub, Discord, indirme siteleri) kaldırılması istenir. Hesapların Celeste servislerinden kalıcı olarak engellenir.</span>
        </div>
        <p className="lic-note">Bu bir özettir; bağlayıcı olan lisansın tam metnidir: <button className="lnk" type="button" onClick={() => onOpen(LICENSE_URL)}>LICENSE</button>. Yalnızca kullanmak istiyorsan <button className="lnk" type="button" onClick={() => onOpen(RELEASES_URL)}>resmi sürümü indir</button>.</p>
      </div>
      <label className="lic-ck"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>Lisansı okudum; şartların tamamını kabul ediyorum.</span></label>
      <div className="lic-f">
        <small aria-live="polite">{why}</small>
        <button className="x" type="button" onClick={onQuit}>Kabul etmiyorum, kapat</button>
        <button className="x go" type="button" disabled={!ready} onClick={onAccept}>Kabul ediyorum</button>
      </div>
    </div>
  );
}

/** Resmi olmayan derlemede her zaman görünen şerit. */
export function UnofficialStrip({ onOpen }: { onOpen: (url: string) => void }) {
  return (
    <button className="unoff" type="button" onClick={() => onOpen(LICENSE_URL)} title="Lisansı aç">
      <b>Resmi olmayan derleme</b><span>{CREDIT}</span>
    </button>
  );
}
