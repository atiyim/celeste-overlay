import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { loadAssets, lookup, resolveSkin, type Assets } from "../../src/assets";
import { LoadoutSheet, SkinTile } from "./Loadout";
import { Settings } from "./Settings";
import { usePrefs, useWakeLock } from "./prefs";
import type { MyStats, Player, Snapshot, Store } from "../../src/types";
import { agentPool } from "../../src/insights";

const inTauri = "__TAURI_INTERNALS__" in window;
const LOGGED = "celeste-riot-logged";

interface LoginResult { ok: boolean; riot?: string | null; puuid?: string | null; error?: string | null }
interface LoginState { session: boolean; pending: boolean; last?: LoginResult | null; expires?: number }

const tierColor = (hex?: string) => (hex ? `#${hex.slice(0, 6)}` : undefined);
const PHASE: Record<string, string> = { menu: "Menüde ya da oyun kapalı", pregame: "Ajan seçimi", ingame: "Maç sürüyor", offline: "Valorant kapalı" };
const QUEUE: Record<string, string> = { competitive: "Rekabetçi", unrated: "Derecesiz", swiftplay: "Tam gaz", premier: "Premier", deathmatch: "Ölüm maçı", hurm: "Takım ölüm maçı", spikerush: "Spike Rush" };

/* Satırda kaplaması gösterilen silahlar (masaüstündekiyle aynı). */
const THUMBS = [
  { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", name: "Vandal" },
  { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", name: "Phantom" },
  { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", name: "Operator" },
  { id: "2f59173c-4bed-b6c3-2191-dea9b58be9c7", name: "Melee", category: "Melee" },
];

type Tab = "lobby" | "store" | "me";

/* ---------------- Giriş ---------------- */
function Login({ busy, error, onLogin }: { busy: boolean; error?: string | null; onLogin: () => void }) {
  return (
    <main className="login">
      <div className="lg-brand">
        <img src="/icon.png" alt="" width={72} height={72} />
        <h1>Celeste</h1>
        <p>Valorant lobini, rankları ve kaplamaları telefondan gör.</p>
      </div>
      <button className="btn pri big" type="button" onClick={onLogin} disabled={busy}>{busy ? "Giriş yapılıyor…" : "Riot ile giriş yap"}</button>
      {error && <p className="err" role="alert">{error}</p>}
      <ul className="lg-notes">
        <li><b>Şifreni Riot'a yazarsın.</b> Açılan sayfa Riot'un kendi giriş sayfasıdır (auth.riotgames.com). Uygulama şifreni görmez.</li>
        <li><b>Giriş bilgin bu telefonda kalır.</b> Celeste'nin sunucusuna gitmez. "Çıkış yap" ile silinir.</li>
        <li><b>Uygulama yalnızca okur.</b> Oyunda hiçbir işlem yapmaz.</li>
      </ul>
      <small className="fine">Celeste Overlay, Riot Games ile bağlantılı değildir ve Riot Games tarafından onaylanmamıştır.</small>
    </main>
  );
}

/* ---------------- Oyuncu kartı ---------------- */
function displayName(p: Player, i: number): [string, string] {
  const name = p.hiddenName && !p.isSelf ? `Oyuncu ${i + 1}` : p.name ?? "…";
  const at = name.lastIndexOf("#");
  return at > 0 ? [name.slice(0, at), name.slice(at)] : [name, ""];
}

function PlayerCard({ p, a, i, skins, onOpen }: { p: Player; a: Assets; i: number; skins: boolean; onOpen: () => void }) {
  const agent = a.agents.get(lookup(p.agentId));
  const cur = a.tiers.get(p.rank.current);
  const peak = a.tiers.get(p.rank.peak);
  const [nm, tag] = displayName(p, i);
  const r = p.rank;
  const [w, g] = r.games > 0 ? [r.wins, r.games] : [r.totalWins, r.totalGames];
  const pool = agentPool(p);
  const thumbs = THUMBS.map((t) => {
    const weapon = a.weapons.find((x) => x.id === t.id) ?? (t.category ? a.weapons.find((x) => x.category === t.category) : undefined);
    if (!weapon) return null;
    const slot = p.loadout.weapons.find((x) => lookup(x.weaponId) === weapon.id);
    return { weapon, skin: resolveSkin(a, weapon, slot) };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const hasLoadout = p.loadout.weapons.length > 0;

  return (
    <article className={p.isSelf ? "pc me" : "pc"} onClick={hasLoadout ? onOpen : undefined}>
      <div className="pc-top">
        {agent ? <img className="pc-agent" src={agent.icon} alt={agent.name} /> : <span className="pc-agent" />}
        <div className="pc-name">
          <b>{nm}</b>{tag && <small>{tag}</small>}
          <span className="pc-sub">{[p.level != null ? `Sv ${p.level}` : null, g > 0 ? `%${Math.round((100 * w) / g)} · ${g} maç` : null, p.kd != null ? `K/D ${p.kd.toFixed(2)}` : null].filter(Boolean).join(" · ")}</span>
        </div>
        {p.party && <span className="pc-party" title="Aynı parti">{p.party}</span>}
        <div className="pc-rank">
          {cur && <img src={cur.icon} alt="" />}
          <span><b style={{ color: tierColor(cur?.color) }}>{cur?.name ?? "Derecesiz"}</b>{p.rank.current > 0 && <small>{p.rank.rr} RR</small>}</span>
        </div>
      </div>
      <div className="pc-row">
        {peak && r.peak > 0 ? <span className="pc-peak">Peak <img src={peak.icon} alt="" /> <b style={{ color: tierColor(peak.color) }}>{peak.name}</b></span> : <span />}
        {pool && (
          <span className="pc-pool">
            {pool.top.map((x) => { const ag = a.agents.get(lookup(x.agentId)); return ag ? <span key={x.agentId}><img src={ag.icon} alt={ag.name} /><small>{x.count}</small></span> : null; })}
          </span>
        )}
      </div>
      {skins && hasLoadout && (
        <div className="pc-skins">
          {thumbs.map((t) => (
            <img key={t.weapon.id} className={t.skin.isDefault ? "dim" : ""} src={t.skin.image} alt={`${t.weapon.name}: ${t.skin.name}`} style={t.skin.tier && !t.skin.isDefault ? ({ "--tc": t.skin.tier.color } as React.CSSProperties) : undefined} />
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
  if (renewing && (!snap || snap.status?.fault === "rejected")) return <p className="empty">Riot oturumu yenileniyor…</p>;
  if (!snap) return <p className="empty">Yükleniyor…</p>;
  if (snap.status?.fault === "rejected") return <p className="empty err">Riot oturumu sona erdi. Ayarlar'dan çıkış yapıp yeniden giriş yapabilirsin.</p>;
  if (snap.error) return <p className="empty err">{snap.error}</p>;
  if (!snap.players.length) {
    return (
      <div className="empty">
        <b>{PHASE[snap.phase] ?? "Bekleniyor"}</b>
        <p>{snap.phase === "menu" ? "Telefon, bilgisayarındaki oyunun açık olup olmadığını göremez. Ajan seçimine ya da maça girince lobidekiler burada görünür." : "Ajan seçimine ya da maça girince lobidekiler burada görünür."}</p>
      </div>
    );
  }
  const me = snap.players.find((p) => p.isSelf);
  const ally = snap.players.filter((p) => p.team === me?.team);
  const enemy = snap.players.filter((p) => p.team !== me?.team);
  const order = [...ally, ...enemy];
  const map = snap.mapId ? a.maps.get(lookup(snap.mapId)) : undefined;
  const sel = open ? order.find((p) => p.puuid === open) : undefined;
  const selIdx = sel ? order.indexOf(sel) : 0;
  const card = (p: Player, i: number) => (
    <PlayerCard key={p.puuid} p={p} a={a} i={i} skins={p.team === me?.team || prefs.enemySkins} onOpen={() => setOpen(p.puuid)} />
  );
  return (
    <>
      <div className="lob-head"><b>{map ?? PHASE[snap.phase]}</b><small>{[PHASE[snap.phase], snap.queueId ? QUEUE[snap.queueId] ?? snap.queueId : null].filter(Boolean).join(" · ")}</small></div>
      <h2 className="grp ally">Takımın</h2>
      {ally.map((p, i) => card(p, i))}
      {enemy.length > 0 && <h2 className="grp enemy">Rakipler</h2>}
      {enemy.map((p, i) => card(p, ally.length + i))}
      <small className="fine">Bütün kaplamaları görmek için oyuncunun kartına dokun.</small>
      {sel && (() => {
        const [nm, tag] = displayName(sel, selIdx);
        const ag = a.agents.get(lookup(sel.agentId));
        return <LoadoutSheet p={sel} a={a} onClose={() => setOpen(null)} title={<span className="st-name">{ag && <img src={ag.icon} alt="" />}<b>{nm}</b><small>{tag}</small></span>} />;
      })()}
    </>
  );
}

/* ---------------- Mağaza ---------------- */
/* Mağaza ve Profil: sekme her açıldığında yeniden indirilmez. Mağaza yenilenene kadar, maçlar 3 dakika saklanır. */
let storeCache: { data: Store; until: number } | null = null;
let statsCache: { data: MyStats; until: number } | null = null;
export function clearCaches() { storeCache = null; statsCache = null; }

function StoreView({ a }: { a: Assets }) {
  const [s, setS] = useState<Store | null>(() => (storeCache && Date.now() < storeCache.until ? storeCache.data : null));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (s) return;
    invoke<Store>("get_store").then((d) => {
      storeCache = { data: d, until: Date.now() + Math.min(d.dailyRemaining ?? 3600, 6 * 3600) * 1000 };
      setS(d);
    }).catch((e) => setErr(String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="empty err">{err}</p>;
  if (!s) return <p className="empty">Mağaza yükleniyor…</p>;
  const left = (sec?: number | null) => {
    if (!sec) return "";
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d > 0 ? `${d} gün ${h} sa` : `${h} sa ${m} dk`;
  };
  const offer = (itemId: string, price?: number | null, disc?: number | null) => {
    const id = lookup(itemId);
    const sk = a.skins.get(id);
    const main = a.levelToSkin.get(id) ?? id;
    const meta = a.skinMeta.get(main);
    const tier = a.contentTiers.get(meta?.tierId ?? "");
    return (
      <SkinTile key={itemId} big name={sk?.name ?? "Bilinmeyen"} image={sk?.icon} tier={tier}
        sub={<span className="price">{disc != null ? <><s>{price}</s> <b>{disc}</b></> : <b>{price}</b>} VP</span>} />
    );
  };
  return (
    <>
      {s.wallet && <div className="wallet"><span><b>{s.wallet.vp ?? 0}</b> VP</span><span><b>{s.wallet.rp ?? 0}</b> RP</span><span><b>{s.wallet.kc ?? 0}</b> KC</span></div>}
      <h2 className="grp">Günlük mağaza <small>{left(s.dailyRemaining)} sonra yenilenir</small></h2>
      <div className="offers">{s.daily.map((o) => offer(o.itemId, o.price))}</div>
      {s.night.length > 0 && <><h2 className="grp">Gece pazarı <small>{left(s.nightRemaining)} kaldı</small></h2><div className="offers">{s.night.map((o) => offer(o.itemId, o.price, o.discounted))}</div></>}
    </>
  );
}

/* ---------------- Profil ---------------- */
function Profile({ a, riot }: { a: Assets; riot?: string | null }) {
  const [s, setS] = useState<MyStats | null>(() => (statsCache && Date.now() < statsCache.until ? statsCache.data : null));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (s) return;
    invoke<MyStats>("get_my_stats").then((d) => { statsCache = { data: d, until: Date.now() + 180_000 }; setS(d); }).catch((e) => setErr(String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const t = s ? a.tiers.get(s.rank.current) : undefined;
  const pk = s ? a.tiers.get(s.rank.peak) : undefined;
  return (
    <>
      <div className="me-head">
        {t && <img src={t.icon} alt="" />}
        <div>
          <b>{riot ?? "Hesabın"}</b>
          {t && <span style={{ color: tierColor(t.color) }}>{t.name} · {s!.rank.rr} RR</span>}
          {pk && s!.rank.peak > 0 && <small>Peak {pk.name}</small>}
        </div>
      </div>
      {err && <p className="empty err">{err}</p>}
      {!s && !err && <p className="empty">Maçların yükleniyor…</p>}
      {s && <h2 className="grp">Son maçlar</h2>}
      {s?.matches.slice(0, 15).map((m) => {
        const ag = a.agents.get(lookup(m.agentId));
        return (
          <div key={m.matchId} className={m.won ? "mm win" : "mm loss"}>
            {ag && <img src={ag.icon} alt="" />}
            <span className="mm-t"><b>{a.maps.get(lookup(m.mapId)) ?? "Harita"}</b><small>{QUEUE[m.queue] ?? m.queue}</small></span>
            <span className="mm-k">{m.kills}/{m.deaths}/{m.assists}</span>
            <span className={m.rrDelta != null ? (m.rrDelta >= 0 ? "mm-rr pos" : "mm-rr neg") : "mm-rr"}>{m.rrDelta != null ? `${m.rrDelta > 0 ? "+" : ""}${m.rrDelta}` : m.won ? "G" : "M"}</span>
          </div>
        );
      })}
    </>
  );
}

const Gear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* Son açılışta uygulama kapandıysa raporu göster (uzun basıp kopyalanabilir). */
function CrashNote() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let js: string | null = null;
    try { js = localStorage.getItem("celeste-js-error"); localStorage.removeItem("celeste-js-error"); } catch { /* */ }
    (inTauri ? invoke<string | null>("last_crash").catch(() => null) : Promise.resolve(null)).then((native) => {
      const all = [native && `Çekirdek:\n${native}`, js && `Arayüz:\n${js}`].filter(Boolean).join("\n\n");
      if (all) setText(all);
    });
  }, []);
  if (!text) return null;
  return (
    <div className="crash-note">
      <b>Uygulama son açılışta bir hatayla karşılaştı</b>
      <p>Bu raporu kopyalayıp gönderirsen sorunu bulabiliriz.</p>
      <textarea readOnly value={text} />
      <button type="button" className="link" onClick={() => setText(null)}>Kapat</button>
    </div>
  );
}

/* ---------------- Uygulama ---------------- */
export function App() {
  const prefs = usePrefs();
  const [assets, setAssets] = useState<Assets | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [riot, setRiot] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("lobby");
  const [settings, setSettings] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const expires = useRef(0);
  useWakeLock(prefs.keepAwake && (snap?.phase === "pregame" || snap?.phase === "ingame"));

  useEffect(() => { loadAssets({ lite: true }).then(setAssets).catch(() => undefined); }, []);

  const startLogin = useCallback(() => {
    try { localStorage.setItem(LOGGED, "1"); } catch { /* */ }
    invoke("riot_login").catch(() => undefined);
  }, []);

  /* Yenileme: Riot'un giriş sayfası açılır; telefonda Riot oturumu durduğu için şifre sormadan anında geri döner.
     (Riot'un oturum çerezini çekirdekten okumak bazı telefonlarda uygulamayı kapattığı için kullanılmıyor.)
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
      if (s.last?.riot) setRiot(s.last.riot);
      if (s.pending) window.setTimeout(ask, 700);
      else if (!s.session && !s.last) {
        // Daha önce giriş yapıldıysa Riot'un çerezi durur: sayfa şifre sormadan anında geri döner.
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
     Uygulama arka plandayken hiç sorulmaz. Belirtecin süresi dolmadan sessizce yenilenir. */
  useEffect(() => {
    if (!login?.session) return;
    let stop = false, t = 0, phase = "menu", lastRenew = 0, busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      if (!document.hidden) {
        if (nearExpiry()) await renew();
        const s = await invoke<Snapshot>("get_snapshot").catch(() => null);
        if (!stop && s) {
          setSnap(s);
          phase = s.phase;
          // Süre beklenenden önce dolduysa (Riot reddetti): dakikada en fazla bir kez yenile.
          if (s.status?.fault === "rejected" && Date.now() - lastRenew > 60_000) { lastRenew = Date.now(); renew(); }
        }
      }
      busy = false;
      const live = phase === "pregame" || phase === "ingame";
      if (!stop) t = window.setTimeout(tick, live ? prefs.interval * 1000 : 15_000);
    };
    tick();
    // Öne gelince beklemeden sor (menüdeyken 15 sn beklenmesin).
    const vis = () => { if (!document.hidden && !stop) { window.clearTimeout(t); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; window.clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
  }, [login?.session, renew, prefs.interval]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    try { localStorage.removeItem(LOGGED); } catch { /* */ }
    await invoke("riot_logout").catch(() => undefined);
    clearCaches(); expires.current = 0;
    setSettings(false); setLogin({ session: false, pending: false }); setRiot(null); setSnap(null);
  };

  if (!login || !assets) return <main className="splash"><img src="/icon.png" alt="" width={64} height={64} /><p>Celeste</p></main>;
  if (!login.session) return <Login busy={login.pending} error={login.last && !login.last.ok ? login.last.error : null} onLogin={startLogin} />;
  if (settings) return <Settings riot={riot} onClose={() => setSettings(false)} onLogout={logout} />;

  return (
    <div className="app">
      <header className="top">
        <b>Celeste</b>
        <span className="top-r"><small>{riot ?? ""}</small><button type="button" className="icon" onClick={() => setSettings(true)} aria-label="Ayarlar"><Gear /></button></span>
      </header>
      <main className="body">
        <CrashNote />
        {tab === "lobby" && <Lobby snap={snap} a={assets} renewing={renewing} />}
        {tab === "store" && <StoreView a={assets} />}
        {tab === "me" && <Profile a={assets} riot={riot} />}
      </main>
      <nav className="tabbar" aria-label="Bölümler">
        {([["lobby", "Lobi"], ["store", "Mağaza"], ["me", "Profil"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
    </div>
  );
}
