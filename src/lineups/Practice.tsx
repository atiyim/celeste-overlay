import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Assets, MapInfo } from "../assets";
import { Icon } from "../icons";
import type { Mood } from "../Mascot";
import { imgUrl, kindName, siteName, type Lineup, type Pt } from "./api";
import { abilityOf, MapBoard } from "./MapBoard";
import { Narrator } from "./Narrator";
import { CHEER_BAD, CHEER_NEAR, CHEER_OK, CLIPS, pick, type ClipId } from "./voice";
import { dailyThree, dueCards, keepDaily, getMe, grade, level, markTried, mastered, patchMe, rankOf, streak, today, useMe } from "./store";

/* Öğren: günün üç lineup'ı, kart kart tekrar (aralıklı), "Nereye düşer?" sınavı, özel oyun planı ve ustalık.
   Her şey bu bilgisayarda tutulur. */

type Mode = "home" | "cards" | "quiz" | "plan";
type Say = { t: string; m: Mood; c?: ClipId };
/** Kayıtlı cümle; ekranda kayda ek bilgi (ör. kazanılan XP) varsa sonuna yazılır, ses yalnızca kaydı okur. */
const sayOf = (c: ClipId, m: Mood, extra = ""): Say => ({ t: extra ? `${CLIPS[c]} ${extra}` : "", m, c });

interface Props {
  list: Lineup[];
  assets: Assets | null;
  maps: MapInfo[];
  mapId: string;
  agentId: string;
  onMap: (id: string) => void;
  onAgent: (id: string) => void;
  onOpen: (id: string) => void;
  onToast: (t: string) => void;
}

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function Ring({ v, size = 64, stroke = 6, children }: { v: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="lrn-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="bg" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, v)))} />
      </svg>
      <span>{children}</span>
    </span>
  );
}

