import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Assets, MapInfo } from "../assets";
import { currentPatch } from "../assets";
import { Icon } from "../icons";
import { DIFFS, imgUrl, kindName, patchLineup, siteName, SLOT_KEY, throwName, voteLineup, type Lineup } from "./api";
import { abilityOf, MapBoard } from "./MapBoard";
import { narration, Narrator } from "./Narrator";
import { dailyDone, getMe, grade, markTried, seen, shareCode, toggleFav, useMe } from "./store";

/* Lineup ayrıntısı: hikâye gibi adım adım. 1) haritada nerede dur, nereye düşer 2) ekran görüntülerinde nişan noktası
   3) varsa klip. Celeste anlatırken adımlar kendiliğinden ilerler; istersen kendin gezersin (← → tuşları). */

const inTauri = "__TAURI_INTERNALS__" in window;
type Slide = { kind: "map" | "step" | "clip"; i?: number };

interface Props {
  l: Lineup;
  assets: Assets | null;
  map: MapInfo | undefined;
  votes: Set<string>;
  onVotes: (fn: (v: Set<string>) => Set<string>) => void;
  canEdit: boolean;
  pos?: { i: number; n: number };
  onPrev?: () => void;
  onNext?: () => void;
  onBack: () => void;
  onEdit: () => void;
  onToast: (t: string) => void;
}

export function patchState(p: string): "now" | "old" | "" {
  const cur = currentPatch();
  if (!p || !cur) return "";
  const [a, b] = p.split(".").map(Number), [c, d] = cur.split(".").map(Number);
  if (a === c && b === d) return "now";
  return (c! - a!) * 12 + (d! - b!) >= 3 ? "old" : "now";
}

