import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NetEntry, NetReport } from "./net";
import { mockNet } from "./mock";
import { PanelHead, Row } from "./ui";

const inTauri = "__TAURI_INTERNALS__" in window;

/* Sıkça sorulanlar: her cevap tek bir şey söyler, birbirini tekrar etmez. */
const TOS = "https://www.riotgames.com/tr/terms-of-service-TR";
const FAQ: { q: string; a: string; tos?: boolean }[] = [
  { q: "Neden güvenmeliyim?", a: "Kaynak kodu açık. Üstelik uygulamanın attığı her istek Canlı kayıt sekmesinde anında görünür; söylenenle yapılanı kendi gözünle karşılaştırabilirsin." },
  { q: "Hesabım banlanır mı?", a: "Riot hiçbir üçüncü taraf uygulamayı onaylamıyor ve Vanguard'ın bir uygulamayı şimdi ya da ileride işaretlemeyeceğini garanti etmiyor. Biz de garanti veremeyiz; yalnızca ne yaptığımızı gösteririz.", tos: true },
  { q: "Şifremi istiyor mu?", a: "Hayır, giriş ekranı yok. Açık Riot Client oturumunu kullanır ve oturum bilgisi yalnızca Riot sunucularına gider." },
  { q: "Oyuna dokunuyor mu?", a: "Hayır. Yalnızca okur: oyun belleğine girmez, tuş ya da tıklama göndermez, dosyaları değiştirmez." },
  { q: "Hile sayılır mı?", a: "Rakibin konumu ya da görüşü gibi anlık oyun bilgisi göstermez; yalnızca rank, maç geçmişi ve kaplama gibi sonradan da öğrenilebilen bilgiler." },
  { q: "Partiyi nasıl biliyor?", a: "Arkadaşların için Riot Client'tan, kesin olarak. Diğer oyuncular için önceki maç kayıtlarından: bir önceki maçlarını ya da son maçlarını aynı partide oynayıp şimdi aynı takımdalarsa aynı parti gösterilir. Harfin üstüne gelince hangisi olduğu yazar." },
  { q: "Gizli isimleri açar mı?", a: "Hayır. İsmini gizleyen oyuncunun adı sorgulanmaz, saklanmaz, gösterilmez." },
  { q: "Verilerim nereye gidiyor?", a: "Etiketler, notlar ve ayarlar bu bilgisayarda kalır. Uygulama kaç kişinin kullandığını saymak için yalnızca rastgele bir kimlik ve sürüm numarası gönderir. Öneri / Hata formunu gönderirsen yazdığınla birlikte Riot ID'n de gider. Şifren, oturum bilgilerin, lobideki oyuncular ve maç bilgisi hiç gönderilmez. Hepsi Canlı kayıt sekmesinde görünür." },
  { q: "Virüs var mı? Nasıl kontrol ederim?", a: "Kurulum dosyasını GitHub kendi sunucularında, depodaki açık koddan derler ve mühürler. Yukarıdaki Bu kurulumu doğrula düğmesi senin dosyanı GitHub'dakiyle karşılaştırır. Windows ve bazı antivirüsler imzasız yeni dosyalara uyarı verebilir; bu tek başına virüs anlamına gelmez." },
];

const TARGET: Record<NetEntry["target"], string> = {
  local: "Bu bilgisayar · Riot Client",
  riot: "Riot sunucuları",
  assets: "valorant-api.com · görsel sözlüğü",
  github: "GitHub · güncelleme denetimi",
  celeste: "Celeste · kullanım sayımı ve öneri formu",
  other: "Beklenmeyen adres",
};

type Tab = "faq" | "live" | "data";
const hhmmss = (t: number) => new Date(t).toLocaleTimeString("tr-TR", { hour12: false });

/* Bu bilgisayarda saklanan yerel veriler (yalnızca overlay'in kendi anahtarları). */
function localData(): { label: string; n: number }[] {
  const count = (key: string): number => {
    try { const v = JSON.parse(localStorage.getItem(key) ?? "null"); return v && typeof v === "object" ? Object.keys(v).length : 0; } catch { return 0; }
  };
  const seen = (() => { try { return Object.values(JSON.parse(localStorage.getItem("overlay-seen") ?? "{}") as Record<string, { label?: string; tag?: string; note?: string }>); } catch { return []; } })();
  return [
    { label: "Karşılaştığın oyuncular", n: count("overlay-seen") },
    { label: "Etiket ve notlar", n: seen.filter((e) => e.label || e.tag || e.note).length },
  ];
}

interface InstallCheck { status: "ok" | "mismatch" | "unavailable"; own: string; matched?: string | null; url: string }