export function Practice({ list, assets, maps, mapId, agentId, onMap, onAgent, onOpen, onToast }: Props) {
  const me = useMe();
  const [mode, setMode] = useState<Mode>("home");
  const pool = useMemo(() => list.filter((l) => (!mapId || l.map === mapId) && (!agentId || l.agent === agentId)), [list, mapId, agentId]);
  const daily = useMemo(() => (list.length ? dailyThree(list) : { day: "", ids: [] as string[], done: [] as string[] }), [list, me.daily]);
  useEffect(() => { if (daily.day) keepDaily(daily); }, [daily]);
  const lv = level(me.xp);
  const st = streak(me);
  const doneCount = list.filter((l) => mastered(l.id)).length;
  const dueN = dueCards(pool).length;
  const quizN = pool.filter((l) => l.steps.some((s) => s.img)).length;

  // Bu haftanın günleri (Pazartesi başlar) ve pratik yapılanlar.
  const week = useMemo(() => {
    const now = Date.now();
    const dow = (new Date(now + 3 * 3_600_000).getUTCDay() + 6) % 7;
    return DAYS.map((n, i) => { const d = today(now + (i - dow) * 86_400_000); return { n, on: me.days.includes(d), now: i === dow, future: i > dow }; });
  }, [me.days]);

  if (mode === "cards") return <Flash pool={pool} assets={assets} maps={maps} onBack={() => setMode("home")} onToast={onToast} />;
  if (mode === "quiz") return <Quiz pool={pool} assets={assets} maps={maps} onBack={() => setMode("home")} onToast={onToast} />;
  if (mode === "plan") return <Plan pool={pool} assets={assets} maps={maps} onBack={() => setMode("home")} onOpen={onOpen} />;

  const agentIds = [...new Set(list.map((l) => l.agent))];
  return (
    <div className="lrn">
      <section className="lrn-hero">
        <div className="lrn-lv">
          <Ring v={lv.into / lv.need} size={72} stroke={6}><b>{lv.lv}</b><small>Seviye</small></Ring>
          <div>
            <strong>{rankOf(lv.lv)}</strong>
            <small>{lv.need - lv.into} XP sonra seviye {lv.lv + 1}</small>
            <small className="dim">Toplam {me.xp} XP</small>
          </div>
        </div>
        <div className="lrn-week">
          <div className="lrn-week-h"><Icon name="flame" size={15} /><b>{st}</b><small>{st ? "günlük seri" : "Bugün başla, seri başlasın"}</small></div>
          <ol>{week.map((d) => <li key={d.n} className={`${d.on ? "on" : ""}${d.now ? " now" : ""}${d.future ? " fut" : ""}`}><i>{d.on && <Icon name="check" size={11} />}</i><small>{d.n}</small></li>)}</ol>
        </div>
        <div className="lrn-done">
          <Ring v={doneCount / Math.max(1, list.length)} size={56} stroke={5}><b>{doneCount}</b></Ring>
          <span><b>Öğrendiğin</b><small>{list.length} lineup'tan</small></span>
        </div>
      </section>

      <section className="lrn-sec">
        <header>
          <h4>Günün üçü</h4>
          <span className="lrn-pill">{daily.done.length}/{daily.ids.length || 3}<i style={{ width: `${(daily.done.length / Math.max(1, daily.ids.length)) * 100}%` }} /></span>
          <small>Hepsini bitir, +25 XP</small>
        </header>
        <div className="lrn-daily">
          {daily.ids.map((id, i) => {
            const l = list.find((x) => x.id === id);
            if (!l) return null;
            const ab = abilityOf(assets, l);
            const ok = daily.done.includes(id);
            const map = maps.find((m) => m.uuid === l.map);
            const ag = assets?.agents.get(l.agent);
            return (
              <button key={id} type="button" className={`lrn-dc ${l.side}${ok ? " ok" : ""}`} onClick={() => onOpen(id)} style={{ animationDelay: `${i * 70}ms`, ...(map?.splash || map?.banner ? { "--bg": `url("${map.splash ?? map.banner}")` } : {}) } as CSSProperties}>
                <span className="lrn-dc-top"><em>{i + 1}</em><span className="lrn-dc-st">{ok ? <><Icon name="check" size={12} />Tamam</> : "Başla"}</span></span>
                <span className="lrn-dc-ab">{ab?.icon && <img src={ab.icon} alt="" />}</span>
                <b>{l.title}</b>
                <small>{ag?.icon && <img src={ag.icon} alt="" />}{ag?.name} · {map?.name}</small>
              </button>
            );
          })}
          {!daily.ids.length && <p className="d none">Kütüphanede lineup olunca burada her gün üç tane seçilir.</p>}
        </div>
      </section>

      <section className="lrn-sec">
        <header>
          <h4>Çalış</h4>
          <span className="lrn-filter">
            <select className="lu-sel" value={mapId} onChange={(e) => onMap(e.target.value)} aria-label="Harita"><option value="">Bütün haritalar</option>{maps.filter((m) => list.some((l) => l.map === m.uuid)).map((m) => <option key={m.uuid} value={m.uuid}>{m.name}</option>)}</select>
            <select className="lu-sel" value={agentId} onChange={(e) => onAgent(e.target.value)} aria-label="Ajan"><option value="">Bütün ajanlar</option>{agentIds.map((id) => <option key={id} value={id}>{assets?.agents.get(id)?.name ?? id}</option>)}</select>
          </span>
        </header>
        <div className="lrn-modes">
          <button type="button" className="lrn-mode m1" onClick={() => setMode("cards")} disabled={!pool.length}>
            <span className="lrn-mi"><Icon name="layers" size={20} /></span>
            <b>Kart kart tekrar</b>
            <small>Duracağın yeri gör, nişan noktasını hatırla.</small>
            <em>{dueN ? `${dueN} kart bekliyor` : `${Math.min(12, pool.length)} kart`}<Icon name="chevron" size={12} /></em>
          </button>
          <button type="button" className="lrn-mode m2" onClick={() => setMode("quiz")} disabled={!quizN}>
            <span className="lrn-mi"><Icon name="target" size={20} /></span>
            <b>Nereye düşer?</b>
            <small>Nişan görseline bak, haritada düşeceği yere tıkla.</small>
            <em>{Math.min(8, quizN)} soru<Icon name="chevron" size={12} /></em>
          </button>
          <button type="button" className="lrn-mode m3" onClick={() => setMode("plan")} disabled={!pool.length}>
            <span className="lrn-mi"><Icon name="play" size={20} /></span>
            <b>Özel oyun planı</b>
            <small>Özel oyunda sırayla dene, olanları işaretle.</small>
            <em>{Math.min(6, pool.length)} lineup<Icon name="chevron" size={12} /></em>
          </button>
        </div>
      </section>

      <section className="lrn-sec">
        <header>
          <h4>Ajanlarım</h4>
          <small>Günün üçü önce bu ajanlardan seçilir</small>
        </header>
        <div className="lrn-mains">
          {agentIds.map((id) => {
            const a = assets?.agents.get(id);
            const on = me.mains.includes(id);
            return <button key={id} type="button" className={on ? "on" : ""} onClick={() => patchMe({ mains: on ? me.mains.filter((x) => x !== id) : [...me.mains, id] })} aria-pressed={on}><img src={a?.icon} alt="" /><span>{a?.name}</span></button>;
          })}
        </div>
      </section>

      <section className="lrn-sec">
        <header><h4>Harita ustalığı</h4></header>
        <div className="lrn-maps">
          {maps.filter((m) => list.some((l) => l.map === m.uuid)).map((m) => {
            const all = list.filter((l) => l.map === m.uuid);
            const n = all.filter((l) => mastered(l.id)).length;
            return (
              <button key={m.uuid} type="button" className="lrn-m" onClick={() => onMap(m.uuid)} style={m.banner ? ({ "--bg": `url("${m.banner}")` } as CSSProperties) : undefined}>
                <span><b>{m.name}</b><small>{n} / {all.length} öğrenildi</small></span>
                <Ring v={n / Math.max(1, all.length)} size={38} stroke={4}><small>{Math.round((n / Math.max(1, all.length)) * 100)}</small></Ring>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kart kart tekrar                                                    */
/* ------------------------------------------------------------------ */

function Flash({ pool, assets, maps, onBack, onToast }: { pool: Lineup[]; assets: Assets | null; maps: MapInfo[]; onBack: () => void; onToast: (t: string) => void }) {
  const queue = useMemo(() => {
    const me = getMe();
    const due = dueCards(pool);
    const fresh = pool.filter((l) => !me.cards[l.id] || (!mastered(l.id) && !due.includes(l)));
    return [...due, ...fresh].slice(0, 12);
  }, [pool]);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [say, setSay] = useState<Say>(sayOf("flash-kart", "happy"));
  const [score, setScore] = useState(0);
  const l = queue[i];
  if (!l) {
    return (
      <div className="lp-run">
        <Head title="Kart kart tekrar" onBack={onBack} />
        <div className="lp-end"><Narrator text={queue.length ? `${CLIPS["gunluk-tekrar-sonu"]} ${queue.length} karttan ${score} tanesini bildin.` : ""} clip={queue.length ? "gunluk-tekrar-sonu" : "kart-yoksa"} mood="flirt" speak={getMe().voice} playing /></div>
        <button type="button" className="x go" onClick={onBack}>Tamam</button>
      </div>
    );
  }
  const map = maps.find((m) => m.uuid === l.map);
  const ab = abilityOf(assets, l);
  const answer = (ok: boolean) => {
    const xp = grade(l.id, ok);
    if (ok) setScore((s) => s + 1);
    setSay(sayOf(ok ? pick(CHEER_OK) : pick(CHEER_BAD), ok ? "wink" : "sad", ok ? `+${xp} XP` : ""));
    if (mastered(l.id) && ok) onToast("Bu lineup'ı öğrendin!");
    setShow(false);
    setI(i + 1);
  };
  return (
    <div className="lp-run">
      <Head title="Kart kart tekrar" onBack={onBack} progress={{ i, n: queue.length }} />
      <div className="lp-card" key={l.id}>
        <div className="lp-card-q">
          <div className="lp-card-tt">
            {ab?.icon && <img src={ab.icon} alt="" />}
            <div><b>{l.title}</b><small>{map?.name} · {siteName(l.site)} · {assets?.agents.get(l.agent)?.name}</small></div>
          </div>
          {map && <MapBoard map={map} assets={assets} lineups={[l]} selected={l.id} focus compact />}
        </div>
        <div className={`lp-card-a${show ? " open" : ""}`}>
          {show ? (
            <div className="lp-shots">
              {l.steps.filter((s) => s.img).map((s, k) => (
                <figure key={k} className="lp-shot" style={{ animationDelay: `${k * 90}ms` }}>
                  <span className="lv-zw"><img src={imgUrl(s.img!)} alt="" />{s.aim && <span className="lv-aim" style={{ left: `${s.aim.x * 100}%`, top: `${s.aim.y * 100}%` }}><i /><i /></span>}</span>
                  {s.text && <figcaption>{s.text}</figcaption>}
                </figure>
              ))}
            </div>
          ) : (
            <button type="button" className="lp-reveal" onClick={() => { setShow(true); setSay(sayOf("cevabi-goster", "wink")); }}>
              <Icon name="eye" size={22} /><b>Cevabı göster</b><small>Önce kafanda canlandır: nereye nişan alıyordun?</small>
            </button>
          )}
        </div>
      </div>
      <div className="lp-foot">
        <Narrator text={say.t} clip={say.c} mood={say.m} speak={getMe().voice} playing={Boolean(say.c)} small />
        {show && <span className="lp-grade"><button type="button" className="x bad" onClick={() => answer(false)}><Icon name="x" size={14} />Bilemedim</button><button type="button" className="x go" onClick={() => answer(true)}><Icon name="check" size={14} />Bildim</button></span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nereye düşer?                                                       */
/* ------------------------------------------------------------------ */

function Quiz({ pool, assets, maps, onBack, onToast }: { pool: Lineup[]; assets: Assets | null; maps: MapInfo[]; onBack: () => void; onToast: (t: string) => void }) {
  const qs = useMemo(() => [...pool.filter((l) => l.steps.some((s) => s.img))].sort(() => Math.random() - 0.5).slice(0, 8), [pool]);
  const [i, setI] = useState(0);
  const [pin, setPin] = useState<Pt | null>(null);
  const [total, setTotal] = useState(0);
  const [say, setSay] = useState<Say>(sayOf("sinav-sorusu", "happy"));
  const l = qs[i];
  if (!l) {
    return (
      <div className="lp-run">
        <Head title="Nereye düşer?" onBack={onBack} />
        <div className="lp-end"><Narrator text={`${CLIPS[total >= qs.length * 15 ? "sinav-sonu" : "dusuk-puanda"]} Toplam ${total} XP kazandın.`} clip={total >= qs.length * 15 ? "sinav-sonu" : "dusuk-puanda"} mood="flirt" speak={getMe().voice} playing /></div>
        <button type="button" className="x go" onClick={onBack}>Tamam</button>
      </div>
    );
  }
  const map = maps.find((m) => m.uuid === l.map);
  const shot = l.steps.find((s) => s.img)!;
  const ab = abilityOf(assets, l);
  const dist = pin ? Math.hypot(pin.x - l.land.x, pin.y - l.land.y) : 0;
  const choose = (p: Pt) => {
    if (pin) return;
    setPin(p);
    const d = Math.hypot(p.x - l.land.x, p.y - l.land.y);
    const ok = d <= 0.05, near = d <= 0.1;
    const xp = grade(l.id, ok);
    const bonus = ok ? 10 : near ? 4 : 0;
    setTotal((t) => t + xp + bonus);
    setSay(sayOf(ok ? pick(CHEER_OK) : near ? pick(CHEER_NEAR) : pick(CHEER_BAD), ok ? "flirt" : near ? "wink" : "sad", xp + bonus > 2 ? `+${xp + bonus} XP` : ""));
    if (ok && mastered(l.id)) onToast("Bu lineup'ı öğrendin!");
  };
  return (
    <div className="lp-run">
      <Head title="Nereye düşer?" onBack={onBack} progress={{ i, n: qs.length }} />
      <div className="lp-quiz" key={l.id}>
        <figure className="lp-qshot">
          <span className="lv-zw"><img src={imgUrl(shot.img!)} alt="" />{shot.aim && <span className="lv-aim" style={{ left: `${shot.aim.x * 100}%`, top: `${shot.aim.y * 100}%` }}><i /><i /></span>}</span>
          <figcaption>{ab?.icon && <img src={ab.icon} alt="" />}{assets?.agents.get(l.agent)?.name} · {ab?.name} · {l.side === "atk" ? "Saldırı" : "Savunma"}</figcaption>
        </figure>
        {map && <MapBoard map={map} assets={assets} lineups={[]} quiz={{ pin, answer: pin ? l.land : null }} onPoint={choose} callouts={!!pin} />}
      </div>
      <div className="lp-foot">
        <Narrator text={say.t} clip={say.c} mood={say.m} speak={getMe().voice} playing={Boolean(say.c)} small />
        {pin && <span className="lp-grade"><small className="lp-dist">{dist <= 0.05 ? "Tam isabet" : dist <= 0.1 ? "Çok yakın" : dist <= 0.2 ? "Biraz uzak" : "Uzak"}</small><button type="button" className="x go" onClick={() => { setPin(null); setI(i + 1); setSay(sayOf("sonraki-soru", "happy")); }}>Sonraki<Icon name="chevron" size={14} /></button></span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Özel oyun planı                                                     */
/* ------------------------------------------------------------------ */

function Plan({ pool, assets, maps, onBack, onOpen }: { pool: Lineup[]; assets: Assets | null; maps: MapInfo[]; onBack: () => void; onOpen: (id: string) => void }) {
  const me = useMe();
  const plan = useMemo(() => [...pool].sort((a, b) => Number(mastered(a.id)) - Number(mastered(b.id)) || a.diff - b.diff).slice(0, 6), [pool]);
  const done = plan.filter((l) => me.tried[l.id]).length;
  const map = maps.find((m) => m.uuid === plan[0]?.map);
  return (
    <div className="lp-run">
      <Head title="Özel oyun planı" onBack={onBack} progress={{ i: done, n: plan.length }} />
      <ol className="lp-howto">
        <li><b>Özel oyun</b> oluştur, haritayı <b>{map?.name ?? "seç"}</b> yap.</li>
        <li>Ayarlar › <b>Hileler</b>'i aç: sınırsız yetenek ve sınırsız mermi.</li>
        <li>Aşağıdaki lineup'ları sırayla aç, her birini <b>2–3 kez</b> dene, olunca işaretle.</li>
      </ol>
      <div className="lp-plan">
        {plan.map((l, i) => {
          const ab = abilityOf(assets, l);
          const ok = Boolean(me.tried[l.id]);
          return (
            <div key={l.id} className={`lp-pi${ok ? " ok" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              <button type="button" className="lp-chk" onClick={() => { markTried(l.id); if (!ok) grade(l.id, true); }} aria-pressed={ok} aria-label="Denedim">{ok && <Icon name="check" size={14} />}</button>
              {ab?.icon && <img src={ab.icon} alt="" />}
              <span><b>{l.title}</b><small>{siteName(l.site)} · {kindName(l.kind)} · {l.diff === 1 ? "Kolay" : l.diff === 2 ? "Orta" : "Zor"}</small></span>
              <button type="button" className="x" onClick={() => onOpen(l.id)}>Aç</button>
            </div>
          );
        })}
      </div>
      {done === plan.length && plan.length > 0 && <Narrator text="" clip="plan-tamam" mood="flirt" speak={getMe().voice} playing small />}
    </div>
  );
}

function Head({ title, onBack, progress }: { title: string; onBack: () => void; progress?: { i: number; n: number } }) {
  return (
    <div className="lp-head">
      <button type="button" className="lv-back" onClick={onBack}><Icon name="chevron" size={16} />Öğren</button>
      <b>{title}</b>
      {progress && progress.n > 0 && (
        <span className="lp-prog"><span><i style={{ width: `${(Math.min(progress.i, progress.n) / progress.n) * 100}%` }} /></span><small>{Math.min(progress.i, progress.n)}/{progress.n}</small></span>
      )}
    </div>
  );
}
