import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { audioCtx, music, pop, sfx } from "./sfx";
import { Mascot, Wand } from "./Mascot";

/* Sesli rehber: gerçek arayüzün küçük bir sahnesinde ok ve ışıkla gösterir, Celeste sesle anlatır, altyazı hep açıktır.
   Adımlar sesi bitince kendiliğinden ilerler; iki adımda kullanıcıdan küçük bir hareket beklenir. Ses dosyaları public/guide. */
interface Props { onDone: () => void }

type Scene = "hello" | "trust" | "stage" | "tools" | "note" | "finish";
type Mode = "roster" | "wait" | "drawer";
interface Step {
  /** Ses dosyası (public/guide/<a>.mp3) */
  a: string;
  /** Sesin süresi (sn); sessizken okuma süresi olarak kullanılır */
  d: number;
  /** Söylenen cümle (altyazı) */
  say: string;
  scene: Scene;
  mode?: Mode;
  /** Işıkla gösterilen parçalar */
  t?: string[];
  /** Beklenen hareket: satıra tıkla / F2 tuşuna bas */
  act?: "row" | "key";
  hint?: string;
  /** Bölüm (üstteki şeritte) */
  ch: number;
  /** Yazılı ek ayrıntı: sesin söylemediği küçük bilgi */
  tip?: string;
}
const CHAPTERS = ["Tanışma", "Güven", "Lobi", "Oyuncu", "Pencere", "Keşfet"];

