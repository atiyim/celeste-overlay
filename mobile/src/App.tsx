import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion, onBackButtonPress } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { loadAssets, lookup, resolveSkin, setAssetLanguage, type Assets } from "../../src/assets";
import type { Player, Snapshot } from "../../src/types";
import { agentPool } from "../../src/insights";
import { PlayerSheet, SkinDetail, SkinTile, Sheet } from "./Loadout";
import { Settings } from "./Settings";
import { Login } from "./Login";
import { Feedback, useNotices } from "./Feedback";
import { Collection } from "./Collection";
import { Profile } from "./Profile";
import { SkeletonCards, SkeletonTiles } from "./Skeleton";
import { hasOpenLayer, usePrefs, useWakeLock } from "./prefs";
import { drop, dropAll, useNow, useStore, useWish } from "./data";
import { assetLang, left, PHASE, QUEUE, t } from "./i18n";
import { checkUpdate, skipUpdate, type Update } from "./update";
import { IconCollection, IconGear, IconLobby, IconProfile, IconStore, Logo } from "./icons";

setAssetLanguage(assetLang);

const inTauri = "__TAURI_INTERNALS__" in window;
const LOGGED = "celeste-riot-logged";

interface LoginResult { ok: boolean; riot?: string | null; puuid?: string | null; error?: string | null }
interface LoginState { session: boolean; pending: boolean; last?: LoginResult | null; expires?: number }

const tierColor = (hex?: string) => (hex ? `#${hex.replace("#", "").slice(0, 6)}` : undefined);
/** Parti renkleri: aynı partidekiler aynı renkte. */
const PARTY = ["#a78bfa", "#f59e0b", "#34d399", "#f472b6", "#60a5fa"];
const partyColor = (p?: string | null) => (p ? PARTY[(p.charCodeAt(0) - 65) % PARTY.length] : undefined);