export function LineupView({ l, assets, map, votes, onVotes, canEdit, pos, onPrev, onNext, onBack, onEdit, onToast }: Props) {
  const me = useMe();
  const slides = useMemo<Slide[]>(() => [{ kind: "map" }, ...l.steps.map((_, i) => ({ kind: "step" as const, i })), ...(l.clip ? [{ kind: "clip" as const }] : [])], [l]);
  const lines = useMemo(() => narration(l, assets, slides), [l, assets, slides]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(me.mode === "celeste");
  const [zoom, setZoom] = useState<string | null>(null);
  const agent = assets?.agents.get(l.agent);
  const ab = abilityOf(assets, l);
  const fav = me.fav.includes(l.id);
  const card = me.cards[l.id];
  const ps = patchState(l.patch);

  useEffect(() => { setAt(0); setBig(false); setPlaying(getMe().mode === "celeste"); seen(l.id); }, [l.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") { setPlaying(false); setAt((a) => Math.min(slides.length - 1, a + 1)); }
      if (e.key === "ArrowLeft") { setPlaying(false); setAt((a) => Math.max(0, a - 1)); }
      if (e.key === "Escape") zoom ? setZoom(null) : onBack();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [slides.length, zoom, onBack]);

  const finished = at === slides.length - 1;
  const advance = () => {
    if (at < slides.length - 1) setAt(at + 1);
    else {
      setPlaying(false);
      if (dailyDone(l.id)) onToast("Günün 3 lineup'ı tamam! +25 XP");
    }
  };

  const vote = async (kind: "up" | "works" | "broken") => {
    try {
      const r = await voteLineup(l.id, kind);
      patchLineup(l.id, { up: r.up, works: r.works, broken: r.broken });
      onVotes((v) => {
        const n = new Set(v);
        const k = `${l.id}:${kind}`;
        if (r.on) n.add(k); else n.delete(k);
        if (r.on && kind !== "up") n.delete(`${l.id}:${kind === "works" ? "broken" : "works"}`);
        return n;
      });
      if (r.on) onToast(kind === "up" ? "Beğendin" : kind === "works" ? "Teşekkürler, çalıştığını işaretledin" : "Bildirildi, kontrol edeceğiz");
    } catch (e) { onToast(e instanceof Error ? e.message : String(e)); }
  };
  const share = async () => {
    const text = `${shareCode([l.id])}  ·  ${l.title} (${agent?.name ?? ""}, ${map?.name ?? ""}) · Celeste Overlay › Lineup › Kod ile ekle`;
    try {
      if (inTauri) { const { writeText } = await import("@tauri-apps/plugin-clipboard-manager"); await writeText(text); }
      else await navigator.clipboard.writeText(text);
      onToast("Paylaşım kodu kopyalandı");
    } catch { onToast("Kopyalanamadı"); }
  };
  // Klip tam ekranı: önce tarayıcı tam ekranı, olmazsa pencereyi dolduran büyük görünüm. Esc ile çıkılır.
  const clipBox = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState(false);
  const toggleBig = () => {
    if (big) { if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); setBig(false); return; }
    setBig(true);
    void clipBox.current?.requestFullscreen?.().catch(() => undefined);
  };
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setBig(false); } };
    const fs = () => { if (!document.fullscreenElement) setBig(false); };
    window.addEventListener("keydown", key, true);
    document.addEventListener("fullscreenchange", fs);
    return () => { window.removeEventListener("keydown", key, true); document.removeEventListener("fullscreenchange", fs); };
  }, [big]);

  const s = slides[at]!;
  const step = s.kind === "step" ? l.steps[s.i!]! : null;
  const accent = agent?.colors?.[0] ?? "var(--accent)";
  const celeste = me.mode === "celeste";
  const go = (i: number) => { setPlaying(false); setAt(Math.max(0, Math.min(slides.length - 1, i))); };
  const label = (x: Slide) => (x.kind === "map" ? "Yerini bul" : x.kind === "clip" ? "Klipte izle" : `${(x.i ?? 0) + 1}. adım`);
  const sub = (x: Slide) => {
    if (x.kind === "map") return "Haritada parlayan yerde dur";
    if (x.kind === "clip") return l.clip ? `${l.clip.end - l.clip.start} saniyelik klip` : "";
    const st = l.steps[x.i ?? 0];
    return st?.text || (st?.aim ? "Halkaya nişan al" : "Görseldeki gibi dur");
  };

  return (
    <div className={`ld ${l.side}`} style={{ "--ag": accent } as CSSProperties}>
      <div className="ld-top">
        <button type="button" className="lv-back" onClick={onBack}><Icon name="chevron" size={16} />Kütüphane</button>
        {pos && pos.n > 1 && (
          <span className="lv-nav">
            <button type="button" className="ib" onClick={onPrev} aria-label="Önceki lineup"><Icon name="chevron" size={16} /></button>
            <small>{pos.i + 1} / {pos.n}</small>
            <button type="button" className="ib flip" onClick={onNext} aria-label="Sonraki lineup"><Icon name="chevron" size={16} /></button>
          </span>
        )}
      </div>

      <div className="ld-grid">
        {/* sol: görsel */}
        <div className="ld-media">
          <div className="ld-slide" key={`${l.id}-${at}`}>
            {s.kind === "map" && map && (
              <div className="ld-map">
                <MapBoard map={map} assets={assets} lineups={[l]} selected={l.id} focus compact />
                <ul className="ld-legend">
                  <li><span className={`lgd stand ${l.side}`} />Burada dur</li>
                  <li><span className="lgd arc" />Atış yolu</li>
                  <li><span className={`lgd land ${l.side}`} />Buraya düşer</li>
                </ul>
              </div>
            )}
            {s.kind === "step" && step && (
              step.img ? (
                <button type="button" className="lv-shot" onClick={() => setZoom(step.img)} aria-label="Büyüt">
                  <img src={imgUrl(step.img)} alt={step.text || `Adım ${(s.i ?? 0) + 1}`} draggable={false} />
                  {step.aim && <span className="lv-aim" style={{ left: `${step.aim.x * 100}%`, top: `${step.aim.y * 100}%` }}><i /><i /><b>Buraya nişan al</b></span>}
                  <span className="ld-zoomhint"><Icon name="expand" size={13} />Büyüt</span>
                </button>
              ) : <div className="lv-textstep"><p>{step.text}</p></div>
            )}
            {s.kind === "clip" && l.clip && (
              <div className={`lv-clip${big ? " big" : ""}`} ref={clipBox}>
                <iframe
                  title="Lineup klibi"
                  src={`https://www.youtube-nocookie.com/embed/${l.clip.id}?start=${l.clip.start}&end=${l.clip.end}&autoplay=1&mute=1&loop=1&playlist=${l.clip.id}&rel=0&modestbranding=1&playsinline=1&fs=1`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <button type="button" className="lv-fs" onClick={toggleBig} aria-label={big ? "Tam ekrandan çık" : "Tam ekran"} title={big ? "Tam ekrandan çık (Esc)" : "Tam ekran"}><Icon name={big ? "x" : "expand"} size={15} /></button>
              </div>
            )}
          </div>
          {slides.length > 1 && (
            <div className="ld-pager">
              <button type="button" className="ib" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Önceki adım"><Icon name="chevron" size={16} /></button>
              <span className="ld-dots">{slides.map((_, i) => <i key={i} className={i === at ? "on" : i < at ? "done" : ""} onClick={() => go(i)} />)}</span>
              <button type="button" className="ib flip" onClick={() => go(at + 1)} disabled={at === slides.length - 1} aria-label="Sonraki adım"><Icon name="chevron" size={16} /></button>
            </div>
          )}
        </div>

        {/* sağ: bilgi, adımlar, Celeste */}
        <aside className="ld-side">
          <header className="ld-head">
            <span className="lv-ab">{ab?.icon ? <img src={ab.icon} alt="" /> : null}<kbd>{SLOT_KEY[l.slot]}</kbd></span>
            <div>
              <h3>{l.title}</h3>
              <p className="ld-sub">{agent && <img src={agent.icon} alt="" />}{agent?.name ?? "Ajan"} · {ab?.name ?? l.slot}</p>
            </div>
          </header>
          <div className="ld-meta">
            <span className={`ld-pill side ${l.side}`}><i />{l.side === "atk" ? "Saldırı" : "Savunma"}</span>
            {l.site && <span className="ld-pill">{siteName(l.site)}</span>}
            <span className="ld-pill">{kindName(l.kind)}</span>
            <span className="ld-pill">{throwName(l.throw)}</span>
            <span className={`ld-pill diff d${l.diff}`}><i /><i /><i />{DIFFS.find(([d]) => d === l.diff)?.[1]}</span>
          </div>
          <p className="ld-by">
            {l.official ? <><Icon name="spark" size={12} />Celeste lineup'ı</> : <><Icon name="user" size={12} />{l.by || "Topluluk"}</>}
            {ps && <span className={ps === "old" ? "old" : ""} title={ps === "now" ? "Bu yamada eklendi" : "Eski bir yamada eklendi; değişmiş olabilir"}>· Yama {l.patch}</span>}
            {card && card.box >= 3 && <span className="ok">· Öğrendin</span>}
          </p>
          {l.broken > l.works && l.broken >= 3 && <p className="lv-warn"><Icon name="info" size={14} />Bazı oyuncular son yamada çalışmadığını söylüyor.</p>}

          <ol className="ld-steps">
            {slides.map((x, i) => (
              <li key={i} className={i === at ? "on" : i < at ? "done" : ""}>
                <button type="button" onClick={() => go(i)} aria-current={i === at ? "step" : undefined}>
                  <em>{i < at ? <Icon name="check" size={12} /> : x.kind === "map" ? <Icon name="map" size={12} /> : x.kind === "clip" ? <Icon name="play" size={11} /> : (x.i ?? 0) + 1}</em>
                  <span><b>{label(x)}</b><small>{sub(x)}</small></span>
                </button>
              </li>
            ))}
          </ol>

          <div className="ld-say">
            {celeste
              ? <Narrator text={lines[at]!.text} clip={lines[at]!.clip} mood={lines[at]!.mood} speak={me.voice} playing={playing} onDone={advance} small />
              : <p className="lv-plain">{s.kind === "map" ? <>Haritada parlayan yere geç. Ok yönü, yeteneğin nereye düşeceğini gösteriyor.{l.note && <><br /><b>Ne zaman:</b> {l.note}</>}</> : s.kind === "clip" ? "Klipte izle, sonra özel oyunda dene." : step?.text || "Görseldeki gibi dur, kıpırdama!"}</p>}
            {celeste && s.kind === "map" && l.note && <p className="lv-plain"><b>Ne zaman:</b> {l.note}</p>}
            <div className="ld-ctl">
              {celeste && (
                <button type="button" className={`ld-play${playing ? " on" : ""}`} onClick={() => { if (!playing && finished) setAt(0); setPlaying(!playing); }}>
                  <Icon name={playing ? "pause" : "play"} size={14} />{playing ? "Duraklat" : finished ? "Baştan anlat" : "Anlat"}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="ld-acts">
        <button type="button" className={`ld-btn main${fav ? " on" : ""}`} onClick={() => onToast(toggleFav(l.id) ? "Setine eklendi" : "Setinden çıkarıldı")}><Icon name="star" size={15} />{fav ? "Setimde" : "Setime ekle"}</button>
        <button type="button" className={`ld-btn${votes.has(`${l.id}:up`) ? " on" : ""}`} onClick={() => void vote("up")}><Icon name="heart" size={15} />Beğen{l.up ? <small>{l.up}</small> : null}</button>
        <span className="ld-works">
          <small>Çalışıyor mu?</small>
          <button type="button" className={`ok${votes.has(`${l.id}:works`) ? " on" : ""}`} onClick={() => void vote("works")} title="Bu yamada denedim, çalışıyor"><Icon name="check" size={14} />{l.works || ""}</button>
          <button type="button" className={`bad${votes.has(`${l.id}:broken`) ? " on" : ""}`} onClick={() => void vote("broken")} title="Denedim, artık çalışmıyor"><Icon name="x" size={14} /></button>
        </span>
        <span className="ld-acts-r">
          <button type="button" className={`ld-ghost${me.tried[l.id] ? " on" : ""}`} onClick={() => { markTried(l.id); if (!getMe().tried[l.id]) return; const xp = grade(l.id, true); onToast(`Denedin, harika! +${xp} XP`); }} title="Özel oyunda denedim"><Icon name="target" size={14} />Denedim</button>
          <button type="button" className="ld-ghost" onClick={() => void share()} title="Paylaşım kodunu kopyala"><Icon name="link" size={14} />Paylaş</button>
          {canEdit && <button type="button" className="ld-ghost" onClick={onEdit}><Icon name="sliders" size={14} />Düzenle</button>}
        </span>
      </div>

      {zoom && (
        <button type="button" className="lv-zoom" onClick={() => setZoom(null)} aria-label="Kapat">
          <span className="lv-zw">
            <img src={imgUrl(zoom)} alt="" />
            {step?.aim && step.img === zoom && <span className="lv-aim big" style={{ left: `${step.aim.x * 100}%`, top: `${step.aim.y * 100}%` }}><i /><i /></span>}
          </span>
        </button>
      )}
    </div>
  );
}
