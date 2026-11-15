import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { sfx } from "./sfx";

/* Sesli rehber: gerçek arayüzün küçük bir sahnesinde ok ve ışıkla gösterir, Celeste sesle anlatır, altyazı hep açıktır.
   Adımlar sesi bitince kendiliğinden ilerler; iki adımda kullanıcıdan küçük bir hareket beklenir. Ses dosyaları public/guide. */
interface Props { onDone: () => void }

type Scene = "hello" | "trust" | "stage" | "note" | "finish";
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
}

const STEPS: Step[] = [
  { a: "01-giris", d: 4.3, scene: "hello", say: "Merhaba! Ben Celeste. Sana iki dakikada her şeyi göstereceğim." },
  { a: "02-guven", d: 6.2, scene: "trust", t: ["trust0", "trust1"], say: "Önce içini rahat edeyim: Riot hesabına giriş yapmıyorum, oyuna dokunmuyorum. Sadece okuyorum." },
  { a: "03-veriler", d: 3.6, scene: "trust", t: ["trust2"], say: "Notların ve etiketlerin sadece senin bilgisayarında kalır." },
  { a: "04-durum", d: 6.2, scene: "stage", mode: "roster", t: ["status"], say: "Sol alttaki bu rozet yeşilse her şey yolunda demektir. Tıklarsan neyin çalıştığını görürsün." },
  { a: "05-valorant", d: 4.3, scene: "stage", mode: "wait", t: ["wait"], say: "Şimdi Valorant'ı aç. Maça girince oyuncular kendiliğinden gelecek." },
  { a: "06-satir", d: 3.1, scene: "stage", mode: "roster", t: ["row0"], say: "Bu bir oyuncu satırı. Hadi birlikte okuyalım." },
  { a: "07-rank", d: 3.8, scene: "stage", mode: "roster", t: ["rank"], say: "Burada oyuncunun şimdiki ve gördüğü en yüksek rank var." },
  { a: "08-form", d: 4.9, scene: "stage", mode: "roster", t: ["form"], say: "Bunlar son beş maç. Yeşil galibiyet, pembe mağlubiyet." },
  { a: "09-parti", d: 4.6, scene: "stage", mode: "roster", t: ["party"], say: "Aynı renkli çizgi, aynı partide demek. Birlikte oynuyorlar." },
  { a: "10-rozet", d: 4.6, scene: "stage", mode: "roster", t: ["badge"], say: "Bu rozet ölçülen verilerden çıkar. Üzerine gelirsen nedenini söyler." },
  { a: "11-tikla", d: 4.6, scene: "stage", mode: "roster", t: ["row0"], act: "row", hint: "İlk satıra tıkla", say: "Şimdi bir oyuncuya tıkla. Kaplamaları ve maç geçmişi tek tıkla açılır." },
  { a: "12-kaplama", d: 3.7, scene: "stage", mode: "drawer", t: ["drawer"], say: "İşte kaplamaları. Oyundaki alım menüsüyle aynı sırada." },
  { a: "13-f2", d: 5.2, scene: "stage", mode: "roster", t: ["key"], act: "key", hint: "F2 tuşuna tıkla", say: "F2 ile overlay'i anında gizleyip geri getirebilirsin. Maçta çok işine yarar." },
  { a: "14-tasi", d: 3.1, scene: "stage", mode: "roster", t: ["title"], say: "Başlıktan tutup istediğin yere sürükleyebilirsin." },
  { a: "15-hizli", d: 6.0, scene: "stage", mode: "roster", t: ["quick"], say: "Sağ üstteki düğme hızlı ayarlar: kayıt modu, isim bulanıklığı, FPS modu hepsi burada." },
  { a: "16-menu", d: 4.9, scene: "stage", mode: "roster", t: ["rail"], say: "Sol menüde profilin, maç raporun ve Akış var. Gezerek keşfet!" },
  { a: "17-akis", d: 5.1, scene: "stage", mode: "roster", t: ["feed"], say: "Akış'ta maçını paylaşabilir, gelenlere GG verebilirsin. Güzel bir topluluk bizimki." },
  { a: "18-tam-ekran", d: 6.0, scene: "note", t: ["note"], say: "Küçük bir not: Overlay görünmüyorsa Valorant'ta Pencereli Tam Ekran'ı seç. Bu kadar." },
  { a: "19-bitis", d: 5.0, scene: "finish", say: "Hazırsın! İyi oyunlar, bol galibiyet. Celeste hep burada." },
];

