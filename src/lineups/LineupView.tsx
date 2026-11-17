import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Assets, MapInfo } from "../assets";
import { currentPatch } from "../assets";
import { Icon } from "../icons";
import { DIFFS, imgUrl, kindName, patchLineup, siteName, SLOT_KEY, throwName, voteLineup, type Lineup } from "./api";
import { abilityOf, MapBoard } from "./MapBoard";
import { narration, Narrator } from "./Narrator";
import { nameUpper, valUpper } from "./upper";
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
  const [clipOn, setClipOn] = useState(false);
  const agent = assets?.agents.get(l.agent);
  const ab = abilityOf(assets, l);
  const fav = me.fav.includes(l.id);
  const card = me.cards[l.id];
  const ps = patchState(l.patch);

  useEffect(() => { setAt(0); setClipOn(false); setPlaying(getMe().mode === "celeste"); seen(l.id); }, [l.id]);
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
  const openClip = () => { if (!l.clip) return; const u = `https://youtu.be/${l.clip.id}?t=${l.clip.start}`; inTauri ? void openUrl(u) : window.open(u, "_blank"); };

  const s = slides[at]!;
  const step = s.kind === "step" ? l.steps[s.i!]! : null;
  const accent = agent?.colors?.[0] ?? "var(--accent)";

  return (
    <div className={`lv ${l.side}`} style={{ "--ag": accent } as CSSProperties}>
      <div className="lv-top">
        <button type="button" className="lv-back" onClick={onBack}><Icon name="chevron" size={16} />Kütüphane</button>
        {pos && pos.n > 1 && (
          <span className="lv-nav">
            <button type="button" className="ib" onClick={onPrev} aria-label="Önceki lineup"><Icon name="chevron" size={16} /></button>
            <small>{pos.i + 1} / {pos.n}</small>
            <button type="button" className="ib flip" onClick={onNext} aria-label="Sonraki lineup"><Icon name="chevron" size={16} /></button>
          </span>
        )}
      </div>

      <header className="lv-head">
        <span className="lv-ab">
          {ab?.icon ? <img src={ab.icon} alt="" /> : null}
          <kbd>{SLOT_KEY[l.slot]}</kbd>
        </span>
        <div className="lv-ttl">
          <h3>{valUpper(l.title)}</h3>
          <div className="lv-chips">
            {agent && <span className="lc ag"><img src={agent.icon} alt="" />{nameUpper(agent.name)}</span>}
            <span className="lc">{valUpper(ab?.name ?? l.slot)}</span>
            <span className={`lc side ${l.side}`}>{l.side === "atk" ? "Saldırı" : "Savunma"}</span>
            {l.site && <span className="lc">{siteName(l.site)}</span>}
            <span className="lc">{kindName(l.kind)}</span>
            <span className="lc">{throwName(l.throw)}</span>
            <span className={`lc diff d${l.diff}`} title="Zorluk"><i /><i /><i />{DIFFS.find(([d]) => d === l.diff)?.[1]}</span>
            {ps && <span className={`lc patch ${ps}`} title={ps === "now" ? "Bu yamada denendi" : "Eski bir yamada eklendi; değişmiş olabilir"}>Yama {l.patch}</span>}
            {l.official ? <span className="lc off"><Icon name="spark" size={12} />Celeste</span> : <span className="lc">{l.by || "Topluluk"}</span>}
            {card && card.box >= 3 && <span className="lc mast"><Icon name="check" size={12} />Öğrendin</span>}
          </div>
        </div>
      </header>

      {l.broken > l.works && l.broken >= 3 && <p className="lv-warn"><Icon name="info" size={14} />Bazı oyuncular bu lineup'ın son yamada çalışmadığını söylüyor.</p>}

      <div className="lv-stage">
        <div className="lv-bars" role="tablist" aria-label="Adımlar">
          {slides.map((x, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === at} className={i < at ? "done" : i === at ? `on${playing ? " run" : ""}` : ""} onClick={() => { setPlaying(false); setAt(i); }}>
              <span>{x.kind === "map" ? "Harita" : x.kind === "clip" ? "Klip" : `${(x.i ?? 0) + 1}. adım`}</span>
              <i />
            </button>
          ))}
        </div>

        <div className="lv-slide" key={`${l.id}-${at}`}>
          {s.kind === "map" && map && (
            <div className="lv-map">
              <MapBoard map={map} assets={assets} lineups={[l]} selected={l.id} focus compact />
              <ul className="lv-legend">
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
                {step.aim && (
                  <span className="lv-aim" style={{ left: `${step.aim.x * 100}%`, top: `${step.aim.y * 100}%` }}>
                    <i /><i /><b>Buraya nişan al</b>
                  </span>
                )}
                <span className="lv-num">{(s.i ?? 0) + 1}</span>
              </button>
            ) : <div className="lv-textstep"><span className="lv-num">{(s.i ?? 0) + 1}</span><p>{step.text}</p></div>
          )}
          {s.kind === "clip" && l.clip && (
            clipOn ? (
              <div className="lv-clip">
                <iframe
                  title="Lineup klibi"
                  src={`https://www.youtube-nocookie.com/embed/${l.clip.id}?start=${l.clip.start}&end=${l.clip.end}&autoplay=1&mute=1&loop=1&playlist=${l.clip.id}&rel=0&modestbranding=1&playsinline=1`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <button type="button" className="lv-clipthumb" onClick={() => setClipOn(true)}>
                <img src={`https://i.ytimg.com/vi/${l.clip.id}/hqdefault.jpg`} alt="" />
                <span className="lv-play"><Icon name="play" size={26} /></span>
                <small>{l.clip.end - l.clip.start} sn · burada oynat</small>
              </button>
            )
          )}
          {at > 0 && <button type="button" className="lv-arrow l" onClick={() => { setPlaying(false); setAt(at - 1); }} aria-label="Önceki adım"><Icon name="chevron" size={22} /></button>}
          {at < slides.length - 1 && <button type="button" className="lv-arrow r" onClick={() => { setPlaying(false); setAt(at + 1); }} aria-label="Sonraki adım"><Icon name="chevron" size={22} /></button>}
        </div>

        <div className="lv-say">
          {me.mode === "celeste"
            ? <Narrator text={lines[at]!.text} mood={lines[at]!.mood} speak={me.voice} playing={playing} onDone={advance} />
            : <p className="lv-plain">{s.kind === "map" ? <>Haritada parlayan yere geç. Ok, yeteneğin nereye düşeceğini gösteriyor.{l.note && <><br /><b>Ne zaman:</b> {l.note}</>}</> : s.kind === "clip" ? "Klipte izle, sonra özel oyunda dene." : step?.text || "Görseldeki gibi dur ve halkaya nişan al."}</p>}
          <div className="lv-ctl">
            {me.mode === "celeste" && (
              <button type="button" className={`x${playing ? " on" : " go"}`} onClick={() => { if (!playing && finished) setAt(0); setPlaying(!playing); }}>
                <Icon name={playing ? "pause" : "play"} size={14} />{playing ? "Duraklat" : finished ? "Baştan anlat" : "Anlat"}
              </button>
            )}
            {s.kind === "clip" && <button type="button" className="x" onClick={openClip}><Icon name="link" size={14} />YouTube'da aç</button>}
          </div>
        </div>
      </div>

      <div className="lv-acts">
        <button type="button" className={`la${fav ? " on fav" : ""}`} onClick={() => onToast(toggleFav(l.id) ? "Setine eklendi" : "Setinden çıkarıldı")}><Icon name="spark" size={15} />{fav ? "Setimde" : "Setime ekle"}</button>
        <button type="button" className={`la${votes.has(`${l.id}:up`) ? " on" : ""}`} onClick={() => void vote("up")}><Icon name="bolt" size={15} />{l.up || ""} Beğen</button>
        <span className="la-sep" />
        <button type="button" className={`la ok${votes.has(`${l.id}:works`) ? " on" : ""}`} onClick={() => void vote("works")} title="Bu yamada denedim, çalışıyor"><Icon name="check" size={15} />Çalışıyor{l.works ? ` · ${l.works}` : ""}</button>
        <button type="button" className={`la bad${votes.has(`${l.id}:broken`) ? " on" : ""}`} onClick={() => void vote("broken")} title="Denedim, artık çalışmıyor"><Icon name="x" size={15} />Çalışmıyor</button>
        <span className="la-sep" />
        <button type="button" className={`la${me.tried[l.id] ? " on" : ""}`} onClick={() => { markTried(l.id); if (!getMe().tried[l.id]) return; const xp = grade(l.id, true); onToast(`Denedin, harika! +${xp} XP`); }}><Icon name="target" size={15} />Özel oyunda denedim</button>
        <button type="button" className="la" onClick={() => void share()}><Icon name="link" size={15} />Paylaş</button>
        {canEdit && <button type="button" className="la" onClick={onEdit}><Icon name="sliders" size={15} />Düzenle</button>}
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
