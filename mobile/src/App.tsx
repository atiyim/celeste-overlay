import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { loadAssets, lookup, resolveSkin, type Assets } from "../../src/assets";
import type { MyStats, Player, Snapshot, Store } from "../../src/types";
import { agentPool } from "../../src/insights";

const inTauri = "__TAURI_INTERNALS__" in window;
const LOGGED = "celeste-riot-logged";

interface LoginResult { ok: boolean; riot?: string | null; puuid?: string | null; error?: string | null }
interface LoginState { session: boolean; pending: boolean; last?: LoginResult | null }

const tierColor = (hex?: string) => (hex ? `#${hex.slice(0, 6)}` : undefined);
const PHASE: Record<string, string> = { menu: "Menüdesin", pregame: "Ajan seçimi", ingame: "Maç sürüyor", offline: "Valorant kapalı" };
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
function PlayerCard({ p, a, i }: { p: Player; a: Assets; i: number }) {
  const [open, setOpen] = useState(false);
  const agent = a.agents.get(lookup(p.agentId));
  const cur = a.tiers.get(p.rank.current);
  const peak = a.tiers.get(p.rank.peak);
  const name = p.hiddenName && !p.isSelf ? `Oyuncu ${i + 1}` : p.name ?? "…";
  const [nm, tag] = name.includes("#") ? [name.slice(0, name.lastIndexOf("#")), name.slice(name.lastIndexOf("#"))] : [name, ""];
  const r = p.rank;
  const [w, g] = r.games > 0 ? [r.wins, r.games] : [r.totalWins, r.totalGames];
  const pool = agentPool(p);
  const thumbs = THUMBS.map((t) => {
    const weapon = a.weapons.find((x) => x.id === t.id) ?? a.weapons.find((x) => x.name === t.name) ?? (t.category ? a.weapons.find((x) => x.category === t.category) : undefined);
    if (!weapon) return null;
    const slot = p.loadout.weapons.find((x) => lookup(x.weaponId) === weapon.id);
    return { weapon, skin: resolveSkin(a, weapon, slot) };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const all = p.loadout.weapons
    .map((slot) => { const weapon = a.weapons.find((x) => x.id === lookup(slot.weaponId)); return weapon ? { weapon, skin: resolveSkin(a, weapon, slot) } : null; })
    .filter((x): x is NonNullable<typeof x> => !!x && !x.skin.isDefault);

  return (
    <article className={p.isSelf ? "pc me" : "pc"} onClick={() => setOpen(!open)}>
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
        {peak && r.peak > 0 && <span className="pc-peak">Peak <img src={peak.icon} alt="" /> <b style={{ color: tierColor(peak.color) }}>{peak.name}</b></span>}
        {pool && (
          <span className="pc-pool">
            {pool.top.map((x) => { const ag = a.agents.get(lookup(x.agentId)); return ag ? <span key={x.agentId}><img src={ag.icon} alt={ag.name} /><small>{x.count}</small></span> : null; })}
          </span>
        )}
      </div>
      {thumbs.length > 0 && (p.loadout.weapons.length > 0) && (
        <div className="pc-skins">
          {thumbs.map((t) => (
            <img key={t.weapon.id} className={t.skin.isDefault ? "dim" : ""} src={t.skin.image} alt={`${t.weapon.name}: ${t.skin.name}`} style={t.skin.tier && !t.skin.isDefault ? ({ "--tc": t.skin.tier.color } as React.CSSProperties) : undefined} />
          ))}
        </div>
      )}
      {open && all.length > 0 && (
        <div className="pc-all">
          {all.map((t) => (
            <div key={t.weapon.id} className="pc-skin">
              <img src={t.skin.image} alt="" />
              <span><b>{t.skin.name}</b><small>{t.weapon.name}{t.skin.tier ? ` · ${t.skin.tier.name}` : ""}</small></span>
            </div>
          ))}
        </div>
      )}
      {open && all.length === 0 && <small className="pc-none">Kaplama bilgisi henüz yok ya da hepsi standart.</small>}
    </article>
  );
}

/* ---------------- Lobi ---------------- */
function Lobby({ snap, a }: { snap: Snapshot | null; a: Assets }) {
  if (!snap) return <p className="empty">Yükleniyor…</p>;
  if (snap.error) return <p className="empty err">{snap.error}</p>;
  if (!snap.players.length) {
    return (
      <div className="empty">
        <b>{PHASE[snap.phase] ?? "Bekleniyor"}</b>
        <p>Ajan seçimine ya da maça girince lobidekiler burada görünür. Bilgisayarında Valorant açık olmalı.</p>
      </div>
    );
  }
  const me = snap.players.find((p) => p.isSelf);
  const ally = snap.players.filter((p) => p.team === me?.team);
  const enemy = snap.players.filter((p) => p.team !== me?.team);
  const map = snap.mapId ? a.maps.get(lookup(snap.mapId)) : undefined;
  return (
    <>
      <div className="lob-head"><b>{map ?? PHASE[snap.phase]}</b><small>{[PHASE[snap.phase], snap.queueId ? QUEUE[snap.queueId] ?? snap.queueId : null].filter(Boolean).join(" · ")}</small></div>
      <h2 className="grp ally">Takımın</h2>
      {ally.map((p, i) => <PlayerCard key={p.puuid} p={p} a={a} i={i} />)}
      {enemy.length > 0 && <h2 className="grp enemy">Rakipler</h2>}
      {enemy.map((p, i) => <PlayerCard key={p.puuid} p={p} a={a} i={ally.length + i} />)}
      <small className="fine">Kartın üstüne dokununca bütün kaplamaları açılır.</small>
    </>
  );
}

/* ---------------- Mağaza ---------------- */
function StoreView({ a }: { a: Assets }) {
  const [s, setS] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { invoke<Store>("get_store").then(setS).catch((e) => setErr(String(e))); }, []);
  if (err) return <p className="empty err">{err}</p>;
  if (!s) return <p className="empty">Mağaza yükleniyor…</p>;
  const left = (sec?: number | null) => (sec ? `${Math.floor(sec / 3600)} sa ${Math.floor((sec % 3600) / 60)} dk` : "");
  const offer = (itemId: string, price?: number | null, disc?: number | null) => {
    const id = lookup(itemId);
    const sk = a.skins.get(id);
    const main = a.levelToSkin.get(id) ?? id;
    const tier = a.contentTiers.get(a.skinMeta.get(main)?.tierId ?? "");
    return (
      <div key={itemId} className="offer" style={tier ? ({ "--tc": tier.color } as React.CSSProperties) : undefined}>
        {sk?.icon && <img src={sk.icon} alt="" />}
        <b>{sk?.name ?? "Bilinmeyen"}</b>
        <small>{disc != null ? <><s>{price}</s> {disc}</> : price} VP</small>
      </div>
    );
  };
  return (
    <>
      {s.wallet && <div className="wallet"><span><b>{s.wallet.vp ?? 0}</b> VP</span><span><b>{s.wallet.rp ?? 0}</b> RP</span><span><b>{s.wallet.kc ?? 0}</b> KC</span></div>}
      <h2 className="grp">Günlük mağaza <small>{left(s.dailyRemaining)}</small></h2>
      <div className="offers">{s.daily.map((o) => offer(o.itemId, o.price))}</div>
      {s.night.length > 0 && <><h2 className="grp">Gece pazarı <small>{left(s.nightRemaining)}</small></h2><div className="offers">{s.night.map((o) => offer(o.itemId, o.price, o.discounted))}</div></>}
    </>
  );
}

/* ---------------- Ben ---------------- */
function Me({ a, riot, onLogout }: { a: Assets; riot?: string | null; onLogout: () => void }) {
  const [s, setS] = useState<MyStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { invoke<MyStats>("get_my_stats").then(setS).catch((e) => setErr(String(e))); }, []);
  const t = s ? a.tiers.get(s.rank.current) : undefined;
  return (
    <>
      <div className="me-head">
        {t && <img src={t.icon} alt="" />}
        <div><b>{riot ?? "Hesabın"}</b>{t && <span style={{ color: tierColor(t.color) }}>{t.name} · {s!.rank.rr} RR</span>}</div>
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
      <button className="btn ghost" type="button" onClick={onLogout}>Çıkış yap</button>
      <small className="fine">Çıkış yapınca bu telefondaki Riot oturumu da silinir.</small>
    </>
  );
}

