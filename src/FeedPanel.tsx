import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { QUEUE_NAMES } from "./queues";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { tierColor } from "./LoadoutPanel";
import type { MyStats } from "./types";
import { Empty, NameLine, PanelHead } from "./ui";
import { ROLE_ICON_NAMES, ROLE_ICON_PATHS, RoleIcon } from "./roleIcons";
import { Roles, adminOf, ink } from "./RoleBadge";
import {
  ago, cardOf, currentMe, feedAdmin, feedComment, feedComments, feedDelete, feedLike, feedList, feedNotes, feedPost, feedProfile, feedReact, feedReport, login,
  REACTS, type AdminList, type Clip, type Comment, type FeedCard, type Me, type Note, type Post, type Profile, type RoleDef, type Tab,
} from "./feed";

const inTauri = "__TAURI_INTERNALS__" in window;
const QUEUE = QUEUE_NAMES;
const POST_MAX = 280, COMMENT_MAX = 200;
const ROLE_COLORS = ["#a78bfa", "#34d399", "#38bdf8", "#fb7185", "#fbbf24", "#2dd4bf", "#f472b6", "#ededed"];

type Toast = (t: string) => void;

/** Yönetici bağlamı: rol listesi (rol verme menüsü için) ve yenileme. */
interface AdminCtx { on: boolean; roles: RoleDef[]; reload: () => void }
const Admin = createContext<AdminCtx>({ on: false, roles: [], reload: () => undefined });
/** İsme ya da etikete tıklayınca profil açılır. */
const OpenProfile = createContext<(riot: string) => void>(() => undefined);