const STEPS: Step[] = [
  { a: "01-giris", ch: 0, d: 4.3, scene: "hello", say: "Merhaba! Ben Celeste. Sana iki dakikada her şeyi göstereceğim." },
  { a: "02-guven", ch: 1, tip: "Kanıtı içinde: S.S.S bölümü uygulamanın attığı her isteği canlı gösterir.", d: 6.2, scene: "trust", t: ["trust0", "trust1"], say: "Önce içini rahat ettireyim: Riot hesabına giriş yapmıyorum, oyuna dokunmuyorum. Sadece okuyorum." },
  { a: "03-veriler", ch: 1, tip: "İsmini gizleyen oyuncunun adı sende de gizli kalır.", d: 3.6, scene: "trust", t: ["trust2"], say: "Notların ve etiketlerin sadece senin bilgisayarında kalır." },
  { a: "04-durum", ch: 2, tip: "Sarı ya da kırmızıysa tıkla: hangi bağlantının eksik olduğunu söyler.", d: 6.2, scene: "stage", mode: "roster", t: ["status"], say: "Sol alttaki bu rozet yeşilse her şey yolunda demektir. Tıklarsan neyin çalıştığını görebilirsin tatlım." },
  { a: "05-valorant", ch: 2, tip: "Liste ajan seçiminde dolar. Rakip kaplamaları maç başlayınca gelir.", d: 4.3, scene: "stage", mode: "wait", t: ["wait"], say: "Şimdi Valorant'ı aç. Maça girince oyuncular kendiliğinden gelecek." },
  { a: "06-satir", ch: 2, tip: "Liste, Kartlar ve Karşı karşıya: düzeni Ayarlar'dan değiştirebilirsin.", d: 3.1, scene: "stage", mode: "roster", t: ["row0"], say: "Bak, bu bir oyuncu satırı. Hadi birlikte okuyalım." },
  { a: "07-rank", ch: 2, tip: "Taç işareti lobinin en yüksek rankını gösterir.", d: 3.8, scene: "stage", mode: "roster", t: ["rank"], say: "Burada oyuncunun şimdiki ve gördüğü en yüksek rankı var." },
  { a: "08-form", ch: 2, tip: "Soluk kutular rekabet dışı maçlar. Üstüne gelince harita ve ajan görünür.", d: 4.9, scene: "stage", mode: "roster", t: ["form"], say: "Bunlar oyuncunun son beş maçı. Yeşil galibiyet, kırmızı ise mağlubiyet." },
  { a: "09-parti", ch: 2, tip: "Üstteki \"Rakipte 2 kişilik parti\" özeti de buradan gelir.", d: 4.6, scene: "stage", mode: "roster", t: ["party"], say: "Aynı renkli çizgi, aynı partide demek. Yani birlikte oynuyorlar." },
  { a: "10-rozet", ch: 2, tip: "Formda, Main, Kafa avcısı, MMR… Eşikleri Ayarlar'dan sen belirlersin.", d: 4.6, scene: "stage", mode: "roster", t: ["badge"], say: "Bu rozet ölçülen verilerden çıkar. Üzerine gelirsen nedenini söyler." },
  { a: "11-tikla", ch: 3, tip: "Panel alttan açılır; pencere büyümez, içinde kaydırırsın.", d: 4.6, scene: "stage", mode: "roster", t: ["row0"], act: "row", hint: "İlk satıra tıkla", say: "Şimdi bir oyuncuya tıkla. Kaplamaları ve maç geçmişi tek tıkla açılır." },
  { a: "12-kaplama", ch: 3, tip: "Yanındaki sekmeler: Performans, Geçmiş ve Profil.", d: 3.7, scene: "stage", mode: "drawer", t: ["drawer"], say: "İşte kaplamaları. Oyundaki alım menüsüyle aynı sırada." },
  { a: "13-f2", ch: 4, tip: "Maç başlayınca kendiliğinden de gizlenir; süresini Ayarlar'dan seçersin.", d: 5.2, scene: "stage", mode: "roster", t: ["key"], act: "key", hint: "F2 tuşuna tıkla", say: "F2 ile overlay'i anında gizleyip geri getirebilirsin. Maçta çok işine yarar." },
  { a: "14-tasi", ch: 4, tip: "Sol menünün boş yerinden de tutabilirsin. Konumu hatırlar.", d: 3.1, scene: "stage", mode: "roster", t: ["title"], say: "Başlıktan tutup istediğin yere sürükleyebilirsin." },
  { a: "15-hizli", ch: 4, tip: "Yayıncıysan: \"kayıtta gizle\" overlay'i OBS'ten saklar.", d: 6.0, scene: "stage", mode: "roster", t: ["quick"], say: "Sağ üstteki düğme hızlı ayarlar: kayıt modu, isim bulanıklığı, performans modu hepsi burada." },
  { a: "16-menu", ch: 5, tip: "Soldaki soru işareti S.S.S, dişli de Ayarlar.", d: 4.9, scene: "stage", mode: "roster", t: ["rail"], say: "Sol menüde profilin, maç raporun ve Akış var. Hadi gezerek keşfet!" },
  { a: "17-akis", ch: 5, tip: "Görsel ve GIF de ekleyebilirsin. Küfür ve hakaret yazılamaz.", d: 5.1, scene: "stage", mode: "roster", t: ["feed"], say: "Akış'ta maçını paylaşabilir, espriler yapabilir ve gelenlere tepkiler verebilirsin." },
  { a: "20-araclar", ch: 5, tip: "Hepsi overlay'in içinde çalışır; oyuna dokunmaz.", d: 7.4, scene: "tools", t: ["tl-head"], say: "Aaa, unutuyordum! Bir de Araçlar var. Sol menüdeki yıldız simgesinden açılır, içinde yedi küçük yardımcı var." },
  { a: "22-araclar2", ch: 5, tip: "İzleme listesindeki oyuncu lobine girince sesli uyarı da alabilirsin.", d: 4.2, scene: "tools", t: ["tl-cross", "tl-chat", "tl-watch"], say: "Hazır nişangahlar, hızlı mesajlar ve izleme listesi de burada." },
  { a: "23-araclar3", ch: 5, tip: "Meta, son yamaya göre haritalarda öne çıkan ajanları gösterir.", d: 6.7, scene: "tools", t: ["tl-search", "tl-device", "tl-meta"], say: "Oyuncu arama, hassasiyet hesabı ve meta ajanlar. Hepsini bir dene, seveceğinden eminim şapşik." },
  { a: "18-tam-ekran", ch: 4, tip: "Bunu bir kez ayarlaman yeter.", d: 6.0, scene: "note", t: ["note"], say: "Küçük bir not: Overlay görünmüyorsa Valorant'ta Pencereli Tam Ekran'ı seç. Bu kadar." },
  { a: "19-bitis", ch: 5, d: 5.0, scene: "finish", say: "Artık hazırsın şapşik. İyi oyunlar. Celeste hep yanında." },
];

