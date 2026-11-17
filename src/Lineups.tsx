import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Assets, MapInfo } from "./assets";
import { Icon, type IconName } from "./icons";
import { useMe as useFeedMe } from "./vip";
import { CloseButton, Empty } from "./ui";
import { adminLineups, DIFFS, kindName, KINDS, myLineups, refreshLineups, SIDES, siteName, SITES, SLOT_KEY, useLineups, type Lineup, type LineupDraft, type Side } from "./lineups/api";
import { Editor } from "./lineups/Editor";
import { LineupView, patchState } from "./lineups/LineupView";
import { abilityOf, MapBoard } from "./lineups/MapBoard";
import { hasTurkishVoice, Narrator } from "./lineups/Narrator";
import { Practice } from "./lineups/Practice";
import { addFavs, mastered, patchMe, readCode, shareCode, streak, useMe } from "./lineups/store";
import "./lineups/lineups.css";
import { nameUpper, valUpper } from "./lineups/upper";

/* Lineup: Celeste'nin ve topluluğun lineup kütüphanesi.
   Keşfet: harita + liste, filtreler. Öğren: günün üçü, tekrar kartları, sınav, özel oyun planı. Setim: kendi listen ve
   paylaşım kodu. Topluluk: gönderilerin ve en beğenilenler. Yönetim: onay bekleyenler (yalnızca yöneticiler). */

type Tab = "lib" | "learn" | "set" | "com" | "mod";
const TABS: [Tab, string, IconName][] = [["lib", "Keşfet", "map"], ["learn", "Öğren", "flame"], ["set", "Setim", "star"], ["com", "Topluluk", "users"], ["mod", "Yönetim", "shield"]];
const inTauri = "__TAURI_INTERNALS__" in window;

interface Props {
  assets: Assets | null;
  /** Oyundaki harita (mapUrl) ve ajanın: açılınca bunlar seçili gelir. */
  currentMapUrl?: string | null;
  myAgentId?: string | null;
  onToast: (t: string) => void;
  onClose: () => void;
}

const mapByUrl = (maps: MapInfo[], url?: string | null) => (url ? maps.find((m) => m.key === url.split("/").filter(Boolean).pop()?.toLowerCase()) : undefined);

