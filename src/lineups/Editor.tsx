import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import type { Assets } from "../assets";
import { currentPatch } from "../assets";
import { Icon } from "../icons";
import type { Mood } from "../Mascot";
import { DIFFS, editLineup, imgUrl, kindName, KINDS, parseYoutube, siteName, SIDES, sitesFor, SLOT_KEY, submitLineup, THROWS, uploadShot, type Lineup, type LineupDraft, type Pt, type Slot, type Step } from "./api";
import { MapBoard } from "./MapBoard";
import { Narrator } from "./Narrator";
import { CHEER_STEP, joinClip, pick as pickOne, type ClipId } from "./voice";
import { getMe } from "./store";

/* Lineup ekleme / düzenleme: beş kısa adım. Her adımda tek iş var; Celeste ne yapılacağını söyler,
   adım bitince sevinip bir sonrakini açar. Tamamlanan adımlar üstteki şeritte özet olarak kalır, tıklayınca geri dönülür.
   Ekran görüntüsü Ctrl+V ile yapıştırılır, sürüklenir ya da seçilir. Yönetici gönderisi doğrudan yayına girer. */

interface Props {
  assets: Assets | null;
  admin: boolean;
  start?: Partial<LineupDraft>;
  editing?: Lineup | null;
  onDone: (id: string, status: string) => void;
  onCancel: () => void;
  onToast: (t: string) => void;
}

type ShotState = Step & { busy?: boolean; local?: string };
const blank = (): ShotState => ({ img: null, text: "", aim: null });

const STEPS = ["Ajan", "Harita", "İşaretle", "Görseller", "Son dokunuş"] as const;
const LAST = STEPS.length - 1;
/* Tek görsel yeter: "Nereye nişan aldığın". Nerede durduğun zaten haritada işaretli, bu yüzden isteğe bağlı. */
const SHOT_HINT = ["Nerede durduğun", "Nereye nişan aldığın", "Ek görsel", "Ek görsel"];
const SHOT_NEED = ["isteğe bağlı", "zorunlu", "isteğe bağlı", "isteğe bağlı"];
const inTauri = "__TAURI_INTERNALS__" in window;