/* "Bu kurulumu doğrula": çalışan dosyanın parmak izi GitHub'ın bu sürüm için yayınladığı listeyle karşılaştırılır. */
function Verify() {
  const [st, setSt] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done"; r: InstallCheck } | { kind: "error"; msg: string }>({ kind: "idle" });
  const run = async () => {
    if (!inTauri) { setSt({ kind: "error", msg: "Doğrulama yalnızca masaüstü uygulamasında çalışır." }); return; }
    setSt({ kind: "busy" });
    try { setSt({ kind: "done", r: await invoke<InstallCheck>("verify_install") }); }
    catch (e) { setSt({ kind: "error", msg: String(e) }); }
  };
  const r = st.kind === "done" ? st.r : null;
  return (
    <div className={`box verify${r?.status === "ok" ? " ok" : r?.status === "mismatch" ? " bad" : ""}`}>
      <Row
        title={r?.status === "ok" ? "Bu kurulum doğrulandı" : r?.status === "mismatch" ? "Bu kurulum GitHub'daki dosyayla eşleşmedi" : "Bu kurulumu doğrula"}
        desc={
          r?.status === "ok" ? "Bilgisayarındaki uygulama dosyası, GitHub'ın açık koddan derleyip yayınladığı dosyayla birebir aynı."
          : r?.status === "mismatch" ? "Kendin derlediysen ya da başka bir yerden indirdiysen bu normaldir. Emin değilsen uygulamayı GitHub'daki sürüm sayfasından yeniden kur."
          : r?.status === "unavailable" ? "Bu sürüm, parmak izi yayınlanmaya başlamadan önce çıktı. Bir sonraki güncellemeden sonra doğrulayabilirsin."
          : st.kind === "error" ? <span className="err">{st.msg}</span>
          : "Uygulama kendi dosyasının parmak izini (SHA256) hesaplar ve GitHub'ın bu sürüm için yayınladığı parmak iziyle karşılaştırır."
        }
      >
        <button className={r?.status === "ok" ? "x" : "x go"} type="button" disabled={st.kind === "busy"} onClick={run}>{st.kind === "busy" ? "Kontrol ediliyor…" : r ? "Tekrar kontrol et" : "Doğrula"}</button>
      </Row>
      {r && r.status !== "unavailable" && <p className="vhash"><span>Bu dosya</span><code>{r.own}</code></p>}
    </div>
  );
}

