import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { tierColor } from "./LoadoutPanel";
import type { MyStats } from "./types";
import { Empty, NameLine, PanelHead } from "./ui";
import {
  ago, cardOf, currentMe, feedAdmin, feedComment, feedComments, feedDelete, feedLike, feedList, feedPost, feedReport, login,
  type AdminList, type Comment, type FeedCard, type Me, type Post, type Role, type RoleDef, type Tab,
} from "./feed";

const inTauri = "__TAURI_INTERNALS__" in window;
const QUEUE: Record<string, string> = { competitive: "Rekabetçi", unrated: "Derecesiz", swiftplay: "Hızlı", premier: "Premier", deathmatch: "Ölüm maçı", spikerush: "Spike Rush" };
const POST_MAX = 280, COMMENT_MAX = 200;
const ROLE_COLORS = ["#a78bfa", "#34d399", "#38bdf8", "#fb7185", "#fbbf24", "#2dd4bf", "#f472b6", "#ededed"];

type Toast = (t: string) => void;

/** Yönetici bağlamı: rol listesi (rol verme menüsü için) ve yenileme. */
interface AdminCtx { on: boolean; roles: RoleDef[]; reload: () => void }
const Admin = createContext<AdminCtx>({ on: false, roles: [], reload: () => undefined });

/* ---------- İsim + roller ---------- */
function Roles({ roles }: { roles: Role[] }) {
  if (!roles.length) return null;
  return (
    <span className="froles">
      {roles.map((r) => (
        <span key={r.name} className={r.admin ? "frole adm" : "frole"} style={{ "--rc": r.color } as React.CSSProperties} title={r.admin ? "Celeste Overlay yöneticisi" : `Rol: ${r.name}`}>{r.name}</span>
      ))}
    </span>
  );
}

/* ---------- Maç kartı (akış içinde, HTML) ---------- */
export function FeedCardView({ c, assets }: { c: FeedCard; assets: Assets }) {
  const ag = assets.agents.get(lookup(c.agentId));
  const art = assets.mapArt.get(lookup(c.mapId));
  const tier = c.tier ? assets.tiers.get(c.tier) : undefined;
  const kd = c.d ? c.k / c.d : c.k;
  return (
    <div className={c.won ? "fcard win" : "fcard loss"} style={art ? ({ "--art": `url("${art}")` } as React.CSSProperties) : undefined}>
      {ag && <img className="fca" src={ag.portrait ?? ag.icon} alt="" loading="lazy" />}
      <div className="fcb">
        <small className="fcm">{[QUEUE[c.queue] ?? (c.queue || "Maç"), assets.maps.get(lookup(c.mapId)) ?? c.mapName, ag?.name ?? c.agentName].filter(Boolean).join(" · ")}</small>
        <div className="fcr">
          <b className="fcw">{c.won ? "Galibiyet" : "Mağlubiyet"}</b>
          {c.score && <b className="fcs">{c.score[0]}–{c.score[1]}</b>}
        </div>
        <div className="fck">
          <span><b>{c.k}/{c.d}/{c.a}</b><small>K/D/A</small></span>
          <span><b>{kd.toFixed(2)}</b><small>K/D</small></span>
          <span><b>{c.acs}</b><small>ACS</small></span>
          {c.rr != null && <span><b className={c.rr >= 0 ? "pos" : "neg"}>{c.rr > 0 ? "+" : ""}{c.rr}</b><small>RR</small></span>}
          {tier && <span className="fct"><img src={tier.icon} alt="" /><small style={{ color: tierColor(tier.color) }}>{tier.name}</small></span>}
        </div>
        {c.hl.length > 0 && <div className="fch">{c.hl.map((h) => <i key={h}>{h}</i>)}</div>}
      </div>
    </div>
  );
}

