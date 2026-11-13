import { useMemo, useState } from "react";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import { TAGS, type Seen, type TagId } from "./seen";
import { PanelHead } from "./ui";

/* İzleme listesi: etiketlediğin ya da not yazdığın oyuncular. Lobiye girince lobide uyarı çıkar (sesli ya da sessiz).
   Etiket oyuncunun kimliğine bağlıdır; ismini değiştirse de, ismi gizli olsa da tanınır. */
interface Props {
  assets: Assets | null; seen: Seen; sound: boolean;
  onSound: (on: boolean) => void;
  onTag: (puuid: string, tag: TagId | null) => void;
  onLabel: (puuid: string, label: string) => void;
  onClear: (puuid: string) => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onClose: () => void;
}

const when = (at: number) => { if (!at) return "daha önce"; const d = Math.floor((Date.now() - at) / 86400000); return d <= 0 ? "bugün" : d === 1 ? "dün" : `${d} gün önce`; };

export function Watchlist({ assets, seen, sound, onSound, onTag, onLabel, onClear, onExport, onImport, onClose }: Props) {
  const [filter, setFilter] = useState<TagId | "all">("all");
  const [edit, setEdit] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [imp, setImp] = useState(false);
  const [text, setText] = useState("");

  const all = useMemo(() => Object.entries(seen).map(([puuid, e]) => {
    const last = e.history[e.history.length - 1];
    const name = [...e.history].reverse().find((h) => h.name)?.name ?? null;
    return { puuid, e, last, name, at: last?.at ?? 0 };
  }).filter((r) => r.name || r.e.label).sort((a, b) => b.at - a.at), [seen]);

  const watched = all.filter((r) => r.e.tag || r.e.label);
  const shown = filter === "all" ? watched : watched.filter((r) => r.e.tag === filter);
  const recent = all.filter((r) => !r.e.tag && !r.e.label && r.at > 0).slice(0, 8);

  const row = ({ puuid, e, last, name }: (typeof all)[number], listed: boolean) => {
    const agent = last ? assets?.agents.get(lookup(last.agentId))?.name : undefined;
    const title = name ?? e.label ?? "?";
    return (
      <div className="wlrow" key={puuid}>
        <span className="sn">
          <b>{title}</b>
          <small>
            {e.n > 0 ? `${e.n} kez karşılaştın · ${when(last?.at ?? 0)}` : "Aktarıldı"}
            {last?.side ? ` · ${last.side === "ally" ? "takım" : "rakip"}` : ""}{agent ? ` · ${agent}` : ""}
            {name && e.label ? ` · notun: ${e.label}` : ""}
          </small>
        </span>
        <span className="wltags" role="group" aria-label="Etiket">
          {TAGS.map((t) => (
            <button key={t.id} type="button" className={e.tag === t.id ? "wlt on" : "wlt"} style={{ "--tc": t.color } as React.CSSProperties} aria-pressed={e.tag === t.id} onClick={() => onTag(puuid, e.tag === t.id ? null : t.id)}>{t.label}</button>
          ))}
        </span>
        {listed && (edit === puuid
          ? <span className="wled"><input autoFocus value={note} maxLength={60} placeholder="Not" onChange={(ev) => setNote(ev.target.value)} onKeyDown={(ev) => { ev.stopPropagation(); if (ev.key === "Enter") { onLabel(puuid, note); setEdit(null); } if (ev.key === "Escape") setEdit(null); }} /><button className="x go" type="button" onClick={() => { onLabel(puuid, note); setEdit(null); }}>Kaydet</button></span>
          : <><button className="x" type="button" onClick={() => { setEdit(puuid); setNote(e.label ?? ""); }}>Not</button><button className="x" type="button" onClick={() => onClear(puuid)}>Çıkar</button></>)}
      </div>
    );
  };

  return (
    <div className="panel" role="dialog" aria-label="İzleme listesi">
      <PanelHead title="İzleme listesi" sub="Etiketlediğin oyuncular lobiye girince uyarılırsın. Etiketi lobideki oyuncu kartından da koyabilirsin." onClose={onClose}
        actions={<label className="wlsnd"><input type="checkbox" checked={sound} onChange={(e) => onSound(e.target.checked)} />Uyarı sesi</label>} />

      <div className="wlf" role="group" aria-label="Süz">
        <button type="button" className={filter === "all" ? "x go" : "x"} onClick={() => setFilter("all")}>Tümü <b>{watched.length}</b></button>
        {TAGS.map((t) => <button key={t.id} type="button" className={filter === t.id ? "x go" : "x"} onClick={() => setFilter(t.id)}>{t.label} <b>{watched.filter((r) => r.e.tag === t.id).length}</b></button>)}
      </div>

      <h2 className="h">Listedekiler<span className="hv">{shown.length} oyuncu</span></h2>
      <div className="box pad">
        {shown.length === 0 && <p className="d none">{watched.length === 0 ? "Liste boş. Aşağıdaki son karşılaştıklarından birini etiketle ya da maçta oyuncu kartından etiket koy." : "Bu etikette oyuncu yok."}</p>}
        {shown.map((r) => row(r, true))}
      </div>

      {recent.length > 0 && (
        <>
          <h2 className="h">Son karşılaştıkların<span className="hv">Etiket koyunca listeye eklenir</span></h2>
          <div className="box pad">{recent.map((r) => row(r, false))}</div>
        </>
      )}

      <h2 className="h">Taşı<span className="hv">Başka hesaba ya da bilgisayara aktar</span></h2>
      <div className="box pad wlio">
        <button className="x" type="button" onClick={onExport} disabled={watched.length === 0}>Listeyi kopyala</button>
        <button className="x" type="button" onClick={() => setImp((v) => !v)}>İçe aktar</button>
        {imp && (
          <span className="wled">
            <input autoFocus value={text} placeholder="Kopyaladığın listeyi buraya yapıştır" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            <button className="x go" type="button" disabled={!text.trim()} onClick={() => { onImport(text); setText(""); setImp(false); }}>Ekle</button>
          </span>
        )}
      </div>
    </div>
  );
}
