import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets, WeaponInfo } from "./assets";
import { charmIcon, lookup, resolveFlex, resolveSkin, resolveSprays } from "./assets";
import { ago, stamp, analyze, formBadge, isComp, modeGroup, modeName, styleBadge, type ModeGroup, type WeaponStat } from "./playstyle";
import { DEFAULT_TH, type Thresholds } from "./theme";
import { TAGS, type Entry, type TagId } from "./seen";
import { actRows, agentBuckets, compOnly, firstAct, kdOf, oneTrick, pool, roleBuckets, tally, winPct, type Bucket, type Tally } from "./profile";
import type { Player, PremierTeam } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;

/* Oyun içi cephanelikle aynı düzen: yan silahlar | SMG + pompalı | tüfek + yakın dövüş | keskin nişancı + makineli. */
const LAYOUT: [string, string][][] = [
  [["Sidearm", "Yan silahlar"]],
  [["SMG", "Hafif makineliler"], ["Shotgun", "Pompalılar"]],
  [["Rifle", "Tüfekler"], ["Melee", "Yakın dövüş"]],
  [["Sniper", "Keskin nişancılar"], ["Heavy", "Makineli tüfekler"]],
];

/* Silah sırası oyun içi cephanelikle aynıdır (fiyata göre, ucuzdan pahalıya). Listede olmayan silah sona eklenir. */
const ORDER = [
  "classic", "shorty", "frenzy", "ghost", "bandit", "sheriff",
  "stinger", "spectre", "bucky", "judge",
  "bulldog", "guardian", "warden", "phantom", "vandal",
  "marshal", "outlaw", "operator", "ares", "odin",
];
const rank = (name: string) => { const i = ORDER.indexOf(name.toLowerCase()); return i < 0 ? 99 : i; };

function Tile({ w, p, a }: { w: WeaponInfo; p: Player; a: Assets }) {
  const slot = p.loadout.weapons.find((x) => lookup(x.weaponId) === w.id);
  const skin = resolveSkin(a, w, slot);
  const charm = charmIcon(a, slot);
  return (
    <div className={skin.isDefault ? "gt dim" : "gt"} title={`${w.name}: ${skin.name}${skin.chromaName ? ` (${skin.chromaName})` : ""}`}>
      <img className="gi" src={skin.image} alt="" loading="lazy" />
      <div className="gx">
        <span className="gn">{skin.name}</span>
        <span className="gw">
          {w.name}
          {skin.swatch && <img className="sw" src={skin.swatch} alt={skin.chromaName ?? "Renk"} />}
        </span>
      </div>
      {charm && <img className="gc" src={charm.icon} alt={charm.name} title={charm.name} loading="lazy" />}
    </div>
  );
}

interface PanelProps {
  p: Player;
  lobby: Player[];
  th?: Thresholds;
  assets: Assets;
  mapId?: string | null;
  entry?: Entry;
  onLabel: (label: string) => void;
  onTag: (tag: TagId | null) => void;
  onClose: () => void;
  onCopy: (n: string | null) => void;
}

const None = ({ text = "Oyun bu bilgiyi göndermedi" }: { text?: string }) => <p className="d none">{text}</p>;
type Tab = "guns" | "perf" | "history" | "profile";
const TABS: [Tab, string][] = [["guns", "Kaplamalar"], ["perf", "Performans"], ["history", "Geçmiş"], ["profile", "Profil"]];

function WeaponTable({ title, list, assets, unit }: { title: string; list: WeaponStat[]; assets: Assets; unit: string }) {
  const rows = list.map((w) => ({ w, info: assets.weapons.find((x) => x.id === w.id) })).filter((r) => r.info).slice(0, 3);
  const max = Math.max(1, ...rows.map((r) => r.w.count));
  return (
    <div>
      <h3 className="h2">{title}</h3>
      {rows.length ? rows.map(({ w, info }) => (
        <div className="wr" key={w.id}>
          <img src={info!.icon} alt="" />
          <span className="wn">{info!.name}</span>
          <span className="wb"><i style={{ width: `${(100 * w.count) / max}%` }} /></span>
          <span className="wv">{w.count} {unit}</span>
        </div>
      )) : <None text="Veri yok" />}
    </div>
  );
}