export function TrustPanel({ onClose, onToast, onOpen }: { onClose: () => void; onToast: (t: string) => void; onOpen: (url: string) => void }) {
  const [rep, setRep] = useState<NetReport | null>(null);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTabState] = useState<Tab>(() => { try { const v = localStorage.getItem("overlay-trust-tab") as Tab | null; return v === "live" || v === "data" ? v : "faq"; } catch { return "faq"; } });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem("overlay-trust-tab", t); } catch { /* depolama kapalı */ } };
  const [q, setQ] = useState<number | null>(0);
  const tick = useRef(0);

  const load = useCallback(async () => {
    try { setRep(inTauri ? await invoke<NetReport>("get_net_report") : mockNet(tick.current++)); } catch { /* sonraki turda */ }
  }, []);
  useEffect(() => {
    load();
    if (paused) return;
    const t = window.setInterval(load, 1500);
    return () => window.clearInterval(t);
  }, [load, paused]);

  const data = useMemo(localData, [confirm, rep?.total]);
  const feed = rep?.entries.slice(0, 60) ?? [];

  const copyFeed = async () => {
    if (!rep) return;
    const lines = [
      `Celeste Overlay · ağ günlüğü · ${rep.total} istek (okuma ${rep.reads}, sorgu ${rep.queries}, yazma ${rep.writes}, hata ${rep.errors})`,
      ...rep.entries.slice(0, 100).map((e) => `${hhmmss(e.t)} ${e.method} ${e.host}${e.path} → ${e.status || "hata"} (${e.ms} ms) · ${e.what}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(lines); onToast("Akış kopyalandı"); } catch { onToast("Kopyalanamadı"); }
  };

  const wipe = () => {
    if (!confirm) { setConfirm(true); window.setTimeout(() => setConfirm(false), 4000); return; }
    try { Object.keys(localStorage).filter((k) => k.startsWith("overlay-")).forEach((k) => localStorage.removeItem(k)); } catch { /* depolama kapalı */ }
    onToast("Yerel veriler silindi");
    window.setTimeout(() => window.location.reload(), 600);
  };

  const TABS: [Tab, string][] = [["faq", "S.S.S"], ["live", "Canlı kayıt"], ["data", "Bu bilgisayar"]];

  return (
    <div className="panel trust" role="dialog" aria-label="S.S.S & Panel">
      <PanelHead
        title="S.S.S & Panel"
        sub="Bu uygulama ne yapar, ne yapmaz? Kısa cevaplar ve onları doğrulayan canlı kayıt."
        actions={
          <span className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                {label}{id === "live" && <i className={paused ? "tdot off" : "tdot"} aria-hidden="true" />}
              </button>
            ))}
          </span>
        }
        onClose={onClose}
      />

      {tab === "faq" && (
        <div className="tbody fade">
          <Verify />
          <div className="faq2">
            {FAQ.map((f, i) => {
              const on = q === i;
              return (
                <div key={f.q} className={on ? "fq2 on" : "fq2"}>
                  <button type="button" aria-expanded={on} onClick={() => setQ(on ? null : i)}>
                    <span>{f.q}</span><i className="chev" aria-hidden="true" />
                  </button>
                  {on && <p className="fade">{f.a}{f.tos && <> <button className="lnk" type="button" onClick={() => onOpen(TOS)}>Riot hizmet şartları</button></>}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "live" && (
        <div className="tbody fade">
          <div className="lhead">
            <span className="m"><i className={paused ? "dot off" : "dot"} />{paused ? "Duraklatıldı" : "Uygulamanın attığı her istek, anında"}</span>
            <span className="lhr">
              <button className="x" type="button" onClick={() => setPaused((p) => !p)}>{paused ? "Devam et" : "Duraklat"}</button>
              <button className="x" type="button" onClick={copyFeed}>Kopyala</button>
            </span>
          </div>
          <div className="nstats">
            <div><b>{rep?.total ?? 0}</b><small>istek</small></div>
            <div><b>{rep?.lastMinute ?? 0}</b><small>son dakikada</small></div>
            <div><b>{rep?.reads ?? 0}</b><small>okuma</small></div>
            <div><b>{rep?.queries ?? 0}</b><small title="İsim ve mağaza sorguları: veri ister, bir şey değiştirmez">sorgu</small></div>
            <div className={rep && rep.writes > 0 ? "bad" : "good"}><b>{rep?.writes ?? 0}</b><small title="Riot'ta bir şeyi değiştiren istek">yazma</small></div>
            <div className={rep && rep.errors > 0 ? "warn" : ""}><b>{rep?.errors ?? 0}</b><small title="Yanıt vermeyen ya da hata dönen istek (Riot Client kapalıyken olağan)">hata</small></div>
          </div>
          <div className="ngrid">
            <div>
              <h3 className="h2">Nereye bağlanıyor</h3>
              <ul className="hosts box">
                {(rep?.hosts ?? []).map((h) => (
                  <li key={h.host} className={h.target === "other" ? "odd" : ""}>
                    <span><b>{TARGET[h.target]}</b><small>{h.host}</small></span>
                    <em>{h.count}</em>
                  </li>
                ))}
                {!rep?.hosts.length && <li className="none">Henüz istek yok.</li>}
              </ul>
              <p className="m small">Görseller doğrudan valorant-api.com'dan yüklenir ve tek tek listelenmez. Başka adres yoktur; olsaydı burada kırmızı görünürdü.</p>
            </div>
            <div>
              <h3 className="h2">Son istekler<span className="hv">Satıra tıkla: adres</span></h3>
              <ul className="feed box" aria-live="off">
                {feed.map((e, i) => (
                  <li key={`${e.t}-${i}`} className={`${e.kind} ${open === i ? "open" : ""}`} onClick={() => setOpen(open === i ? null : i)}>
                    <span className="ft">{hhmmss(e.t)}</span>
                    <span className={`fk ${e.kind}`}>{e.kind}</span>
                    <span className="fw">{e.what}</span>
                    <span className={e.status === 0 || e.status >= 400 ? "fs bad" : "fs"}>{e.status || "hata"}</span>
                    <span className="fm">{e.ms} ms</span>
                    {open === i && <span className="fd">{e.method} {e.host}{e.path}</span>}
                  </li>
                ))}
                {!feed.length && <li className="none">Riot Client ve Valorant açılınca istekler burada görünür.</li>}
              </ul>
              <p className="m small">Kayıt yalnızca bellekte tutulur. Token, çerez ve oyuncu kimlikleri gösterilmez ya da maskelenir.</p>
            </div>
          </div>
        </div>
      )}

      {tab === "data" && (
        <div className="tbody fade">
          <div className="box">
            <Row title="Gizli isimler" desc="İsmini gizleyen oyuncuların adı sorgulanmadı, saklanmadı, gösterilmedi.">
              <b className="big">{rep?.hiddenSkipped ?? 0}</b>
            </Row>
            {data.map((d) => <Row key={d.label} title={d.label} desc={d.label.startsWith("Etiket") ? "Senin koyduğun etiketler ve notlar." : "Aynı maçta olduğun oyuncuların karşılaşma geçmişi."}><b className="big">{d.n}</b></Row>)}
            <Row title="Verilerimi sil" desc="Etiketler, notlar, karşılaşma geçmişi ve ayarlar bu bilgisayardan silinir. Geri alınamaz.">
              <button className={confirm ? "x warn" : "x"} type="button" onClick={wipe}>{confirm ? "Emin misin? Tekrar tıkla" : "Verilerimi sil"}</button>
            </Row>
          </div>
          <p className="m small">Bunların hiçbiri bilgisayarından çıkmaz. Yalnızca kullanım sayımı için rastgele bir kimlik ve sürüm, öneri formunu gönderirsen de yazdığın ve Riot ID'n gider.</p>
        </div>
      )}
    </div>
  );
}
