import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import type { Assets } from "../assets";
import { currentPatch } from "../assets";
import { Icon } from "../icons";
import { DIFFS, editLineup, imgUrl, KINDS, parseYoutube, SIDES, SITES, SLOT_KEY, submitLineup, THROWS, uploadShot, type Lineup, type LineupDraft, type Pt, type Slot, type Step } from "./api";
import { MapBoard } from "./MapBoard";

/* Lineup ekleme / düzenleme. Ekran görüntüsünü Ctrl+V ile yapıştırabilir, sürükleyip bırakabilir ya da seçebilirsin.
   Görsele tıklayınca nişan noktası işaretlenir. Yönetici gönderince doğrudan yayına girer, oyuncu gönderisi onaya düşer. */

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
  const [pick, setPick] = useState<"stand" | "land" | null>(d.stand ? null : "stand");
  const [aimAt, setAimAt] = useState<number | null>(null);
  const [clipRaw, setClipRaw] = useState(init.clip ? `https://youtu.be/${init.clip.id}?t=${init.clip.start}` : "");
  const [agentQ, setAgentQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileFor = useRef<number>(0);
  const map = maps.find((m) => m.uuid === d.map);
  const agent = assets?.agents.get(d.agent);
  const up = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));

  const addShot = async (file: Blob, at?: number) => {
    let idx = at ?? steps.findIndex((s) => !s.img && !s.busy);
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

  // Ctrl+V: panodaki ekran görüntüsü ilk boş adıma eklenir.
  useEffect(() => {
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

  const problems = [
    !d.agent && "Ajan seç",
    !d.map && "Harita seç",
    !d.stand && "Haritada duracağın yeri işaretle",
    !d.land && "Haritada düşeceği yeri işaretle",
    !steps.some((s) => s.img) && "En az bir ekran görüntüsü ekle",
    d.title.trim().length < 3 && "Başlık yaz",
    steps.some((s) => s.busy) && "Görseller yükleniyor",
  ].filter(Boolean) as string[];

  const save = async () => {
    if (problems.length) { setErr(problems[0]!); return; }
    setBusy(true); setErr(null);
    const draft: LineupDraft = { ...d, steps: steps.filter((s) => s.img || s.text.trim()).map(({ img, text, aim }) => ({ img, text: text.trim(), aim })), clip: parseYoutube(clipRaw) ? { ...parseYoutube(clipRaw)!, ...(d.clip && d.clip.id === parseYoutube(clipRaw)!.id ? { start: d.clip.start, end: d.clip.end } : {}) } : null };
    try {
      const r = editing ? await editLineup(editing.id, draft) : await submitLineup(draft);
      onDone(r.id, r.status);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const clip = parseYoutube(clipRaw);
  const ab = agent?.abilities ?? [];
  const shownAgents = agents.filter(([, a]) => a.name.toLocaleLowerCase("tr").includes(agentQ.toLocaleLowerCase("tr")));

  return (
    <div className="led">
      <div className="led-top">
        <button type="button" className="lv-back" onClick={onCancel}><Icon name="chevron" size={16} />Vazgeç</button>
        <h3>{editing ? "Lineup'ı düzenle" : "Yeni lineup"}</h3>
        <span className="led-who">{admin ? <><Icon name="spark" size={13} />Celeste lineup'ı olarak doğrudan yayınlanır</> : <><Icon name="shield" size={13} />Yetkililer kontrol edip yayınlar</>}</span>
      </div>

      <section className="led-sec">
        <h4><b>1</b>Ajan ve yetenek</h4>
        <div className="led-agents">
          <input className="led-q" value={agentQ} onChange={(e) => setAgentQ(e.target.value)} placeholder="Ajan ara" onKeyDown={(e) => e.stopPropagation()} />
          <div className="led-ag-grid">
            {shownAgents.map(([id, a]) => (
              <button key={id} type="button" className={`led-ag${d.agent === id ? " on" : ""}`} onClick={() => up({ agent: id })} title={a.name}>
                <img src={a.icon} alt="" /><span>{a.name}</span>
              </button>
            ))}
          </div>
        </div>
        {agent && (
          <div className="led-abs">
            {ab.map((x) => (
              <button key={x.slot} type="button" className={`led-ab${d.slot === x.slot ? " on" : ""}`} onClick={() => up({ slot: x.slot as Slot })}>
                {x.icon && <img src={x.icon} alt="" />}<kbd>{SLOT_KEY[x.slot as Slot] ?? "?"}</kbd><span>{x.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="led-sec">
        <h4><b>2</b>Harita ve durum</h4>
        <div className="led-maps">
          {maps.map((m) => (
            <button key={m.uuid} type="button" className={`led-map${d.map === m.uuid ? " on" : ""}`} onClick={() => { up({ map: m.uuid, stand: null, land: null }); setPick("stand"); }} style={m.banner ? { backgroundImage: `url(${m.banner})` } : undefined}>
              <span>{m.name}</span>
            </button>
          ))}
        </div>
        <div className="led-grid">
          <label><span>Taraf</span><span className="seg">{SIDES.map(([id, n]) => <button key={id} type="button" className={d.side === id ? "on" : ""} onClick={() => up({ side: id })}>{n}</button>)}</span></label>
          <label><span>Site</span><span className="seg">{SITES.map(([id, n]) => <button key={id} type="button" className={d.site === id ? "on" : ""} onClick={() => up({ site: d.site === id ? "" : id })}>{n}</button>)}</span></label>
          <label><span>Nasıl atılır</span><span className="seg wrap">{THROWS.map(([id, n]) => <button key={id} type="button" className={d.throw === id ? "on" : ""} onClick={() => up({ throw: id })}>{n}</button>)}</span></label>
          <label><span>Zorluk</span><span className="seg">{DIFFS.map(([id, n]) => <button key={id} type="button" className={d.diff === id ? "on" : ""} onClick={() => up({ diff: id })}>{n}</button>)}</span></label>
        </div>
        <div className="led-kinds">
          {KINDS.map(([id, n, desc]) => (
            <button key={id} type="button" className={`led-kind${d.kind === id ? " on" : ""}`} onClick={() => up({ kind: id })}><b>{n}</b><small>{desc}</small></button>
          ))}
        </div>
      </section>

      <section className="led-sec">
        <h4><b>3</b>Haritada işaretle</h4>
        <div className="led-mapwrap">
          {map ? (
            <MapBoard map={map} assets={assets} lineups={[]} pick={pick} callouts draft={{ stand: d.stand, land: d.land, agent: d.agent, slot: d.slot, side: d.side }}
              onPoint={(p) => { if (pick === "stand") { up({ stand: p }); setPick(d.land ? null : "land"); } else if (pick === "land") { up({ land: p }); setPick(null); } }} />
          ) : <p className="d none">Harita seç.</p>}
          <div className="led-pickbar">
            <button type="button" className={`led-pk${pick === "stand" ? " on" : ""}${d.stand ? " ok" : ""}`} onClick={() => setPick("stand")}><span className={`lgd stand ${d.side}`} />Duracağın yer{d.stand && <Icon name="check" size={13} />}</button>
            <button type="button" className={`led-pk${pick === "land" ? " on" : ""}${d.land ? " ok" : ""}`} onClick={() => setPick("land")}><span className={`lgd land ${d.side}`} />Düşeceği yer{d.land && <Icon name="check" size={13} />}</button>
            <small>Tekerlekle yakınlaş, ince ayar için tekrar tıkla.</small>
          </div>
        </div>
      </section>

      <section className="led-sec">
        <h4><b>4</b>Ekran görüntüleri <small>Ctrl+V ile yapıştır, sürükle ya da seç. Görsele tıklayıp nişan noktasını işaretle.</small></h4>
        <div className="led-steps">
          {steps.map((s, i) => (
            <div key={i} className={`led-step${aimAt === i ? " aiming" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, i)}>
              <div className="led-step-h">
                <b>{i + 1}. adım</b>
                <span>
                  <button type="button" className="ib" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yukarı"><Icon name="chevron" size={14} /></button>
                  <button type="button" className="ib flip" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Aşağı"><Icon name="chevron" size={14} /></button>
                  <button type="button" className="ib" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} aria-label="Sil"><Icon name="x" size={14} /></button>
                </span>
              </div>
              {s.img || s.local ? (
                <div className={`led-shot${s.busy ? " busy" : ""}`} onClick={(e) => !s.busy && setAim(e, i)} role="button" tabIndex={0}>
                  <img src={s.local ?? imgUrl(s.img!)} alt="" draggable={false} />
                  {s.aim && <span className="lv-aim" style={{ left: `${s.aim.x * 100}%`, top: `${s.aim.y * 100}%` }}><i /><i /></span>}
                  <span className="led-shot-tip">{s.busy ? "Yükleniyor…" : s.aim ? "Nişan noktasını değiştirmek için tıkla" : "Nişan noktasına tıkla"}</span>
                </div>
              ) : (
                <button type="button" className="led-drop" onClick={() => { fileFor.current = i; fileRef.current?.click(); }}>
                  <Icon name="plus" size={20} /><span>Görsel ekle</span><small>Ctrl+V · sürükle · tıkla</small>
                </button>
              )}
              <input className="led-in" value={s.text} maxLength={160} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}
                placeholder={i === 0 ? "Ör. Spawn kapısının köşesine sırtını ver" : "Ör. Antenin ucuna nişan al, zıpla ve at"} />
            </div>
          ))}
          {steps.length < 4 && <button type="button" className="led-add" onClick={() => setSteps((x) => [...x, blank()])}><Icon name="plus" size={16} />Adım ekle</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addShot(f, fileFor.current); e.target.value = ""; }} />
      </section>

      <section className="led-sec">
        <h4><b>5</b>Başlık ve ayrıntılar</h4>
        <div className="led-form">
          <label className="wide"><span>Başlık</span><input className="led-in" maxLength={60} value={d.title} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => up({ title: e.target.value })} placeholder="Ör. A Main tek yönlü smoke" /></label>
          <label className="wide"><span>Ne zaman kullanılır</span><textarea className="led-in" maxLength={240} rows={2} value={d.note} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => up({ note: e.target.value })} placeholder="Ör. Takım A Main'e girmeden 2 saniye önce. Rakip Heaven'dan bakamaz." /></label>
          <label className="wide"><span>Klip (YouTube, isteğe bağlı)</span><input className="led-in" value={clipRaw} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setClipRaw(e.target.value)} placeholder="https://youtu.be/…?t=42" />
            {clipRaw && <small className={clip ? "ok" : "bad"}>{clip ? `Klip ${clip.start}. saniyeden başlar, 12 saniye oynar` : "YouTube bağlantısı tanınmadı"}</small>}
          </label>
          <label><span>Yama</span><input className="led-in" value={d.patch} maxLength={5} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => up({ patch: e.target.value })} placeholder="11.10" /></label>
        </div>
      </section>

      <div className="led-foot">
        {err ? <p className="led-err"><Icon name="info" size={14} />{err}</p> : problems.length ? <p className="led-todo">Eksik: {problems.join(" · ")}</p> : <p className="led-ready"><Icon name="check" size={14} />Hazır</p>}
        <button type="button" className="x" onClick={onCancel}>Vazgeç</button>
        <button type="button" className="x go" disabled={busy} onClick={() => void save()}>{busy ? "Gönderiliyor…" : editing ? "Kaydet" : admin ? "Yayınla" : "Onaya gönder"}</button>
      </div>
    </div>
  );
}