const RAIL: { icon: IconName; k?: string }[] = [
  { icon: "users" }, { icon: "clock" }, { icon: "user" }, { icon: "msg", k: "feed" }, { icon: "spark" }, { icon: "crown" },
];
/** Araçlar sahnesindeki kutular (uygulamadaki Araçlar sekmeleriyle aynı). */
const TOOLBOX: { k: string; icon: IconName; n: string; d: string }[] = [
  { k: "timers", icon: "timer", n: "Sayaçlar", d: "Kendi geri sayımların" },
  { k: "cross", icon: "target", n: "Nişangah", d: "Hazır kodlar, tek tıkla kopyala" },
  { k: "chat", icon: "chat", n: "Hızlı mesajlar", d: "Kaydet, tıkla, yapıştır" },
  { k: "watch", icon: "eye", n: "İzleme listesi", d: "Etiketlediğin gelince uyarır" },
  { k: "search", icon: "search", n: "Oyuncu arama", d: "Karşılaştıklarını bul" },
  { k: "device", icon: "mouse", n: "DPI / eDPI", d: "Duyarlılığını hesapla" },
  { k: "meta", icon: "layers", n: "Meta", d: "Haritada öne çıkan ajanlar" },
];
const ROWS = [
  { n: "Sen", a: "Jett · Sv. 60", tier: "PLATIN 2", rr: "41 RR", c: "#8b9cff", f: "wwlwl", party: true, badge: "Formda +72 RR", tone: "pos" },
  { n: "Kuzey", a: "Viper · Sv. 77", tier: "ELMAS 1", rr: "62 RR", c: "#f0a6ca", f: "wlwwl", party: true, badge: "Main", tone: "" },
  { n: "Oyuncu 3", a: "Sova · İsim gizli", tier: "ALTIN 3", rr: "18 RR", c: "#fbbf24", f: "lwwlw", party: false, badge: "MMR ↓", tone: "neg" },
];
const MUTE_KEY = "overlay-guide-mute";

