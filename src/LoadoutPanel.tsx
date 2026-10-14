import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets, WeaponInfo } from "./assets";
import { charmIcon, lookup, resolveFlex, resolveSkin, resolveSprays } from "./assets";
import { ago, analyze, formBadge, smurfSigns, styleBadge, type WeaponStat } from "./playstyle";
import { DEFAULT_TH, type Thresholds } from "./theme";
import { TAGS, type Entry, type TagId } from "./seen";
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
  entry?: Entry;
  onLabel: (label: string) => void;
  onTag: (tag: TagId | null) => void;
  onClose: () => void;
  onCopy: (n: string | null) => void;
}

const None = ({ text = "Oyun bu bilgiyi göndermedi" }: { text?: string }) => <p className="d none">{text}</p>;
type Tab = "guns" | "perf" | "profile";
const TABS: [Tab, string][] = [["guns", "Kaplamalar"], ["perf", "Performans"], ["profile", "Profil"]];

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

export function LoadoutPanel({ p, lobby, th = DEFAULT_TH, assets, entry, onLabel, onTag, onClose, onCopy }: PanelProps) {
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

  const by = (cat: string) => assets.weapons.filter((w) => w.category === cat).sort((a, b) => rank(a.name) - rank(b.name));
  const card = assets.cards.get(lookup(p.cardId));
  const title = assets.titles.get(lookup(p.titleId));
  const cur = assets.tiers.get(p.rank.current);
  const peak = assets.tiers.get(p.rank.peak);
  const agent = assets.agents.get(lookup(p.agentId));
  const sprays = resolveSprays(assets, p.loadout);
  const flex = resolveFlex(assets, p.loadout);

  const play = analyze(p);
  const fb = formBadge(p);
  const sb = styleBadge(play, th);
  const smurf = smurfSigns(p, th, cur?.name ?? "");
  const rrSum = p.rrTrend.reduce((a, b) => a + b, 0);
  const sameAgent = p.form.filter((f) => lookup(f.agentId) === lookup(p.agentId));
  const sameKd = (() => {
    const k = sameAgent.reduce((a, f) => a + f.kills, 0), d = sameAgent.reduce((a, f) => a + f.deaths, 0);
    return d ? k / d : k;
  })();
  const kd = (k: number, d: number) => (d ? k / d : k).toFixed(2);
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  return (
    <div className="panel" role="dialog" aria-label="Oyuncu ayrıntısı">
      <div className="ph">
        <div>
          <h2 className="t">
            <button className="namebtn" type="button" title="Kullanıcı adını kopyala" onClick={() => onCopy(anonymous ? entry?.label ?? null : p.name ?? null)}>
              {anonymous ? entry?.label ?? "Oyuncu (isim gizli)" : p.name}
            </button>
            {sb && <span className={`bd ${sb.tone}`} title={sb.tip}>{sb.text}</span>}
            {fb && <span className={`bd ${fb.tone}`} title={fb.tip}>{fb.text}</span>}
          </h2>
          <p className="m">
            <b className="ag-n">{agent?.name}</b>
            <span className="sep" />
            <span style={{ color: cur ? tierColor(cur.color) : undefined }}>{cur?.name ?? "Derecesiz"}{p.rank.current > 0 ? ` · ${p.rank.rr} RR` : ""}</span>
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
            <h3 className="h2">Son maçlar{p.kd != null && <span className="hv">K/D {p.kd.toFixed(2)}</span>}</h3>
            {p.form.length === 0 ? <None text={p.formLoading ? "Yükleniyor…" : "Maç verisi yok"} /> : (
              <div className="tb">
                <div className="tr hd2"><span /><span>Harita</span><span>Ajan</span><span className="num">K / D / A</span><span className="num">K/D</span></div>
                {p.form.map((f, i) => {
                  const fa = assets.agents.get(lookup(f.agentId));
                  return (
                    <div className="tr" key={i}>
                      <span className={f.won ? "fc win" : "fc loss"}>{f.won ? "W" : "L"}</span>
                      <span>{assets.maps.get(lookup(f.mapId)) ?? "?"}</span>
                      <span className="ra">{fa && <img src={fa.icon} alt="" />}{fa?.name ?? "?"}</span>
                      <span className="num">{f.kills} / {f.deaths} / {f.assists}</span>
                      <span className="num">{kd(f.kills, f.deaths)}</span>
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
            {play ? (
              <>
                <h3 className="h2">Oynayış<span className="hv">{play.matches} maç, {play.rounds} round</span></h3>
                <div className="stats">
                  <div className="gold"><b>{play.hsPct != null ? `%${play.hsPct.toFixed(0)}` : "–"}</b><small>Kafa isabeti</small></div>
                  <div className="orange"><b>{play.adr != null ? play.adr.toFixed(0) : "–"}</b><small>Round başı hasar</small></div>
                  <div className="teal"><b>{play.firstKills}</b><small>İlk kan</small></div>
                  <div className="loss"><b>{play.firstDeaths}</b><small>İlk ölüm</small></div>
                </div>
                <div className="wpair">
                  <WeaponTable title="Öldürdüğü silahlar" list={play.killWeapons} assets={assets} unit="kill" />
                  <WeaponTable title="Satın aldığı silahlar" list={play.bought} assets={assets} unit="round" />
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

      {tab === "profile" && (
        <div className="prof3 fade">
          <div>
            <h3 className="h2">Spreyler</h3>
            {sprays.length ? sprays.map((s) => (
              <div className="chrow" key={s.name}><img src={s.icon} alt="" loading="lazy" /><span>{s.name}</span></div>
            )) : <None />}
            {smurf.length > 0 && (
              <>
                <h3 className="h2">Smurf işaretleri</h3>
                <ul className="signs">{smurf.map((x) => <li key={x.text}>{x.text}</li>)}</ul>
              </>
            )}
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
                      <span key={m.puuid} className={m.puuid === p.puuid ? "mem me" : "mem"}>{m.hidden ? "İsim gizli" : m.name ?? "…"}</span>
                    ))}
                  </div>
                </>
              )}
            {p.together.length > 0 && (
              <>
                <h3 className="h2">Son maçlarda birlikte<span className="hv">Aynı partide girilen maç</span></h3>
                <div className="tb">
                  {p.together.slice(0, 4).map((t) => {
                    const mate = lobby.find((x) => x.puuid === t.puuid);
                    const now = p.partySure && mate?.partySure && mate.party === p.party;
                    return (
                      <div className="tr tog" key={t.puuid}>
                        <span className="pair"><b>{mate ? (mate.hiddenName && !mate.isSelf ? "İsim gizli" : mate.name ?? "…") : "?"}</b></span>
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
                <h3 className="h2">Daha önce karşılaştınız</h3>
                <div className="tb">
                  {entry.history.slice(-4, -1).reverse().map((h, i) => (
                    <div className="tr met" key={i}>
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