/* ---------------- Uygulama ---------------- */
export function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [riot, setRiot] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("lobby");
  const relogAt = useRef(0);

  useEffect(() => { loadAssets().then(setAssets).catch(() => undefined); }, []);

  const startLogin = useCallback(() => {
    try { localStorage.setItem(LOGGED, "1"); } catch { /* */ }
    invoke("riot_login").catch(() => undefined);
  }, []);

  // Giriş durumu: sayfa Riot'tan dönünce yeniden yüklenir; sonucu çekirdekten okuruz.
  useEffect(() => {
    if (!inTauri) { setLogin({ session: false, pending: false }); return; }
    let stop = false;
    const ask = async () => {
      const s = await invoke<LoginState>("login_state").catch(() => null);
      if (stop || !s) return;
      setLogin(s);
      if (s.last?.riot) setRiot(s.last.riot);
      if (s.pending) window.setTimeout(ask, 700);
      else if (!s.session && !s.last) {
        // Daha önce giriş yapıldıysa Riot'un çerezi durur: sayfa şifre sormadan anında geri döner.
        let was = false;
        try { was = localStorage.getItem(LOGGED) === "1"; } catch { /* */ }
        if (was) startLogin();
      }
    };
    ask();
    const un = listen<LoginResult>("riot-login", () => ask());
    return () => { stop = true; un.then((f) => f()); };
  }, [startLogin]);

  // Lobi: 3 sn'de bir; uygulama arka plandayken sorulmaz.
  useEffect(() => {
    if (!login?.session) return;
    let stop = false, t = 0;
    const tick = async () => {
      if (!document.hidden) {
        const s = await invoke<Snapshot>("get_snapshot").catch(() => null);
        if (!stop && s) {
          setSnap(s);
          // Riot'un erişim belirteci yaklaşık 1 saat geçerli: reddedilince sessizce yeniden giriş (çerezle anında).
          if (s.status?.fault === "rejected" && Date.now() - relogAt.current > 5 * 60_000) { relogAt.current = Date.now(); startLogin(); }
        }
      }
      if (!stop) t = window.setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; window.clearTimeout(t); };
  }, [login?.session, startLogin]);

  const logout = async () => {
    try { localStorage.removeItem(LOGGED); } catch { /* */ }
    await invoke("riot_logout").catch(() => undefined);
    setLogin({ session: false, pending: false }); setRiot(null); setSnap(null);
  };

  if (!login || !assets) return <main className="splash"><img src="/icon.png" alt="" width={64} height={64} /><p>Celeste</p></main>;
  if (!login.session) return <Login busy={login.pending} error={login.last && !login.last.ok ? login.last.error : null} onLogin={startLogin} />;

  return (
    <div className="app">
      <header className="top"><b>Celeste</b><small>{riot ?? ""}</small></header>
      <main className="body">
        {tab === "lobby" && <Lobby snap={snap} a={assets} />}
        {tab === "store" && <StoreView a={assets} />}
        {tab === "me" && <Me a={assets} riot={riot} onLogout={logout} />}
      </main>
      <nav className="tabbar" aria-label="Bölümler">
        {([["lobby", "Lobi"], ["store", "Mağaza"], ["me", "Ben"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
    </div>
  );
}