/* Harita ya da ajan için üç sayı: maç, galibiyet oranı, K/D. */
function Trio({ t, empty }: { t: Tally; empty: string }) {
  if (!t.matches) return <None text={empty} />;
  const w = winPct(t);
  return (
    <div className="stats s3">
      <div className="gold"><b>{t.matches}</b><small>Maç</small></div>
      <div className="teal"><b>{w != null ? `%${w}` : "–"}</b><small>Galibiyet</small></div>
      <div className="orange"><b>{kdOf(t).toFixed(2)}</b><small>K/D</small></div>
    </div>
  );
}

/* Satır: ikon, ad, pay çubuğu ve "7 maç · %57 · 1,24". */
function BucketRows({ list, total, limit }: { list: Bucket[]; total: number; limit: number }) {
  return (
    <>
      {list.slice(0, limit).map((b) => (
        <div className="br" key={b.id} title={`${b.name}: ${b.t.matches} maç, ${b.t.wins} galibiyet`}>
          {b.icon ? <img src={b.icon} alt="" loading="lazy" /> : <span />}
          <span className="wn">{b.name}</span>
          <span className="wb"><i style={{ width: `${(100 * b.t.matches) / Math.max(1, total)}%` }} /></span>
          <span className="wv">{b.t.matches} maç · %{winPct(b.t)} · {kdOf(b.t).toFixed(2)}</span>
        </div>
      ))}
    </>
  );
}