const MENTION_RE = /@([^\s#@](?:[^#@\n]{0,14}[^\s#@])?#[0-9A-Za-zÇĞİÖŞÜçğıöşü]{2,5})/gu;

/** Yazı + tıklanabilir @isim#etiket. */
function RichText({ text, className }: { text: string; className?: string }) {
  const open = useContext(OpenProfile);
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(<button key={i} type="button" className="fmention" onClick={() => open(m[1])}>@{m[1]}</button>);
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className={className}>{parts}</p>;
}

/** Tıklanabilir isim (profili açar). */
function Who({ riot }: { riot: string }) {
  const open = useContext(OpenProfile);
  return <button type="button" className="fwho" onClick={() => open(riot)} title="Profili aç"><NameLine name={riot} /></button>;
}

const CLIP_NAME: Record<Clip["kind"], string> = { youtube: "YouTube", tiktok: "TikTok", medal: "Medal", twitch: "Twitch" };
function ClipView({ clip }: { clip: Clip }) {
  const go = () => { if (inTauri) openUrl(clip.url).catch(() => undefined); else window.open(clip.url, "_blank"); };
  return (
    <button type="button" className={`fclip ${clip.kind}`} onClick={go} title="Klibi tarayıcıda aç">
      {clip.kind === "youtube"
        ? <img src={`https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        : <span className="fclipbg" aria-hidden="true" />}
      <span className="fplay" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5v9l7.5-4.5z" /></svg></span>
      <span className="fclipl"><b>{CLIP_NAME[clip.kind]} klibi</b><small>Tarayıcıda açılır</small></span>
    </button>
  );
}

/** 🔥 💀 😂 👏 tepkileri. */
function Reacts({ p, canWrite, onToast }: { p: Post; canWrite: boolean; onToast: Toast }) {
  const [counts, setCounts] = useState<Record<string, number>>(p.reacts ?? {});
  const [mine, setMine] = useState<string[]>(p.myReacts ?? []);
  useEffect(() => { setCounts(p.reacts ?? {}); setMine(p.myReacts ?? []); }, [p.reacts, p.myReacts]);
  const toggle = async (k: string) => {
    if (!canWrite) return;
    const on = !mine.includes(k);
    setMine(on ? [...mine, k] : mine.filter((x) => x !== k));
    setCounts({ ...counts, [k]: Math.max(0, (counts[k] ?? 0) + (on ? 1 : -1)) });
    try { const r = await feedReact(p.id, k); setCounts((c) => ({ ...c, [k]: r.count })); }
    catch (e) { setMine(mine); setCounts(counts); onToast((e as Error).message); }
  };
  return (
    <span className="freacts">
      {REACTS.map(([k, e]) => (
        <button key={k} type="button" className={mine.includes(k) ? "frx on" : "frx"} onClick={() => toggle(k)} disabled={!canWrite} aria-pressed={mine.includes(k)} title="Tepki ver">
          <span aria-hidden="true">{e}</span>{(counts[k] ?? 0) > 0 && <b>{counts[k]}</b>}
        </button>
      ))}
    </span>
  );
}

const NOTE_TEXT: Record<Note["kind"], string> = { gg: "paylaşımına GG verdi", react: "paylaşımına tepki verdi", comment: "paylaşımına yorum yaptı", mention: "seni etiketledi", weekly: "Paylaşımın haftanın paylaşımı seçildi" };
const REACT_OF: Record<string, string> = Object.fromEntries(REACTS);

/** Bildirimler: paylaşımlarına gelen GG, tepki, yorum ve etiketler. */
function NotesMenu({ onClose }: { onClose: () => void }) {
  const open = useContext(OpenProfile);
  const [list, setList] = useState<Note[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    feedNotes(true).then((r) => { setList(r.notes); window.dispatchEvent(new Event("feed-notes-seen")); }).catch((e) => setErr((e as Error).message));
  }, []);
  return (
    <div className="fnotes box" role="dialog" aria-label="Bildirimler">
      <div className="fnh"><b>Bildirimler</b><button className="lnk" type="button" onClick={onClose}>Kapat</button></div>
      {err && <small className="neg">{err}</small>}
      {!err && !list && <small className="d">Yükleniyor…</small>}
      {list && list.length === 0 && <small className="d">Henüz bildirim yok. Paylaşımlarına GG, tepki ya da yorum gelince burada görünür.</small>}
      {list?.map((n) => (
        <div key={n.id} className={n.seen ? "fnote" : "fnote new"}>
          {n.kind === "weekly"
            ? <span><b>🏆 {NOTE_TEXT.weekly}!</b></span>
            : <span><button type="button" className="fmention" onClick={() => { open(n.by); onClose(); }}>{n.by}</button> {NOTE_TEXT[n.kind]}{n.kind === "react" && REACT_OF[n.text] ? ` ${REACT_OF[n.text]}` : ""}{(n.kind === "comment" || n.kind === "mention") && n.text ? <q>{n.text}</q> : null}</span>}
          <small className="d">{ago(n.at)}</small>
        </div>
      ))}
    </div>
  );
}

/** Profil: Akış'ta paylaştıklarından oluşan özet. */
function ProfileView({ riot, assets, canWrite, onBack, onToast }: { riot: string; assets: Assets; canWrite: boolean; onBack: () => void; onToast: Toast }) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { feedProfile(riot).then((x) => { setP(x); setErr(null); }).catch((e) => setErr((e as Error).message)); }, [riot]);
  useEffect(() => { setP(null); load(); }, [load]);
  const tier = p?.tier ? assets.tiers.get(p.tier.tier) : undefined;
  return (
    <div className="fprof">
      <button className="lnk" type="button" onClick={onBack}>← Akış'a dön</button>
      {err && <Empty tone="err" title="Profil açılamadı" text={err} onRetry={load} />}
      {!err && !p && <Empty text="Profil yükleniyor…" />}
      {p && (
        <>
          <div className="fprofh box pad" style={adminOf(p.roles) ? ({ "--adm": adminOf(p.roles)!.color } as React.CSSProperties) : undefined}>
            {tier && <img className="fproft" src={tier.icon} alt={tier.name} title={tier.name} />}
            <div className="fprofn">
              <span className={adminOf(p.roles) ? "fprofname adm" : "fprofname"}><NameLine name={p.riot} /></span>
              <Roles roles={p.roles} />
              {tier && <small style={{ color: tierColor(tier.color) }}>{tier.name} · son paylaştığı maçta</small>}
            </div>
            <div className="fprofs">
              <span><b>{p.stats.posts}</b><small>paylaşım</small></span>
              <span><b>{p.stats.gg}</b><small>GG aldı</small></span>
              <span><b>{p.stats.comments}</b><small>yorum</small></span>
            </div>
            {p.agents.length > 0 && (
              <div className="fprofa">
                {p.agents.map((a) => {
                  const ag = assets.agents.get(lookup(a.agentId));
                  return <span key={a.agentId} title={`${ag?.name ?? a.name}: ${a.n} maç, ${a.w} galibiyet`}>{ag && <img src={ag.icon} alt="" />}<small>{ag?.name ?? a.name} · {a.n}</small></span>;
                })}
              </div>
            )}
          </div>
          <small className="d">Profilde yalnızca Akış'ta paylaştıkları görünür.{p.stats.since ? ` İlk paylaşımı ${new Date(p.stats.since).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}.` : ""}</small>
          <div className="flist">
            {p.posts.length === 0 && <Empty text="Görünür paylaşımı yok." />}
            {p.posts.map((x) => <PostView key={x.id} p={x} assets={assets} canWrite={canWrite} onToast={onToast} onChanged={load} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Maç kartı (akış içinde, HTML) ---------- */
function Board({ rows, title, assets, ally }: { rows: NonNullable<FeedCard["board"]>; title: string; assets: Assets; ally: boolean }) {
  if (!rows.length) return null;
  return (
    <div className={ally ? "sbp ally" : "sbp enemy"}>
      <small className="sbt">{title}</small>
      {rows.map((r, i) => {
        const ag = assets.agents.get(lookup(r.a));
        return (
          <div key={i} className={r.me ? "sbr me" : "sbr"}>
            {ag ? <img src={ag.icon} alt={ag.name} title={ag.name} /> : <i />}
            <span className="sbk">{r.k}/{r.d}/{r.as}</span>
            <span className="sba">{r.acs}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FeedCardView({ c, assets }: { c: FeedCard; assets: Assets }) {
  const ag = assets.agents.get(lookup(c.agentId));
  const art = assets.mapArt.get(lookup(c.mapId));
  const tier = c.tier ? assets.tiers.get(c.tier) : undefined;
  const kd = c.d ? c.k / c.d : c.k;
  const board = c.board ?? [];
  const allies = board.filter((r) => r.ally), enemies = board.filter((r) => !r.ally);
  return (
    <div className={`${c.won ? "fcard win" : "fcard loss"}${board.length ? " hasb" : ""}`} style={art ? ({ "--art": `url("${art}")` } as React.CSSProperties) : undefined}>
      {ag && !board.length && <img className="fca" src={ag.portrait ?? ag.icon} alt="" loading="lazy" />}
      <div className="fcb">
        <small className="fcm">{[QUEUE[c.queue] ?? (c.queue || "Maç"), assets.maps.get(lookup(c.mapId)) ?? c.mapName, ag?.name ?? c.agentName].filter(Boolean).join(" · ")}</small>
        <div className="fcr">
          <b className="fcw">{c.won ? "Galibiyet" : "Mağlubiyet"}</b>
          {c.score && <b className="fcs">{c.score[0]}–{c.score[1]}</b>}
          {tier && <span className="fcrank"><img src={tier.icon} alt="" /><b style={{ color: tierColor(tier.color) }}>{tier.name}</b></span>}
        </div>
        <div className="fck">
          <span><b>{c.k}/{c.d}/{c.a}</b><small>K/D/A</small></span>
          <span><b>{kd.toFixed(2)}</b><small>K/D</small></span>
          <span><b>{c.acs}</b><small>ACS</small></span>
          {c.rr != null && <span><b className={c.rr >= 0 ? "pos" : "neg"}>{c.rr > 0 ? "+" : ""}{c.rr}</b><small>RR</small></span>}
        </div>
        {c.hl.length > 0 && <div className="fch">{c.hl.map((h) => <i key={h}>{h}</i>)}</div>}
      </div>
      {board.length > 0 && (
        <div className="sbx">
          <Board rows={allies} title={`Takımın${c.score ? ` · ${c.score[0]}` : ""}`} assets={assets} ally />
          <Board rows={enemies} title={`Rakip${c.score ? ` · ${c.score[1]}` : ""}`} assets={assets} ally={false} />
        </div>
      )}
    </div>
  );
}

/* ---------- Yönetici düğmeleri: sil, banla (onaylı), rol ver ---------- */
function AdminButtons({ target, riot, onToast, onDone, pinned, mine }: { target: string; riot: string; onToast: Toast; onDone: () => void; pinned?: boolean; mine?: boolean }) {
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
  const pin = async () => {
    try { await feedAdmin(pinned ? "unpin" : "pin", { target }); onToast(pinned ? "Sabitleme kaldırıldı" : "Paylaşım en üste sabitlendi"); onDone(); }
    catch (e) { onToast((e as Error).message); }
  };
  const isPost = target.startsWith("p:");
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
      {isPost && <button className="lnk" type="button" onClick={pin}>{pinned ? "Sabitlemeyi kaldır" : "Sabitle"}</button>}
      {!mine && <button className="lnk" type="button" onClick={() => setAsk("del")}>Sil</button>}
      {!mine && <button className="lnk neg" type="button" onClick={() => setAsk("ban")}>Banla</button>}
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
        <div className={adminOf(c.roles) ? "fcm1 adm" : "fcm1"} key={c.id} style={adminOf(c.roles) ? ({ "--adm": adminOf(c.roles)!.color } as React.CSSProperties) : undefined}>
          <div className="fcmh"><Who riot={c.riot} /><Roles roles={c.roles} /><small className="d">{ago(c.created)}</small>
            <span className="sp" />
            {c.mine && <button className="lnk" type="button" onClick={() => act(() => feedDelete(`c:${c.id}`), "Yorum silindi")}>Sil</button>}
            {!c.mine && !adm.on && canWrite && <button className="lnk" type="button" onClick={() => act(() => feedReport(`c:${c.id}`), "Bildirildi, teşekkürler")}>Bildir</button>}
            {adm.on && <AdminButtons target={`c:${c.id}`} riot={c.riot} mine={c.mine} onToast={onToast} onDone={load} />}
          </div>
          <RichText text={c.text} />
        </div>
      ))}
      {list && list.length === 0 && <small className="d">Henüz yorum yok.</small>}
      {canWrite && (
        <div className="fcin">
          <input className="inp" value={text} maxLength={COMMENT_MAX} placeholder="Yorum yaz · @isim#etiket ile etiketle" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
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
    <article className={`fpost${adminOf(p.roles) ? " adm" : ""}${p.pinned ? " pinned" : ""}`} style={adminOf(p.roles) ? ({ "--adm": adminOf(p.roles)!.color } as React.CSSProperties) : undefined}>
      {p.pinned && (
        <div className="fpin"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.5 1.5 14.5 5.5 12 6.5 9.5 9l.5 3.5-1 1L6 10.5 2.5 14l-.5-.5L5.5 10 2.5 7l1-1L7 6.5 9.5 4z" /></svg>Sabitlenmiş paylaşım</div>
      )}
      <header className="fph">
        <Who riot={p.riot} />
        <Roles roles={p.roles} />
        <small className="d">{ago(p.created)}</small>
        {p.hidden && <span className="bd neg">Gizli · {p.reports} bildirim</span>}
        <span className="sp" />
        {p.mine && <button className="lnk" type="button" onClick={() => act(() => feedDelete(`p:${p.id}`), "Paylaşım silindi")}>Sil</button>}
        {!p.mine && !adm.on && canWrite && <button className="lnk" type="button" onClick={() => act(() => feedReport(`p:${p.id}`), "Bildirildi, teşekkürler")}>Bildir</button>}
        {adm.on && <AdminButtons target={`p:${p.id}`} riot={p.riot} pinned={p.pinned} mine={p.mine} onToast={onToast} onDone={onChanged} />}
      </header>
      {p.text && <RichText className="fpt" text={p.text} />}
      {p.card && <FeedCardView c={p.card} assets={assets} />}
      {p.clip && <ClipView clip={p.clip} />}
      <footer className="fpf">
        <button type="button" className={liked ? "fgg on" : "fgg"} onClick={gg} disabled={!canWrite} aria-pressed={liked} title="GG ver">GG <b>{likes}</b></button>
        <Reacts p={p} canWrite={canWrite} onToast={onToast} />
        <span className="sp" />
        <button type="button" className={open ? "fgg fcbtn on2" : "fgg fcbtn"} onClick={() => setOpen(!open)} aria-expanded={open}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg>
          {count > 0 ? <>{count} yorum</> : "Yorum yap"}
        </button>
      </footer>
      {!open && (p.preview?.length ?? 0) > 0 && (
        <div className="fprev">
          {count > (p.preview?.length ?? 0) && <button className="lnk" type="button" onClick={() => setOpen(true)}>Tüm yorumları gör ({count})</button>}
          {p.preview!.map((c) => (
            <div key={c.id} className="fprevc"><Who riot={c.riot} /><RichText text={c.text} /></div>
          ))}
        </div>
      )}
      {!open && canWrite && <QuickComment post={p} first={count === 0} onSent={() => { setCount((n) => n + 1); setOpen(true); }} onToast={onToast} />}
      {open && <Comments post={p} canWrite={canWrite} onToast={onToast} onCount={setCount} />}
    </article>
  );
}

/* ---------- Hızlı yorum: her paylaşımın altında, tek satır ---------- */
const QUICK = ["GG WP", "Efsane 🔥", "Temiz clutch", "Şanssızlık 😅", "Sonraki maç senin 💪"];

function QuickComment({ post, first, onSent, onToast }: { post: Post; first: boolean; onSent: () => void; onToast: Toast }) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (t: string) => {
    const v = t.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await feedComment(post.id, v); setText(""); onSent(); onToast("Yorumun gönderildi"); }
    catch (e) { onToast((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className={focus || first ? "fquick open" : "fquick"}>
      <div className="fqin">
        <input
          className="inp" value={text} maxLength={COMMENT_MAX}
          placeholder={first ? "İlk yorumu sen yap…" : "Yorum yaz…"}
          aria-label="Yorum yaz"
          onFocus={() => setFocus(true)} onBlur={() => window.setTimeout(() => setFocus(false), 150)}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(text); }}
        />
        {text.trim() && <button className="x pri" type="button" onClick={() => send(text)} disabled={busy}>Gönder</button>}
      </div>
      {(focus || first) && !text && (
        <div className="fqchips" aria-label="Hızlı yorum">
          {QUICK.map((q) => <button key={q} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => send(q)} disabled={busy}>{q}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---------- Rol düzenleyici: ad, renk, simge, parlama ---------- */
interface RoleDraft { name: string; color: string; icon: string; glow: boolean }
function RoleEditor({ name, color, icon, glow, onChange, onSave, action }: RoleDraft & { onChange: (v: Partial<RoleDraft>) => void; onSave: () => void; action: string }) {
  return (
    <div className="froled">
      <div className="fcin">
        <input className="inp" value={name} maxLength={16} placeholder="Rol adı (ör. Developer)" onChange={(e) => onChange({ name: e.target.value })} />
        <span className="froles fprev"><span className={glow ? "frole adm" : "frole"} style={{ "--rc": color, "--rt": ink(color) } as React.CSSProperties}><RoleIcon name={icon} />{name.trim() || "Önizleme"}</span></span>
        <button className="x" type="button" disabled={name.trim().length < 2} onClick={onSave}>{action}</button>
      </div>
      <div className="froleopts">
        <span className="fsw">{ROLE_COLORS.map((c) => <button key={c} type="button" className={c === color ? "on" : ""} style={{ background: c }} aria-label={`Renk ${c}`} onClick={() => onChange({ color: c })} />)}</span>
        <label className="fcolor"><input type="color" value={color} onChange={(e) => onChange({ color: e.target.value })} aria-label="Özel renk" /></label>
        <span className="ficons" role="group" aria-label="Simge">
          <button type="button" className={!icon ? "on" : ""} onClick={() => onChange({ icon: "" })} title="Simgesiz">–</button>
          {Object.keys(ROLE_ICON_PATHS).map((k) => (
            <button key={k} type="button" className={icon === k ? "on" : ""} title={ROLE_ICON_NAMES[k]} aria-label={ROLE_ICON_NAMES[k]} onClick={() => onChange({ icon: k })}><RoleIcon name={k} size={13} /></button>
          ))}
        </span>
        <label className="fglow"><input type="checkbox" checked={glow} onChange={(e) => onChange({ glow: e.target.checked })} /> ADMIN gibi parlasın</label>
      </div>
    </div>
  );
}

function RoleEdit({ r, onSave }: { r: RoleDef; onSave: (v: RoleDraft) => void }) {
  const [v, setV] = useState<RoleDraft>({ name: r.name, color: r.color, icon: r.icon ?? "", glow: !!r.glow });
  return <RoleEditor {...v} onChange={(p) => setV({ ...v, ...p })} action="Kaydet" onSave={() => onSave({ ...v, name: v.name.trim() })} />;
}

/* ---------- Yönetim sekmesi ---------- */
function AdminView({ assets, data, err, me, onToast, reload, onColor }: { assets: Assets; data: AdminList | null; err: string | null; me: Me | null; onToast: Toast; reload: () => void; onColor: (c: string) => void }) {
  const [riot, setRiot] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(ROLE_COLORS[0]);
  const [icon, setIcon] = useState("");
  const [glow, setGlow] = useState(false);
  const [edit, setEdit] = useState<number | null>(null);
  const act = async (action: string, extra: object, ok: string) => {
    try { await feedAdmin(action, extra); onToast(ok); reload(); } catch (e) { onToast((e as Error).message); }
  };
  return (
    <div className="fadmv">
      {err && <Empty tone="err" title="Yönetim açılamadı" text={err} onRetry={reload} />}

      <h3 className="h2">ADMIN rozeti</h3>
      <div className="box pad fadmcol">
        <span className="froles"><span className="frole adm" style={{ "--rc": data?.adminColor ?? "#f5c451", "--rt": ink(data?.adminColor ?? "#f5c451") } as React.CSSProperties}><RoleIcon name="crown" />ADMIN</span></span>
        <span className="fsw">{["#f5c451", "#ec4899", "#38bdf8", "#a78bfa", "#34d399", "#f87171", "#ffffff"].map((c) => (
          <button key={c} type="button" className={c === data?.adminColor ? "on" : ""} style={{ background: c }} aria-label={`ADMIN rengi ${c}`} onClick={() => { act("admin_color", { color: c }, "ADMIN rengi değişti"); onColor(c); }} />
        ))}</span>
        <label className="fcolor">Özel renk <input type="color" value={data?.adminColor ?? "#f5c451"} onChange={(e) => { act("admin_color", { color: e.target.value }, "ADMIN rengi değişti"); onColor(e.target.value); }} /></label>
        <small className="d">Adının yanındaki rozet, paylaşımlarının çerçevesi ve Discord kartının rengi.</small>
      </div>

      <h3 className="h2">Roller</h3>
      <div className="box pad froleadm">
        <RoleEditor
          name={name} color={color} icon={icon} glow={glow}
          onChange={(v) => { if (v.name != null) setName(v.name); if (v.color) setColor(v.color); if (v.icon != null) setIcon(v.icon); if (v.glow != null) setGlow(v.glow); }}
          action="Rol aç"
          onSave={() => { act("role_create", { name: name.trim(), color, icon, glow }, "Rol açıldı"); setName(""); setIcon(""); setGlow(false); }}
        />
        {data && data.roles.length === 0 && <small className="d">Henüz rol yok. Açtığın rolü paylaşımlardaki "Rol ver" menüsünden verirsin.</small>}
        {data?.roles.map((r) => (
          <div key={r.id} className="frolewrap">
          <div className="frolerow">
            <Roles roles={[{ name: r.name, color: r.color, icon: r.icon, glow: r.glow }]} />
            <span className="frm">
              {r.members.length === 0 ? <small className="d">Kimsede yok</small> : r.members.map((m) => (
                <span key={m.puuid} className="frmem">{m.riot}<button type="button" aria-label={`${m.riot} kişisinden rolü al`} onClick={() => act("role_take", { role: r.id, puuid: m.puuid }, "Rol alındı")}>×</button></span>
              ))}
            </span>
            {me && !r.members.some((m) => m.puuid === me.puuid) && <button className="lnk" type="button" onClick={() => act("role_give", { role: r.id, puuid: me.puuid }, `${r.name} rolü sende`)}>Kendime ver</button>}
            <button className="lnk" type="button" onClick={() => setEdit(edit === r.id ? null : r.id)}>{edit === r.id ? "Kapat" : "Düzenle"}</button>
            <button className="lnk neg" type="button" onClick={() => act("role_delete", { role: r.id }, "Rol silindi")}>Rolü sil</button>
          </div>
          {edit === r.id && <RoleEdit r={r} onSave={(v) => { act("role_update", { role: r.id, ...v }, "Rol güncellendi"); setEdit(null); }} />}
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
  const [profileOf, setProfileOf] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [clip, setClip] = useState("");
  const [clipOpen, setClipOpen] = useState(false);
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
  // Riot Client'ta hesap değişince akış kimliği de değişsin (overlay'i kapatıp açmaya gerek kalmadan).
  const riotRef = useRef<string | null>(null);
  useEffect(() => { riotRef.current = me?.riot ?? null; }, [me?.riot]);
  useEffect(() => {
    if (!inTauri) return;
    const check = async () => {
      if (document.hidden) return;
      const now = await invoke<string>("get_riot_id").catch(() => "");
      const cur = riotRef.current;
      if (now && cur && now.toLocaleLowerCase("tr-TR") !== cur.toLocaleLowerCase("tr-TR")) auth();
      if (now && !cur && !authing) auth();
    };
    const t = window.setInterval(check, 8_000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(t); window.removeEventListener("focus", check); };
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (draft) { setCard(draft); onDraftUsed(); area.current?.focus(); } }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = !!me?.admin;
  useEffect(() => {
    if (!me || me.banned) return;
    const ask = () => { if (!document.hidden) feedNotes().then((r) => setUnseen(r.unseen)).catch(() => undefined); };
    ask();
    const t = window.setInterval(ask, 60_000);
    return () => window.clearInterval(t);
  }, [me?.puuid, me?.banned]); // eslint-disable-line react-hooks/exhaustive-deps
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
      setCard(cardOf(s.matches[0], assets, s.rank.current));
    } catch (e) { onToast(String(e).slice(0, 120)); }
  };

  const share = async () => {
    setBusy(true);
    try {
      await feedPost(text.trim(), card, clip.trim());
      setText(""); setCard(null); setClip(""); setClipOpen(false); onToast("Paylaşıldı");
      if (tab !== "new") setTab("new"); else load("new");
    } catch (e) { onToast((e as Error).message); }
    setBusy(false);
  };

  const canWrite = !!me && !me.banned;
  const tabs: [Tab | "admin", string][] = [["new", "Yeni"], ["top", "Haftanın en iyileri"], ["mine", "Paylaşımlarım"], ...(isAdmin ? [["admin", "Yönetim"] as [Tab | "admin", string]] : [])];
  const ctx: AdminCtx = { on: isAdmin, roles: adm?.roles ?? [], reload: loadAdmin };

  return (
    <Admin.Provider value={ctx}>
    <OpenProfile.Provider value={(r) => { setShowNotes(false); setProfileOf(r); }}>
      <div className="panel akis" role="dialog" aria-label="Akış">
        <PanelHead
          title="Akış"
          sub={me ? <>Riot ile doğrulandı: <b>{me.riot}</b>{me.roles.length > 0 && <> <Roles roles={me.roles} /></>}</> : "Maçlarını ve düşüncelerini paylaş, GG ver, yorum yap"}
          actions={<>
            {me && !me.banned && (
              <button className={showNotes ? "x fbell on" : "x fbell"} type="button" onClick={() => { setShowNotes(!showNotes); setUnseen(0); }} aria-label={unseen ? `Bildirimler, ${unseen} yeni` : "Bildirimler"}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a4 4 0 0 1 8 0v3l1.5 2h-11L4 10z" /><path d="M6.5 13.5a1.6 1.6 0 0 0 3 0" /></svg>
                Bildirimler{unseen > 0 && <b className="fnew note">{unseen > 9 ? "9+" : unseen}</b>}
              </button>
            )}
            <button className="x" type="button" onClick={() => load()}>Yenile</button>
          </>}
          onClose={onClose}
        />

        {me?.banned ? (
          <Empty tone="err" title="Akışta paylaşım yapamazsın" text="Hesabın akışta kalıcı olarak kapatıldı. Paylaşımları okuyabilirsin; paylaşım, yorum ve GG kapalı." />
        ) : !me ? (
          authErr ? <Empty tone="err" title="Riot ile doğrulanamadı" text={<>{authErr} Paylaşımları okuyabilirsin; paylaşmak için Riot Client açık olmalı.</>} onRetry={auth} />
            : <Empty text={authing ? "Riot hesabın doğrulanıyor…" : "Paylaşmak için Riot Client açık olmalı."} onRetry={authing ? undefined : auth} />
        ) : tab !== "admin" && !profileOf && (
          <div className="fcomp box pad">
            <textarea ref={area} className="inp" rows={2} maxLength={POST_MAX} value={text} placeholder={card ? "Maçın hakkında bir şey yaz (isteğe bağlı)" : "Ne düşünüyorsun?"} onChange={(e) => setText(e.target.value)} />
            {clipOpen && (
              <div className="fcin">
                <input className="inp" value={clip} placeholder="YouTube, TikTok, Medal ya da Twitch klip bağlantısı" onChange={(e) => setClip(e.target.value)} />
                <button className="lnk" type="button" onClick={() => { setClip(""); setClipOpen(false); }}>Kaldır</button>
              </div>
            )}
            {card && (
              <div className="fdraft">
                <FeedCardView c={card} assets={assets} />
                <button className="lnk" type="button" onClick={() => setCard(null)}>Kartı kaldır</button>
              </div>
            )}
            <div className="fcbar">
              {!card && <button className="x" type="button" onClick={attachLast}>Son maçımı ekle</button>}
              {!clipOpen && <button className="x" type="button" onClick={() => setClipOpen(true)}>Klip ekle</button>}
              <small className="d">Paylaşımın Riot ID'nle herkese açık görünür ve Celeste Discord sunucusuna da düşer. Küfür ve hakaret yazılamaz.</small>
              <span className="sp" />
              <small className={text.length > POST_MAX - 20 ? "neg" : "d"}>{text.length}/{POST_MAX}</small>
              <button className="x pri" type="button" onClick={share} disabled={busy || (!text.trim() && !card && !clip.trim())}>{busy ? "Paylaşılıyor" : "Paylaş"}</button>
            </div>
          </div>
        )}

        {showNotes && <NotesMenu onClose={() => setShowNotes(false)} />}

        {!profileOf && (
        <div className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        )}

        {profileOf ? (
          <ProfileView riot={profileOf} assets={assets} canWrite={canWrite} onBack={() => setProfileOf(null)} onToast={onToast} />
        ) : tab === "admin" ? (
          <AdminView assets={assets} data={adm} err={admErr} me={me} onToast={onToast} reload={() => { loadAdmin(); load(tab === "admin" ? "new" : tab); }} onColor={(c) => setMe((m) => (m ? { ...m, roles: m.roles.map((r) => (r.admin ? { ...r, color: c } : r)) } : m))} />
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
    </OpenProfile.Provider>
    </Admin.Provider>
  );
}