export function Editor({ assets, admin, start, editing, onDone, onCancel, onToast }: Props) {
  const maps = assets?.mapList ?? [];
  const agents = useMemo(() => [...(assets?.agents.entries() ?? [])].sort((a, b) => a[1].name.localeCompare(b[1].name, "tr")), [assets]);
  const init = editing ?? start ?? {};
  const [d, setD] = useState<Omit<LineupDraft, "steps">>({
    map: init.map ?? maps[0]?.uuid ?? "", agent: init.agent ?? "", slot: (init.slot as Slot) ?? "Grenade", side: init.side ?? "atk", site: init.site ?? "A", kind: init.kind ?? "execute",
    title: init.title ?? "", note: init.note ?? "", throw: init.throw ?? "stand", diff: init.diff ?? 2, stand: init.stand ?? null, land: init.land ?? null,
    clip: init.clip ?? null, patch: init.patch || currentPatch(), alt: init.alt ?? "",
  });
  const [steps, setSteps] = useState<ShotState[]>(init.steps?.length ? init.steps.map((s) => ({ ...s })) : [blank(), blank()]);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(editing ? LAST : 0);
  const [cheer, setCheer] = useState<{ at: number; clip: ClipId; base?: string } | null>(null);
  const [abPicked, setAbPicked] = useState(Boolean(editing));
  const [pick, setPick] = useState<"stand" | "land" | null>(d.stand ? null : "stand");
  const [aimAt, setAimAt] = useState<number | null>(null);
  const [clipRaw, setClipRaw] = useState(init.clip ? `https://youtu.be/${init.clip.id}?t=${init.clip.start}` : "");
  const [more, setMore] = useState(Boolean(init.clip || init.note));
  const [agentQ, setAgentQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileFor = useRef<number>(0);
  const autoDone = useRef(new Set<number>());
  const stepRef = useRef(step);
  stepRef.current = step;
  const map = maps.find((m) => m.uuid === d.map);
  const agent = assets?.agents.get(d.agent);
  const ability = agent?.abilities?.find((x) => x.slot === d.slot);
  const up = (p: Partial<typeof d>) => { setD((x) => ({ ...x, ...p })); setErr(null); };

  /* ---------- adım geçerliliği ---------- */
  const shots = steps.filter((s) => s.img).length;
  const valid = [
    Boolean(d.agent && abPicked),
    Boolean(d.map),
    Boolean(d.stand && d.land),
    shots > 0 && !steps.some((s) => s.busy),
    d.title.trim().length >= 3,
  ];
  const firstBad = valid.findIndex((v) => !v);

  const goTo = (i: number) => { if (i <= reached || editing) { setStep(i); setErr(null); setCheer(null); } };
  const advance = (from: number) => {
    if (from >= LAST) return;
    const next = from + 1;
    setCheer({ at: next, clip: pickOne(CHEER_STEP) });
    setReached((r) => Math.max(r, next));
    setStep(next);
  };
  // Bir adım ilk kez tamamlanınca Celeste kendisi ileri götürür (yalnızca yeni lineup'ta; düzenlerken serbest gezilir).
  const autoNext = (i: number, ms: number) => {
    if (editing || autoDone.current.has(i)) return;
    autoDone.current.add(i);
    window.setTimeout(() => { if (stepRef.current === i) advance(i); }, ms);
  };
  useEffect(() => { if (step === 2 && d.stand && d.land) autoNext(2, 1100); }, [step, d.stand, d.land]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- görseller ---------- */
  const addShot = async (file: Blob, at?: number) => {
    // Önce zorunlu kutu (nişan görseli) dolsun; ikincisi boşsa oraya, değilse ilk boş kutuya.
    const aimFirst = steps.length > 1 && !steps[1]!.img && !steps[1]!.busy ? 1 : -1;
    let idx = at ?? (aimFirst >= 0 ? aimFirst : steps.findIndex((s) => !s.img && !s.busy));
    if (idx < 0) {
      if (steps.length >= 4) { onToast("En fazla 4 görsel ekleyebilirsin"); return; }
      idx = steps.length;
      setSteps((s) => [...s, blank()]);
    }
    const local = URL.createObjectURL(file);
    setSteps((s) => s.map((x, i) => (i === idx ? { ...x, busy: true, local, aim: null } : x)));
    try {
      const id = await uploadShot(file);
      setSteps((s) => s.map((x, i) => (i === idx ? { ...x, img: id, busy: false } : x)));
      setAimAt(idx);
    } catch (e) {
      setSteps((s) => s.map((x, i) => (i === idx ? { ...x, busy: false, local: undefined } : x)));
      onToast(e instanceof Error ? e.message : String(e));
    }
  };

  // Panodan otomatik yakalama (masaüstü uygulaması): görseller adımındayken Win+Shift+S ile alınan ekran görüntüsü kendiliğinden eklenir.
  // Yalnızca panoyu okur, oyuna dokunmaz. Adıma girerken panoda zaten duran görsel yok sayılır.
  const addShotRef = useRef(addShot);
  addShotRef.current = addShot;
  useEffect(() => {
    if (step !== 3 || !inTauri) return;
    let stop = false, busy = false, first = true, last = "";
    const tick = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const { readImage } = await import("@tauri-apps/plugin-clipboard-manager");
        const img = await readImage();
        const { width, height } = await img.size();
        const px = await img.rgba();
        let h = (width * 31 + height) >>> 0;
        for (let i = 0; i < px.length; i += 4099) h = ((h * 33) ^ px[i]!) >>> 0;
        const sig = `${width}x${height}:${h}`;
        if (first) { first = false; last = sig; }
        else if (sig !== last && !stop) {
          last = sig;
          const c = document.createElement("canvas");
          c.width = width; c.height = height;
          c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), width, height), 0, 0);
          const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
          if (blob && !stop) { onToast("Ekran görüntüsü panodan eklendi"); void addShotRef.current(blob); }
        }
      } catch { /* pano boş ya da görsel değil */ }
      busy = false;
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => { stop = true; window.clearInterval(id); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+V: görseller adımındayken panodaki ekran görüntüsü ilk boş kutuya eklenir.
  useEffect(() => {
    if (step !== 3) return;
    const paste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (!f) return;
      e.preventDefault();
      void addShot(f);
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  });

  const drop = (e: DragEvent, i: number) => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (f) void addShot(f, i);
  };
  const setAim = (e: MouseEvent<HTMLElement>, i: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    const aim: Pt = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, aim } : x)));
    setAimAt(null);
  };
  const move = (i: number, dir: -1 | 1) => setSteps((s) => { const n = [...s]; const j = i + dir; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });

  /* ---------- gönder ---------- */
  const clip = parseYoutube(clipRaw);
  const save = async () => {
    if (firstBad >= 0) { setStep(firstBad); setErr("Bu adımda eksik var"); return; }
    setBusy(true); setErr(null);
    const draft: LineupDraft = { ...d, steps: steps.filter((s) => s.img || s.text.trim()).map(({ img, text, aim }) => ({ img, text: text.trim(), aim })), clip: clip ? { ...clip, ...(d.clip && d.clip.id === clip.id ? { start: d.clip.start, end: d.clip.end } : {}) } : null };
    try {
      const r = editing ? await editLineup(editing.id, draft) : await submitLineup(draft);
      onDone(r.id, r.status);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  /* ---------- Celeste ne desin ---------- */
  const baseSay = ((): { text: string; mood: Mood; clip?: ClipId } => {
    if (err) return { text: `Bir sorun var galiba. Birlikte düzeltelim. (${err})`, mood: "surprised", clip: "hata" };
    switch (step) {
      case 0:
        if (!d.agent) return { text: "", mood: "happy", clip: "ajan" };
        return { text: "", mood: "wink", clip: "ajan-secilince" };
      case 1:
        if (!d.map) return { text: "", mood: "happy", clip: "harita" };
        return { text: "", mood: "happy", clip: "harita-secilince" };
      case 2:
        if (!d.stand) return { text: "", mood: "happy", clip: "isaretle-once-dokunma" };
        if (!d.land) return { text: "", mood: "wink", clip: "isaretle-yetenegin-dusecegi-yer" };
        return { text: "", mood: "flirt", clip: "isaretle-tam-isabet" };
      case 3:
        if (!shots) return { text: inTauri ? "Win+Shift+S ile ekran görüntüsü al, ben kutuya koyarım. Tek görsel yeter." : "Ekran görüntüsünü Ctrl+V ile yapıştır ya da kutuya sürükle. Tek görsel yeter.", mood: "happy" };
        if (steps.some((s) => (s.img || s.local) && !s.aim)) return { text: "Görsele tıklayıp nişan noktasını göster, oyuncular tam oraya baksın.", mood: "wink" };
        return { text: "Görseller çok net. Bir cümleyle anlatırsan daha da iyi olur.", mood: "happy" };
      default:
        if (d.title.trim().length < 3) return { text: "", mood: "flirt", clip: "son-dokunus" };
        return { text: "", mood: "flirt", clip: editing ? "duzenlemede-hazir-kaydedlim-mi" : admin ? "admin-her-sey-hazir" : "son-dokunus2" };
    }
  })();  // Adım tamamlanınca övgü, sonraki cümleyle tek kayıtta söylenir ("Harikasın! Şimdi tarafı..."): iki ayrı kayıt arasındaki bekleme olmaz.
  const MERGE: Record<string, string> = { harita: "harita", "harita-secilince": "harita-secilince-kisa", "isaretle-once-dokunma": "isaretle-once-dokunma", "son-dokunus": "son-dokunus" };
  const cheerOn = !err && cheer?.at === step && (cheer.base === undefined || cheer.base === (baseSay.clip ?? ""));
  const say = ((): { text: string; mood: Mood; clip?: ClipId } => {
    if (!cheerOn || !cheer) return baseSay;
    const m = baseSay.clip ? MERGE[baseSay.clip] : undefined;
    return m ? { text: "", mood: baseSay.mood, clip: joinClip(cheer.clip, m) } : { text: "", mood: "flirt", clip: cheer.clip };
  })();
  useEffect(() => {
    if (cheer && cheer.at === step && cheer.base === undefined) setCheer({ ...cheer, base: baseSay.clip ?? "" });
  }, [cheer, step, baseSay.clip]);



  const summary = [
    agent ? `${agent.name}${ability ? ` · ${ability.name}` : ""}` : "",
    map ? `${map.name} · ${d.side === "atk" ? "Saldırı" : "Savunma"}${d.site ? ` · ${siteName(d.site)}` : ""}` : "",
    d.stand && d.land ? "İki nokta işaretli" : d.stand ? "Duruş işaretli" : "",
    shots ? `${shots} görsel` : "",
    d.title.trim(),
  ];

  const shownAgents = agents.filter(([, a]) => a.name.toLocaleLowerCase("tr").includes(agentQ.toLocaleLowerCase("tr")));

  return (
    <div className="led lw">
      <div className="led-top">
        <button type="button" className="lv-back" onClick={onCancel}><Icon name="chevron" size={16} />Vazgeç</button>
        <h3>{editing ? "Lineup düzenle" : "Yeni lineup"}</h3>
        <span className="led-who">{admin ? <><Icon name="spark" size={13} />Doğrudan yayınlanır</> : <><Icon name="shield" size={13} />Yetkililer kontrol edip yayınlar</>}</span>
      </div>

      {/* adım şeridi */}
      <ol className="lw-rail">
        {STEPS.map((n, i) => {
          const done = valid[i] && (i < step || i < reached);
          const can = i <= reached || Boolean(editing);
          return (
            <li key={n} className={`${i === step ? "on" : ""}${done ? " done" : ""}${can ? "" : " lock"}`}>
              <button type="button" onClick={() => goTo(i)} disabled={!can} aria-current={i === step ? "step" : undefined}>
                <em>{done && i !== step ? <Icon name="check" size={13} /> : i + 1}</em>
                <span><b>{n}</b><small>{summary[i] || (i === step ? "Şimdi" : can ? "Eksik" : "")}</small></span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lw-guide">
        <Narrator text={say.text} clip={say.clip} mood={say.mood} speak={getMe().voice} playing={Boolean(say.clip)} onDone={() => setCheer((c) => (c?.at === step && !(baseSay.clip && MERGE[baseSay.clip]) ? null : c))} small />
      </div>

      <section className="led-sec lw-body" key={step}>
        {step === 0 && (
          <>
            <div className="lw-row">
              <label className="led-search"><Icon name="search" size={14} /><input value={agentQ} onChange={(e) => setAgentQ(e.target.value)} placeholder="Ajan ara" onKeyDown={(e) => e.stopPropagation()} autoFocus /></label>
            </div>
            <div className="led-ag-grid">
              {shownAgents.map(([id, a]) => (
                <button key={id} type="button" className={`led-ag${d.agent === id ? " on" : ""}`} onClick={() => { up({ agent: id }); if (d.agent !== id) setAbPicked(false); }} title={a.name}>
                  <img src={a.icon} alt="" /><span>{a.name}</span>
                </button>
              ))}
            </div>
            {agent && (
              <div className="lw-sub">
                <h5>Yetenek</h5>
                <div className="led-abs">
                  {(agent.abilities ?? []).map((x) => (
                    <button key={x.slot} type="button" className={`led-ab${abPicked && d.slot === x.slot ? " on" : ""}`} onClick={() => { up({ slot: x.slot as Slot }); setAbPicked(true); autoNext(0, 650); }}>
                      {x.icon && <img src={x.icon} alt="" />}<kbd>{SLOT_KEY[x.slot as Slot] ?? "?"}</kbd><span>{x.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="led-maps">
              {maps.map((m) => (
                <button key={m.uuid} type="button" className={`led-map${d.map === m.uuid ? " on" : ""}`} onClick={() => { if (d.map !== m.uuid) { up({ map: m.uuid, stand: null, land: null, ...(d.site && d.site !== "mid" && !m.sites.includes(d.site) ? { site: "A" } : {}) }); setPick("stand"); autoDone.current.delete(2); } }} style={m.banner ? ({ "--bg": `url("${m.banner}")` } as CSSProperties) : undefined} aria-pressed={d.map === m.uuid}>
                  {d.map === m.uuid && <i className="lw-tick"><Icon name="check" size={12} /></i>}
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
            <div className="lw-pairs">
              <div><h5>Taraf</h5><span className="seg">{SIDES.map(([id, n]) => <button key={id} type="button" className={d.side === id ? "on" : ""} onClick={() => up({ side: id })}>{n}</button>)}</span></div>
              <div><h5>Site</h5><span className="seg">{sitesFor(map).map(([id, n]) => <button key={id} type="button" className={d.site === id ? "on" : ""} onClick={() => up({ site: d.site === id ? "" : id })}>{n}</button>)}</span></div>
            </div>
            <div className="lw-sub">
              <h5>Ne zaman kullanılır</h5>
              <div className="led-kinds">
                {KINDS.map(([id, n, desc]) => (
                  <button key={id} type="button" className={`led-kind${d.kind === id ? " on" : ""}`} onClick={() => up({ kind: id })}><b>{n}</b><small>{desc}</small></button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="led-mapwrap">
            {map ? (
              <MapBoard map={map} assets={assets} lineups={[]} pick={pick} callouts draft={{ stand: d.stand, land: d.land, agent: d.agent, slot: d.slot, side: d.side }}
                onPoint={(p) => { if (pick === "stand") { up({ stand: p }); setPick(d.land ? null : "land"); } else if (pick === "land") { up({ land: p }); setPick(null); } }} />
            ) : <p className="d none">Önce harita seç.</p>}
            <div className="led-pickbar">
              <button type="button" className={`led-pk${pick === "stand" ? " on" : ""}${d.stand ? " ok" : ""}`} onClick={() => setPick("stand")}><em>1</em><span className={`lgd stand ${d.side}`} />Duracağın yer{d.stand && <Icon name="check" size={13} />}</button>
              <button type="button" className={`led-pk${pick === "land" ? " on" : ""}${d.land ? " ok" : ""}`} onClick={() => setPick("land")}><em>2</em><span className={`lgd land ${d.side}`} />Düşeceği yer{d.land && <Icon name="check" size={13} />}</button>
              <small>Tekerlekle yakınlaş, sürükleyerek gez. Düzeltmek için düğmeye basıp yeniden dokun.</small>
            </div>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="lw-tip"><Icon name="image" size={15} /><span><b>Ctrl+V</b> ile yapıştır, sürükle ya da kutuya tıkla. Sonra görselde nişan noktasına dokun.</span></div>
            <div className="led-steps">
              {steps.map((s, i) => (
                <div key={i} className={`led-step${aimAt === i ? " aiming" : ""}${s.img ? " has" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, i)}>
                  <div className="led-step-h">
                    <b><em>{i + 1}</em>{SHOT_HINT[i]}<small className={`led-need${i === 1 ? " req" : ""}`}>{SHOT_NEED[i]}</small></b>
                    <span>
                      <button type="button" className="ib" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Sola al"><Icon name="chevron" size={14} /></button>
                      <button type="button" className="ib flip" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Sağa al"><Icon name="chevron" size={14} /></button>
                      {steps.length > 1 && <button type="button" className="ib" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} aria-label="Sil"><Icon name="x" size={14} /></button>}
                    </span>
                  </div>
                  {s.img || s.local ? (
                    <div className={`led-shot${s.busy ? " busy" : ""}`} onClick={(e) => !s.busy && setAim(e, i)} role="button" tabIndex={0}>
                      <img src={s.local ?? imgUrl(s.img!)} alt="" draggable={false} />
                      {s.aim && <span className="lv-aim" style={{ left: `${s.aim.x * 100}%`, top: `${s.aim.y * 100}%` }}><i /><i /></span>}
                      <span className="led-shot-tip">{s.busy ? "Yükleniyor…" : s.aim ? "Değiştirmek için tıkla" : "Nişan noktasına tıkla"}</span>
                    </div>
                  ) : (
                    <button type="button" className="led-drop" onClick={() => { fileFor.current = i; fileRef.current?.click(); }}>
                      <span className="led-drop-ic"><Icon name="upload" size={18} /></span><span>Görsel ekle</span><small>{inTauri ? "Win+Shift+S ile çek, kendiliğinden eklenir" : "Ctrl+V · sürükle · tıkla"}</small>
                    </button>
                  )}
                  <input className="led-in" value={s.text} maxLength={160} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}
                    placeholder={i === 0 ? "Ör. Spawn kapısının köşesine sırtını ver" : "Ör. Antenin ucuna nişan al, zıpla ve at"} />
                </div>
              ))}
              {steps.length < 4 && <button type="button" className="led-add" onClick={() => setSteps((x) => [...x, blank()])}><Icon name="plus" size={16} />Görsel ekle</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addShot(f, fileFor.current); e.target.value = ""; }} />
          </>
        )}

        {step === 4 && (
          <div className="lw-final">
            <div className="led-form">
              <label className="wide"><span>Başlık</span><input className="led-in big" maxLength={60} value={d.title} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => up({ title: e.target.value })} placeholder="Ör. A Main tek yönlü smoke" autoFocus /></label>
              <div className="wide lw-pairs">
                <div><h5>Nasıl atılır</h5><span className="seg wrap">{THROWS.map(([id, n]) => <button key={id} type="button" className={d.throw === id ? "on" : ""} onClick={() => up({ throw: id })}>{n}</button>)}</span></div>
                <div><h5>Zorluk</h5><span className="seg">{DIFFS.map(([id, n]) => <button key={id} type="button" className={d.diff === id ? "on" : ""} onClick={() => up({ diff: id })}>{n}</button>)}</span></div>
              </div>
              <button type="button" className={`lw-more wide${more ? " on" : ""}`} onClick={() => setMore(!more)} aria-expanded={more}><Icon name="chevron" size={14} />Not, klip ve yama <small>isteğe bağlı</small></button>
              {more && (
                <div className="wide lw-more-body">
                  <label><span>Not</span><textarea className="led-in" maxLength={240} rows={2} value={d.note} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => up({ note: e.target.value })} placeholder="Ör. Takım A Main'e girmeden 2 saniye önce. Rakip Heaven'dan bakamaz." /></label>
                  <div className="lw-two">
                    <label><span>Klip bağlantısı</span><input className="led-in" value={clipRaw} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setClipRaw(e.target.value)} placeholder="https://youtu.be/…?t=42" />
                      {clipRaw && <small className={clip ? "ok" : "bad"}>{clip ? `${clip.start}. saniyeden başlar, 12 saniye oynar. Lineup içinde gömülü oynar.` : "Şimdilik YouTube bağlantısı kabul ediliyor"}</small>}
                    </label>
                    <label><span>Yama</span><input className="led-in" value={d.patch} maxLength={5} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => up({ patch: e.target.value })} placeholder="11.10" /></label>
                  </div>
                </div>
              )}
            </div>
            <aside className={`lw-prev ${d.side}`} style={{ "--ag": agent?.colors?.[0] ?? "var(--accent)" } as CSSProperties}>
              <small>Önizleme</small>
              <div className="lw-prev-card" style={map?.banner ? ({ "--bg": `url("${map.banner}")` } as CSSProperties) : undefined}>
                <span className="lu-card-ab">{ability?.icon ? <img src={ability.icon} alt="" /> : null}<kbd>{SLOT_KEY[d.slot]}</kbd></span>
                <span className="lw-prev-t">
                  <b>{d.title.trim() || "Başlık"}</b>
                  <small>{agent?.name ?? "Ajan"} · {map?.name ?? "Harita"}{d.site ? ` · ${siteName(d.site)}` : ""}</small>
                  <small>{kindName(d.kind)} · {shots} görsel</small>
                </span>
              </div>
            </aside>
          </div>
        )}
      </section>

      <div className="led-foot lw-foot">
        <button type="button" className="x" onClick={() => (step ? setStep(step - 1) : onCancel())}>{step ? "Geri" : "Vazgeç"}</button>
        <span className="lw-count">{step + 1} / {STEPS.length}</span>
        {step < LAST ? (
          <button type="button" className={`x go${valid[step] ? " ready" : ""}`} disabled={!valid[step]} onClick={() => advance(step)}>Devam<Icon name="chevron" size={14} /></button>
        ) : (
          <button type="button" className={`x go${valid[step] ? " ready" : ""}`} disabled={busy || !valid[step]} onClick={() => void save()}>{busy ? "Gönderiliyor…" : editing ? "Kaydet" : admin ? "Yayınla" : "Onaya gönder"}</button>
        )}
      </div>
    </div>
  );
}
