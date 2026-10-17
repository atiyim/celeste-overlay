import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { availableMonitors, cursorPosition, getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import { loadAssets, lookup, type Assets } from "./assets";
import { mockSnapshot } from "./mock";
import { recordSeen, setLabel, setTag, type Seen } from "./seen";
import type { MyStats, Snapshot } from "./types";
import { PlayerRow } from "./PlayerRow";
import { LoadoutPanel } from "./LoadoutPanel";
import { QuickChat } from "./QuickChat";
import { Guide } from "./Guide";
import { Crosshairs } from "./CrosshairPanel";
import { Settings } from "./Settings";
import { StatusBar } from "./StatusBar";
import { AccountPanel } from "./AccountPanel";
import { StorePanel } from "./StorePanel";
import { StatsPanel } from "./StatsPanel";
import { ReportPanel } from "./ReportPanel";
import { TrustPanel } from "./TrustPanel";
import { alertOf, fmtDur, fmtRr, sessionOf, type Session } from "./tilt";
import { useUpdater } from "./updater";
import { applyTheme, COLS, gridTemplate, loadTheme, overlayWidth } from "./theme";

const inTauri = "__TAURI_INTERNALS__" in window;
// Pencere genişliği açık sütunlara göre hesaplanır; yükseklik içeriğe göre otomatik ayarlanır.
const SIDE_QUEUES = ["competitive", "unrated", "swiftplay", "spikerush", "premier"];
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

const NAV = [
  ["roster", "Oyuncular"], ["report", "Son maç"], ["store", "Mağaza"], ["account", "Hesabım"], ["stats", "İstatistik"], ["chat", "Sohbet"], ["cross", "Nişangah"], ["trust", "S.S.S & Panel"], ["settings", "Ayarlar"],
] as const;
type View = (typeof NAV)[number][0];

const PHASE_TEXT: Record<string, string> = {
  offline: "Valorant bekleniyor",
  menu: "Maç bekleniyor",
  pregame: "Ajan seçimi",
  ingame: "Maç sürüyor",
};

export function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [snap, setSnap] = useState<Snapshot>({ phase: "offline", players: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem("overlay-collapsed") === "1");
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<View>("roster");
  const [theme, setTheme] = useState(loadTheme);
  const [seen, setSeen] = useState<Seen>({});
  const [guide, setGuide] = useState<boolean>(() => { try { return localStorage.getItem("overlay-guide") !== "1"; } catch { return false; } });
  const closeGuide = () => { setGuide(false); try { localStorage.setItem("overlay-guide", "1"); } catch { /* depolama kapalı */ } };
  const [protect, setProtect] = useState<boolean>(() => localStorage.getItem("overlay-protect") === "1");
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem("overlay-zoom")) || 1);
  const [blur, setBlur] = useState<boolean>(() => { try { return localStorage.getItem("overlay-blur") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("overlay-blur", blur ? "1" : "0"); } catch { /* depolama kapalı */ } }, [blur]);
  const [autoHidden, setAutoHidden] = useState(false);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const updater = useUpdater();
  const [lastMatch, setLastMatch] = useState<string | null>(() => {
    try { return localStorage.getItem("overlay-last-match"); } catch { return null; }
  });
  const prevPhase = useRef<string>("offline");
  const [sess, setSess] = useState<Session | null>(null);
  const [newest, setNewest] = useState("");
  const [tiltAck, setTiltAck] = useState<string>(() => { try { return localStorage.getItem("overlay-tilt-ack") ?? ""; } catch { return ""; } });
  const tiltTimers = useRef<number[]>([]);
  const tiltInit = useRef(false);
  const rootRef = useRef<HTMLElement>(null);
  const lastSize = useRef("");
  const autoHiddenRef = useRef(false);
  const manualKeep = useRef(false); // F2 ile elle açıldıysa bu maç boyunca otomatik gizleme yapma
  const ingameSince = useRef<number | null>(null);
  const width = overlayWidth(theme.cols);
  const template = gridTemplate(theme.cols);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => { applyTheme(theme); }, [theme]);

  const retryAssets = () => {
    setAssetsFailed(false);
    loadAssets().then(setAssets).catch(() => setAssetsFailed(true));
  };
  useEffect(retryAssets, []);

  useEffect(() => {
    if (!inTauri) {
      if (assets) setSnap(mockSnapshot(assets));
      return;
    }
    let stop = false;
    const tick = async () => {
      try { if (!stop) setSnap(await invoke<Snapshot>("get_snapshot")); } catch { /* sonraki turda tekrar dene */ }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [assets]);

  // Aynı oyuncuyla karşılaşma geçmişini yerelde kaydet (isim saklanmaz).
  useEffect(() => {
    if (snap.phase !== "ingame" || !snap.matchId) return;
    const me = snap.players.find((p) => p.isSelf)?.team;
    setSeen(
      recordSeen(
        snap.matchId,
        snap.mapId ?? null,
        snap.players.filter((p) => !p.isSelf).map((p) => ({ puuid: p.puuid, agentId: p.agentId, side: p.team === me ? "ally" : "enemy", name: p.hiddenName ? null : p.name })),
      ),
    );
  }, [snap.matchId, snap.phase, snap.players]);

  // Tilt koruyucu: maç bitince kendi seansını hesaplar. Maç kaydı Riot'ta birkaç saniye geç düşebilir, o yüzden birkaç kez dener.
  const loadTilt = (expect: string | null, delays: number[]) => {
    tiltTimers.current.forEach(window.clearTimeout);
    tiltTimers.current = delays.map((d) => window.setTimeout(async () => {
      try {
        const d2 = await invoke<MyStats>("get_my_stats");
        setSess(sessionOf(d2.matches));
        setNewest(d2.matches[0]?.matchId ?? "");
        if (!expect || d2.matches.some((m) => m.matchId === expect)) tiltTimers.current.forEach(window.clearTimeout);
      } catch { /* sonraki denemede */ }
    }, d));
  };
  useEffect(() => {
    if (!theme.tilt.on) { tiltTimers.current.forEach(window.clearTimeout); setSess(null); return; }
    if (!inTauri) {
      try { if (localStorage.getItem("overlay-demo-tilt") === "1") { setSess({ games: 5, wins: 1, losses: 4, rr: -52, lossStreak: 3, minutes: 148 }); setNewest("demo"); } } catch { /* demo kapalı */ }
      return;
    }
    if (prevPhase.current === "ingame" && snap.phase !== "ingame" && (snap.phase === "menu" || snap.phase === "offline")) {
      loadTilt(lastMatch, [12000, 40000, 90000]);
    } else if (snap.phase === "menu" && !tiltInit.current) {
      tiltInit.current = true;
      loadTilt(null, [5000]);
    }
  }, [snap.phase, theme.tilt.on]); // eslint-disable-line react-hooks/exhaustive-deps
  const tilt = alertOf(sess, theme.tilt, newest);
  const ackTilt = () => { if (!tilt) return; setTiltAck(tilt.key); try { localStorage.setItem("overlay-tilt-ack", tilt.key); } catch { /* depolama kapalı */ } };

  // Maç bitince (oyundan menüye ya da kapanışa geçince) rapor kendiliğinden açılır.
  useEffect(() => {
    if (snap.phase === "ingame" && snap.matchId) {
      setLastMatch(snap.matchId);
      try { localStorage.setItem("overlay-last-match", snap.matchId); } catch { /* depolama dolu */ }
    }
    if (prevPhase.current === "ingame" && snap.phase !== "ingame" && (snap.phase === "menu" || snap.phase === "offline")) {
      setSelected(null);
      setCollapsed(false);
      setView("report");
    }
    prevPhase.current = snap.phase;
  }, [snap.phase, snap.matchId]);

  // F2 (Rust tarafında) overlay'i öne aldığında: şeridi aç ve tıklamayı overlay'e ver.
  useEffect(() => {
    if (!inTauri) return;
    let un: (() => void) | undefined;
    listen("overlay-activated", () => {
      manualKeep.current = true;
      setAutoHidden(false);
      setCollapsed(false);
      getCurrentWindow().setIgnoreCursorEvents(false).catch(() => undefined);
    }).then((f) => { un = f; }).catch(() => undefined);
    return () => un?.();
  }, []);

  // Fare otomatik: imleç overlay'in üstündeyken tıklamalar overlay'e, dışındayken oyuna gider.
  useEffect(() => {
    if (!inTauri) return;
    const w = getCurrentWindow();
    let stop = false;
    let ignoring: boolean | null = null;
    const loop = async () => {
      try {
        const [c, p, s] = await Promise.all([cursorPosition(), w.outerPosition(), w.outerSize()]);
        const inside = c.x >= p.x && c.x < p.x + s.width && c.y >= p.y && c.y < p.y + s.height;
        if (ignoring !== !inside) { ignoring = !inside; await w.setIgnoreCursorEvents(ignoring); }
      } catch { /* bir sonraki turda tekrar dene */ }
      if (!stop) window.setTimeout(loop, 80);
    };
    loop();
    return () => { stop = true; w.setIgnoreCursorEvents(false).catch(() => undefined); };
  }, []);

  // Konum: kaydedileni uygula, ama pencere her zaman ekranda ve kullanılabilir boyutta kalsın.
  useEffect(() => {
    if (!inTauri) return;
    const w = getCurrentWindow();
    const valid = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) && x > -2000 && y > -2000 && x < 20000 && y < 20000;

    // startup=true: küçültülmüşse geri aç ve göster. Sonraki turlarda kullanıcının küçültmesine karışma.
    const heal = async (startup: boolean) => {
      if (autoHiddenRef.current) return; // otomatik gizliyken pencere bilerek çok küçük
      try {
        if (await w.isMinimized()) {
          if (!startup) return;
          await w.unminimize();
        }
        if (startup) await w.show();
        const [pos, size, mons] = await Promise.all([w.outerPosition(), w.outerSize(), availableMonitors()]);
        const onScreen = mons.some(
          (m) =>
            pos.x + size.width > m.position.x + 60 && pos.x < m.position.x + m.size.width - 60 &&
            pos.y + size.height > m.position.y + 30 && pos.y < m.position.y + m.size.height - 30,
        );
        if (!onScreen || size.width < 200 || size.height < 60) {
          const m = await primaryMonitor();
          await w.setPosition(new PhysicalPosition((m?.position.x ?? 0) + 40, (m?.position.y ?? 0) + 40));
          const z = Number(localStorage.getItem("overlay-zoom")) || 1;
          await w.setSize(new LogicalSize(Math.round(widthRef.current * z), Math.round(420 * z)));
          lastSize.current = "";
        }
      } catch { /* bir sonraki turda tekrar dene */ }
    };

    try {
      const saved = localStorage.getItem("overlay-pos");
      if (saved) {
        const { x, y } = JSON.parse(saved);
        if (valid(x, y)) w.setPosition(new PhysicalPosition(x, y)).catch(() => undefined);
        else localStorage.removeItem("overlay-pos");
      }
    } catch { /* kayıtlı konum yok */ }

    const t0 = window.setTimeout(() => heal(true), 400);
    const t = window.setInterval(() => heal(false), 4000);
    let un: (() => void) | undefined;
    w.onMoved(({ payload }) => {
      if (valid(payload.x, payload.y)) localStorage.setItem("overlay-pos", JSON.stringify({ x: payload.x, y: payload.y }));
    }).then((f) => { un = f; }).catch(() => undefined);
    return () => { window.clearTimeout(t0); window.clearInterval(t); un?.(); };
  }, []);

  useEffect(() => {
    localStorage.setItem("overlay-zoom", String(zoom));
    if (inTauri) getCurrentWebview().setZoom(zoom).catch(() => undefined);
  }, [zoom]);

  // Kayıtta gizle: pencere ekran kaydı ve yayın yazılımlarında görünmez (Windows'ta çalışır, oyuncunun kendi ekranında görünmeye devam eder).
  useEffect(() => {
    try { localStorage.setItem("overlay-protect", protect ? "1" : "0"); } catch { /* depolama kapalı */ }
    if (inTauri) getCurrentWindow().setContentProtected(protect).catch(() => undefined);
  }, [protect]);

  useEffect(() => { localStorage.setItem("overlay-collapsed", collapsed ? "1" : "0"); if (collapsed) setSelected(null); }, [collapsed]);

  // Otomatik gizleme: maç başladıktan N saniye sonra pencere görünmez ve tıklanamaz hâle gelir (odak çalınmaz).
  // Ajan seçimi (pregame) ve menüde otomatik olarak geri görünür.
  useEffect(() => {
    if (!theme.autoHide) { setAutoHidden(false); return; }
    if (snap.phase !== "ingame") {
      ingameSince.current = null;
      manualKeep.current = false;
      setAutoHidden(false);
      return;
    }
    if (ingameSince.current === null) ingameSince.current = Date.now();
    const wait = Math.max(0, theme.hideAfter * 1000 - (Date.now() - ingameSince.current));
    const t = window.setTimeout(() => { if (!manualKeep.current) setAutoHidden(true); }, wait);
    return () => window.clearTimeout(t);
  }, [snap.phase, theme.autoHide, theme.hideAfter]);

  // Gizliyken pencere minik ve tıklamayı geçiren bir noktaya iner; görününce boyut yeniden hesaplanır.
  // (Bu efekt, boyutlandırma efektinden önce tanımlı olmalı: sıfırlama önce çalışsın.)
  useEffect(() => {
    autoHiddenRef.current = autoHidden;
    lastSize.current = "";
    if (!inTauri || !autoHidden) return;
    const w = getCurrentWindow();
    w.setIgnoreCursorEvents(true).catch(() => undefined);
    w.setSize(new LogicalSize(2, 2)).catch(() => undefined);
  }, [autoHidden]);

  // Pencereyi içeriğe göre otomatik boyutlandır: kaydırma gerekmez.
  const fit = () => {
    const el = rootRef.current;
    if (!inTauri || !el) return;
    const h = Math.ceil(el.offsetHeight);
    if (h < 40) return; // küçültülmüşken ölçüm 0 çıkabilir, pencereyi yok etme
    const key = `${h}|${zoom}|${width}`;
    if (key === lastSize.current) return;
    lastSize.current = key;
    getCurrentWindow().setSize(new LogicalSize(Math.round(width * zoom), Math.round(h * zoom))).catch(() => undefined);
  };
  useEffect(() => { fit(); });
  useEffect(() => {
    if (!rootRef.current) return;
    const ro = new ResizeObserver(fit);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  });

  const showToast = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 1800); };
  const copyName = async (name: string | null, label?: string) => {
    if (!name) { showToast("Bu oyuncunun ismi gizli, kopyalanacak bir şey yok"); return; }
    try {
      if (inTauri) await writeText(name); else await navigator.clipboard.writeText(name);
      showToast(label ?? (blur ? "Kopyalandı" : `Kopyalandı: ${name}`));
    } catch { showToast("Kopyalanamadı"); }
  };

  const openTracker = (url: string) => {
    if (inTauri) openUrl(url).catch(() => showToast("Tarayıcı açılamadı"));
    else window.open(url, "_blank");
  };

  const startDrag = (e: React.MouseEvent) => {
    if (inTauri && e.button === 0) getCurrentWindow().startDragging().catch(() => undefined);
  };
  const stepZoom = (d: number) => {
    const i = ZOOMS.indexOf(zoom);
    setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 2 : i) + d))]);
  };
  const noDrag = (e: React.MouseEvent) => e.stopPropagation();

  const myTeam = snap.players.find((p) => p.isSelf)?.team ?? snap.players[0]?.team;
  const allies = snap.players.filter((p) => p.team === myTeam);
  const enemies = snap.players.filter((p) => p.team !== myTeam);
  const active = snap.players.find((p) => p.puuid === selected);
  const mapName = snap.mapId && assets ? assets.maps.get(lookup(snap.mapId)) : undefined;

  // Saldıran/Savunan: takım rengine göre (Kırmızı saldırır, Mavi savunur). Yalnızca ilk yarı için geçerli.
  const showSides = !!snap.queueId && SIDE_QUEUES.includes(snap.queueId.toLowerCase());
  const sideOf = (team?: string): "Saldıran" | "Savunan" | null => {
    const t = team?.toLowerCase();
    if (!showSides || (t !== "red" && t !== "blue")) return null;
    return (t === "red") !== theme.swapSides ? "Saldıran" : "Savunan";
  };
  const mySide = sideOf(myTeam);

  const st = snap.status;
  const emptyText = !assets
    ? assetsFailed ? "Görseller yüklenemedi. İnternet bağlantını kontrol edip yeniden dene." : "Görseller yükleniyor…"
    : !inTauri ? "Maç başladığında oyuncular burada görünecek."
    : !st ? "Bağlanılıyor…"
    : st.fault === "no_riot_client" ? "Riot Client açık değil. Önce Riot Client'ı, sonra Valorant'ı başlat."
    : st.fault === "not_logged_in" ? "Riot Client'ta oturum açık değil. Giriş yap."
    : st.fault === "no_region" ? "Bölge bilgisi bulunamadı. Valorant'ı bu bilgisayarda en az bir kez açmış olmalısın."
    : st.riotClient && !st.valorant ? "Valorant'ı başlatman gerekiyor, Valorant bekleniyor."
    : snap.error ? snap.error
    : snap.phase === "menu" ? "Maç bekleniyor. Ajan seçimi başlayınca oyuncular burada görünecek."
    : "Maç başladığında oyuncular burada görünecek.";

  // Takım karşılaşması: ortalama rank, ortalama K/D.
  const teamStats = (list: typeof allies) => {
    const ranked = list.filter((p) => p.rank.current > 0);
    const kds = list.filter((p) => p.kd != null);
    const avgTier = ranked.length ? Math.round(ranked.reduce((a, p) => a + p.rank.current, 0) / ranked.length) : 0;
    return {
      tier: avgTier ? assets?.tiers.get(avgTier) : undefined,
      kd: kds.length ? kds.reduce((a, p) => a + (p.kd ?? 0), 0) / kds.length : null,
    };
  };

  if (autoHidden) return null;

  return (
    <main className={blur ? "ov blur" : "ov"} ref={rootRef} style={{ width }}>
      <header className="hd drag" onMouseDown={startDrag} title="Sürükleyerek taşı">
        <span className="hl">
          <h1 className="t">{mapName ?? "Celeste Overlay"}</h1>
          {mySide && (
            <span className={mySide === "Saldıran" ? "side atk" : "side def"} title="Takım rengine göre belirlenir; yalnızca ilk yarıda doğrudur">
              {mySide} (ilk yarı)
            </span>
          )}
        </span>
        <span className="hr">
          <span className="m">{PHASE_TEXT[snap.phase]}</span>
          <span className="zoom" onMouseDown={noDrag}>
            {!collapsed && (
              <>
                <button type="button" onClick={() => stepZoom(-1)} aria-label="Küçült">A−</button>
                <button type="button" onClick={() => stepZoom(1)} aria-label="Büyüt">A+</button>
              </>
            )}
            {!collapsed && (
              <button
                type="button"
                className={protect ? "on" : ""}
                aria-pressed={protect}
                title="Açıkken overlay ekran kaydında ve yayında görünmez; sen oyunda görmeye devam edersin."
                onClick={() => { setProtect(!protect); showToast(protect ? "Overlay kayıtta görünür" : "Overlay kayıtta gizli"); }}
              >
                {protect ? "Kayıtta gizli" : "Kayıtta gizle"}
              </button>
            )}
            {!collapsed && (
              <button
                type="button"
                className={blur ? "on" : ""}
                aria-pressed={blur}
                title="Açıkken oyuncu isimleri bulanık görünür. Video çekerken başkalarının kimliğini göstermemek için."
                onClick={() => { setBlur(!blur); showToast(blur ? "İsimler görünür" : "İsimler bulanık"); }}
              >
                {blur ? "İsimler bulanık" : "Bulanıklaştır"}
              </button>
            )}
            <button type="button" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
              {collapsed ? "Göster" : "Gizle"}
            </button>
          </span>
        </span>
      </header>

      {updater.state.kind === "available" && !collapsed && (
        <div className="upd" role="status">
          <span><i className="pulse" />Yeni sürüm hazır: <b>{updater.state.version}</b></span>
          <button className="trk" type="button" onClick={updater.install}>Güncelle ve yeniden başlat</button>
        </div>
      )}
      {updater.state.kind === "downloading" && !collapsed && (
        <div className="upd" role="status">Güncelleme indiriliyor {updater.state.pct != null ? `%${updater.state.pct}` : "…"}</div>
      )}

      {tilt && tilt.key !== tiltAck && !collapsed && (
        <div className="tilt" role="status">
          <span>{tilt.text}</span>
          <button className="x" type="button" onClick={ackTilt}>Tamam</button>
        </div>
      )}

      {!collapsed && !guide && (
        <nav className="nav" aria-label="Bölümler">
          {NAV.map(([id, label]) => (
            <button key={id} type="button" className={`${view === id ? "on" : ""}${id === "trust" ? " spot" : ""}`.trim()} onClick={() => { setSelected(null); setView(id); }}>
              {label}
            </button>
          ))}
        </nav>
      )}

      {!collapsed && !guide && sess && sess.games > 0 && theme.tilt.on && view === "roster" && (
        <p className="mode sess">Bu seans · {sess.wins}G {sess.losses}M · <span className={sess.rr < 0 ? "neg" : sess.rr > 0 ? "pos" : ""}>{fmtRr(sess.rr)}</span> · {fmtDur(sess.minutes)}</p>
      )}
      {!collapsed && guide && <Guide onDone={closeGuide} />}

      {!collapsed && !guide && (
        view === "settings" ? (
          <Settings updater={updater} theme={theme} onChange={setTheme} onGuide={() => { setGuide(true); setView("roster"); }} zoom={zoom} onZoom={setZoom} zooms={ZOOMS} onToast={showToast} onClose={() => setView("roster")} />
        ) : view === "report" ? (
          assets ? <ReportPanel assets={assets} matchId={lastMatch} onClose={() => setView("roster")} /> : <p className="empty">Görseller yükleniyor…</p>
        ) : view === "store" ? (
          assets ? <StorePanel assets={assets} onClose={() => setView("roster")} /> : <p className="empty">Görseller yükleniyor…</p>
        ) : view === "account" ? (
          assets ? <AccountPanel assets={assets} onClose={() => setView("roster")} /> : <p className="empty">Görseller yükleniyor…</p>
        ) : view === "stats" ? (
          assets ? <StatsPanel assets={assets} onClose={() => setView("roster")} /> : <p className="empty">Görseller yükleniyor…</p>
        ) : view === "cross" ? (
          <Crosshairs onCopy={copyName} onClose={() => setView("roster")} />
        ) : view === "trust" ? (
          <TrustPanel onToast={showToast} onOpen={openTracker} onClose={() => setView("roster")} />
        ) : view === "chat" ? (
          <QuickChat onCopy={copyName} onClose={() => setView("roster")} />
        ) : active && assets ? (
          <LoadoutPanel
            p={active}
            lobby={snap.players}
            th={theme.th}
            assets={assets}
            entry={seen[active.puuid]}
            onLabel={(l) => setSeen(setLabel(active.puuid, l))}
            onTag={(t) => setSeen(setTag(active.puuid, t))}
            onClose={() => setSelected(null)}
            onCopy={copyName}
          />
        ) : snap.players.length === 0 || !assets ? (
          <div className="empty">
            <p>{emptyText}</p>
            {st?.riotClient && !st.valorant && assets && <p className="d">Mağaza ve İstatistik sekmeleri oyun kapalıyken de çalışır.</p>}
            {st?.valorant && <p className="d">Overlay oyunun arkasında kalıyorsa Valorant'ta Ekran Modu'nu Pencereli Tam Ekran yap.</p>}
            {assetsFailed && !assets && <button className="x" type="button" onClick={retryAssets}>Tekrar dene</button>}
          </div>
        ) : (
          <>
            <div className="g c" style={{ gridTemplateColumns: template }}>
              <div>Oyuncu</div>
              {COLS.filter((c) => theme.cols[c.id]).map((c) => (
                <div key={c.id} className={c.id === "wr" ? "k" : undefined}>{c.id === "tracker" ? "" : c.label}</div>
              ))}
            </div>
            {[["Takımın", allies], ["Rakipler", enemies]].map(([title, list]) =>
              (list as typeof allies).length ? (
                <section key={title as string}>
                  <p className="s ts">
                    <span>
                      {title as string}
                      {sideOf((list as typeof allies)[0]?.team) ? ` · ${sideOf((list as typeof allies)[0]?.team)}` : ""}
                    </span>
                    {(() => {
                      const t = teamStats(list as typeof allies);
                      return (
                        <span className="cmp" title="Ortalama rank ve son 5 rekabet maçının ortalama K/D'si">
                          Ortalama {t.tier?.name ?? "–"} · K/D {t.kd != null ? t.kd.toFixed(2) : "–"}
                        </span>
                      );
                    })()}
                  </p>
                  {(list as typeof allies).map((p, i) => (
                    <PlayerRow
                      key={p.puuid}
                      p={p}
                      index={i}
                      assets={assets}
                      entry={seen[p.puuid]}
                      cols={theme.cols}
                      th={theme.th}
                      template={template}
                      blur={blur}
                      onOpen={() => setSelected(p.puuid)}
                      onCopy={copyName}
                      onTracker={openTracker}
                    />
                  ))}
                </section>
              ) : null,
            )}
            <p className="mode">İsme tıkla: adı kopyala · Satıra tıkla: ayrıntılar · Başlığı sürükle: taşı</p>
            {snap.players.some((x) => x.form.some((f) => (f.queue ?? "").toLowerCase() !== "competitive")) && (
              <p className="mode legend">
                <span className="fc win">W</span>Rekabet
                <span className="fc win alt">W</span>Diğer mod · üstüne gelince mod, harita ve ajan görünür
              </p>
            )}
            {snap.players.some((x) => x.party) && (
              <p className="mode legend">
                <span className="p mini">A</span>Aynı parti
                {snap.players.some((x) => x.party && !x.partySure) && <><span className="p mini soft">A</span>Son rekabet maçlarında sık birlikte</>}
              </p>
            )}
          </>
        )
      )}
      {!collapsed && <StatusBar status={snap.status} inApp={inTauri} assetsOk={!!assets} assetsFailed={assetsFailed} version={updater.version} onToast={showToast} onOpen={openTracker} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