export function LoadoutPanel({ p, lobby, th = DEFAULT_TH, assets, mapId, entry, onLabel, onTag, onClose, onCopy }: PanelProps) {
  const [draft, setDraft] = useState(entry?.label ?? "");
  const [tab, setTab] = useState<Tab>("guns");
  const [premier, setPremier] = useState<PremierTeam | null | "loading" | "error">("loading");
  const anonymous = p.hiddenName && !p.isSelf;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Premier takımı: ismini gizleyen oyuncular için sorgu yapılmaz.
  useEffect(() => {
    setPremier("loading");
    if (!inTauri || anonymous) { setPremier(null); return; }
    let live = true;
    invoke<PremierTeam | null>("get_premier", { puuid: p.puuid })
      .then((t) => live && setPremier(t))
      .catch(() => live && setPremier("error"));
    return () => { live = false; };
  }, [p.puuid, anonymous]);

  // "Geçmiş" sekmesi açılınca oyuncunun son 25 maçı içindeki rekabet maçları da istenir (bir kez, oyuncu başına).
  const deepened = useRef(new Set<string>());
  useEffect(() => {
    if (tab !== "history" || !inTauri || deepened.current.has(p.puuid)) return;
    deepened.current.add(p.puuid);
    invoke("deepen_player", { puuid: p.puuid }).catch(() => deepened.current.delete(p.puuid));
  }, [tab, p.puuid]);

  const by = (cat: string) => assets.weapons.filter((w) => w.category === cat).sort((a, b) => rank(a.name) - rank(b.name));
  const card = assets.cards.get(lookup(p.cardId));
  const title = assets.titles.get(lookup(p.titleId));
  const cur = assets.tiers.get(p.rank.current);
  const peak = assets.tiers.get(p.rank.peak);
  const agent = assets.agents.get(lookup(p.agentId));
  const sprays = resolveSprays(assets, p.loadout);
  const flex = resolveFlex(assets, p.loadout);

  // Maç modu filtresi: varsayılan rekabet (yoksa tümü). Rozetler her zaman rekabet verisinden gelir.
  const MODES: { id: "all" | ModeGroup; label: string }[] = [
    { id: "competitive", label: "Rekabet" }, { id: "unrated", label: "Derecesiz" }, { id: "spikerush", label: "Tam gaz" }, { id: "other", label: "Diğer" }, { id: "all", label: "Tümü" },
  ];
  const [chosen, setChosen] = useState<"all" | ModeGroup | null>(null);
  useEffect(() => setChosen(null), [p.puuid]);
  const countOf = (m: "all" | ModeGroup) => (m === "all" ? p.form.length : p.form.filter((f) => modeGroup(f.queue) === m).length);
  const mode = chosen ?? (countOf("competitive") > 0 ? "competitive" : "all");
  const shown = mode === "all" ? p.form : p.form.filter((f) => modeGroup(f.queue) === mode);
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? "";

  const play = analyze(p);
  const playShown = analyze(p, shown);
  const fb = formBadge(p);
  const sb = styleBadge(play, th);
  const rrSum = p.rrTrend.reduce((a, b) => a + b, 0);
  const sameAgent = shown.filter((f) => lookup(f.agentId) === lookup(p.agentId));
  const sameKd = (() => {
    const k = sameAgent.reduce((a, f) => a + f.kills, 0), d = sameAgent.reduce((a, f) => a + f.deaths, 0);
    return d ? k / d : k;
  })();
  const kd = (k: number, d: number) => (d ? k / d : k).toFixed(2);

  // Geçmiş sekmesi: yalnızca rekabet maçları. Derin geçmiş geldiyse hepsi, gelmediyse satırdaki son maçlar.
  const hist = compOnly(pool(p));
  const onMap = hist.filter((f) => lookup(f.mapId) === lookup(mapId));
  const onAgent = hist.filter((f) => lookup(f.agentId) === lookup(p.agentId));
  const agents = agentBuckets(hist, assets);
  const roles = roleBuckets(hist, assets);
  const trick = oneTrick(agents);
  const acts = actRows(p, assets);
  const first = firstAct(acts);
  const [actsOpen, setActsOpen] = useState(false);
  useEffect(() => setActsOpen(false), [p.puuid]);
  const mapName = assets.maps.get(lookup(mapId));
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  return (
    <div className="panel" role="dialog" aria-label="Oyuncu ayrıntısı">
      <div className="ph">
        <div>
          <h2 className="t">
            <button className="namebtn" type="button" title="Kullanıcı adını kopyala" onClick={() => onCopy(anonymous ? entry?.label ?? null : p.name ?? null)}>
              <span className="pn">{anonymous ? entry?.label ?? "Oyuncu (isim gizli)" : p.name}</span>
            </button>
            {sb && <span className={`bd ${sb.tone}`} title={sb.tip}>{sb.text}</span>}
            {fb && <span className={`bd ${fb.tone}`} title={fb.tip}>{fb.text}</span>}
          </h2>
          <p className="m">
            <b className="ag-n">{agent?.name}</b>
            <span className="sep" />
            <span style={{ color: cur ? tierColor(cur.color) : undefined }}>{cur?.name ?? "Derecesiz"}{p.rank.current > 0 ? ` · ${p.rank.rr} RR` : ""}</span>
            {p.rank.leaderboard ? <span className="lbr" title="Güncel act liderlik tablosundaki sırası">#{p.rank.leaderboard.toLocaleString("tr-TR")}</span> : null}
            <span className="sep" />
            Peak <span style={{ color: peak ? tierColor(peak.color) : undefined }}>{peak?.name ?? "–"}</span>
            {p.level != null && <><span className="sep" />Seviye {p.level}</>}
          </p>
        </div>
        <div className="phr">
          {!p.isSelf && (
            <span className="tagrow" title="Etiketler yalnızca bu bilgisayarda saklanır. İsim gizli olsa da aynı oyuncuyu sonraki maçta tanır.">
              {TAGS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={entry?.tag === t.id ? "tg on" : "tg"}
                  style={{ color: t.color, borderColor: t.color }}
                  onClick={() => onTag(entry?.tag === t.id ? null : t.id)}
                  aria-pressed={entry?.tag === t.id}
                >
                  {t.label}
                </button>
              ))}
            </span>
          )}
          <button className="x" onClick={onClose} type="button">Kapat</button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "guns" && (
        <div className="gcols fade">
          {LAYOUT.map((col, i) => (
            <div className="gcol" key={i}>
              {col.map(([cat, name]) => (
                <section key={cat}>
                  <h3 className="h2">{name}</h3>
                  {by(cat).map((w) => <Tile key={w.id} w={w} p={p} a={assets} />)}
                </section>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "perf" && (
        <div className="perf fade">
          <div>
            <h3 className="h2">Son maçlar{p.kd != null && <span className="hv" title="Rekabet maçlarının K/D'si">Rekabet K/D {p.kd.toFixed(2)}</span>}</h3>
            {p.form.length > 0 && (
              <div className="mfil" role="group" aria-label="Maç modu">
                {MODES.filter((m) => m.id === mode || countOf(m.id) > 0).map((m) => (
                  <button key={m.id} type="button" className={m.id === mode ? "on" : ""} aria-pressed={m.id === mode} onClick={() => setChosen(m.id)}>
                    {m.label}<small>{countOf(m.id)}</small>
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 ? <None text={p.formLoading ? "Yükleniyor…" : p.form.length ? `${modeLabel} maçı yok` : "Maç verisi yok"} /> : (
              <div className="tb">
                <div className="tr tmx hd2"><span /><span>Harita</span><span>Ajan</span><span className="num">K / D / A</span><span className="num">K/D</span><span className="num">Zaman</span></div>
                {shown.map((f, i) => {
                  const fa = assets.agents.get(lookup(f.agentId));
                  return (
                    <div className="tr tmx" key={i} title={modeName(f.queue)}>
                      <span className={`${f.won ? "fc win" : "fc loss"}${isComp(f) ? "" : " alt"}`}>{f.won ? "W" : "L"}</span>
                      <span>{assets.maps.get(lookup(f.mapId)) ?? "?"}{mode === "all" && <small className="mo"> · {modeName(f.queue)}</small>}</span>
                      <span className="ra">{fa && <img src={fa.icon} alt="" />}{fa?.name ?? "?"}</span>
                      <span className="num">{f.kills} / {f.deaths} / {f.assists}</span>
                      <span className="num">{kd(f.kills, f.deaths)}</span>
                      <span className="num tt">{f.started ? <><b>{stamp(f.started)}</b><small>{ago(f.started)} önce</small></> : "–"}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {sameAgent.length > 0 && agent && (
              <p className="m cap">{agent.name}: {sameAgent.length} maç, K/D {sameKd.toFixed(2)}, {sameAgent.filter((f) => f.won).length} galibiyet</p>
            )}
            <h3 className="h2">Son 24 saat</h3>
            <p className="m cap">
              <b>{p.played24h}{p.played24hCapped ? "+" : ""} maç</b>
              {p.lastMatchAt ? <span className="d">, sonuncusu {ago(p.lastMatchAt)} önce başladı</span> : null}
            </p>
          </div>

          <div>
            {playShown ? (
              <>
                <h3 className="h2">Oynayış · {modeLabel}<span className="hv">{playShown.matches} maç, {playShown.rounds} round</span></h3>
                <div className="stats">
                  <div className="gold"><b>{playShown.hsPct != null ? `%${playShown.hsPct.toFixed(0)}` : "–"}</b><small>Kafa isabeti</small></div>
                  <div className="orange"><b>{playShown.adr != null ? playShown.adr.toFixed(0) : "–"}</b><small>Round başı hasar</small></div>
                  <div className="teal"><b>{playShown.firstKills}</b><small>İlk kan</small></div>
                  <div className="loss"><b>{playShown.firstDeaths}</b><small>İlk ölüm</small></div>
                </div>
                <div className="wpair">
                  <WeaponTable title="Öldürdüğü silahlar" list={playShown.killWeapons} assets={assets} unit="kill" />
                  <WeaponTable title="Satın aldığı silahlar" list={playShown.bought} assets={assets} unit="round" />
                </div>
              </>
            ) : <None text="Oynayış verisi yok" />}
            {p.rrTrend.length > 0 && (
              <>
                <h3 className="h2">Rekabet RR<span className="hv">son {p.rrTrend.length} maç, toplam <b className={rrSum >= 0 ? "pos" : "neg"}>{sign(rrSum)}</b></span></h3>
                <div className="pills">
                  {p.rrTrend.map((r, i) => <span key={i} className={r >= 0 ? "pill pos" : "pill neg"}>{sign(r)}</span>)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="perf fade">
          <div>
            <h3 className="h2">Bu haritada{mapName ? ` · ${mapName}` : ""}<span className="hv">rekabet</span></h3>
            <Trio t={tally(onMap)} empty={mapName ? "Bu haritada rekabet maçı yok" : "Harita bilinmiyor"} />
            <h3 className="h2">Bu ajanda{agent ? ` · ${agent.name}` : ""}<span className="hv">rekabet</span></h3>
            <Trio t={tally(onAgent)} empty="Bu ajanla rekabet maçı yok" />
            <h3 className="h2">Roller<span className="hv">son {hist.length} rekabet maçı{p.deepLoading ? " · yükleniyor…" : ""}</span></h3>
            {roles.length ? <BucketRows list={roles} total={hist.length} limit={4} /> : <None text={p.formLoading || p.deepLoading ? "Yükleniyor…" : "Rekabet maçı yok"} />}
          </div>
          <div>
            <h3 className="h2">Ajanlar{trick && <span className="bd gold" title="Son rekabet maçlarının %70'inden fazlasını aynı ajanla oynadı">{trick.name} oyuncusu</span>}</h3>
            {agents.length ? <BucketRows list={agents} total={hist.length} limit={5} /> : <None text={p.formLoading || p.deepLoading ? "Yükleniyor…" : "Rekabet maçı yok"} />}
            <h3 className="h2">Rekabet geçmişi</h3>
            {acts.length ? (
              <>
                <p className="m cap0">
                  {first ? <>Kayıtlı ilk rekabet acti <b>{first.label}</b> · </> : null}{acts.length} act oynadı
                </p>
                <button type="button" className={actsOpen ? "fold on" : "fold"} aria-expanded={actsOpen} onClick={() => setActsOpen(!actsOpen)}>
                  <span className="chev" aria-hidden="true" />Geçmiş actler<small>{acts.length}</small>
                </button>
                {actsOpen && (
                  <div className="tb acts fade">
                    <div className="tr hd2 actr"><span>Act</span><span>Act sonu</span><span>En yüksek</span><span className="num">Galibiyet</span></div>
                    {acts.map((r) => {
                      const end = assets.tiers.get(r.tier), top = assets.tiers.get(r.peak);
                      return (
                        <div className="tr actr" key={r.seasonId}>
                          <span className="actn"><b>{r.label}</b>{r.when && <small>{r.when}</small>}</span>
                          <span className="ra">{end && r.tier > 0 ? <><img src={end.icon} alt="" /><span style={{ color: tierColor(end.color) }}>{end.name}</span></> : <span className="d">–</span>}</span>
                          <span className="ra">{top && r.peak > 0 ? <><img src={top.icon} alt="" /><span style={{ color: tierColor(top.color) }}>{top.name}</span></> : <span className="d">–</span>}</span>
                          <span className="num">{r.wins}/{r.games}<small className="d"> %{Math.round((100 * r.wins) / Math.max(1, r.games))}</small></span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : <None text="Rekabet geçmişi yok" />}
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="prof3 fade">
          <div>
            <h3 className="h2">Spreyler</h3>
            {sprays.length ? sprays.map((s) => (
              <div className="chrow" key={s.name}><img src={s.icon} alt="" loading="lazy" /><span>{s.name}</span></div>
            )) : <None />}
          </div>
          <div>
            <h3 className="h2">Flex</h3>
            {flex.length ? flex.map((f) => (
              <div className="chrow" key={f.name}><img src={f.icon} alt="" loading="lazy" /><span>{f.name}</span></div>
            )) : <None />}
            <h3 className="h2">Kart ve ünvan</h3>
            {card || title ? (
              <div className="card">
                {card && <img src={card.wide} alt="" loading="lazy" />}
                {title && <span>{title}</span>}
              </div>
            ) : <None />}
          </div>
          <div>
            <h3 className="h2">Premier</h3>
            {anonymous ? <None text="İsmi gizli oyuncular için sorgulanmaz" />
              : premier === "loading" ? <None text="Yükleniyor…" />
              : premier === "error" ? <None text="Premier bilgisi alınamadı" />
              : premier === null ? <None text="Premier takımı yok" />
              : (
                <>
                  <p className="team"><b>{premier.name}</b>{premier.tag && <span className="tagname">#{premier.tag}</span>}</p>
                  <div className="members">
                    {premier.members.map((m) => (
                      <span key={m.puuid} className={m.puuid === p.puuid ? "mem me" : "mem"}><span className="pn">{m.hidden ? "İsim gizli" : m.name ?? "…"}</span></span>
                    ))}
                  </div>
                </>
              )}
            {p.together.length > 0 && (
              <>
                <h3 className="h2">Son rekabet maçlarında birlikte<span className="hv">Aynı partide girilen maç</span></h3>
                <div className="tb">
                  {p.together.slice(0, 4).map((t) => {
                    const mate = lobby.find((x) => x.puuid === t.puuid);
                    const now = p.partySure && mate?.partySure && mate.party === p.party;
                    return (
                      <div className="tr tog" key={t.puuid}>
                        <span className="pair"><b className="pn">{mate ? (mate.hiddenName && !mate.isSelf ? "İsim gizli" : mate.name ?? "…") : "?"}</b></span>
                        <span className="num">{t.count}/{t.of} maç</span>
                        {now ? <span className="bd win">Şu an aynı parti</span> : <span />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {anonymous && (
              <>
                <h3 className="h2">Kendi notun</h3>
                <div className="note">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onLabel(draft); e.stopPropagation(); }}
                    placeholder="isim#etiket"
                    aria-label="Oyuncu için kişisel not"
                  />
                  <button className="x" type="button" onClick={() => onLabel(draft)}>Kaydet</button>
                </div>
              </>
            )}
            {entry && entry.history.length >= 2 && (
              <>
                <h3 className="h2">Daha önce karşılaştınız<span className="hv">{entry.n}. maç</span></h3>
                <div className="tb">
                  {entry.history.slice(-4, -1).reverse().map((h, i) => (
                    <div className="tr met" key={i}>
                      <span className="mn pn">{!anonymous && h.name ? h.name : "–"}</span>
                      <span>{assets.maps.get(lookup(h.mapId)) ?? "?"}</span>
                      <span>{assets.agents.get(lookup(h.agentId))?.name ?? "?"}</span>
                      <span className={h.side === "ally" ? "side-ally" : "side-enemy"}>{h.side === "ally" ? "Takım" : "Rakip"}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Düşük rank renkleri (Demir gibi) siyah zeminde soluk kalır; okunur olsun diye beyaza çekilir. */
export const tierColor = (c: string) => `color-mix(in srgb, ${c} 62%, #fff)`;
