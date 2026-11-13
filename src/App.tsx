import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogicalPosition, LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { availableMonitors, currentMonitor, cursorPosition, getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { exit } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { loadAssets, lookup, type Assets } from "./assets";
import { mockSnapshot } from "./mock";
import { clearWatch, exportWatch, importWatch, recordSeen, setLabel, setTag, TAGS, type Seen } from "./seen";
import { Watchlist } from "./Watchlist";
import { Versus } from "./Versus";
import type { MyStats, Player, Snapshot } from "./types";
import { PlayerRow } from "./PlayerRow";
import { PlayerCard } from "./PlayerCard";
import { groupParties } from "./playerView";
import { LoadoutPanel } from "./LoadoutPanel";
import { QuickChat } from "./QuickChat";
import { Guide } from "./Guide";
import { Crosshairs } from "./CrosshairPanel";
import { Settings } from "./Settings";
import { StatusBar } from "./StatusBar";
import { Device } from "./Device";
import { Timers } from "./Timers";
import { Search } from "./Search";
import { Meta } from "./Meta";
import { TimerPill } from "./TimerPill";
import { onTimerDone, startSpike, useSpikeKey } from "./timerStore";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { AccountPanel } from "./AccountPanel";
import { StorePanel } from "./StorePanel";
import { StatsPanel } from "./StatsPanel";
import { ReportPanel } from "./ReportPanel";
import { TrustPanel } from "./TrustPanel";
import { teamSummary } from "./insights";
import { FeedbackPanel } from "./FeedbackPanel";
import { FeedPanel } from "./FeedPanel";
import { useDiscordPresence } from "./discordRpc";
import { useFeedBadge, type FeedCard } from "./feed";
import { alertOf, fmtRr, sessionOf, type Session } from "./tilt";
import { useUpdater } from "./updater";
import { ForceUpdate, useOutdated } from "./ForceUpdate";
import { Empty } from "./ui";
import { Icon } from "./icons";
import { Rail, type Group } from "./Rail";
import { QuickMenu } from "./QuickMenu";
import { Hub } from "./Hub";
import { Waiting } from "./Waiting";
import { WhatsNew } from "./WhatsNew";
import { NoticeCard } from "./NoticeCard";
import { useNotices, useUsagePing } from "./community";
import { PreviewBar } from "./PreviewBar";
import { PremiumPanel } from "./PremiumPanel";
import { ROLES, roleCounts, topThreat } from "./threat";
import { Roles } from "./RoleBadge";
import { syncPresence, useLobbyRoles } from "./roleLookup";
import { SAMPLE, applyLook, fxColor, isPremium, rolesUnlock, loadPremiumCfg, unlocked, useMe, usePremiumCfg, usePreview, type ItemId } from "./vip";
import { currentMe, login } from "./feed";
import { applyTheme, gridCols, gridTemplate, hideOf, loadTheme, overlayWidth } from "./theme";

const inTauri = "__TAURI_INTERNALS__" in window;
// Pencere genişliği açık sütunlara göre hesaplanır; yükseklik içeriğe göre otomatik ayarlanır.
const SIDE_QUEUES = ["competitive", "unrated", "swiftplay", "spikerush", "premier"];
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

/* Bölümler: sol menüdeki gruplar ve içlerindeki alt sekmeler. */
const PROFILE = [["stats", "İstatistik"], ["store", "Mağaza"], ["account", "Hesabım"]] as const;
const TOOLS = [["chat", "Hızlı mesajlar"], ["cross", "Nişangah"], ["device", "DPI/eDPI"], ["timers", "Sayaçlar"], ["search", "Oyuncu arama"], ["watch", "İzleme listesi"], ["meta", "Meta"]] as const;
type ProfileView = (typeof PROFILE)[number][0];
type ToolView = (typeof TOOLS)[number][0];
type View = "roster" | "report" | "feed" | "feedback" | "premium" | "trust" | "settings" | ProfileView | ToolView;
const groupOf = (v: View): Group =>
  PROFILE.some(([id]) => id === v) ? "profile" : TOOLS.some(([id]) => id === v) ? "tools" : v === "feedback" ? "roster" : (v as Group);
const saved = <T extends string>(key: string, list: readonly (readonly [T, string])[], fallback: T): T => {
  try { const v = localStorage.getItem(key) as T | null; return v && list.some(([id]) => id === v) ? v : fallback; } catch { return fallback; }
};

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
  const [feedDraft, setFeedDraft] = useState<FeedCard | null>(null);
  const [feedNew, feedSeen, feedNotes] = useFeedBadge(view === "feed");
  const [theme, setTheme] = useState(loadTheme);
  const [seen, setSeen] = useState<Seen>({});
  const [watchSound, setWatchSound] = useState(() => { try { return localStorage.getItem("overlay-watch-sound") !== "0"; } catch { return true; } });
  const alerted = useRef(new Set<string>());
  const [guide, setGuide] = useState<boolean>(() => { try { return localStorage.getItem("overlay-guide") !== "1"; } catch { return false; } });
  const closeGuide = () => { setGuide(false); try { localStorage.setItem("overlay-guide", "1"); } catch { /* depolama kapalı */ } };
  const [protect, setProtect] = useState<boolean>(() => localStorage.getItem("overlay-protect") === "1");
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem("overlay-zoom")) || 1);
  const [blur, setBlur] = useState<boolean>(() => { try { return localStorage.getItem("overlay-blur") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("overlay-blur", blur ? "1" : "0"); } catch { /* depolama kapalı */ } }, [blur]);
  const [autoHidden, setAutoHidden] = useState(false);
  const [hideAt, setHideAt] = useState<number | null>(null);
  const [askQuit, setAskQuit] = useState(false);
  const [assetsFailed, setAssetsFailed] = useState(false);
  // Discord kartı ("Celeste Overlay oynuyor"); ayarlardan kapatılabilir.
  useDiscordPresence(snap, assets, theme.discord, theme.streamer);
  const updater = useUpdater();
  useUsagePing(updater.version);
  const outdated = useOutdated(updater.version);
  const [notices, clearNotices] = useNotices();
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
  const lastProfile = useRef<ProfileView>(saved("overlay-profile-tab", PROFILE, "stats"));
  const lastTool = useRef<ToolView>(saved("overlay-tool-tab", TOOLS, "chat"));
  // Oyuncu ayrıntısı yandan açılan bir panelde: liste kısa kalırsa pencere panelin boyuna kadar uzar.
  const drawerRef = useRef<HTMLDivElement>(null);
  const [drawerH, setDrawerH] = useState(0);
  const lastSize = useRef("");
  const autoHiddenRef = useRef(false);
  const manualKeep = useRef(false); // F2 ile elle açıldıysa bu maç boyunca otomatik gizleme yapma
  const ingameSince = useRef<number | null>(null);
  const [full, setFull] = useState(false);
  const fullRef = useRef(false);
  fullRef.current = full;
  const prevPos = useRef<PhysicalPosition | null>(null);
  const progMove = useRef(0); // kodun kendi yaptığı taşımalar (tam ekran, konum onarımı) sürükleme sayılmasın
  const fullPos = useRef<PhysicalPosition | null>(null);
  const dragAt = useRef(0);
  const toggleFullRef = useRef<(on?: boolean, restore?: boolean) => void>(() => undefined);
  const scr = window.screen as Screen & { availLeft?: number; availTop?: number };
  const width = full ? Math.floor(scr.availWidth / zoom) : overlayWidth(theme.cols, theme.layout);
  const fullH = Math.floor(scr.availHeight / zoom);
  const toggleFull = async (force?: boolean, restore = true) => {
    const next = typeof force === "boolean" ? force : !full;
    if (next === full) return;
    progMove.current = Date.now() + 900;
    if (inTauri) {
      const w = getCurrentWindow();
      try {
        if (next) {
          prevPos.current = await w.outerPosition();
          await w.setPosition(new LogicalPosition(scr.availLeft ?? 0, scr.availTop ?? 0));
          window.setTimeout(() => { w.outerPosition().then((q) => { fullPos.current = q; }).catch(() => undefined); }, 450);
        } else if (restore && prevPos.current) {
          await w.setPosition(prevPos.current);
        }
      } catch { /* konum alınamazsa yalnız boyut değişir */ }
    }
    lastSize.current = "";
    setFull(next);
  };
  toggleFullRef.current = (on, restore) => { void toggleFull(on, restore); };
  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog] :focus")) toggleFull(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const template = gridTemplate(theme.cols);
  const widthRef = useRef(width);
  widthRef.current = width;
  const hide = hideOf(theme);
  // FPS modu: gizliyken (maçta ya da F2 ile) arka plandaki denetimler seyrekleşir.
  const fpsRef = useRef(theme.fps);
  fpsRef.current = theme.fps;
  const idle = () => autoHiddenRef.current || document.hidden;

  useEffect(() => { applyTheme(theme); }, [theme]);
  // Premium görünüm: tema, vurgu rengi ve rol efekti. Her biri yöneticinin seçtiği role bağlı olabilir.
  // Önizleme sırasında kilitli özellik de 15 sn uygulanır (rengi yoksa örnek altın renkle).
  const me = useMe();
  const prem = isPremium(me);
  const pcfg = usePremiumCfg();
  const pv = usePreview();
  const can = (id: ItemId) => pv?.id === id || unlocked(me, id, pcfg);
  const pvSkin = pv?.id.startsWith("skin:") ? pv.id.slice(5) : null;
  const skinId = pvSkin ?? (theme.skin && unlocked(me, `skin:${theme.skin}`, pcfg) ? theme.skin : "");
  const accentRc = pv?.id === "fx:accent" ? (fxColor(me?.roles, "fx:accent", pcfg) ?? SAMPLE) : theme.roleAccent && unlocked(me, "fx:accent", pcfg) ? fxColor(me?.roles, "fx:accent", pcfg) : undefined;
  const glowRc = pv?.id === "fx:glow" ? (fxColor(me?.roles, "fx:glow", pcfg) ?? SAMPLE) : theme.vipFx && unlocked(me, "fx:glow", pcfg) ? fxColor(me?.roles, "fx:glow", pcfg) : undefined;
  useEffect(() => {
    applyLook({ skin: skinId, accent: accentRc ?? theme.accent, vipColor: glowRc });
  }, [skinId, accentRc, glowRc, theme.accent]);
  useEffect(() => { void loadPremiumCfg(); }, [me]);
  // Rolü olan biri önceden Akış'a girdiyse oturum açılışta tazelenir (rol değişmiş olabilir). Yalnızca eski oturumu olanlar için.
  useEffect(() => {
    if (!inTauri || !currentMe()) return;
    const t = window.setTimeout(() => { login().catch(() => undefined); }, 6_000);
    return () => window.clearTimeout(t);
  }, []);
  const marks = useLobbyRoles(snap.players, theme.showRoles);
  const lobbyRoles = marks.roles;
  // Lobide görünme: açılışta ve ayar değişince bir kez (Riot Client açıksa).
  const riotUp = snap.phase !== "offline";
  useEffect(() => { if (riotUp) void syncPresence(theme.showMe, currentMe()?.session); }, [theme.showMe, riotUp]);
  useEffect(() => {
    const el = drawerRef.current;
    if (!selected || !el) { setDrawerH(0); return; }
    // İçeriğin kendi boyu ölçülür (panelin değil): yoksa pencere büyüdükçe ölçüm de büyür.
    const ro = new ResizeObserver(() => setDrawerH(Math.ceil(el.offsetHeight) + 26));
    ro.observe(el);
    return () => ro.disconnect();
  }, [selected]);

  const retryAssets = () => {
    setAssetsFailed(false);
    loadAssets().then(setAssets).catch(() => setAssetsFailed(true));
  };
  useEffect(retryAssets, []);

  useEffect(() => {
    if (!inTauri) {
      if (assets) setSnap(location.hash === "#bos" ? { phase: "menu", players: [] } : mockSnapshot(assets));
      return;
    }
    let stop = false;
    let t = 0;
    const tick = async () => {
      try { if (!stop) setSnap(await invoke<Snapshot>("get_snapshot")); } catch { /* sonraki turda tekrar dene */ }
      if (!stop) t = window.setTimeout(tick, idle() ? (fpsRef.current ? 15000 : 8000) : 2500); // gizliyken seyrek: maç sırasında bağlantıya yük olmasın
    };
    tick();
    return () => { stop = true; window.clearTimeout(t); };
  }, [assets]);

  // Aynı oyuncuyla karşılaşma geçmişini yerelde kaydet (isim saklanmaz).
  // İzleme listesi: etiketli oyuncu lobiye girince (maç başına bir kez) kısa bir uyarı sesi. Yalnızca Toksik ve Şüpheli için.
  useEffect(() => {
    if (!watchSound || snap.phase !== "ingame" || !snap.matchId) return;
    const hit = snap.players.filter((p) => !p.isSelf && (seen[p.puuid]?.tag === "toksik" || seen[p.puuid]?.tag === "supheli") && !alerted.current.has(`${snap.matchId}:${p.puuid}`));
    if (!hit.length) return;
    for (const p of hit) alerted.current.add(`${snap.matchId}:${p.puuid}`);
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 660; g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.16);
      o.start(t); o.stop(t + 0.4); o.onended = () => { void ctx.close(); };
    } catch { /* ses çalınamadı */ }
  }, [snap.phase, snap.matchId, snap.players, seen, watchSound]);

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

  // OBS tarayıcı kaynağı: açıksa uygulama yerelde küçük bir sayfa sunar; rank, RR ve bugünkü seans 2 dakikada bir ve maç bitince yenilenir.
  useEffect(() => {
    if (!inTauri) return;
    invoke<string>("obs_set", { enabled: theme.obs }).catch((e) => { if (theme.obs) showToast(String(e)); });
  }, [theme.obs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!inTauri || !theme.obs || !assets) return;
    let stop = false;
    const push = async () => {
      try {
        const d = await invoke<MyStats>("get_my_stats");
        if (stop) return;
        const t = assets.tiers.get(d.rank.current);
        const s = sessionOf(d.matches);
        await invoke("obs_push", { data: { rank: t ? { name: t.name, icon: t.icon, color: t.color, rr: d.rank.current > 0 ? d.rank.rr : null } : null, session: s ? { games: s.games, wins: s.wins, losses: s.losses, rr: s.rr } : null } });
      } catch { /* sonraki turda */ }
    };
    push();
    const t = window.setInterval(push, 120_000);
    return () => { stop = true; window.clearInterval(t); };
  }, [theme.obs, assets, snap.phase === "ingame"]); // maç bitince (ingame → değil) yeniden
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
    let un2: (() => void) | undefined;
    listen("overlay-activated", () => {
      manualKeep.current = true;
      setAutoHidden(false);
      setHideAt(null);
      setCollapsed(false);
      getCurrentWindow().setIgnoreCursorEvents(false).catch(() => undefined);
    }).then((f) => { un = f; }).catch(() => undefined);
    // Uygulama zaten açıkken tekrar açılmaya çalışıldı: yeni kopya başlamadı, bu pencere öne geldi.
    listen("second-instance", () => showToast("Celeste Overlay zaten açık. Gizliyken F2 ile açılır, tepsideki simgeden kapatılır."))
      .then((f) => { un2 = f; }).catch(() => undefined);
    return () => { un?.(); un2?.(); };
  }, []);

  // Fare otomatik: imleç overlay'in üstündeyken tıklamalar overlay'e, dışındayken oyuna gider.
  useEffect(() => {
    if (!inTauri) return;
    const w = getCurrentWindow();
    let stop = false;
    let ignoring: boolean | null = null;
    const loop = async () => {
      // Gizliyken (otomatik gizleme ya da F2) imleç denetlenmez: pencere zaten tıklamayı geçirir ya da görünmez.
      if (idle()) {
        ignoring = null; // görünür olunca ilk turda yeniden belirlenir
        if (!stop) window.setTimeout(loop, 500);
        return;
      }
      try {
        const [c, p, s] = await Promise.all([cursorPosition(), w.outerPosition(), w.outerSize()]);
        const inside = c.x >= p.x && c.x < p.x + s.width && c.y >= p.y && c.y < p.y + s.height;
        if (ignoring !== !inside) { ignoring = !inside; await w.setIgnoreCursorEvents(ignoring); }
      } catch { /* bir sonraki turda tekrar dene */ }
      if (!stop) window.setTimeout(loop, fpsRef.current ? 120 : 80);
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
      if (!startup && document.hidden) return; // F2 ile gizliyken düzeltilecek bir şey yok
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

  // Kenara yapıştır: pencereyi tutup ekranın üst kenarına değdirip bırakınca tam ekran olur (Windows'taki gibi).
  // Tam ekrandayken tutup çekersen tam ekrandan çıkar.
  useEffect(() => {
    if (!inTauri) return;
    const w = getCurrentWindow();
    let timer: number | undefined;
    let un: (() => void) | undefined;
    w.onMoved(({ payload }) => {
      if (Date.now() < progMove.current) return;
      window.clearTimeout(timer);
      if (fullRef.current) {
        const f = fullPos.current;
        if (f && Math.abs(payload.x - f.x) + Math.abs(payload.y - f.y) > 40) toggleFullRef.current(false, false);
        return;
      }
      if (Date.now() - dragAt.current > 120_000) return; // yalnızca kullanıcının tutup sürüklediği taşımalar
      timer = window.setTimeout(async () => {
        try {
          const [c, mon] = await Promise.all([cursorPosition(), currentMonitor()]);
          if (mon && c.y <= mon.position.y + 6 && c.x >= mon.position.x && c.x < mon.position.x + mon.size.width) toggleFullRef.current(true);
        } catch { /* imleç okunamadı */ }
      }, 350);
    }).then((f) => { un = f; }).catch(() => undefined);
    return () => { window.clearTimeout(timer); un?.(); };
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
    if (!hide.on || !inTauri) { setAutoHidden(false); return; } // tarayıcıda (geliştirme) hiç gizlenmez
    if (snap.phase !== "ingame") {
      ingameSince.current = null;
      manualKeep.current = false;
      setAutoHidden(false);
      setHideAt(null);
      return;
    }
    if (ingameSince.current === null) ingameSince.current = Date.now();
    const wait = Math.max(0, hide.after * 1000 - (Date.now() - ingameSince.current));
    if (!manualKeep.current) setHideAt(Date.now() + wait);
    const t = window.setTimeout(() => { if (!manualKeep.current) setAutoHidden(true); setHideAt(null); }, wait);
    return () => window.clearTimeout(t);
  }, [snap.phase, hide.on, hide.after]);

  // Gizlenmeden önce geri sayım (saniye): kullanıcı overlay'in kapanmadığını, gizlendiğini bilsin.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!hideAt) return;
    const t = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [hideAt]);

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
    getCurrentWindow().setSize(new LogicalSize(Math.round(width * zoom), Math.round(h * zoom))).then(keepOnScreen).catch(() => undefined);
  };
  // Pencere büyüyünce (menü açılınca, genişlik değişince) ekranın dışına taşmasın: çalışma alanına geri çek.
  const keepOnScreen = async () => {
    if (!inTauri || fullRef.current) return;
    try {
      const w = getCurrentWindow();
      const [pos, size, mon] = await Promise.all([w.outerPosition(), w.outerSize(), currentMonitor()]);
      if (!mon) return;
      const wa = mon.workArea ?? { position: mon.position, size: mon.size };
      const maxX = wa.position.x + wa.size.width - size.width, maxY = wa.position.y + wa.size.height - size.height;
      const x = Math.max(wa.position.x, Math.min(pos.x, maxX)), y = Math.max(wa.position.y, Math.min(pos.y, maxY));
      if (x !== pos.x || y !== pos.y) await w.setPosition(new PhysicalPosition(x, y));
    } catch { /* konum okunamazsa pencere olduğu yerde kalır */ }
  };
  useEffect(() => { fit(); });
  useEffect(() => {
    if (!rootRef.current) return;
    const ro = new ResizeObserver(fit);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  });

  const showToast = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 1800); };
  // Spike sayacı için atanmış genel kısayol (oyunun üstündeyken de çalışır).
  const spikeKey = useSpikeKey();
  useEffect(() => {
    if (!inTauri || !spikeKey) return;
    register(spikeKey, (e) => { if (e.state === "Pressed") startSpike(); }).catch(() => showToast("Spike tuşu kaydedilemedi, başka bir program kullanıyor olabilir"));
    return () => { unregister(spikeKey).catch(() => undefined); };
  }, [spikeKey]);
  useEffect(() => { onTimerDone((t) => { setToast(`${t.name} bitti`); window.setTimeout(() => setToast(null), 3500); }); return () => onTimerDone(null); }, []);
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
    if (inTauri && e.button === 0) { dragAt.current = Date.now(); getCurrentWindow().startDragging().catch(() => undefined); }
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
    : !inTauri ? "Maç bulunduğunda oyuncular burada kendiliğinden listelenir."
    : !st ? "Bağlanılıyor…"
    : st.fault === "no_riot_client" ? "Riot Client kapalı görünüyor. Önce Riot Client'ı, ardından Valorant'ı aç."
    : st.fault === "not_logged_in" ? "Riot Client'ta oturum açık değil. Giriş yap."
    : st.fault === "no_region" ? "Bölge bilgisi bulunamadı. Valorant'ı bu bilgisayarda en az bir kez açmış olmalısın."
    : st.riotClient && !st.valorant ? "Riot Client bağlı. Şimdi Valorant'ı aç."
    : snap.error ? snap.error
    : snap.phase === "menu" ? "Valorant'a bağlandık. Maç bulunduğunda oyuncular burada kendiliğinden listelenir."
    : "Maç bulunduğunda oyuncular burada kendiliğinden listelenir.";

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

  const avgTierOf = (list: typeof allies) => teamStats(list).tier ? Math.round(list.filter((p) => p.rank.current > 0).reduce((s, p) => s + p.rank.current, 0) / Math.max(1, list.filter((p) => p.rank.current > 0).length)) : 0;
  let hotId: string | null = null;

  if (autoHidden) return null;
  // Menüler ve oyuncu ayrıntısı her zaman tam opaktır; saydamlık yalnızca oyuncu listesinde geçerlidir.
  const solid = !collapsed && (guide || view !== "roster" || !!active);
  const group = groupOf(view);
  const feedCount = feedNotes || feedNew;
  const go = (v: View) => {
    setSelected(null);
    setView(v);
    if (v === "feed") feedSeen();
    if (PROFILE.some(([id]) => id === v)) { lastProfile.current = v as ProfileView; try { localStorage.setItem("overlay-profile-tab", v); } catch { /* depolama kapalı */ } }
    if (TOOLS.some(([id]) => id === v)) { lastTool.current = v as ToolView; try { localStorage.setItem("overlay-tool-tab", v); } catch { /* depolama kapalı */ } }
  };
  const pickGroup = (g: Group) => go(g === "profile" ? lastProfile.current : g === "tools" ? lastTool.current : g);
  const loading = <Empty text="Görseller yükleniyor…" />;
  const sideText = (list: typeof allies) => sideOf(list[0]?.team);

  // Lobi özeti: rakip ve takım özetleri, tekrar karşılaşılan oyuncu ve bugünkü seans tek satırda.
  const again = snap.players
    .filter((p) => !p.isSelf && (seen[p.puuid]?.n ?? 0) >= 2)
    .sort((a, b) => (seen[b.puuid]?.n ?? 0) - (seen[a.puuid]?.n ?? 0))[0];
  const againName = again ? (again.hiddenName ? seen[again.puuid]?.label ?? "Gizli bir oyuncu" : (again.name ?? "").split("#")[0]) : null;
  const watchedHere = snap.players.filter((p) => !p.isSelf && seen[p.puuid]?.tag).slice(0, 4);
  const foeSum = teamSummary(enemies, snap.mapId), mySum = teamSummary(allies.filter((x) => !x.isSelf), snap.mapId);

  const cards = theme.layout === "cards";
  const versus = theme.layout === "versus";
  // Lobinin en yüksek rankı (eşitlikte hepsi).
  const maxTier = Math.max(0, ...snap.players.map((p) => p.rank.current));
  const topIds = new Set(maxTier > 0 ? snap.players.filter((p) => p.rank.current === maxTier).map((p) => p.puuid) : []);
  // Rakip takımın ortalama rankı seninkinden kaç kademe farklı (yalnızca ölçülen ranklardan).
  const rankGap = (() => {
    const avg = (l: typeof allies) => { const r = l.filter((p) => p.rank.current > 0); return r.length >= 3 ? r.reduce((a, p) => a + p.rank.current, 0) / r.length : null; };
    const a = avg(allies), e = avg(enemies);
    if (a == null || e == null) return null;
    const d = Math.round(e - a);
    if (d === 0) return { text: "Denk", tone: "eq" };
    return { text: `${Math.abs(d)} kademe ${d > 0 ? "üstte" : "altta"}`, tone: d > 0 ? "up" : "down" };
  })();

  const cellProps = (p: Player, list: Player[], hot: string | null) => ({
                p, index: list.indexOf(p), assets: assets!, entry: seen[p.puuid], cols: theme.cols, th: theme.th,
                onOpen: () => setSelected(p.puuid), onCopy: copyName, onTracker: openTracker,
                mapId: snap.mapId, mapName, lobby: snap.players, top: topIds.has(p.puuid), hot: p.puuid === hot,
                celeste: theme.showRoles && (p.isSelf ? theme.showMe : marks.users.has(p.puuid)),
                roles: theme.showRoles ? (p.isSelf ? (prem ? me!.roles : undefined) : lobbyRoles.get(p.puuid)) : undefined,
                plate: theme.showRoles ? (p.isSelf ? (can("fx:plate") ? (fxColor(me?.roles, "fx:plate", pcfg) ?? SAMPLE) : undefined) : rolesUnlock(lobbyRoles.get(p.puuid), "fx:plate", pcfg) ? fxColor(lobbyRoles.get(p.puuid), "fx:plate", pcfg) : undefined) : undefined,
  });
  const foeHot = versus ? topThreat(enemies, avgTierOf(enemies)) : null;
  const lobby = (
    <>
      {(foeSum.length > 0 || mySum.length > 0 || again || watchedHere.length > 0 || (sess && sess.games > 0 && theme.tilt.on)) && (
        <div className="lchips" role="note" aria-label="Lobi özeti">
          {foeSum.length > 0 && <span className="lchip foe" title="Rakip takım"><Icon name="link" size={14} /><b>Rakipte</b>{foeSum.join(" · ")}</span>}
          {mySum.length > 0 && <span className="lchip ally" title="Senin takımın"><Icon name="users" size={14} /><b>Takımında</b>{mySum.join(" · ")}</span>}
          {again && (
            <span className="lchip again" title={`Bu oyuncuyla ${seen[again.puuid]?.n}. kez aynı maçtasın`}>
              <Icon name="repeat" size={14} /><b className="pn">{againName}</b>ile {seen[again.puuid]?.n}. kez aynı maçtasın
            </span>
          )}
          {watchedHere.map((p) => {
            const t = TAGS.find((x) => x.id === seen[p.puuid]?.tag)!;
            const nm = p.hiddenName ? seen[p.puuid]?.label ?? "Gizli bir oyuncu" : (p.name ?? "").split("#")[0];
            return (
              <span key={p.puuid} className="lchip watch" style={{ "--tc": t.color } as React.CSSProperties} title="İzleme listendeki oyuncu">
                <Icon name="eyeoff" size={14} /><b className="pn">{nm}</b>{t.label} · {p.team === myTeam ? "takımında" : "rakipte"}
              </span>
            );
          })}
          {sess && sess.games > 0 && theme.tilt.on && (
            <span className="lchip" title="Bugünkü seansın">
              <Icon name="moon" size={14} />Bu seans <b>{sess.wins}G {sess.losses}M</b>
              <span className={sess.rr < 0 ? "neg" : sess.rr > 0 ? "pos" : ""}>{fmtRr(sess.rr)}</span>
            </span>
          )}
        </div>
      )}
      {versus && assets && (
        <Versus allies={groupParties(allies)} enemies={groupParties(enemies)} assets={assets} mapId={snap.mapId} mapName={mapName} allySide={sideText(allies)} foeSide={sideText(enemies)}
          cell={(p, list) => cellProps(p, list, list === enemies || enemies.includes(p) ? foeHot : null)} />
      )}
      {!cards && !versus && (
        <div className="g c" style={{ gridTemplateColumns: template }}>
          <div>Oyuncu</div>
          {gridCols(theme.cols).map((c) => <div key={c.id}>{c.id === "tracker" ? "" : c.label}</div>)}
        </div>
      )}
      {!versus && ([["Takımın", allies, "ally"], ["Rakipler", enemies, "foe"]] as const).map(([title, list, kind]) =>
        list.length ? (
          <section key={title} className={`team ${kind}${cards ? " cards" : ""}`}>
            <div className="teamh">
              <span className="teamn"><i />{title}{sideText(list) ? <small>{sideText(list)}</small> : null}</span>
              {assets && <RoleStrip list={list} assets={assets} ally={kind === "ally"} />}
              {(() => {
                const t = teamStats(list);
                const gap = kind === "foe" ? rankGap : null;
                return (
                  <span className="cmp" title="Ortalama rank ve son rekabet maçlarının ortalama K/D'si">
                    {gap && <span className={`rgap ${gap.tone}`}>{gap.text}</span>}
                    Ortalama <b>{t.tier?.name ?? "–"}</b> · K/D <b>{t.kd != null ? t.kd.toFixed(2) : "–"}</b>
                  </span>
                );
              })()}
            </div>
            <div className={cards ? "pcgrid" : "rows"}>
            {(() => { hotId = kind === "foe" ? topThreat(list, avgTierOf(list)) : null; return null; })()}
            {groupParties(list).map((p) => {
              const props = cellProps(p, list, hotId);
              return cards ? <PlayerCard key={p.puuid} {...props} /> : <PlayerRow key={p.puuid} {...props} template={template} blur={blur} />;
            })}
            </div>
          </section>
        ) : null,
      )}
    </>
  );

  const content = view === "settings" ? (
    <Settings updater={updater} onOpen={openTracker} onFeedback={() => go("feedback")} theme={theme} onChange={setTheme} onGuide={() => { setGuide(true); setView("roster"); }} zoom={zoom} onZoom={setZoom} zooms={ZOOMS} onToast={showToast} onClose={() => go("roster")} />
  ) : view === "feed" ? (
    assets ? <FeedPanel assets={assets} draft={feedDraft} onDraftUsed={() => setFeedDraft(null)} onToast={showToast} onClose={() => go("roster")} /> : loading
  ) : view === "feedback" ? (
    <FeedbackPanel version={updater.version} onOpen={openTracker} onClose={() => go("roster")} />
  ) : view === "report" ? (
    assets ? <ReportPanel assets={assets} matchId={lastMatch} seen={seen} onTag={(id, t) => setSeen(setTag(id, t))} onOpen={openTracker} onClose={() => go("roster")} /> : loading
  ) : group === "profile" ? (
    <Hub title="Profilim" tabs={PROFILE} active={view as ProfileView} onPick={go}>
      {!assets ? loading
        : view === "store" ? <StorePanel assets={assets} onClose={() => go("roster")} />
        : view === "account" ? <AccountPanel assets={assets} onClose={() => go("roster")} />
        : <StatsPanel assets={assets} onToast={showToast} onShare={(c) => { setFeedDraft(c); go("feed"); }} onClose={() => go("roster")} />}
    </Hub>
  ) : group === "tools" ? (
    <Hub title="Araçlar" tabs={TOOLS} active={view as ToolView} onPick={go}>
      {view === "cross" ? <Crosshairs onCopy={copyName} onClose={() => go("roster")} />
        : view === "device" ? <Device onCopy={copyName} onClose={() => go("roster")} />
        : view === "timers" ? <Timers onClose={() => go("roster")} />
        : view === "meta" ? <Meta assets={assets} currentMapId={snap.mapId} onClose={() => go("roster")} />
        : view === "watch" ? <Watchlist assets={assets} seen={seen} sound={watchSound} onSound={(on) => { setWatchSound(on); try { localStorage.setItem("overlay-watch-sound", on ? "1" : "0"); } catch { /* depolama kapalı */ } }}
            onTag={(id, t) => setSeen(setTag(id, t))} onLabel={(id, t) => setSeen(setLabel(id, t))} onClear={(id) => setSeen(clearWatch(id))}
            onExport={() => copyName(exportWatch(seen), "Liste kopyalandı")}
            onImport={(t) => { const r = importWatch(t); if (!r) showToast("Liste okunamadı"); else { setSeen(r.seen); showToast(r.added ? `${r.added} oyuncu eklendi` : "Yeni oyuncu yok"); } }}
            onClose={() => go("roster")} />
        : view === "search" ? <Search assets={assets} seen={seen} onOpen={openTracker} onCopy={copyName} onClose={() => go("roster")} />
        : <QuickChat onCopy={copyName} onClose={() => go("roster")} />}
    </Hub>
  ) : view === "premium" ? (
    <PremiumPanel theme={theme} onChange={setTheme} onOpen={openTracker} onToast={showToast} onClose={() => go("roster")} onGo={(v) => go(v)} />
  ) : view === "trust" ? (
    <TrustPanel onToast={showToast} onOpen={openTracker} onClose={() => go("roster")} />
  ) : snap.players.length === 0 || !assets ? (
    <Waiting
      inApp={inTauri}
      status={st}
      phase={snap.phase}
      assetsOk={!!assets}
      assetsFailed={assetsFailed}
      text={<>
        {emptyText}
        {st?.valorant && <small>Overlay oyunun arkasında kalıyorsa Valorant'ta Ekran Modu'nu “Pencereli Tam Ekran” yap.</small>}
      </>}
      onRetry={assetsFailed && !assets ? retryAssets : undefined}
      sess={theme.tilt.on ? sess : null}
      feedCount={feedCount}
      feedNote={feedNotes > 0}
      hasLastMatch={!!lastMatch}
      onGo={go}
    />
  ) : (
    <div className={active ? "lobbyw hasdrawer" : "lobbyw"} style={active && drawerH ? { minHeight: drawerH } : undefined}>
      {lobby}
      {active && (
        <div className="drawerw">
          <button type="button" className="dscrim" aria-label="Oyuncu ayrıntısını kapat" onClick={() => setSelected(null)} />
          <aside className="drawer">
            <div ref={drawerRef}>
            <LoadoutPanel
              p={active}
              lobby={snap.players}
              th={theme.th}
              assets={assets}
              mapId={snap.mapId}
              entry={seen[active.puuid]}
              onLabel={(l) => setSeen(setLabel(active.puuid, l))}
              onTag={(t) => setSeen(setTag(active.puuid, t))}
              onClose={() => setSelected(null)}
              onCopy={copyName}
              onTracker={openTracker}
            />
            </div>
          </aside>
        </div>
      )}
    </div>
  );

  const phaseTone = snap.phase === "pregame" ? "go" : snap.phase === "ingame" ? "live" : snap.phase === "menu" ? "wait" : "off";

  return (
    <main className={`ov${blur ? " blur" : ""}${solid ? " solid" : ""}${collapsed ? " mini" : ""}${full ? " fullw" : ""}`} ref={rootRef} style={full ? { width, height: fullH, maxHeight: fullH, borderRadius: 0 } : { width, maxHeight: Math.max(360, Math.floor(((window.screen?.availHeight ?? 1000) - 24) / zoom)) }}>
      {!collapsed && !guide && <Rail active={group} onPick={pickGroup} feedCount={feedCount} feedNote={feedNotes > 0} onDrag={startDrag} />}
      <div className="ovm">
        <header className="hd drag" onMouseDown={startDrag} title="Sürükleyerek taşı">
          <span className="hl">
            {(collapsed || guide) && <img className="mark" src="/celeste-mark.png" alt="" aria-hidden="true" draggable={false} />}
            <h1 className="t">{mapName ?? "Celeste Overlay"}</h1>
            <span className={`phase ${phaseTone}`}><i />{PHASE_TEXT[snap.phase]}</span>
            {mySide && !collapsed && (
              <span className={mySide === "Saldıran" ? "side atk" : "side def"} title="Takım rengine göre belirlenir; yalnızca ilk yarıda doğrudur">
                {mySide} · ilk yarı
              </span>
            )}
            {prem && me && <Roles roles={me.roles} compact />}
            <TimerPill onOpen={() => go("timers")} />
            {theme.fps && <span className="fpsb" title="FPS modu açık: animasyonlar kapalı, maçta hemen gizlenir">FPS</span>}
          </span>
          <span className="hr" onMouseDown={noDrag}>
            {!collapsed && (
              <QuickMenu
                protect={protect} onProtect={(v) => { setProtect(v); showToast(v ? "Overlay kayıtta gizli" : "Overlay kayıtta görünür"); }}
                blur={blur} onBlur={(v) => { setBlur(v); showToast(v ? "İsimler bulanık" : "İsimler görünür"); }}
                fps={theme.fps} onFps={(v) => setTheme({ ...theme, fps: v })}
                zoom={zoom} zooms={ZOOMS} onZoom={setZoom}
                onAll={() => go("settings")}
              />
            )}
            {!collapsed && (
              <button type="button" className={full ? "ib on" : "ib"} onClick={() => toggleFull()} aria-pressed={full} aria-label={full ? "Tam ekrandan çık" : "Tam ekran"} title={full ? "Tam ekrandan çık" : "Tam ekran"}>
                <Icon name={full ? "unfull" : "full"} size={16} />
              </button>
            )}
            <button type="button" className="ib" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={collapsed ? "Göster" : "Küçült"} title={collapsed ? "Göster" : "Küçült · tamamen gizlemek için F2"}>
              <Icon name={collapsed ? "expand" : "minus"} size={17} />
            </button>
            {inTauri && (askQuit ? (
              <span className="quitask">
                <small>Kapatılsın mı?</small>
                <button type="button" className="danger" onClick={() => { exit(0).catch(() => undefined); }}>Kapat</button>
                <button type="button" onClick={() => setAskQuit(false)}>Vazgeç</button>
              </span>
            ) : (
              <button type="button" className="ib" onClick={() => setAskQuit(true)} title="Celeste Overlay'i tamamen kapat" aria-label="Uygulamayı kapat">
                <Icon name="power" size={17} />
              </button>
            ))}
          </span>
        </header>

        {hideAt && !autoHidden && !manualKeep.current && (
          <div className="hidebar" role="status">
            <span className="hbt">
              <b>Maç başladı.</b> Overlay {Math.max(0, Math.ceil((hideAt - Date.now()) / 1000))} saniye sonra gizlenecek; uygulama kapanmıyor. Geri getirmek için <kbd>F2</kbd>.
            </span>
            <span className="hba">
              <button type="button" onClick={() => { manualKeep.current = true; setHideAt(null); showToast("Bu maç boyunca açık kalacak"); }}>Bu maç açık kalsın</button>
              <button type="button" onClick={() => { setAutoHidden(true); setHideAt(null); }}>Şimdi gizle</button>
            </span>
            <small className="hbs">Otomatik gizlemeyi Ayarlar › Overlay'den kapatabilirsin.</small>
          </div>
        )}

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

        <div className="obody">
        {!collapsed && !guide && notices.length > 0 && <NoticeCard list={notices} onClose={clearNotices} />}
        {!collapsed && !guide && view === "roster" && !active && <WhatsNew version={updater.version} />}
        {!collapsed && guide && <Guide onDone={closeGuide} />}
        {!collapsed && !guide && (outdated ? <ForceUpdate info={outdated} updater={updater} onOpen={openTracker} /> : content)}
        </div>
        {!collapsed && <StatusBar status={snap.status} inApp={inTauri} assetsOk={!!assets} assetsFailed={assetsFailed} version={updater.version} onToast={showToast} onOpen={openTracker} onFeedback={() => { setGuide(false); setCollapsed(false); go("feedback"); }} onTrust={() => go("trust")} />}
      </div>
      <PreviewBar onOpen={openTracker} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

/** Takımdaki rol dağılımı; takımın kontrolcüsü yoksa uyarır (ajan seçimi bitmişse). */
function RoleStrip({ list, assets, ally }: { list: Player[]; assets: Assets; ally: boolean }) {
  const n = roleCounts(list, assets);
  const icons = new Map<string, string>();
  for (const a of assets.agents.values()) if (a.roleId && a.roleIcon && !icons.has(a.roleId)) icons.set(a.roleId, a.roleIcon);
  const picked = list.every((p) => p.agentId && assets.agents.has(lookup(p.agentId)));
  const noCtl = ally && picked && !n.get(ROLES[1].id);
  return (
    <span className="rstrip" title="Takımdaki ajan rolleri">
      {ROLES.map((r) => (
        <span key={r.id} className={n.get(r.id) ? "rs on" : "rs"} title={`${r.short}: ${n.get(r.id) ?? 0}`}>
          {icons.get(r.id) && <img src={icons.get(r.id)} alt="" />}<b>{n.get(r.id) ?? 0}</b>
        </span>
      ))}
      {noCtl && <span className="rwarn" title="Takımda kontrolcü yok">Kontrolcü yok</span>}
    </span>
  );
}
