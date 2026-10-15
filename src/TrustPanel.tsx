import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NetEntry, NetReport } from "./net";
import { mockNet } from "./mock";

const inTauri = "__TAURI_INTERNALS__" in window;

/* Sıkça sorulanlar: her cevap tek bir şey söyler, birbirini tekrar etmez. */
const TOS = "https://www.riotgames.com/tr/terms-of-service-TR";
const FAQ: { q: string; a: string; tos?: boolean }[] = [
  { q: "Neden güvenmeliyim?", a: "Kaynak kodu açık. Üstelik uygulamanın attığı her istek aşağıda canlı akar; söylenenle yapılanı kendi gözünle karşılaştırabilirsin." },
  { q: "Hesabım banlanır mı?", a: "Riot hiçbir üçüncü taraf uygulamayı onaylamıyor ve Vanguard'ın bir uygulamayı şimdi ya da ileride işaretlemeyeceğini garanti etmiyor. Biz de garanti veremeyiz; yalnızca ne yaptığımızı gösteririz.", tos: true },
  { q: "Şifremi istiyor mu?", a: "Hayır, giriş ekranı yok. Açık Riot Client oturumunu kullanır ve oturum bilgisi yalnızca Riot sunucularına gider." },
  { q: "Oyuna dokunuyor mu?", a: "Hayır. Yalnızca okur: oyun belleğine girmez, tuş ya da tıklama göndermez, dosyaları değiştirmez." },
  { q: "Hile sayılır mı?", a: "Rakibin konumu ya da görüşü gibi anlık oyun bilgisi göstermez; yalnızca rank, maç geçmişi ve kaplama gibi sonradan da öğrenilebilen bilgiler." },
  { q: "Gizli isimleri açar mı?", a: "Hayır. İsmini gizleyen oyuncunun adı sorgulanmaz, saklanmaz, gösterilmez." },
  { q: "Verilerim nereye gidiyor?", a: "Hiçbir yere. Etiketler, notlar ve ayarlar bu bilgisayarda kalır; uygulamanın kendi sunucusu yok." },
  { q: "Windows neden uyarı veriyor?", a: "Kurulum dosyası ücretli bir kod imzasıyla imzalanmadı. Windows yeni ve imzasız her dosyada uyarır; virüs anlamına gelmez." },
];

const TARGET: Record<NetEntry["target"], string> = {
  local: "Bu bilgisayar · Riot Client",
  riot: "Riot sunucuları",
  assets: "valorant-api.com · görsel sözlüğü",
  github: "GitHub · güncelleme denetimi",
  other: "Beklenmeyen adres",
};

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

export function TrustPanel({ onClose, onToast, onOpen }: { onClose: () => void; onToast: (t: string) => void; onOpen: (url: string) => void }) {
  const [rep, setRep] = useState<NetReport | null>(null);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
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

  return (
    <div className="panel trust" role="dialog" aria-label="S.S.S & Panel">
      <div className="ph">
        <div>
          <h2 className="t">S.S.S &amp; Panel</h2>
          <p className="m">Bu uygulama ne yapar, ne yapmaz? Önce kısa cevaplar, altında bunları doğrulayan canlı kayıt.</p>
        </div>
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>

      <div className="faq">
        {FAQ.map((f, i) => (
          <div key={f.q} className="fq" style={{ "--i": i } as React.CSSProperties}>
            <h3>{f.q}</h3>
            <p>{f.a}{f.tos && <> <button className="lnk" type="button" onClick={() => onOpen(TOS)}>Riot hizmet şartları</button></>}</p>
          </div>
        ))}
      </div>

      <div className="live">
        <h2 className="h lh">
          <span><i className={paused ? "dot off" : "dot"} />Canlı kayıt</span>
          <span className="lhr">
            <button className="x" type="button" onClick={() => setPaused((p) => !p)}>{paused ? "Devam et" : "Duraklat"}</button>
            <button className="x" type="button" onClick={copyFeed}>Kopyala</button>
          </span>
        </h2>

        <div className="nstats">
          <div><b>{rep?.total ?? 0}</b><small>istek</small></div>
          <div><b>{rep?.lastMinute ?? 0}</b><small>son dakikada</small></div>
          <div><b>{rep?.reads ?? 0}</b><small>okuma</small></div>
          <div><b>{rep?.queries ?? 0}</b><small title="İsim ve mağaza sorguları: veri ister, bir şey değiştirmez">sorgu</small></div>
          <div className={rep && rep.writes > 0 ? "bad" : "good"}><b>{rep?.writes ?? 0}</b><small title="Riot'ta bir şeyi değiştiren istek">yazma</small></div>
          <div className={rep && rep.errors > 0 ? "warn" : ""}><b>{rep?.errors ?? 0}</b><small>hata</small></div>
        </div>

        <div className="ngrid">
          <div>
            <h2 className="h">Nereye bağlanıyor</h2>
            <ul className="hosts">
              {(rep?.hosts ?? []).map((h) => (
                <li key={h.host} className={h.target === "other" ? "odd" : ""}>
                  <span><b>{TARGET[h.target]}</b><small>{h.host}</small></span>
                  <em>{h.count}</em>
                </li>
              ))}
              {!rep?.hosts.length && <li className="none">Henüz istek yok.</li>}
            </ul>
            <p className="m small">Görseller doğrudan valorant-api.com'dan yüklenir ve tek tek listelenmez. Başka adres yoktur; olsaydı burada kırmızı görünürdü.</p>

            <h2 className="h">Gizli isimler</h2>
            <p className="m"><b className="big">{rep?.hiddenSkipped ?? 0}</b> oyuncu ismini gizliyor, adları sorgulanmadı.</p>

            <h2 className="h">Bu bilgisayardaki verilerin</h2>
            <ul className="hosts plain">
              {data.map((d) => <li key={d.label}><span>{d.label}</span><em>{d.n}</em></li>)}
            </ul>
            <p className="m small">Uygulama ayarları da burada saklanır. Hiçbiri bilgisayarından çıkmaz.</p>
            <button className={confirm ? "x warn" : "x"} type="button" onClick={wipe}>{confirm ? "Emin misin? Tekrar tıkla" : "Verilerimi sil"}</button>
          </div>

          <div>
            <h2 className="h">Son istekler</h2>
            <ul className="feed" aria-live="off">
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
    </div>
  );
}