export function Guide({ onDone }: Props) {
  const [i, setI] = useState(0);
  const [begun, setBegun] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } });
  const [auto, setAuto] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const [bye, setBye] = useState(false);
  const [burst, setBurst] = useState(0);
  const [sayKey, setSayKey] = useState(0);
  const [cheer, setCheer] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  /** Ağzın nasıl oynayacağı: gerçek ses seviyesi, sessizken sahte konuşma, ya da kapalı */
  const talk = useRef<"audio" | "fake" | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const autoRef = useRef(auto); autoRef.current = auto;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  const stop = () => {
    window.clearTimeout(timer.current);
    music.duck(false);
    talk.current = null; analyser.current = null;
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current = null; }
    setSpeaking(false);
  };
  /** Sesi çalar; sessizken ya da çalamazsa `ms` sonra devam eder. */
  const speak = (file: string, ms: number, then?: () => void) => {
    stop();
    const fallback = () => { setSpeaking(false); talk.current = ms > 1500 ? "fake" : null; timer.current = window.setTimeout(() => { talk.current = null; then?.(); }, ms); };
    if (mutedRef.current) { fallback(); return; }
    const a = new Audio(`/guide/${file}.mp3`);
    audio.current = a;
    try {
      const c = audioCtx();
      if (c) { const src = c.createMediaElementSource(a), an = c.createAnalyser(); an.fftSize = 512; src.connect(an); an.connect(c.destination); analyser.current = an; }
    } catch { analyser.current = null; }
    a.onplay = () => { setSpeaking(true); talk.current = analyser.current ? "audio" : "fake"; music.duck(true); };
    a.onended = () => { setSpeaking(false); talk.current = null; music.duck(false); then?.(); };
    a.onerror = fallback;
    a.play().catch(fallback);
  };
  /** Anlatım bitince ne olacağı: son adımda yumuşak kapanış, diğerlerinde (hareket beklenmiyorsa) sıradaki adım. */
  const after = (k: number) => () => {
    if (k >= STEPS.length - 1) { timer.current = window.setTimeout(leave, 900); return; }
    if (STEPS[k].act || !autoRef.current) return;
    timer.current = window.setTimeout(next, 260);
  };
  const next = () => setI((x) => Math.min(STEPS.length - 1, x + 1));

  // Her adımda: geçiş sesi, anlatım, bitince (hareket beklemiyorsa) kendiliğinden ilerle.
  useEffect(() => {
    if (!begun) return;
    setDone(false);
    if (i > 0 && !mutedRef.current) sfx.whoosh();
    if (STEPS[i].scene === "finish" && !mutedRef.current) window.setTimeout(() => sfx.fanfare(), 250);
    const st = STEPS[i];
    setSayKey((k) => k + 1);
    if (st.scene === "finish") window.setTimeout(() => confetti(), 350);
    speak(st.a, st.d * 1000 + 400, after(i));
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, begun]);

  useEffect(() => () => { stop(); music.stop(0.3); }, []);
  // Ağız: sesin gücüne göre kapalı / yarım / açık. Sessiz modda ritimli sahte konuşma.
  useEffect(() => {
    let raf = 0, lv = 0;
    const buf = new Uint8Array(512);
    const tick = () => {
      const el = mascotRef.current;
      if (el) {
        let m = 0;
        if (talk.current === "audio" && analyser.current) {
          analyser.current.getByteTimeDomainData(buf);
          let sum = 0;
          for (let k = 0; k < buf.length; k++) { const v = (buf[k] - 128) / 128; sum += v * v; }
          lv = Math.max(Math.sqrt(sum / buf.length), lv * 0.84);
          m = lv > 0.085 ? 2 : lv > 0.028 ? 1 : 0;
        } else if (talk.current === "fake") m = [0, 1, 2, 1, 2, 0, 1][Math.floor(Date.now() / 130) % 7];
        else lv = 0;
        if (el.dataset.mouth !== String(m)) el.dataset.mouth = String(m);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const begin = (silent: boolean) => {
    if (silent) { setMuted(true); mutedRef.current = true; try { localStorage.setItem(MUTE_KEY, "1"); } catch { /* depolama kapalı */ } }
    else { sfx.tick(); music.start(); }
    setBegun(true);
  };
  const toggleMute = () => {
    const v = !muted;
    setMuted(v); mutedRef.current = v;
    try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* depolama kapalı */ }
    if (v) { stop(); music.stop(0.4); } else if (begun) { music.start(); setSayKey((k) => k + 1); speak(s.a, s.d * 1000 + 400, after(i)); }
  };
  const replay = () => { if (!begun) return; setMuted(false); mutedRef.current = false; music.start(); setSayKey((k) => k + 1); speak(s.a, s.d * 1000 + 400, after(i)); };
  /** Elle ileri: hareket beklenen adımda yapmadan geçerse kısa onay sesi. */
  const go = (d: number) => {
    sfx.tick();
    if (d > 0 && s.act && !done && !mutedRef.current) { speak("r3-tamam", 600, () => next()); return; }
    stop();
    setI((x) => Math.max(0, Math.min(STEPS.length - 1, x + d)));
  };
  const hit = (kind: "row" | "key") => {
    if (s.act !== kind || done) return;
    setDone(true);
    confetti();
    if (kind === "key") { setGone(true); window.setTimeout(() => setGone(false), 1000); }
    speak(kind === "row" ? "r1-super" : "r2-harika", 900, () => { timer.current = window.setTimeout(next, 250); });
  };
  const finish = () => { stop(); music.stop(0.4); onDone(); };
  /** Yumuşak çıkış: müzik ve ekran birlikte söner. */
  const leave = () => { stop(); music.stop(1); setBye(true); window.setTimeout(onDone, 750); };
  const confetti = () => { setBurst((b) => b + 1); setCheer(true); window.setTimeout(() => setCheer(false), 1300); if (!mutedRef.current) { pop(); sfx.chime(); } };

  const L = (k: string) => (s.t?.includes(k) ? " lit" : "");
  const stage = (
    <div className={`gs-win${s.t ? " focus" : ""}${gone ? " gone" : ""}${s.act && !done ? " ask" : ""}`}>
      <div className="gs-top">
        <span className={`gs-logo${L("logo")}`}><img src="/celeste-mark.png" alt="" /></span>
        <b className={`gs-title${L("title")}`}>Haven</b>
        <span className="gs-pill"><i />Maç sürüyor</span>
        <span className="sp" />
        <button type="button" className={`gs-key${L("key")}`} disabled={s.act !== "key" || done} onClick={() => hit("key")} aria-label="F2">F2</button>
        <span className={`gs-ib${L("quick")}`}><Icon name="sliders" size={14} /></span>
        <span className="gs-ib"><Icon name="minus" size={14} /></span>
      </div>
      <div className="gs-body">
        <nav className={`gs-rail${L("rail")}`}>
          {RAIL.map((r, k) => <span key={k} className={`gs-ri${k === 0 ? " on" : ""}${r.k ? L(r.k) : ""}`} style={{ animationDelay: `${k * 70}ms` }}><Icon name={r.icon} size={16} /></span>)}
        </nav>
        <div className="gs-main">
          {s.mode === "wait" ? (
            <div className={`gs-wait${L("wait")}`}>
              <h4>Valorant'ı başlat</h4>
              <p>Riot Client bağlı. Şimdi Valorant'ı aç.</p>
              <ol className="steps">
                <li className="step done"><span className="sc"><Icon name="check" size={12} stroke={2.4} /></span>Riot Client açık</li>
                <li className="step wait"><span className="sc" />Valorant'ı aç</li>
                <li className="step todo"><span className="sc" />Maç bulunsun, oyuncular gelsin</li>
              </ol>
            </div>
          ) : (
            <>
              {s.mode !== "drawer" && <div className="gs-cols"><span /><span /><span>Oyuncu</span><span>Rank</span><span>Form</span><span>Öne çıkan</span></div>}
              {(s.mode === "drawer" ? ROWS.slice(0, 1) : ROWS).map((r, k) => {
                const clickable = s.act === "row" && k === 0 && !done;
                return (
                  <div key={r.n} className={`gs-row${k === 0 ? L("row0") : ""}${s.mode === "drawer" ? " sel" : ""}${clickable ? " tap" : ""}`}
                    role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => hit("row") : undefined} onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") hit("row"); } : undefined}>
                    <i className={`gs-party${r.party ? "" : " off"}${r.party ? L("party") : ""}`} />
                    <span className="gs-av" style={{ background: r.c }} />
                    <span className="gs-nm"><b>{r.n}</b><small>{r.a}</small></span>
                    <span className={`gs-rk${L("rank")}`}><i className="gs-hex" style={{ background: r.c }} /><span><b>{r.tier}</b><small>{r.rr}</small></span></span>
                    <span className={`gs-fm${L("form")}`}><span className="fdots">{[...r.f].map((c, n) => <i key={n} className={c}>{c === "w" ? "W" : "L"}</i>)}</span></span>
                    <span className={`gs-bd${L("badge")}`}><span className={`bd ${r.tone}`}>{r.badge}</span></span>
                  </div>
                );
              })}
              {s.mode === "drawer" && (
                <div className={`gs-drawer${L("drawer")}`}>
                  <div className="gs-dh"><b>Kaplamalar</b><small>Oyundaki alım menüsüyle aynı sıra</small></div>
                  <div className="gs-guns">
                    {[["Phantom", "Elderflame", "#f5955b"], ["Vandal", "Prime", "#009587"], ["Operator", "Oni", "#d1548d"]].map(([w, n, c], k) => (
                      <span className="gs-gun" key={w} style={{ "--tc": c, animationDelay: `${k * 90}ms` } as React.CSSProperties}><small>{w}</small><b>{n}</b><i /></span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="gs-foot"><span className={`gs-status${L("status")}`}><i />Her şey bağlı</span></div>
      <div className="gs-scrim" />
      {s.act && !done && <div className="gs-hint"><Icon name="chevron" size={13} />{s.hint}</div>}
    </div>
  );

  const scenes: Record<Scene, JSX.Element> = {
    hello: (
      <div className="gs-card hello">
        <img className="gs-moon" src="/celeste-moon.webp" alt="" draggable={false} />
        <h2>Celeste Overlay'e hoş geldin</h2>
        <p>İki dakikalık sesli bir tur. Her şeyi gerçek ekranda tek tek göstereceğim.</p>
        {!begun && (
          <div className="gs-start">
            <button type="button" className="x go big" onClick={() => begin(false)} autoFocus><Icon name="volume" size={16} />Sesli başlat</button>
            <button type="button" className="lnk" onClick={() => begin(true)}>Sessiz izle</button>
          </div>
        )}
      </div>
    ),
    trust: (
      <div className="gs-card trust">
        {[
          ["Giriş yok", "Riot hesabına giriş yapmazsın. Açık Riot Client oturumunu okur."],
          ["Oyuna dokunmaz", "Tuş göndermez, oyun dosyalarını değiştirmez. Yalnızca okur."],
          ["Veriler sende kalır", "Etiketler ve notlar yalnızca bu bilgisayarda saklanır."],
        ].map(([a, b], k) => (
          <div key={a} className={`gs-tc${L(`trust${k}`)}`} style={{ animationDelay: `${k * 110}ms` }}>
            <span className="gs-ck"><Icon name="check" size={14} stroke={2.6} /></span>
            <span><b>{a}</b><small>{b}</small></span>
          </div>
        ))}
      </div>
    ),
    stage,
    tools: (
      <div className="gs-card tools">
        <div className={`gs-tlh${L("tl-head")}`}><span className="gs-tli"><Icon name="spark" size={16} /></span><b>Araçlar</b><small>Sol menüdeki yıldız simgesi</small></div>
        <div className="gs-tlg">
          {TOOLBOX.map((t, k) => (
            <div key={t.k} className={`gs-tl${L(`tl-${t.k}`)}`} style={{ animationDelay: `${k * 60}ms` }}>
              <span className="gs-tli"><Icon name={t.icon} size={16} /></span>
              <span><b>{t.n}</b><small>{t.d}</small></span>
            </div>
          ))}
        </div>
      </div>
    ),
    note: (
      <div className="gs-card note">
        <small className="gs-path">Valorant → Ayarlar → Video → Ekran Modu</small>
        <div className="gs-seg">
          <span>Tam Ekran</span>
          <span className={`on${L("note")}`}><Icon name="check" size={13} stroke={2.6} />Pencereli Tam Ekran</span>
          <span>Pencereli</span>
        </div>
        <p>Tam ekranda overlay oyunun arkasında kalır. Pencereli Tam Ekran'da hep üstte durur.</p>
      </div>
    ),
    finish: (
      <div className="gs-card finish">
        {Array.from({ length: 14 }, (_, k) => <i key={k} className="gs-star" style={{ left: `${(k * 37 + 8) % 92}%`, top: `${(k * 53 + 10) % 78}%`, animationDelay: `${(k % 7) * 160}ms` }} />)}
        <img className="gs-moon" src="/celeste-moon.webp" alt="" draggable={false} />
        <h2>Hazırsın!</h2>
        <p>Valorant'ı aç, maça gir, gerisini Celeste halleder.</p>
      </div>
    ),
  };

  return (
    <div ref={rootRef} className={`panel guide gsx${bye ? " bye" : ""}`} role="dialog" aria-label="Başlangıç rehberi">
      {burst > 0 && <Confetti key={burst} />}
      <div className="gbar" aria-hidden="true"><i style={{ width: `${((i + (begun ? 1 : 0)) / STEPS.length) * 100}%` }} /></div>
      <div className="ph">
        <ol className="gs-ch" aria-label="Bölümler">
          {CHAPTERS.map((c, k) => <li key={c} className={!begun ? "" : k === s.ch ? "on" : k < s.ch ? "done" : ""}>{k < s.ch && begun ? <Icon name="check" size={11} stroke={2.8} /> : <i>{k + 1}</i>}{c}</li>)}
        </ol>
        <button className="lnk gs-skip" type="button" onClick={finish}>Atla</button>
      </div>
      <div className="gs-stage" key={s.scene === "stage" || s.scene === "tools" ? s.scene : `${s.scene}${i}`}>{scenes[s.scene]}</div>
      <div className="gs-cap" aria-live="polite">
        <Mascot ref={mascotRef} cheer={cheer} mood={cheer ? "happy" : s.scene === "finish" ? "wink" : s.act && !done ? "surprised" : undefined} />
        <div className="gs-txt">
          {begun
            ? <p key={sayKey} className="gs-say">{s.say.split(" ").map((w, k, all) => <span key={k} style={{ animationDelay: `${((k / all.length) * s.d * 0.9).toFixed(2)}s` }}>{w} </span>)}</p>
            : <p>Başlamak için "Sesli başlat"a bas. Sesi istersen sonradan da kapatabilirsin.</p>}
          {begun && s.tip && <small key={`t${i}`} className="gs-tip" style={{ animationDelay: `${(s.d * 0.55).toFixed(1)}s` }}><Icon name="spark" size={12} />{s.tip}</small>}
        </div>
        <button className="gs-ic" type="button" onClick={replay} disabled={!begun} title="Bu adımı tekrar dinle" aria-label="Bu adımı tekrar dinle"><Icon name="repeat" size={15} /></button>
      </div>
      <Wand root={rootRef} hand={mascotRef} aim={begun && !!s.t && s.scene !== "hello" && s.scene !== "finish"} />
      <div className="gnav">
        <button className="x" type="button" onClick={() => go(-1)} disabled={!begun || i === 0}>Geri</button>
        <span className="gs-ctl">
          <button className="gs-ic" type="button" onClick={() => { const v = !auto; setAuto(v); if (v && begun && !speaking && !s.act && !last) timer.current = window.setTimeout(next, 500); else if (!v) window.clearTimeout(timer.current); }} disabled={!begun} title={auto ? "Otomatik ilerlemeyi durdur" : "Otomatik ilerle"} aria-label={auto ? "Otomatik ilerlemeyi durdur" : "Otomatik ilerle"} aria-pressed={!auto}><Icon name={auto ? "pause" : "play"} size={15} /></button>
          <button className="gs-ic" type="button" onClick={toggleMute} title={muted ? "Sesi aç" : "Sesi kapat"} aria-label={muted ? "Sesi aç" : "Sesi kapat"} aria-pressed={muted}><Icon name={muted ? "mute" : "volume"} size={15} /></button>
        </span>
        <button className="x go" type="button" onClick={() => (last ? leave() : go(1))} disabled={!begun || bye}>{last ? "Bitir" : "İleri"}</button>
      </div>
    </div>
  );
}

/** Konfeti: tek seferlik patlama (her tetiklemede yeniden kurulur). */
const CONF = ["var(--accent)", "#4ade80", "#f0a6ca", "#8b9cff", "#fbbf24", "#2dd4bf"];
function Confetti() {
  const bits = useRef(Array.from({ length: 46 }, (_, k) => ({
    x: (Math.random() - 0.5) * 620, y: -(120 + Math.random() * 240), r: Math.random() * 720 - 360,
    c: CONF[k % CONF.length], d: Math.random() * 0.12, w: 5 + Math.random() * 5, round: k % 3 === 0,
  }))).current;
  return (
    <div className="gs-conf" aria-hidden="true">
      {bits.map((b, k) => <i key={k} style={{ "--x": `${b.x}px`, "--y": `${b.y}px`, "--r": `${b.r}deg`, background: b.c, width: b.w, height: b.round ? b.w : b.w * 1.7, borderRadius: b.round ? "50%" : 2, animationDelay: `${b.d}s` } as React.CSSProperties} />)}
    </div>
  );
}
