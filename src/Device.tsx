import { useEffect, useMemo, useState } from "react";
import { PanelHead } from "./ui";

/* Cihaz kontrolü: eDPI, 360° dönüş mesafesi, başka oyundan duyarlılık çevirme ve ayar profilleri.
   Formüller sabittir (oyunların yaw değerleri); hesap bu bilgisayarda yapılır, hiçbir şey gönderilmez. */
const STORE = "overlay-device-profiles";
const VALORANT_YAW = 0.07;
const GAMES = [
  { id: "cs", label: "CS2 / CS:GO", yaw: 0.022 },
  { id: "apex", label: "Apex Legends", yaw: 0.022 },
  { id: "ow", label: "Overwatch 2", yaw: 0.0066 },
] as const;

interface Profile { id: number; name: string; dpi: number; sens: number; crosshair?: string; note?: string }

const num = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d).replace(/\.?0+$/, "") : "–");

function load(): Profile[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "[]") as Profile[];
    return Array.isArray(v) ? v.filter((p) => p && typeof p.name === "string") : [];
  } catch { return []; }
}

interface Props { onCopy: (text: string, label?: string) => void; onClose: () => void }

export function Device({ onCopy, onClose }: Props) {
  const [dpi, setDpi] = useState("800");
  const [sens, setSens] = useState("0.35");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [game, setGame] = useState<(typeof GAMES)[number]["id"]>("cs");
  const [other, setOther] = useState("");
  const [list, setList] = useState<Profile[]>(load);

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* depolama dolu */ } }, [list]);

  const d = num(dpi), s = num(sens);
  const edpi = d * s;
  const inch = d && s ? 360 / (VALORANT_YAW * s * d) : 0;
  const cm = inch * 2.54;

  const yaw = GAMES.find((g) => g.id === game)!.yaw;
  const converted = useMemo(() => (num(other) ? (num(other) * yaw) / VALORANT_YAW : 0), [other, yaw]);

  const save = () => {
    const n = name.trim();
    if (!n || !d || !s) return;
    setList((l) => [{ id: Date.now(), name: n, dpi: d, sens: s, ...(code.trim() ? { crosshair: code.trim() } : {}) }, ...l].slice(0, 12));
    setName("");
  };
  const use = (p: Profile) => { setDpi(String(p.dpi)); setSens(String(p.sens)); };
  const text = (p: Profile) => `${p.name}: ${p.dpi} DPI · ${p.sens} duyarlılık · eDPI ${fmt(p.dpi * p.sens)}${p.crosshair ? ` · ${p.crosshair}` : ""}`;

  return (
    <div className="panel" role="dialog" aria-label="Cihaz kontrolü">
      <PanelHead title="Cihaz kontrolü" sub="DPI ve oyun içi duyarlılığından eDPI ile 360° dönüş mesafeni hesapla." onClose={onClose} />

      <div className="dv">
        <label>DPI<input inputMode="decimal" value={dpi} onChange={(e) => setDpi(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="DPI" /></label>
        <label>Valorant duyarlılığı<input inputMode="decimal" value={sens} onChange={(e) => setSens(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="Valorant duyarlılığı" /></label>
        <div className="dvr"><small>eDPI</small><b>{d && s ? fmt(edpi, 1) : "–"}</b></div>
        <div className="dvr"><small>360° dönüş</small><b>{cm ? `${fmt(cm, 1)} cm` : "–"}</b><em>{inch ? `${fmt(inch, 1)} inç` : ""}</em></div>
      </div>

      <h2 className="h">Başka oyundan çevir<span className="hv">Valorant'a</span></h2>
      <div className="dv conv">
        <div className="seg" role="tablist" aria-label="Oyun">
          {GAMES.map((g) => <button key={g.id} type="button" role="tab" aria-selected={game === g.id} className={game === g.id ? "x on" : "x"} onClick={() => setGame(g.id)}>{g.label}</button>)}
        </div>
        <label>Oradaki duyarlılık<input inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="ör. 1.2" aria-label="Diğer oyundaki duyarlılık" /></label>
        <div className="dvr"><small>Valorant karşılığı</small><b>{converted ? fmt(converted, 3) : "–"}</b></div>
        {converted > 0 && <button className="x" type="button" onClick={() => setSens(fmt(converted, 3))}>Hesaplayıcıya al</button>}
      </div>

      <h2 className="h">Ayar profillerim<span className="hv">{list.length} profil</span></h2>
      <div className="note">
        <input className="short" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); e.stopPropagation(); }} placeholder="Profil adı" aria-label="Profil adı" />
        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); e.stopPropagation(); }} placeholder="Nişangah kodu (isteğe bağlı)" aria-label="Nişangah kodu" />
        <button className="x go" type="button" onClick={save} disabled={!name.trim() || !d || !s}>Kaydet</button>
      </div>
      <div className="box pad">
        {list.length === 0 && <p className="d none">Henüz profil yok. Yukarıdaki DPI ve duyarlılıkla bir profil kaydedebilirsin.</p>}
        {list.map((p) => (
          <div className="dvp" key={p.id}>
            <button className="mt" type="button" onClick={() => use(p)} title="Hesaplayıcıya al">
              <b>{p.name}</b>
              <small>{p.dpi} DPI · {p.sens} · eDPI {fmt(p.dpi * p.sens, 1)}{p.crosshair ? " · nişangah kodlu" : ""}</small>
            </button>
            <button className="x" type="button" onClick={() => onCopy(p.crosshair ?? text(p), p.crosshair ? "Nişangah kodu kopyalandı" : "Profil kopyalandı")}>Kopyala</button>
            <button className="x" type="button" onClick={() => setList((l) => l.filter((x) => x.id !== p.id))} aria-label="Profili sil">Sil</button>
          </div>
        ))}
      </div>
    </div>
  );
}