const RAIL: { icon: IconName; k?: string }[] = [
  { icon: "users" }, { icon: "clock" }, { icon: "user" }, { icon: "msg", k: "feed" }, { icon: "spark" }, { icon: "crown" },
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
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const autoRef = useRef(auto); autoRef.current = auto;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  const stop = () => {
    window.clearTimeout(timer.current);
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current = null; }
    setSpeaking(false);
  };
  /** Sesi çalar; sessizken ya da çalamazsa `ms` sonra devam eder. */
  const speak = (file: string, ms: number, then?: () => void) => {
    stop();
    const fallback = () => { setSpeaking(false); timer.current = window.setTimeout(() => then?.(), ms); };
    if (mutedRef.current) { fallback(); return; }
    const a = new Audio(`/guide/${file}.mp3`);
    audio.current = a;
    a.onplay = () => setSpeaking(true);
    a.onended = () => { setSpeaking(false); then?.(); };
    a.onerror = fallback;
    a.play().catch(fallback);
  };
  const next = () => setI((x) => Math.min(STEPS.length - 1, x + 1));

  // Her adımda: geçiş sesi, anlatım, bitince (hareket beklemiyorsa) kendiliğinden ilerle.
  useEffect(() => {
    if (!begun) return;
    setDone(false);
    if (i > 0 && !mutedRef.current) sfx.whoosh();
    if (STEPS[i].scene === "finish" && !mutedRef.current) window.setTimeout(() => sfx.fanfare(), 250);
    const st = STEPS[i];
    speak(st.a, st.d * 1000 + 1200, () => {
      if (st.act || !autoRef.current || i >= STEPS.length - 1) return;
      timer.current = window.setTimeout(next, 900);
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, begun]);

  useEffect(() => () => stop(), []);

  const begin = (silent: boolean) => {
    if (silent) { setMuted(true); mutedRef.current = true; try { localStorage.setItem(MUTE_KEY, "1"); } catch { /* depolama kapalı */ } }
    else sfx.tick();
    setBegun(true);
  };
  const toggleMute = () => {
    const v = !muted;
    setMuted(v); mutedRef.current = v;
    try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* depolama kapalı */ }
    if (v) stop(); else if (begun) speak(s.a, s.d * 1000 + 1200);
  };
  const replay = () => { if (!begun) return; setMuted(false); mutedRef.current = false; speak(s.a, s.d * 1000 + 1200); };
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
    if (!mutedRef.current) sfx.chime();
    if (kind === "key") { setGone(true); window.setTimeout(() => setGone(false), 1000); }
    speak(kind === "row" ? "r1-super" : "r2-harika", 900, () => { timer.current = window.setTimeout(next, 500); });
  };
  const finish = () => { stop(); onDone(); };

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
        <p>İki dakikalık sesli bir tur. Gerçek ekranı gösterip her şeyi tek tek anlatacağım.</p>
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
    <div className="panel guide gsx" role="dialog" aria-label="Başlangıç rehberi">
      <div className="gbar" aria-hidden="true"><i style={{ width: `${((i + (begun ? 1 : 0)) / STEPS.length) * 100}%` }} /></div>
      <div className="ph">
        <p className="m">Sesli rehber{begun && <> · {i + 1} / {STEPS.length}</>}</p>
        <button className="lnk gs-skip" type="button" onClick={finish}>Atla</button>
      </div>
      <div className="gs-stage" key={s.scene === "stage" ? "stage" : `${s.scene}${i}`}>{scenes[s.scene]}</div>
      <div className="gs-cap" aria-live="polite">
        <span className={`gs-mo${speaking ? " on" : ""}`}><img src="/celeste-mark.png" alt="" draggable={false} /></span>
        <p key={i}>{begun ? s.say : "Başlamak için \"Sesli başlat\"a bas. Sesi istersen sonradan da kapatabilirsin."}</p>
        <button className="gs-ic" type="button" onClick={replay} disabled={!begun} title="Bu adımı tekrar dinle" aria-label="Bu adımı tekrar dinle"><Icon name="repeat" size={15} /></button>
      </div>
      <div className="gnav">
        <button className="x" type="button" onClick={() => go(-1)} disabled={!begun || i === 0}>Geri</button>
        <span className="gs-ctl">
          <button className="gs-ic" type="button" onClick={() => { const v = !auto; setAuto(v); if (v && begun && !speaking && !s.act && !last) timer.current = window.setTimeout(next, 500); else if (!v) window.clearTimeout(timer.current); }} disabled={!begun} title={auto ? "Otomatik ilerlemeyi durdur" : "Otomatik ilerle"} aria-label={auto ? "Otomatik ilerlemeyi durdur" : "Otomatik ilerle"} aria-pressed={!auto}><Icon name={auto ? "pause" : "play"} size={15} /></button>
          <button className="gs-ic" type="button" onClick={toggleMute} title={muted ? "Sesi aç" : "Sesi kapat"} aria-label={muted ? "Sesi aç" : "Sesi kapat"} aria-pressed={muted}><Icon name={muted ? "mute" : "volume"} size={15} /></button>
        </span>
        <button className="x go" type="button" onClick={() => (last ? finish() : go(1))} disabled={!begun}>{last ? "Başla" : "İleri"}</button>
      </div>
    </div>
  );
}
