import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Assets, MapInfo } from "../assets";
import { Icon } from "../icons";
import type { Mood } from "../Mascot";
import { imgUrl, kindName, siteName, type Lineup, type Pt } from "./api";
import { abilityOf, MapBoard } from "./MapBoard";
import { Narrator } from "./Narrator";
import { dailyThree, dueCards, keepDaily, getMe, grade, level, markTried, mastered, rankOf, streak, useMe } from "./store";

/* Öğren: günün üç lineup'ı, kart kart tekrar (aralıklı), "Nereye düşer?" sınavı, özel oyun planı ve ustalık.
   Her şey bu bilgisayarda tutulur. */

type Mode = "home" | "cards" | "quiz" | "plan";
const CHEER_OK = ["İşte bu! Ezberledin bile.", "Tam isabet! Sen bu işi biliyorsun.", "Mükemmel. Bir sonrakine geçelim mi?", "Vay, gözüm kamaştı!"];
const CHEER_NEAR = ["Çok yakındı! Biraz daha.", "Neredeyse! Bir daha bak.", "Az kaldı, yaklaştın."];
const CHEER_BAD = ["Olsun, şimdi gördün. Bir dahakine bilirsin.", "Bu zor biriydi. Tekrar sorarım, merak etme.", "Hmm, burası değildi. Birlikte öğreniriz."];
const pickOne = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;

interface Props {
  list: Lineup[];
  assets: Assets | null;
  maps: MapInfo[];
  mapId: string;
  agentId: string;
  onOpen: (id: string) => void;
  onToast: (t: string) => void;
}