/* ---------- Yönetici düğmeleri: sil, banla (onaylı), rol ver ---------- */
function AdminButtons({ target, riot, onToast, onDone }: { target: string; riot: string; onToast: Toast; onDone: () => void }) {
  const adm = useContext(Admin);
  const [ask, setAsk] = useState<"ban" | "del" | null>(null);
  const run = async (action: "ban" | "delete") => {
    try { await feedAdmin(action, { target }); onToast(action === "ban" ? `${riot} banlandı. Bir daha paylaşım yapamaz.` : "Silindi"); onDone(); }
    catch (e) { onToast((e as Error).message); }
    setAsk(null);
  };
  const give = async (role: number) => {
    try { await feedAdmin("role_give", { role, target }); onToast(`Rol verildi: ${riot}`); adm.reload(); onDone(); }
    catch (e) { onToast((e as Error).message); }
  };
  if (ask) return (
    <span className="fadm ask">
      <small>{ask === "ban" ? `${riot} kalıcı banlansın mı?` : "Silinsin mi?"}</small>
      <button className="lnk neg" type="button" onClick={() => run(ask === "ban" ? "ban" : "delete")}>Evet</button>
      <button className="lnk" type="button" onClick={() => setAsk(null)}>Vazgeç</button>
    </span>
  );
  return (
    <span className="fadm">
      {adm.roles.length > 0 && (
        <select className="fsel" value="" aria-label="Rol ver" onChange={(e) => { if (e.target.value) give(Number(e.target.value)); }}>
          <option value="">Rol ver</option>
          {adm.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
      <button className="lnk" type="button" onClick={() => setAsk("del")}>Sil</button>
      <button className="lnk neg" type="button" onClick={() => setAsk("ban")}>Banla</button>
    </span>
  );
}

/* ---------- Yorumlar ---------- */
function Comments({ post, canWrite, onToast, onCount }: { post: Post; canWrite: boolean; onToast: Toast; onCount: (n: number) => void }) {
  const adm = useContext(Admin);
  const [list, setList] = useState<Comment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await feedComments(post.id); setList(r.comments); onCount(r.comments.length); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try { await feedComment(post.id, t); setText(""); await load(); }
    catch (e) { onToast((e as Error).message); }
    setBusy(false);
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); onToast(ok); await load(); } catch (e) { onToast((e as Error).message); }
  };

  return (
    <div className="fcom">
      {err && <small className="neg">{err}</small>}
      {list?.map((c) => (
        <div className="fcm1" key={c.id}>
          <div className="fcmh"><NameLine name={c.riot} /><Roles roles={c.roles} /><small className="d">{ago(c.created)}</small>
            <span className="sp" />
            {c.mine && <button className="lnk" type="button" onClick={() => act(() => feedDelete(`c:${c.id}`), "Yorum silindi")}>Sil</button>}
            {!c.mine && !adm.on && canWrite && <button className="lnk" type="button" onClick={() => act(() => feedReport(`c:${c.id}`), "Bildirildi, teşekkürler")}>Bildir</button>}
            {adm.on && !c.mine && <AdminButtons target={`c:${c.id}`} riot={c.riot} onToast={onToast} onDone={load} />}
          </div>
          <p>{c.text}</p>
        </div>
      ))}
      {list && list.length === 0 && <small className="d">Henüz yorum yok.</small>}
      {canWrite && (
        <div className="fcin">
          <input className="inp" value={text} maxLength={COMMENT_MAX} placeholder="Yorum yaz" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <button className="x" type="button" onClick={send} disabled={busy || !text.trim()}>Gönder</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Tek paylaşım ---------- */
function PostView({ p, assets, canWrite, onToast, onChanged }: { p: Post; assets: Assets; canWrite: boolean; onToast: Toast; onChanged: () => void }) {
  const adm = useContext(Admin);
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.liked);
  const [count, setCount] = useState(p.comments);
  const [open, setOpen] = useState(false);
  useEffect(() => { setLikes(p.likes); setLiked(p.liked); setCount(p.comments); }, [p.likes, p.liked, p.comments]);

  const gg = async () => {
    if (!canWrite) return;
    setLiked(!liked); setLikes(likes + (liked ? -1 : 1));
    try { const r = await feedLike(p.id); setLiked(r.liked); setLikes(r.likes); }
    catch (e) { setLiked(liked); setLikes(likes); onToast((e as Error).message); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); onToast(ok); onChanged(); } catch (e) { onToast((e as Error).message); }
  };

  return (
    <article className={p.roles.some((r) => r.admin) ? "fpost adm" : "fpost"}>
      <header className="fph">
        <NameLine name={p.riot} />
        <Roles roles={p.roles} />
        <small className="d">{ago(p.created)}</small>
        {p.hidden && <span className="bd neg">Gizli · {p.reports} bildirim</span>}
        <span className="sp" />
        {p.mine && <button className="lnk" type="button" onClick={() => act(() => feedDelete(`p:${p.id}`), "Paylaşım silindi")}>Sil</button>}
        {!p.mine && !adm.on && canWrite && <button className="lnk" type="button" onClick={() => act(() => feedReport(`p:${p.id}`), "Bildirildi, teşekkürler")}>Bildir</button>}
        {adm.on && !p.mine && <AdminButtons target={`p:${p.id}`} riot={p.riot} onToast={onToast} onDone={onChanged} />}
      </header>
      {p.text && <p className="fpt">{p.text}</p>}
      {p.card && <FeedCardView c={p.card} assets={assets} />}
      <footer className="fpf">
        <button type="button" className={liked ? "fgg on" : "fgg"} onClick={gg} disabled={!canWrite} aria-pressed={liked} title="GG ver">GG <b>{likes}</b></button>
        <button type="button" className={open ? "fgg on2" : "fgg"} onClick={() => setOpen(!open)} aria-expanded={open}>Yorumlar <b>{count}</b></button>
      </footer>
      {open && <Comments post={p} canWrite={canWrite} onToast={onToast} onCount={setCount} />}
    </article>
  );
}

/* ---------- Yönetim sekmesi ---------- */
function AdminView({ assets, data, err, onToast, reload }: { assets: Assets; data: AdminList | null; err: string | null; onToast: Toast; reload: () => void }) {
  const [riot, setRiot] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(ROLE_COLORS[0]);
  const act = async (action: string, extra: object, ok: string) => {
    try { await feedAdmin(action, extra); onToast(ok); reload(); } catch (e) { onToast((e as Error).message); }
  };
  return (
    <div className="fadmv">
      {err && <Empty tone="err" title="Yönetim açılamadı" text={err} onRetry={reload} />}

      <h3 className="h2">Roller</h3>
      <div className="box pad froleadm">
        <div className="fcin">
          <input className="inp" value={name} maxLength={16} placeholder="Yeni rol adı (ör. Öneri Ustası)" onChange={(e) => setName(e.target.value)} />
          <span className="fsw">{ROLE_COLORS.map((c) => <button key={c} type="button" className={c === color ? "on" : ""} style={{ background: c }} aria-label={`Renk ${c}`} onClick={() => setColor(c)} />)}</span>
          <button className="x" type="button" disabled={name.trim().length < 2} onClick={() => { act("role_create", { name: name.trim(), color }, "Rol açıldı"); setName(""); }}>Rol aç</button>
        </div>
        {data && data.roles.length === 0 && <small className="d">Henüz rol yok. Açtığın rolü paylaşımlardaki "Rol ver" menüsünden verirsin.</small>}
        {data?.roles.map((r) => (
          <div key={r.id} className="frolerow">
            <span className="frole" style={{ "--rc": r.color } as React.CSSProperties}>{r.name}</span>
            <span className="frm">
              {r.members.length === 0 ? <small className="d">Kimsede yok</small> : r.members.map((m) => (
                <span key={m.puuid} className="frmem">{m.riot}<button type="button" aria-label={`${m.riot} kişisinden rolü al`} onClick={() => act("role_take", { role: r.id, puuid: m.puuid }, "Rol alındı")}>×</button></span>
              ))}
            </span>
            <button className="lnk neg" type="button" onClick={() => act("role_delete", { role: r.id }, "Rol silindi")}>Rolü sil</button>
          </div>
        ))}
      </div>

      <h3 className="h2">Bildirilen paylaşımlar</h3>
      {data && data.posts.length === 0 && <small className="d">Bildirilen paylaşım yok.</small>}
      {data?.posts.map((p) => (
        <div key={p.id} className="fadmrow">
          <PostView p={p} assets={assets} canWrite={false} onToast={onToast} onChanged={reload} />
          <button className="x" type="button" onClick={() => act("restore", { target: `p:${p.id}` }, "Geri getirildi")}>Sorun yok, geri getir</button>
        </div>
      ))}
      <h3 className="h2">Bildirilen yorumlar</h3>
      {data && data.comments.length === 0 && <small className="d">Bildirilen yorum yok.</small>}
      {data?.comments.map((c) => (
        <div key={c.id} className="fcm1 box pad">
          <div className="fcmh"><NameLine name={c.riot} /><small className="d">{ago(c.created)} · {c.reports} bildirim{c.hidden ? " · gizli" : ""}</small><span className="sp" />
            <button className="lnk" type="button" onClick={() => act("restore", { target: `c:${c.id}` }, "Geri getirildi")}>Geri getir</button>
            <AdminButtons target={`c:${c.id}`} riot={c.riot} onToast={onToast} onDone={reload} />
          </div>
          <p>{c.text}</p>
        </div>
      ))}
      <h3 className="h2">Banlılar</h3>
      <div className="box pad">
        {data && data.bans.length === 0 && <small className="d">Banlı kimse yok.</small>}
        {data?.bans.map((b) => (
          <div key={b.riot} className="fban"><span>{b.riot}</span><small className="d">{ago(b.at)}</small><span className="sp" />
            <button className="lnk" type="button" onClick={() => act("unban", { riot: b.riot }, `${b.riot} banı kaldırıldı`)}>Banı kaldır</button>
          </div>
        ))}
      </div>
      <h3 className="h2">Riot ID eşleşmesini sıfırla</h3>
      <div className="fcin">
        <input className="inp" value={riot} placeholder="isim#etiket" onChange={(e) => setRiot(e.target.value)} />
        <button className="x" type="button" disabled={!riot.includes("#")} onClick={() => { act("release", { riot }, "Eşleşme sıfırlandı"); setRiot(""); }}>Sıfırla</button>
      </div>
      <small className="d">Riot'un belirtecinde adı gelmeyen biri "bu Riot ID başka bir hesaba ait" uyarısı alıyorsa.</small>
    </div>
  );
}

/* ---------- Panel ---------- */
export function FeedPanel({ assets, draft, onDraftUsed, onToast, onClose }: { assets: Assets; draft: FeedCard | null; onDraftUsed: () => void; onToast: Toast; onClose: () => void }) {
  const [tab, setTab] = useState<Tab | "admin">("new");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(currentMe());
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authing, setAuthing] = useState(false);
  const [text, setText] = useState("");
  const [card, setCard] = useState<FeedCard | null>(draft);
  const [busy, setBusy] = useState(false);
  const [adm, setAdm] = useState<AdminList | null>(null);
  const [admErr, setAdmErr] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const auth = useCallback(async () => {
    setAuthing(true);
    try { setMe(await login()); setAuthErr(null); }
    catch (e) { setAuthErr(e instanceof Error ? e.message : String(e)); }
    setAuthing(false);
  }, []);
  useEffect(() => { auth(); }, [auth]);
  useEffect(() => { if (draft) { setCard(draft); onDraftUsed(); area.current?.focus(); } }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = !!me?.admin;
  const loadAdmin = useCallback(async () => {
    if (!isAdmin) return;
    try { setAdm(await feedAdmin<AdminList>("list")); setAdmErr(null); } catch (e) { setAdmErr((e as Error).message); }
  }, [isAdmin]);
  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  const load = useCallback(async (t: Tab | "admin" = tab) => {
    if (t === "admin") { loadAdmin(); return; }
    try {
      const r = await feedList(t);
      setPosts(r.posts); setMore(t !== "top" && r.posts.length >= 20); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [tab, loadAdmin]);
  useEffect(() => { setPosts(null); load(tab); }, [tab, me?.puuid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = window.setInterval(() => { if (!document.hidden) load(); }, 60_000); return () => window.clearInterval(t); }, [load]);

  const loadMore = async () => {
    if (!posts?.length || tab === "admin") return;
    try { const r = await feedList(tab, posts[posts.length - 1].id); setPosts([...posts, ...r.posts]); setMore(r.posts.length >= 20); }
    catch (e) { onToast((e as Error).message); }
  };

  const attachLast = async () => {
    if (!inTauri) { onToast("Maç kartı yalnızca masaüstü uygulamasında eklenir."); return; }
    try {
      const s = await invoke<MyStats>("get_my_stats");
      if (!s.matches.length) { onToast("Eklenecek maç bulunamadı."); return; }
      setCard(cardOf(s.matches[0], assets));
    } catch (e) { onToast(String(e).slice(0, 120)); }
  };

  const share = async () => {
    setBusy(true);
    try {
      await feedPost(text.trim(), card);
      setText(""); setCard(null); onToast("Paylaşıldı");
      if (tab !== "new") setTab("new"); else load("new");
    } catch (e) { onToast((e as Error).message); }
    setBusy(false);
  };

  const canWrite = !!me && !me.banned;
  const tabs: [Tab | "admin", string][] = [["new", "Yeni"], ["top", "Haftanın en iyileri"], ["mine", "Paylaşımlarım"], ...(isAdmin ? [["admin", "Yönetim"] as [Tab | "admin", string]] : [])];
  const ctx: AdminCtx = { on: isAdmin, roles: adm?.roles ?? [], reload: loadAdmin };

  return (
    <Admin.Provider value={ctx}>
      <div className="panel akis" role="dialog" aria-label="Akış">
        <PanelHead
          title="Akış"
          sub={me ? <>Riot ile doğrulandı: <b>{me.riot}</b>{me.roles.length > 0 && <> <Roles roles={me.roles} /></>}</> : "Maçlarını ve düşüncelerini paylaş, GG ver, yorum yap"}
          actions={<button className="x" type="button" onClick={() => load()}>Yenile</button>}
          onClose={onClose}
        />

        {me?.banned ? (
          <Empty tone="err" title="Akışta paylaşım yapamazsın" text="Hesabın akışta kalıcı olarak kapatıldı. Paylaşımları okuyabilirsin; paylaşım, yorum ve GG kapalı." />
        ) : !me ? (
          authErr ? <Empty tone="err" title="Riot ile doğrulanamadı" text={<>{authErr} Paylaşımları okuyabilirsin; paylaşmak için Riot Client açık olmalı.</>} onRetry={auth} />
            : <Empty text={authing ? "Riot hesabın doğrulanıyor…" : "Paylaşmak için Riot Client açık olmalı."} onRetry={authing ? undefined : auth} />
        ) : tab !== "admin" && (
          <div className="fcomp box pad">
            <textarea ref={area} className="inp" rows={2} maxLength={POST_MAX} value={text} placeholder={card ? "Maçın hakkında bir şey yaz (isteğe bağlı)" : "Ne düşünüyorsun?"} onChange={(e) => setText(e.target.value)} />
            {card && (
              <div className="fdraft">
                <FeedCardView c={card} assets={assets} />
                <button className="lnk" type="button" onClick={() => setCard(null)}>Kartı kaldır</button>
              </div>
            )}
            <div className="fcbar">
              {!card && <button className="x" type="button" onClick={attachLast}>Son maçımı ekle</button>}
              <small className="d">Paylaşımın Riot ID'nle herkese açık görünür ve Celeste Discord sunucusuna da düşer. Küfür ve hakaret yazılamaz.</small>
              <span className="sp" />
              <small className={text.length > POST_MAX - 20 ? "neg" : "d"}>{text.length}/{POST_MAX}</small>
              <button className="x pri" type="button" onClick={share} disabled={busy || (!text.trim() && !card)}>{busy ? "Paylaşılıyor" : "Paylaş"}</button>
            </div>
          </div>
        )}

        <div className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "admin" ? (
          <AdminView assets={assets} data={adm} err={admErr} onToast={onToast} reload={loadAdmin} />
        ) : (
          <div className="flist">
            {err && <Empty tone="err" title="Akış yüklenemedi" text={err} onRetry={() => load()} />}
            {!err && !posts && <Empty text="Akış yükleniyor…" />}
            {posts && posts.length === 0 && <Empty text={tab === "mine" ? (me ? "Henüz bir şey paylaşmadın." : "Paylaşımlarını görmek için Riot ile doğrulanman gerekiyor.") : tab === "top" ? "Bu hafta henüz GG alan paylaşım yok." : "Henüz paylaşım yok. İlk paylaşımı sen yap."} />}
            {posts?.map((p) => <PostView key={p.id} p={p} assets={assets} canWrite={canWrite} onToast={onToast} onChanged={() => load()} />)}
            {more && <button className="x more" type="button" onClick={loadMore}>Daha fazla</button>}
          </div>
        )}

        {me && !isAdmin && (
          <div className="fkey">
            <button className="lnk d" type="button" title="Yöneticiysen bu kimliği sitenin FEED_ADMINS ayarına yazarsın" onClick={() => { navigator.clipboard.writeText(me.puuid).then(() => onToast("Hesap kimliğin kopyalandı"), () => onToast("Kopyalanamadı")); }}>Hesap kimliğimi kopyala</button>
          </div>
        )}
      </div>
    </Admin.Provider>
  );
}