/* Kartta kaplaması gösterilen silahlar (masaüstündekiyle aynı). */
const THUMBS = [
  { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", name: "Vandal" },
  { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", name: "Phantom" },
  { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", name: "Operator" },
  { id: "2f59173c-4bed-b6c3-2191-dea9b58be9c7", name: "Melee", category: "Melee" },
];

type Tab = "lobby" | "store" | "collection" | "me";

/* ---------------- Oyuncu kartı ---------------- */
function displayName(p: Player, i: number): [string, string] {
  const name = p.hiddenName && !p.isSelf ? t("player", { n: i + 1 }) : p.name ?? "…";
  const at = name.lastIndexOf("#");
  return at > 0 ? [name.slice(0, at), name.slice(at)] : [name, ""];
}

function PlayerCard({ p, a, i, skins, flash, onOpen }: { p: Player; a: Assets; i: number; skins: boolean; flash: boolean; onOpen: () => void }) {
  const agent = a.agents.get(lookup(p.agentId));
  const cur = a.tiers.get(p.rank.current);
  const peak = a.tiers.get(p.rank.peak);
  const [nm, tag] = displayName(p, i);
  const r = p.rank;
  const [w, g] = r.games > 0 ? [r.wins, r.games] : [r.totalWins, r.totalGames];
  const pool = agentPool(p);
  const thumbs = THUMBS.map((x) => {
    const weapon = a.weapons.find((y) => y.id === x.id) ?? (x.category ? a.weapons.find((y) => y.category === x.category) : undefined);
    if (!weapon) return null;
    const slot = p.loadout.weapons.find((y) => lookup(y.weaponId) === weapon.id);
    return { weapon, skin: resolveSkin(a, weapon, slot) };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const hasLoadout = p.loadout.weapons.length > 0;
  const pc = partyColor(p.party);
  const state = p.agentState === "locked" ? "locked" : p.agentState === "selected" ? "picking" : "";

  return (
    <article className={["pc", p.isSelf && "me", pc && "party", state, flash && "lockin"].filter(Boolean).join(" ")} style={pc ? ({ "--party": pc } as React.CSSProperties) : undefined} onClick={onOpen}>
      <div className="pc-top">
        <span className="pc-ag">
          {agent ? <img className="pc-agent" src={agent.icon} alt={agent.name} /> : <span className="pc-agent" />}
          {state && <small className="pc-state">{state === "locked" ? t("locked") : t("picking")}</small>}
        </span>
        <div className="pc-name">
          <b>{nm}</b>{tag && <small>{tag}</small>}
          <span className="pc-sub">{[p.level != null ? t("lvl", { n: p.level }) : null, g > 0 ? `%${Math.round((100 * w) / g)} · ${t("games", { n: g })}` : null, p.kd != null ? `K/D ${p.kd.toFixed(2)}` : null].filter(Boolean).join(" · ")}</span>
        </div>
        {p.party && <span className="pc-party" title={t("sameParty")}>{p.party}</span>}
        <div className="pc-rank">
          {cur && <img src={cur.icon} alt="" />}
          <span><b style={{ color: tierColor(cur?.color) }}>{cur?.name ?? t("unranked")}</b>{p.rank.current > 0 && <small>{p.rank.rr} RR</small>}</span>
        </div>
      </div>
      <div className="pc-row">
        {peak && r.peak > 0 ? <span className="pc-peak">{t("peak")} <img src={peak.icon} alt="" /> <b style={{ color: tierColor(peak.color) }}>{peak.name}</b></span> : <span />}
        {pool && (
          <span className="pc-pool">
            {pool.top.map((x) => { const ag = a.agents.get(lookup(x.agentId)); return ag ? <span key={x.agentId}><img src={ag.icon} alt={ag.name} /><small>{x.count}</small></span> : null; })}
          </span>
        )}
      </div>
      {skins && hasLoadout && (
        <div className="pc-skins">
          {thumbs.map((x) => (
            <img key={x.weapon.id} className={x.skin.isDefault ? "dim" : ""} src={x.skin.image} alt={`${x.weapon.name}: ${x.skin.name}`} style={x.skin.tier && !x.skin.isDefault ? ({ "--tc": x.skin.tier.color } as React.CSSProperties) : undefined} />
          ))}
        </div>
      )}
    </article>
  );
}

/* ---------------- Lobi ---------------- */
function Lobby({ snap, a, renewing }: { snap: Snapshot | null; a: Assets; renewing: boolean }) {
  const prefs = usePrefs();
  const [open, setOpen] = useState<string | null>(null);
  // Ajan kilitlenince kart kısa bir an parlar.
  const prev = useRef(new Map<string, string>());
  const [flash, setFlash] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!snap || snap.phase !== "pregame") { prev.current.clear(); return; }
    const now = new Set<string>();
    for (const p of snap.players) {
      const was = prev.current.get(p.puuid);
      if (p.agentState === "locked" && was && was !== "locked") now.add(p.puuid);
      prev.current.set(p.puuid, p.agentState ?? "");
    }
    if (now.size) { setFlash(now); const id = window.setTimeout(() => setFlash(new Set()), 900); return () => window.clearTimeout(id); }
  }, [snap]);

  if (renewing && (!snap || snap.status?.fault === "rejected")) return <p className="empty">{t("renewing")}</p>;
  if (!snap) return <SkeletonCards />;
  if (snap.status?.fault === "rejected") return <p className="empty err">{t("sessionExpired")}</p>;
  if (snap.error) return <p className="empty err">{snap.error}</p>;
  if (!snap.players.length) {
    return (
      <div className="empty">
        <b>{PHASE(snap.phase)}</b>
        <p>{snap.phase === "menu" ? t("menuHelp") : t("lobbyHelp")}</p>
      </div>
    );
  }
  const me = snap.players.find((p) => p.isSelf);
  const ally = snap.players.filter((p) => p.team === me?.team);
  const enemy = snap.players.filter((p) => p.team !== me?.team);
  const order = [...ally, ...enemy];
  const mapKey = snap.mapId ? lookup(snap.mapId) : "";
  const map = mapKey ? a.maps.get(mapKey) : undefined;
  const banner = mapKey ? a.mapBanner.get(mapKey) : undefined;
  const sel = open ? order.find((p) => p.puuid === open) : undefined;
  const selIdx = sel ? order.indexOf(sel) : 0;
  const card = (p: Player, i: number) => (
    <PlayerCard key={p.puuid} p={p} a={a} i={i} flash={flash.has(p.puuid)} skins={p.team === me?.team || prefs.enemySkins} onOpen={() => setOpen(p.puuid)} />
  );
  return (
    <>
      <div className={banner ? "lob-head has-art" : "lob-head"}>
        {banner && <img className="lob-art" src={banner} alt="" />}
        <span><b>{map ?? PHASE(snap.phase)}</b><small>{[PHASE(snap.phase), QUEUE(snap.queueId)].filter(Boolean).join(" · ")}</small></span>
      </div>
      <h2 className="grp ally">{t("yourTeam")}</h2>
      {ally.map((p, i) => card(p, i))}
      {enemy.length > 0 && <h2 className="grp enemy">{t("enemies")}</h2>}
      {enemy.map((p, i) => card(p, ally.length + i))}
      <small className="fine">{t("tapHint")}</small>
      {sel && (() => {
        const [nm, tag] = displayName(sel, selIdx);
        const ag = a.agents.get(lookup(sel.agentId));
        return <PlayerSheet p={sel} a={a} onClose={() => setOpen(null)} title={<span className="st-name">{ag && <img src={ag.icon} alt="" />}<b>{nm}</b><small>{tag}</small></span>} />;
      })()}
    </>
  );
}

/* ---------------- Mağaza ---------------- */
function offerSkin(a: Assets, itemId: string) {
  const id = lookup(itemId);
  const main = a.levelToSkin.get(id) ?? id;
  const meta = a.skinMeta.get(main);
  return { id: main, name: a.skins.get(id)?.name ?? meta?.name, icon: a.skins.get(id)?.icon ?? meta?.icon, meta, tier: a.contentTiers.get(meta?.tierId ?? "") };
}

function StoreView({ a }: { a: Assets }) {
  const s = useStore();
  const wish = useWish();
  const now = useNow(1000);
  const [pick, setPick] = useState<ReturnType<typeof offerSkin> | null>(null);
  if (s.error) return <p className="empty err">{s.error}</p>;
  if (!s.data) return <><div className="wallet sk-wallet" /><SkeletonTiles n={4} big /></>;
  const d = s.data;
  const end = (sec?: number | null) => (sec ? s.at + sec * 1000 : 0);
  const dailyEnd = end(d.dailyRemaining), nightEnd = end(d.nightRemaining);
  const offer = (itemId: string, price?: number | null, disc?: number | null) => {
    const o = offerSkin(a, itemId);
    return (
      <SkinTile key={itemId} big name={o.name ?? t("unknownSkin")} image={o.icon} tier={o.tier} wished={wish.has(o.id)} onClick={() => setPick(o)}
        sub={<span className="price">{disc != null ? <><s>{price}</s> <b>{disc}</b></> : <b>{price}</b>} VP</span>} />
    );
  };
  return (
    <>
      {d.wallet && <div className="wallet"><span><b>{d.wallet.vp ?? 0}</b> VP</span><span><b>{d.wallet.rp ?? 0}</b> RP</span><span><b>{d.wallet.kc ?? 0}</b> KC</span></div>}
      <h2 className="grp">{t("daily")}{dailyEnd > 0 && <small className="clock">{t("renewsIn", { t: left(dailyEnd - now) })}</small>}</h2>
      <div className="offers">{d.daily.map((o) => offer(o.itemId, o.price))}</div>
      {d.night.length > 0 && <><h2 className="grp">{t("night")}{nightEnd > 0 && <small className="clock">{t("leftT", { t: left(nightEnd - now) })}</small>}</h2><div className="offers">{d.night.map((o) => offer(o.itemId, o.price, o.discounted))}</div></>}
      {pick && (
        <Sheet title={<span className="st-name"><b>{pick.name}</b></span>} onClose={() => setPick(null)}>
          <SkinDetail name={pick.name ?? ""} image={pick.icon} weapon={pick.meta?.weapon ?? ""} tier={pick.tier} skinId={pick.meta ? pick.id : undefined} />
        </Sheet>
      )}
    </>
  );
}

/* ---------------- Üstteki bildirim kartları ---------------- */
function CrashNote({ onSend }: { onSend: (report: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let js: string | null = null;
    try { js = localStorage.getItem("celeste-js-error"); localStorage.removeItem("celeste-js-error"); } catch { /* */ }
    (inTauri ? invoke<string | null>("last_crash").catch(() => null) : Promise.resolve(null)).then((native) => {
      const all = [native && `Core:\n${native}`, js && `UI:\n${js}`].filter(Boolean).join("\n\n");
      if (all) setText(all);
    });
  }, []);
  if (!text) return null;
  return (
    <div className="note err-note">
      <b>{t("crashTitle")}</b>
      <p>{t("crashText")}</p>
      <textarea readOnly value={text} />
      <span className="note-act">
        <button type="button" className="btn pri" onClick={() => { onSend(text); setText(null); }}>{t("sendReport")}</button>
        <button type="button" className="link" onClick={() => setText(null)}>{t("close")}</button>
      </span>
    </div>
  );
}

function UpdateNote() {
  const [u, setU] = useState<Update | null>(null);
  useEffect(() => {
    if (!inTauri) return;
    getVersion().then((v) => checkUpdate(v)).then(setU).catch(() => undefined);
  }, []);
  if (!u) return null;
  return (
    <div className="note acc-note">
      <b>{t("updTitle", { v: u.version })}</b>
      <p>{t("updText")}</p>
      <span className="note-act">
        <button type="button" className="btn pri" onClick={() => openUrl(u.url).catch(() => undefined)}>{t("download")}</button>
        <button type="button" className="link" onClick={() => { skipUpdate(u.version); setU(null); }}>{t("later")}</button>
      </span>
    </div>
  );
}

function NoticeNotes() {
  const [list, clear] = useNotices();
  if (!list.length) return null;
  const st = { ele: t("ntEle"), plan: t("ntPlan"), ekl: t("ntEkl"), yok: t("ntYok") };
  return (
    <div className="note acc-note">
      {list.map((n, i) => (
        <p key={i}><b>{n.kind === "hata" ? t("ntBug") : t("ntIdea")} {st[n.status ?? "ele"]}.</b>{n.message ? <> {t("ntFrom")} {n.message}</> : null}</p>
      ))}
      <button type="button" className="link" onClick={clear}>{t("ok")}</button>
    </div>
  );
}

/** İstek listesindeki bir kaplama bugünkü mağazadaysa: her sekmenin üstünde. */
function WishNote({ a, onOpen }: { a: Assets; onOpen: () => void }) {
  const wish = useWish();
  const s = useStore(wish.size > 0); // istek listesi boşsa mağaza bunun için hiç sorulmaz
  if (!s.data || !wish.size) return null;
  const hits = [...s.data.daily, ...s.data.night].map((o) => offerSkin(a, o.itemId)).filter((o) => wish.has(o.id));
  if (!hits.length) return null;
  return (
    <button type="button" className="note wish-note" onClick={onOpen}>
      {hits[0].icon && <img src={hits[0].icon} alt="" />}
      <b>{hits.length === 1 ? t("wishTodayOne", { name: hits[0].name ?? "" }) : t("wishToday", { n: hits.length })}</b>
      <i className="chev">›</i>
    </button>
  );
}

/* ---------------- Aşağı çekip yenileme ---------------- */
function usePull(onRefresh: () => Promise<unknown> | void) {
  const ref = useRef<HTMLElement>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const handlers = {
    onTouchStart: (e: React.TouchEvent) => { start.current = (ref.current?.scrollTop ?? 0) <= 0 && !busy ? e.touches[0].clientY : null; },
    onTouchMove: (e: React.TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      setPull(dy > 0 ? Math.min(96, dy * 0.5) : 0);
    },
    onTouchEnd: async () => {
      if (start.current == null) return;
      start.current = null;
      if (pull >= 64) {
        setBusy(true); setPull(48);
        try { await onRefresh(); } finally { setBusy(false); setPull(0); }
      } else setPull(0);
    },
  };
  const label = busy ? t("refreshing") : pull >= 64 ? t("releaseRefresh") : t("pullRefresh");
  return { ref, pull, busy, handlers, label };
}

const TABS: [Tab, () => string, () => React.ReactElement][] = [
  ["lobby", () => t("tabLobby"), IconLobby],
  ["store", () => t("tabStore"), IconStore],
  ["collection", () => t("tabCollection"), IconCollection],
  ["me", () => t("tabProfile"), IconProfile],
];

/* ---------------- Uygulama ---------------- */
export function App() {
  const prefs = usePrefs();
  const [assets, setAssets] = useState<Assets | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [riot, setRiot] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("lobby");
  const [settings, setSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ report?: string } | null>(null);
  const [renewing, setRenewing] = useState(false);
  const expires = useRef(0);
  const tickNow = useRef<() => Promise<void>>(async () => undefined);
  useWakeLock(prefs.keepAwake && (snap?.phase === "pregame" || snap?.phase === "ingame"));

  // Geri tuşu: açık panel/ayar varsa onu kapat, yoksa uygulamayı arka plana al.
  useEffect(() => {
    if (!inTauri) return;
    const l = onBackButtonPress(() => { if (hasOpenLayer()) history.back(); else invoke("minimize").catch(() => undefined); });
    return () => { l.then((x) => x.unregister()).catch(() => undefined); };
  }, []);

  useEffect(() => { loadAssets({ lite: true }).then(setAssets).catch(() => undefined); }, []);

  const startLogin = useCallback(() => { invoke("riot_login").catch(() => undefined); }, []);

  /* Yenileme: Riot'un giriş sayfası açılır; telefonda Riot oturumu durduğu için şifre sormadan anında geri döner.
     Aynı dakikada ikinci kez denenmez: döngüye girmesin. */
  const renew = useCallback(async (): Promise<boolean> => {
    let last = 0;
    try { last = Number(sessionStorage.getItem("celeste-renew-at")) || 0; } catch { /* */ }
    if (Date.now() - last < 60_000) return false;
    try { sessionStorage.setItem("celeste-renew-at", String(Date.now())); } catch { /* */ }
    setRenewing(true);
    window.setTimeout(() => setRenewing(false), 15_000);
    startLogin();
    return true;
  }, [startLogin]);
  const nearExpiry = () => expires.current > 0 && Date.now() / 1000 > expires.current - 300;

  // Giriş durumu: sayfa Riot'tan dönünce yeniden yüklenir; sonucu çekirdekten okuruz.
  useEffect(() => {
    if (!inTauri) { setLogin({ session: false, pending: false }); return; }
    let stop = false;
    const ask = async () => {
      const s = await invoke<LoginState>("login_state").catch(() => null);
      if (stop || !s) return;
      setLogin(s);
      expires.current = s.expires ?? 0;
      // Açılışta kendiliğinden giriş yalnızca daha önce gerçekten giriş yapıldıysa.
      if (s.session) { try { localStorage.setItem(LOGGED, "1"); } catch { /* */ } }
      if (s.last?.riot) setRiot(s.last.riot);
      if (s.pending) window.setTimeout(ask, 700);
      else if (!s.session && !s.last) {
        let was = false;
        try { was = localStorage.getItem(LOGGED) === "1"; } catch { /* */ }
        if (was) renew();
      }
    };
    ask();
    const un = listen<LoginResult>("riot-login", () => ask());
    return () => { stop = true; un.then((f) => f()); };
  }, [startLogin, renew]);

  // Uygulama öne gelince: oturumun süresi dolmak üzereyse önce yenile.
  useEffect(() => {
    const vis = () => { if (!document.hidden && login?.session && nearExpiry()) renew(); };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [login?.session, renew]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Lobi: ajan seçiminde ve maçta ayardaki aralıkla, menüdeyken 15 sn'de bir.
     Uygulama arka plandayken hiç sorulmaz. */
  useEffect(() => {
    if (!login?.session) return;
    let stop = false, t0 = 0, phase = "menu", lastRenew = 0, busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      if (!document.hidden) {
        if (nearExpiry()) await renew();
        const s = await invoke<Snapshot>("get_snapshot").catch(() => null);
        if (!stop && s) {
          setSnap(s);
          phase = s.phase;
          if (s.status?.fault === "rejected" && Date.now() - lastRenew > 60_000) { lastRenew = Date.now(); renew(); }
        }
      }
      busy = false;
      const live = phase === "pregame" || phase === "ingame";
      if (!stop) t0 = window.setTimeout(tick, live ? prefs.interval * 1000 : 15_000);
    };
    tickNow.current = async () => { window.clearTimeout(t0); await tick(); };
    tick();
    const vis = () => { if (!document.hidden && !stop) { window.clearTimeout(t0); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; window.clearTimeout(t0); document.removeEventListener("visibilitychange", vis); };
  }, [login?.session, renew, prefs.interval]); // eslint-disable-line react-hooks/exhaustive-deps

  const pull = usePull(async () => {
    if (tab === "lobby") await tickNow.current();
    else if (tab === "store") drop("store");
    else if (tab === "collection") drop("owned");
    else { drop("stats"); drop("contracts"); }
    await new Promise((r) => window.setTimeout(r, 400));
  });

  const logout = async () => {
    try { localStorage.removeItem(LOGGED); } catch { /* */ }
    await invoke("riot_logout").catch(() => undefined);
    dropAll(); expires.current = 0;
    setSettings(false); setLogin({ session: false, pending: false }); setRiot(null); setSnap(null); setTab("lobby");
  };
  const switchAccount = async () => { await logout(); startLogin(); };

  // Emülatör testi (yalnızca test derlemesinde): giriş ekranında hesap değiştirme adımlarını dener.
  useEffect(() => {
    if (!inTauri || login?.session !== false || login.pending) return;
    let done = false;
    try { done = sessionStorage.getItem("celeste-selftest") === "1"; } catch { /* */ }
    if (done) return;
    invoke<boolean>("selftest").then((on) => {
      if (!on) return;
      try { sessionStorage.setItem("celeste-selftest", "1"); } catch { /* */ }
      window.setTimeout(() => { void switchAccount(); }, 4000);
    }).catch(() => undefined);
  }, [login?.session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!login || !assets) return <main className="splash"><Logo size={72} tile /><p>Celeste</p></main>;
  if (!login.session) return <Login busy={login.pending} error={login.last && !login.last.ok ? login.last.error : null} onLogin={startLogin} />;
  if (feedback) return <Feedback riot={riot} report={feedback.report} onClose={() => setFeedback(null)} />;
  if (settings) return <Settings riot={riot} onClose={() => setSettings(false)} onLogout={logout} onSwitch={switchAccount} />;

  return (
    <div className="app">
      <header className="top">
        <span className="brand"><Logo size={26} /><b>Celeste</b></span>
        <span className="top-r"><small>{riot ?? ""}</small><button type="button" className="icon" onClick={() => setSettings(true)} aria-label={t("settings")}><IconGear /></button></span>
      </header>
      <main className="body" ref={pull.ref} {...pull.handlers}>
        <div className="ptr" style={{ height: pull.pull }} aria-hidden={!pull.pull}>{pull.pull > 8 && <span className={pull.busy ? "ptr-spin" : ""}>{pull.label}</span>}</div>
        <CrashNote onSend={(report) => setFeedback({ report })} />
        <NoticeNotes />
        <UpdateNote />
        {tab !== "store" && <WishNote a={assets} onOpen={() => setTab("store")} />}
        {tab === "lobby" && <Lobby snap={snap} a={assets} renewing={renewing} />}
        {tab === "store" && <StoreView a={assets} />}
        {tab === "collection" && <Collection a={assets} />}
        {tab === "me" && <Profile a={assets} riot={riot} />}
      </main>
      <nav className="tabbar" aria-label={t("sections")}>
        {TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon /><span>{label()}</span></button>
        ))}
      </nav>
    </div>
  );
}