export function Practice({ list, assets, maps, mapId, agentId, onOpen, onToast }: Props) {
  const me = useMe();
  const [mode, setMode] = useState<Mode>("home");
  const pool = useMemo(() => list.filter((l) => (!mapId || l.map === mapId) && (!agentId || l.agent === agentId)), [list, mapId, agentId]);
  const daily = useMemo(() => (list.length ? dailyThree(list) : { day: "", ids: [] as string[], done: [] as string[] }), [list, me.daily]);
  useEffect(() => { if (daily.day) keepDaily(daily); }, [daily]);
  const lv = level(me.xp);
  const st = streak(me);
  const doneCount = list.filter((l) => mastered(l.id)).length;
  const dueN = dueCards(pool).length;

  if (mode === "cards") return <Flash pool={pool} assets={assets} maps={maps} onBack={() => setMode("home")} onToast={onToast} />;
  if (mode === "quiz") return <Quiz pool={pool} assets={assets} maps={maps} onBack={() => setMode("home")} onToast={onToast} />;
  if (mode === "plan") return <Plan pool={pool} assets={assets} maps={maps} onBack={() => setMode("home")} onOpen={onOpen} />;

  return (
    <div className="lp">
      <div className="lp-hero">
        <div className="lp-lv">
          <span className="lp-badge"><b>{lv.lv}</b><small>Seviye</small></span>
          <div>
            <strong>{rankOf(lv.lv)}</strong>
            <div className="lp-xp"><i style={{ width: `${(lv.into / lv.need) * 100}%` }} /></div>
            <small>{lv.into} / {lv.need} XP · toplam {me.xp}</small>
          </div>
        </div>
        <div className={`lp-st${st ? " on" : ""}`}><Icon name="bolt" size={18} /><b>{st}</b><small>günlük seri</small></div>
        <div className="lp-st"><Icon name="check" size={18} /><b>{doneCount}</b><small>öğrendiğin</small></div>
      </div>

      <section className="lp-daily">
        <h4><Icon name="spark" size={15} />Günün 3 lineup'ı <small>{daily.done.length}/{daily.ids.length} · hepsini bitir, +25 XP</small></h4>
        <div className="lp-dgrid">
          {daily.ids.map((id, i) => {
            const l = list.find((x) => x.id === id);
            if (!l) return null;
            const ab = abilityOf(assets, l);
            const ok = daily.done.includes(id);
            const map = maps.find((m) => m.uuid === l.map);
            return (
              <button key={id} type="button" className={`lp-dc${ok ? " ok" : ""}`} onClick={() => onOpen(id)} style={{ animationDelay: `${i * 70}ms`, ...(map?.banner ? { "--bg": `url(${map.banner})` } : {}) } as CSSProperties}>
                <span className="lp-dc-ab">{ab?.icon && <img src={ab.icon} alt="" />}</span>
                <span className="lp-dc-t"><b>{l.title}</b><small>{map?.name} · {assets?.agents.get(l.agent)?.name} · {kindName(l.kind)}</small></span>
                <span className="lp-dc-ok">{ok ? <Icon name="check" size={16} /> : <Icon name="play" size={14} />}</span>
              </button>
            );
          })}
          {!daily.ids.length && <p className="d none">Kütüphanede lineup olunca burada her gün üç tane seçilir.</p>}
        </div>
      </section>

      <div className="lp-modes">
        <button type="button" className="lp-mode m1" onClick={() => setMode("cards")} disabled={!pool.length}>
          <span className="lp-mi"><Icon name="layers" size={22} /></span>
          <b>Kart kart tekrar</b>
          <small>Duracağın yeri görürsün, nişan noktasını hatırlarsın. Bildiklerin seyrekleşir, bilemediklerin sık gelir.</small>
          {dueN > 0 && <em>{dueN} kart tekrar bekliyor</em>}
        </button>
        <button type="button" className="lp-mode m2" onClick={() => setMode("quiz")} disabled={!pool.some((l) => l.steps.some((s) => s.img))}>
          <span className="lp-mi"><Icon name="target" size={22} /></span>
          <b>Nereye düşer?</b>
          <small>Nişan görselini görürsün, haritada nereye düşeceğine tıklarsın. Ne kadar yakınsa o kadar XP.</small>
        </button>
        <button type="button" className="lp-mode m3" onClick={() => setMode("plan")} disabled={!pool.length}>
          <span className="lp-mi"><Icon name="play" size={22} /></span>
          <b>Özel oyun planı</b>
          <small>Özel oyunda sırayla deneyeceğin lineup listesi. Denediklerini işaretle.</small>
        </button>
      </div>

      <section className="lp-mastery">
        <h4><Icon name="chart" size={15} />Ustalık</h4>
        <div className="lp-mgrid">
          {maps.filter((m) => list.some((l) => l.map === m.uuid)).map((m) => {
            const all = list.filter((l) => l.map === m.uuid);
            const n = all.filter((l) => mastered(l.id)).length;
            return (
              <div key={m.uuid} className="lp-m" style={m.banner ? ({ "--bg": `url(${m.banner})` } as CSSProperties) : undefined}>
                <b>{m.name}</b><small>{n}/{all.length}</small>
                <span className="lp-mbar"><i style={{ width: `${(n / Math.max(1, all.length)) * 100}%` }} /></span>
              </div>
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
  const [say, setSay] = useState<{ t: string; m: Mood }>({ t: "Duracağın yere bak. Nişan noktasını hatırlıyor musun?", m: "happy" });
  const [score, setScore] = useState(0);
  const l = queue[i];
  if (!l) {
    return (
      <div className="lp-run">
        <Head title="Kart kart tekrar" onBack={onBack} />
        <div className="lp-end"><Narrator text={queue.length ? `Bitti! ${queue.length} karttan ${score} tanesini bildin. Yarın tekrar sorarım.` : "Şimdilik tekrar edilecek kart yok. Kütüphaneden yeni lineup aç, sonra buraya gel!"} mood="flirt" speak={getMe().voice} playing={false} /></div>
        <button type="button" className="x go" onClick={onBack}>Tamam</button>
      </div>
    );
  }
  const map = maps.find((m) => m.uuid === l.map);
  const ab = abilityOf(assets, l);
  const answer = (ok: boolean) => {
    const xp = grade(l.id, ok);
    if (ok) setScore((s) => s + 1);
    setSay({ t: ok ? `${pickOne(CHEER_OK)} +${xp} XP` : pickOne(CHEER_BAD), m: ok ? "wink" : "sad" });
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
            <button type="button" className="lp-reveal" onClick={() => { setShow(true); setSay({ t: "Hatırladığınla aynı mı? Dürüst ol!", m: "wink" }); }}>
              <Icon name="eye" size={22} /><b>Cevabı göster</b><small>Önce kafanda canlandır: nereye nişan alıyordun?</small>
            </button>
          )}
        </div>
      </div>
      <div className="lp-foot">
        <Narrator text={say.t} mood={say.m} speak={getMe().voice} playing={false} small />
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
  const [say, setSay] = useState<{ t: string; m: Mood }>({ t: "Bu görsele göre yetenek haritada nereye düşer? Tıkla bakalım.", m: "happy" });
  const l = qs[i];
  if (!l) {
    return (
      <div className="lp-run">
        <Head title="Nereye düşer?" onBack={onBack} />
        <div className="lp-end"><Narrator text={`Sınav bitti! Toplam ${total} XP kazandın. ${total >= qs.length * 15 ? "Harita senin evin olmuş!" : "Biraz daha pratikle tam olacak."}`} mood="flirt" speak={getMe().voice} playing={false} /></div>
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
    setSay({ t: `${ok ? pickOne(CHEER_OK) : near ? pickOne(CHEER_NEAR) : pickOne(CHEER_BAD)}${xp + bonus > 2 ? ` +${xp + bonus} XP` : ""}`, m: ok ? "flirt" : near ? "wink" : "sad" });
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
        <Narrator text={say.t} mood={say.m} speak={getMe().voice} playing={false} small />
        {pin && <span className="lp-grade"><small className="lp-dist">{dist <= 0.05 ? "Tam isabet" : dist <= 0.1 ? "Çok yakın" : dist <= 0.2 ? "Biraz uzak" : "Uzak"}</small><button type="button" className="x go" onClick={() => { setPin(null); setI(i + 1); setSay({ t: "Sıradaki! Nereye düşer?", m: "happy" }); }}>Sonraki<Icon name="chevron" size={14} /></button></span>}
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
      {done === plan.length && plan.length > 0 && <Narrator text="Plan tamam! Artık maçta kullanma zamanı. Ben buradayım." mood="flirt" speak={getMe().voice} playing={false} small />}
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