export function Lineups({ assets, currentMapUrl, myAgentId, onToast, onClose }: Props) {
  const { list, loading, error } = useLineups();
  const me = useMe();
  const feedMe = useFeedMe();
  const maps = useMemo(() => (assets?.mapList ?? []).filter((m) => m.uuid), [assets]);
  const [tab, setTab] = useState<Tab>("lib");
  const [mapId, setMapId] = useState<string>(() => mapByUrl(maps, currentMapUrl)?.uuid ?? "");
  const [agentId, setAgentId] = useState<string>(myAgentId ?? "");
  const [side, setSide] = useState<Side | "">("");
  const [site, setSite] = useState("");
  const [kind, setKind] = useState("");
  const [diff, setDiff] = useState(0);
  const [q, setQ] = useState("");
  const [onlySet, setOnlySet] = useState(false);
  const [callouts, setCallouts] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ editing: Lineup | null; start?: Partial<LineupDraft> } | null>(null);
  const [mine, setMine] = useState<{ admin: boolean; lineups: Lineup[] } | null>(null);
  const [votes, setVotes] = useState<Set<string>>(new Set());
  const admin = Boolean(mine?.admin || feedMe?.admin);
  const mapsRef = useRef<HTMLDivElement>(null);
  // Seçili harita şeritte görünmüyorsa ortaya kaydır.
  useEffect(() => { mapsRef.current?.querySelector<HTMLElement>(".lu-map.on")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [mapId, tab]);
  const filtered = Boolean(agentId || side || site || kind || diff || q.trim() || onlySet);
  const clearFilters = () => { setAgentId(""); setSide(""); setSite(""); setKind(""); setDiff(0); setQ(""); setOnlySet(false); };

  // Harita listesi geç gelirse oyundaki harita sonra seçilir; hiçbiri yoksa lineup'ı en çok olan harita.
  useEffect(() => {
    if (mapId || !maps.length) return;
    const cur = mapByUrl(maps, currentMapUrl)?.uuid;
    const counts = new Map<string, number>();
    list.forEach((l) => counts.set(l.map, (counts.get(l.map) ?? 0) + 1));
    setMapId(cur ?? [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? maps[0]!.uuid);
  }, [maps, list, currentMapUrl, mapId]);

  const loadMine = () => { if (inTauri) myLineups().then((r) => { setMine(r); setVotes(new Set(r.votes)); }).catch(() => undefined); };
  useEffect(loadMine, []);

  const map = maps.find((m) => m.uuid === mapId);
  const onMap = useMemo(() => list.filter((l) => l.map === mapId), [list, mapId]);
  const agentsHere = useMemo(() => {
    const c = new Map<string, number>();
    onMap.forEach((l) => c.set(l.agent, (c.get(l.agent) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [onMap]);
  const shown = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("tr");
    return onMap.filter((l) => (!agentId || l.agent === agentId) && (!side || l.side === side) && (!site || l.site === site) && (!kind || l.kind === kind) && (!diff || l.diff === diff)
      && (!onlySet || me.fav.includes(l.id))
      && (!t || `${l.title} ${l.note} ${kindName(l.kind)} ${assets?.agents.get(l.agent)?.name ?? ""} ${abilityOf(assets, l)?.name ?? ""}`.toLocaleLowerCase("tr").includes(t)))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.official) - Number(a.official) || b.up - a.up);
  }, [onMap, agentId, side, site, kind, diff, onlySet, q, me.fav, assets]);

  const openOne = list.find((l) => l.id === open) ?? mine?.lineups.find((l) => l.id === open) ?? null;
  const siblings = shown.some((l) => l.id === open) ? shown : openOne ? [openOne] : [];
  const pos = openOne ? siblings.findIndex((l) => l.id === openOne.id) : -1;
  const go = (id: string) => { const l = list.find((x) => x.id === id); if (l && l.map !== mapId) setMapId(l.map); setOpen(id); };
  const canEdit = (l: Lineup) => admin || (l.status !== "live" && mine?.lineups.some((x) => x.id === l.id) === true);

  /* ---------- düzenleyici ve ayrıntı ---------- */
  if (edit) {
    return (
      <div className="lu panel fade">
        <Editor assets={assets} admin={admin} editing={edit.editing} start={edit.start} onToast={onToast} onCancel={() => setEdit(null)}
          onDone={(id, status) => { setEdit(null); loadMine(); onToast(status === "live" ? "Yayında!" : "Gönderildi, yetkililer kontrol edince yayına girer"); if (status === "live") setOpen(id); else setTab("com"); }} />
      </div>
    );
  }

  const head = (
    <div className="lu-head">
      <div className="lu-title">
        <span className="lu-logo"><Icon name="map" size={18} /></span>
        <div><h2>{valUpper("Lineup")}</h2><small>{list.length ? `${list.length} lineup · ${new Set(list.map((l) => l.map)).size} harita` : "Kütüphane"}</small></div>
      </div>
      <div className="lu-tabs" role="tablist">
        {TABS.filter(([id]) => id !== "mod" || admin).map(([id, n, ic]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => { setTab(id); setOpen(null); }}>
            <Icon name={ic} size={15} />{n}
            {id === "learn" && streak(me) > 0 && <em className="lu-fire">{streak(me)}</em>}
          </button>
        ))}
      </div>
      <div className="lu-hr">
        <span className="lu-mode seg" title="Lineup'ları kim anlatsın?">
          <button type="button" className={me.mode === "celeste" ? "on" : ""} onClick={() => patchMe({ mode: "celeste" })}>Celeste anlatsın</button>
          <button type="button" className={me.mode === "self" ? "on" : ""} onClick={() => patchMe({ mode: "self" })}>Kendim bakarım</button>
        </span>
        {me.mode === "celeste" && hasTurkishVoice() && (
          <button type="button" className={`ib${me.voice ? " on" : ""}`} onClick={() => patchMe({ voice: !me.voice })} title={me.voice ? "Sesli anlatım açık" : "Sesli anlatım kapalı"} aria-pressed={me.voice}><Icon name={me.voice ? "volume" : "mute"} size={16} /></button>
        )}
        <button type="button" className="x go lu-add" onClick={() => setEdit({ editing: null, start: { map: mapId, agent: agentId || undefined } })}><Icon name="plus" size={14} />Lineup ekle</button>
        <CloseButton onClick={onClose} />
      </div>
    </div>
  );

  return (
    <div className="lu panel fade">
      {head}
      {!me.seenIntro && (
        <div className="lu-intro">
          <Narrator text="Burası lineup köşemiz! Haritadan bir yetenek seç, adım adım göstereyim. Öğren sekmesinde her gün üç tane çalışırız, seri yaparsan XP kazanırsın." mood="flirt" speak={false} playing={false} />
          <button type="button" className="x go" onClick={() => patchMe({ seenIntro: true })}>Hadi başlayalım</button>
        </div>
      )}

      {openOne ? (
        <LineupView
          key={openOne.id}
          l={openOne}
          assets={assets}
          map={maps.find((m) => m.uuid === openOne.map)}
          votes={votes}
          onVotes={setVotes}
          canEdit={canEdit(openOne)}
          pos={pos >= 0 ? { i: pos, n: siblings.length } : undefined}
          onPrev={() => setOpen(siblings[(pos - 1 + siblings.length) % siblings.length]!.id)}
          onNext={() => setOpen(siblings[(pos + 1) % siblings.length]!.id)}
          onBack={() => setOpen(null)}
          onEdit={() => setEdit({ editing: openOne })}
          onToast={onToast}
        />
      ) : tab === "lib" ? (
        <div className="lu-lib">
          <div className="lu-maps" role="listbox" aria-label="Harita" ref={mapsRef}>
            {maps.map((m) => {
              const n = list.filter((l) => l.map === m.uuid).length;
              return (
                <button key={m.uuid} type="button" role="option" aria-selected={mapId === m.uuid} className={`lu-map${mapId === m.uuid ? " on" : ""}${n ? "" : " empty"}`} onClick={() => { setMapId(m.uuid); setAgentId(""); setHover(null); }} style={m.banner ? ({ "--bg": `url(${m.banner})` } as CSSProperties) : undefined}>
                  {mapId === m.uuid && <i className="lw-tick"><Icon name="check" size={12} /></i>}
                  <b>{nameUpper(m.name)}</b>{n > 0 && <small>{n}</small>}
                </button>
              );
            })}
          </div>

          <div className="lu-filters">
            <div className="lu-agents">
              <button type="button" className={`lu-ag all${!agentId ? " on" : ""}`} onClick={() => setAgentId("")}><span>Tümü</span><small>{onMap.length}</small></button>
              {agentsHere.map(([id, n]) => {
                const a = assets?.agents.get(id);
                return (
                  <button key={id} type="button" className={`lu-ag${agentId === id ? " on" : ""}`} onClick={() => setAgentId(agentId === id ? "" : id)} title={a?.name}>
                    <img src={a?.icon} alt="" /><small>{n}</small>
                  </button>
                );
              })}
            </div>
            <div className="lu-chips">
              <span className="seg">{([["", "Tümü"], ...SIDES] as [string, string][]).map(([id, n]) => <button key={id || "all"} type="button" className={side === id ? "on" : ""} onClick={() => setSide(id as Side | "")}>{n}</button>)}</span>
              <span className="seg">{SITES.map(([id, n]) => <button key={id} type="button" className={site === id ? "on" : ""} onClick={() => setSite(site === id ? "" : id)}>{n}</button>)}</span>
              <select className="lu-sel" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Durum">
                <option value="">Her durum</option>
                {KINDS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              <select className="lu-sel" value={diff} onChange={(e) => setDiff(Number(e.target.value))} aria-label="Zorluk">
                <option value={0}>Her zorluk</option>
                {DIFFS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              <label className="lu-search"><Icon name="search" size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Ara" /></label>
              <button type="button" className={`ib${onlySet ? " on" : ""}`} onClick={() => setOnlySet(!onlySet)} title="Yalnızca Setim" aria-pressed={onlySet}><Icon name="star" size={15} /></button>
              <button type="button" className={`ib${callouts ? " on" : ""}`} onClick={() => setCallouts(!callouts)} title="Bölge adları" aria-pressed={callouts}><Icon name="text" size={15} /></button>
            </div>
          </div>

          {error && !list.length ? (
            <Empty title="Kütüphane açılamadı" text={error} tone="err" onRetry={() => void refreshLineups(true)} />
          ) : (
            <div className="lu-main">
              {map ? (
                <div className="lu-board">
                  <div className="lu-hero" key={map.uuid} style={map.splash || map.banner ? ({ "--bg": `url(${map.splash ?? map.banner})` } as CSSProperties) : undefined}>
                    <div><small>Seçili harita</small><b>{nameUpper(map.name)}</b></div>
                    <span>{onMap.length} lineup · {agentsHere.length} ajan</span>
                  </div>
                  <MapBoard map={map} assets={assets} lineups={shown} hover={hover} onHover={setHover} onPick={(id) => setOpen(id)} callouts={callouts} done={mastered} />
                  <div className="lu-board-foot">
                    <span><i className="lgd land atk" />Saldırı</span><span><i className="lgd land def" />Savunma</span>
                    <small>Simgeye tıkla · tekerlekle yakınlaş</small>
                  </div>
                </div>
              ) : <div className="lu-board" />}
              <div className="lu-list">
                {(shown.length > 0 || filtered) && (
                  <div className="lu-list-h">
                    <b>{shown.length} lineup{filtered && onMap.length !== shown.length ? ` / ${onMap.length}` : ""}</b>
                    {filtered && <button type="button" onClick={clearFilters}><Icon name="x" size={12} />Filtreleri temizle</button>}
                  </div>
                )}
                {loading && !list.length && Array.from({ length: 4 }, (_, i) => <div key={i} className="lu-card sk" />)}
                {!loading && !shown.length && (
                  <div className="lu-none">
                    <Narrator text={onMap.length ? "Bu filtrelerle bir şey bulamadım. Filtreleri biraz gevşetelim mi?" : `${map?.name ?? "Bu harita"} için henüz lineup yok. İlkini sen eklersen adın kütüphanede yazar!`} mood={onMap.length ? "surprised" : "wink"} speak={false} playing={false} small />
                    {!onMap.length ? <button type="button" className="x go" onClick={() => setEdit({ editing: null, start: { map: mapId } })}><Icon name="plus" size={14} />İlk lineup'ı ekle</button>
                      : <button type="button" className="x" onClick={clearFilters}>Filtreleri temizle</button>}
                  </div>
                )}
                {shown.map((l, i) => <LineupCard key={l.id} l={l} assets={assets} i={i} hover={hover === l.id} fav={me.fav.includes(l.id)} learned={mastered(l.id)} onHover={setHover} onOpen={() => setOpen(l.id)} />)}
              </div>
            </div>
          )}
        </div>
      ) : tab === "learn" ? (
        <div className="lu-learn">
          <div className="lu-chips">
            <select className="lu-sel" value={mapId} onChange={(e) => setMapId(e.target.value)} aria-label="Harita"><option value="">Bütün haritalar</option>{maps.filter((m) => list.some((l) => l.map === m.uuid)).map((m) => <option key={m.uuid} value={m.uuid}>{m.name}</option>)}</select>
            <select className="lu-sel" value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Ajan"><option value="">Bütün ajanlar</option>{[...new Set(list.map((l) => l.agent))].map((id) => <option key={id} value={id}>{assets?.agents.get(id)?.name ?? id}</option>)}</select>
            <MainsPicker assets={assets} list={list} />
          </div>
          <Practice list={list} assets={assets} maps={maps} mapId={mapId} agentId={agentId} onOpen={go} onToast={onToast} />
        </div>
      ) : tab === "set" ? (
        <MySet list={list} assets={assets} maps={maps} onOpen={go} onToast={onToast} />
      ) : tab === "com" ? (
        <Community list={list} assets={assets} maps={maps} mine={mine?.lineups ?? []} onOpen={go} onEdit={(l) => setEdit({ editing: l })} onNew={() => setEdit({ editing: null, start: { map: mapId } })} />
      ) : (
        <Moderation assets={assets} maps={maps} onToast={onToast} onOpen={(l) => { setMine((m) => (m ? { ...m, lineups: [...m.lineups.filter((x) => x.id !== l.id), l] } : m)); setOpen(l.id); }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LineupCard({ l, assets, i, hover, fav, learned, onHover, onOpen }: { l: Lineup; assets: Assets | null; i: number; hover: boolean; fav: boolean; learned: boolean; onHover: (id: string | null) => void; onOpen: () => void }) {
  const ab = abilityOf(assets, l);
  const agent = assets?.agents.get(l.agent);
  const ps = patchState(l.patch);
  return (
    <button type="button" className={`lu-card ${l.side}${hover ? " hv" : ""}${l.featured ? " feat" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 35}ms`, "--ag": agent?.colors?.[0] ?? "var(--accent)" } as CSSProperties}
      onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(l.id)} onClick={onOpen}>
      <span className="lu-card-ab">{ab?.icon ? <img src={ab.icon} alt="" /> : null}<kbd>{SLOT_KEY[l.slot]}</kbd></span>
      <span className="lu-card-b">
        <b>{valUpper(l.title)}</b>
        <small>
          {agent && <img src={agent.icon} alt="" />}
          {agent?.name} · {l.site ? `${siteName(l.site)} · ` : ""}{kindName(l.kind)}
        </small>
      </span>
      <span className="lu-card-r">
        <span className={`lu-dots d${l.diff}`} title={DIFFS.find(([d]) => d === l.diff)?.[1]}><i /><i /><i /></span>
        <span className="lu-tags">
          {l.official && <em className="off" title="Celeste lineup'ı"><Icon name="spark" size={11} /></em>}
          {l.featured && <em className="feat" title="Öne çıkan"><Icon name="trophy" size={11} /></em>}
          {fav && <em className="fav" title="Setinde"><Icon name="star" size={11} /></em>}
          {learned && <em className="ok" title="Öğrendin"><Icon name="check" size={11} /></em>}
          {ps === "old" && <em className="old" title="Eski yamadan">{l.patch}</em>}
          {l.clip && <em title="Klibi var"><Icon name="play" size={10} /></em>}
        </span>
      </span>
    </button>
  );
}

function MainsPicker({ assets, list }: { assets: Assets | null; list: Lineup[] }) {
  const me = useMe();
  const ids = [...new Set(list.map((l) => l.agent))];
  return (
    <span className="lu-mains" title="Ana ajanların: Günün 3 lineup'ı önce bunlardan seçilir">
      <small>Ajanlarım</small>
      {ids.map((id) => {
        const a = assets?.agents.get(id);
        const on = me.mains.includes(id);
        return <button key={id} type="button" className={on ? "on" : ""} onClick={() => patchMe({ mains: on ? me.mains.filter((x) => x !== id) : [...me.mains, id] })} title={a?.name} aria-pressed={on}><img src={a?.icon} alt="" /></button>;
      })}
    </span>
  );
}

function MySet({ list, assets, maps, onOpen, onToast }: { list: Lineup[]; assets: Assets | null; maps: MapInfo[]; onOpen: (id: string) => void; onToast: (t: string) => void }) {
  const me = useMe();
  const [code, setCode] = useState("");
  const favs = list.filter((l) => me.fav.includes(l.id));
  const byMap = maps.map((m) => [m, favs.filter((l) => l.map === m.uuid)] as const).filter(([, ls]) => ls.length);
  const copy = async (ids: string[]) => {
    const text = shareCode(ids);
    try {
      if (inTauri) { const { writeText } = await import("@tauri-apps/plugin-clipboard-manager"); await writeText(text); } else await navigator.clipboard.writeText(text);
      onToast(`${ids.length} lineup'lık kod kopyalandı`);
    } catch { onToast("Kopyalanamadı"); }
  };
  const add = () => {
    const ids = readCode(code).filter((id) => list.some((l) => l.id === id));
    if (!ids.length) { onToast("Kod okunamadı ya da lineup'lar kütüphanede yok"); return; }
    addFavs(ids); setCode(""); onToast(`${ids.length} lineup setine eklendi`);
  };
  return (
    <div className="lu-set">
      <div className="lu-code">
        <div>
          <b>Paylaşım kodu</b>
          <small>Setini arkadaşına ya da takımına kodla ver. Gelen kodu buraya yapıştır.</small>
        </div>
        <input className="led-in" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") add(); }} placeholder="CL1-…" />
        <button type="button" className="x" onClick={add} disabled={!code.trim()}>Ekle</button>
        <button type="button" className="x go" onClick={() => void copy(favs.map((l) => l.id))} disabled={!favs.length}><Icon name="link" size={14} />Setimi kopyala</button>
      </div>
      {!favs.length ? (
        <div className="lu-none"><Narrator text="Setin boş. Beğendiğin lineup'ta Setime ekle'ye bas; harita harita burada toplanır." mood="wink" speak={false} playing={false} small /></div>
      ) : byMap.map(([m, ls]) => (
        <section key={m.uuid} className="lu-setmap">
          <h4 style={m.banner ? ({ "--bg": `url(${m.banner})` } as CSSProperties) : undefined}><b>{m.name}</b><small>{ls.length} lineup · {ls.filter((l) => mastered(l.id)).length} öğrenildi</small>
            <button type="button" className="x" onClick={() => void copy(ls.map((l) => l.id))}><Icon name="link" size={13} />Kod</button></h4>
          <div className="lu-setgrid">
            {ls.map((l, i) => <LineupCard key={l.id} l={l} assets={assets} i={i} hover={false} fav learned={mastered(l.id)} onHover={() => undefined} onOpen={() => onOpen(l.id)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = { live: ["Yayında", "ok"], pending: ["Onay bekliyor", "wait"], rejected: ["Reddedildi", "bad"] };

function Community({ list, assets, maps, mine, onOpen, onEdit, onNew }: { list: Lineup[]; assets: Assets | null; maps: MapInfo[]; mine: Lineup[]; onOpen: (id: string) => void; onEdit: (l: Lineup) => void; onNew: () => void }) {
  const community = list.filter((l) => !l.official);
  const top = [...community].sort((a, b) => b.up + b.works - (a.up + a.works)).slice(0, 6);
  const authors = useMemo(() => {
    const c = new Map<string, { n: number; up: number }>();
    community.forEach((l) => { const x = c.get(l.by) ?? { n: 0, up: 0 }; c.set(l.by, { n: x.n + 1, up: x.up + l.up }); });
    return [...c.entries()].filter(([by]) => by).sort((a, b) => b[1].up + b[1].n * 3 - (a[1].up + a[1].n * 3)).slice(0, 8);
  }, [community]);
  return (
    <div className="lu-com">
      <div className="lu-cta">
        <Narrator text="Bildiğin bir lineup mı var? Gönder, yetkililer bakıp yayınlasın. Adın kütüphanede ve Discord'da görünür!" mood="flirt" speak={false} playing={false} small />
        <button type="button" className="x go" onClick={onNew}><Icon name="upload" size={14} />Lineup gönder</button>
      </div>
      <div className="lu-com-grid">
        <section>
          <h4><Icon name="user" size={15} />Gönderilerim</h4>
          {!mine.length ? <p className="d none">{inTauri ? "Henüz gönderin yok." : "Gönderilerin masaüstü uygulamasında görünür."}</p> : (
            <div className="lu-mine">
              {mine.map((l) => {
                const [label, tone] = STATUS[l.status] ?? ["", ""];
                const ab = abilityOf(assets, l);
                return (
                  <div key={l.id} className={`lu-mi ${tone}`}>
                    {ab?.icon && <img src={ab.icon} alt="" />}
                    <span><b>{l.title}</b><small>{maps.find((m) => m.uuid === l.map)?.name} · {assets?.agents.get(l.agent)?.name}{l.status === "live" ? ` · ${l.up} beğeni` : ""}</small>
                      {l.status === "rejected" && l.reason && <small className="why">Neden: {l.reason}</small>}</span>
                    <em className={`st ${tone}`}>{label}</em>
                    {l.status !== "live" && <button type="button" className="x" onClick={() => onEdit(l)}>Düzenle</button>}
                    {l.status === "live" && <button type="button" className="x" onClick={() => onOpen(l.id)}>Aç</button>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section>
          <h4><Icon name="trophy" size={15} />En çok katkı verenler</h4>
          {!authors.length ? <p className="d none">İlk topluluk lineup'ı seninki olsun.</p> : (
            <ol className="lu-lb">
              {authors.map(([by, x], i) => <li key={by} className={i < 3 ? `p${i + 1}` : ""}><em>{i + 1}</em><b>{by}</b><small>{x.n} lineup · {x.up} beğeni</small></li>)}
            </ol>
          )}
        </section>
      </div>
      <section>
        <h4><Icon name="flame" size={15} />Topluluğun en beğenilenleri</h4>
        {!top.length ? <p className="d none">Henüz topluluk lineup'ı yok.</p> : (
          <div className="lu-setgrid">{top.map((l, i) => <LineupCard key={l.id} l={l} assets={assets} i={i} hover={false} fav={false} learned={mastered(l.id)} onHover={() => undefined} onOpen={() => onOpen(l.id)} />)}</div>
        )}
      </section>
    </div>
  );
}

function Moderation({ assets, maps, onToast, onOpen }: { assets: Assets | null; maps: MapInfo[]; onToast: (t: string) => void; onOpen: (l: Lineup) => void }) {
  const [rows, setRows] = useState<Lineup[] | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const load = () => { adminLineups<{ lineups: Lineup[] }>("pending").then((r) => setRows(r.lineups)).catch((e) => onToast(e instanceof Error ? e.message : String(e))); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (action: string, id: string) => {
    try { await adminLineups(action, { id, reason: reason[id] ?? "" }); setRows((r) => r?.filter((x) => x.id !== id) ?? r); void refreshLineups(true); onToast(action === "approve" ? "Yayına alındı" : action === "reject" ? "Reddedildi" : "Silindi"); }
    catch (e) { onToast(e instanceof Error ? e.message : String(e)); }
  };
  if (!rows) return <p className="d none">Yükleniyor…</p>;
  if (!rows.length) return <div className="lu-none"><Narrator text="Onay bekleyen gönderi yok. Her şey tertemiz!" mood="happy" speak={false} playing={false} small /></div>;
  return (
    <div className="lu-mod">
      {rows.map((l) => {
        const ab = abilityOf(assets, l);
        return (
          <div key={l.id} className="lu-modrow">
            {ab?.icon && <img src={ab.icon} alt="" />}
            <span><b>{l.title}</b><small>{l.by} · {maps.find((m) => m.uuid === l.map)?.name} · {assets?.agents.get(l.agent)?.name} · {kindName(l.kind)}</small></span>
            <button type="button" className="x" onClick={() => onOpen(l)}>Önizle</button>
            <input className="led-in" placeholder="Reddetme nedeni" value={reason[l.id] ?? ""} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setReason({ ...reason, [l.id]: e.target.value })} />
            <button type="button" className="x bad" onClick={() => void act("reject", l.id)}>Reddet</button>
            <button type="button" className="x" onClick={() => void act("delete", l.id)}><Icon name="x" size={13} /></button>
            <button type="button" className="x go" onClick={() => void act("approve", l.id)}><Icon name="check" size={13} />Onayla</button>
          </div>
        );
      })}
    </div>
  );
}
