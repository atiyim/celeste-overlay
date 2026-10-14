import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets, WeaponInfo } from "./assets";
import { charmIcon, lookup, resolveFlex, resolveSkin, resolveSprays } from "./assets";
import { ago, analyze, formBadge, styleBadge, type WeaponStat } from "./playstyle";
import { TAGS, type Entry, type TagId } from "./seen";
import type { Player, PremierTeam } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;

const CATS: [string, string][] = [
  ["Sidearm", "Yan silahlar"], ["SMG", "Hafif makineliler"], ["Shotgun", "Pompalılar"], ["Rifle", "Tüfekler"],
  ["Sniper", "Keskin nişancılar"], ["Heavy", "Ağır silahlar"], ["Melee", "Yakın dövüş"],
];
const COLUMNS = [[0, 1], [2, 3], [4, 5, 6]];

function Group({ title, weapons, p, a }: { title: string; weapons: WeaponInfo[]; p: Player; a: Assets }) {
  if (!weapons.length) return null;
  return (
    <>
      <h2 className="h">{title}</h2>
      {weapons.map((w) => {
        const slot = p.loadout.weapons.find((x) => lookup(x.weaponId) === w.id);
        const skin = resolveSkin(a, w, slot);
        const charm = charmIcon(a, slot);
        return (
          <div className="w" key={w.id}>
            <span className="d">{w.name}</span>
            <span className="skin" title={skin.name}>
              <img className="gun" src={skin.image} alt="" loading="lazy" />
              <span className={skin.isDefault ? "d" : ""}>{skin.name}</span>
              {skin.swatch && <img className="sw" src={skin.swatch} alt={skin.chromaName ?? "Chroma"} title={skin.chromaName} />}
            </span>
            <span className="charm">{charm ? <img src={charm.icon} alt={charm.name} title={charm.name} loading="lazy" /> : null}</span>
          </div>
        );
      })}
    </>
  );
}

interface PanelProps {
  p: Player;
  assets: Assets;
  entry?: Entry;
  onLabel: (label: string) => void;
  onTag: (tag: TagId | null) => void;
  onClose: () => void;
  onCopy: (n: string | null) => void;
}

const None = () => <p className="d none">Oyun bu bilgiyi göndermedi</p>;
type Tab = "guns" | "perf" | "profile";
const TABS: [Tab, string][] = [["guns", "Kaplamalar"], ["perf", "Performans"], ["profile", "Profil"]];

export function LoadoutPanel({ p, assets, entry, onLabel, onTag, onClose, onCopy }: PanelProps) {
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

  const by = (cat: string) => assets.weapons.filter((w) => w.category === cat);
  const card = assets.cards.get(lookup(p.cardId));
  const title = assets.titles.get(lookup(p.titleId));
  const cur = assets.tiers.get(p.rank.current);
  const peak = assets.tiers.get(p.rank.peak);
  const agent = assets.agents.get(lookup(p.agentId));
  const sprays = resolveSprays(assets, p.loadout);
  const flex = resolveFlex(assets, p.loadout);

  const play = analyze(p);
  const fb = formBadge(p);
  const sb = styleBadge(play);
  const rrSum = p.rrTrend.reduce((a, b) => a + b, 0);
  const sameAgent = p.form.filter((f) => lookup(f.agentId) === lookup(p.agentId));
  const sameKd = (() => {
    const k = sameAgent.reduce((a, f) => a + f.kills, 0), d = sameAgent.reduce((a, f) => a + f.deaths, 0);
    return d ? k / d : k;
  })();
  const wlist = (list: WeaponStat[], unit: string) =>
    list.slice(0, 3).map((w) => {
      const info = assets.weapons.find((x) => x.id === w.id);
      return info ? <span className="wc" key={w.id}><img src={info.icon} alt="" />{info.name} <b>{w.count}</b> {unit}</span> : null;
    });

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
            {agent?.name} · {cur?.name ?? "Derecesiz"}{p.rank.current > 0 ? ` (${p.rank.rr} RR)` : ""} · Peak {peak?.name ?? "–"}
            {p.level != null ? ` · Seviye ${p.level}` : ""}
          </p>
        </div>
        <div className="phr">
          {!p.isSelf && (
            <span className="tagrow" title="Etiketler yalnızca bu bilgisayarda saklanır; isim gizli olsa da sonraki maçta aynı oyuncuda görünür">
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
        <div className="cols3">
          {COLUMNS.map((idx, i) => (
            <div key={i}>{idx.map((c) => <Group key={CATS[c][0]} title={CATS[c][1]} weapons={by(CATS[c][0])} p={p} a={assets} />)}</div>
          ))}
        </div>
      )}

      {tab === "perf" && (
        <div className="perf">
          <div>
            <h2 className="h" style={{ marginTop: 0 }}>
              Son {p.form.length || 5} maç{p.kd != null ? ` · K/D ${p.kd.toFixed(2)}` : ""}
            </h2>
            {p.form.length === 0 && <p className="d none">{p.formLoading ? "Yükleniyor…" : "Maç verisi yok"}</p>}
            {p.form.map((f, i) => {
              const fa = assets.agents.get(lookup(f.agentId));
              return (
                <div className="rm" key={i}>
                  <span className={f.won ? "fc win" : "fc loss"}>{f.won ? "W" : "L"}</span>
                  <span>{assets.maps.get(lookup(f.mapId)) ?? "?"}</span>
                  <span className="ra">{fa && <img src={fa.icon} alt="" />}{fa?.name ?? "?"}</span>
                  <span>{f.kills}/{f.deaths}/{f.assists}</span>
                  <span className="d">K/D {(f.deaths ? f.kills / f.deaths : f.kills).toFixed(2)}</span>
                </div>
              );
            })}
            {sameAgent.length > 0 && agent && (
              <p className="m">{agent.name} ile {sameAgent.length} maç: K/D {sameKd.toFixed(2)}, {sameAgent.filter((f) => f.won).length} galibiyet</p>
            )}
            <p className="m">
              <span className="d">Son 24 saatte:</span> <b>{p.played24h}{p.played24hCapped ? "+" : ""} maç</b>
              {p.lastMatchAt ? <span className="d"> · son maç {ago(p.lastMatchAt)} önce başladı</span> : null}
            </p>
          </div>
          <div>
            {play ? (
              <>
                <h2 className="h" style={{ marginTop: 0 }}>Oynayış · {play.matches} maç, {play.rounds} round</h2>
                <div className="pst">
                  <div><b>{play.hsPct != null ? `%${play.hsPct.toFixed(0)}` : "–"}</b><small>Kafa</small></div>
                  <div><b>{play.adr != null ? play.adr.toFixed(0) : "–"}</b><small>ADR</small></div>
                  <div><b>{play.firstKills}</b><small>İlk kan</small></div>
                  <div><b>{play.firstDeaths}</b><small>İlk ölüm</small></div>
                </div>
                {play.killWeapons.length > 0 && <p className="m wl"><span className="d">Öldürdüğü silah:</span>{wlist(play.killWeapons, "kill")}</p>}
                {play.bought.length > 0 && <p className="m wl"><span className="d">Aldığı silah:</span>{wlist(play.bought, "round")}</p>}
              </>
            ) : <p className="d none">Oynayış verisi yok</p>}
            {p.rrTrend.length > 0 && (
              <p className="m wl">
                <span className="d">Son {p.rrTrend.length} rekabet maçı RR:</span>
                {p.rrTrend.map((r, i) => <span key={i} className={r >= 0 ? "pos" : "neg"}>{r > 0 ? "+" : ""}{r}</span>)}
                <span className="d">(toplam {rrSum > 0 ? "+" : ""}{rrSum})</span>
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="prof3">
          <div>
            <h2 className="h" style={{ marginTop: 0 }}>Spreyler</h2>
            {sprays.length ? sprays.map((s) => (
              <div className="chrow" key={s.name}><img src={s.icon} alt="" loading="lazy" /><span className="full">{s.name}</span></div>
            )) : <None />}
          </div>
          <div>
            <h2 className="h" style={{ marginTop: 0 }}>Flex</h2>
            {flex.length ? flex.map((f) => (
              <div className="chrow" key={f.name}><img src={f.icon} alt="" loading="lazy" /><span className="full">{f.name}</span></div>
            )) : <None />}
            <h2 className="h">Kart ve ünvan</h2>
            {card || title ? (
              <div className="card">
                {card && <img src={card.wide} alt="" loading="lazy" />}
                {title && <span>{title}</span>}
              </div>
            ) : <None />}
          </div>
          <div>
            <h2 className="h" style={{ marginTop: 0 }}>Premier</h2>
            {anonymous ? <p className="d none">İsmi gizli oyuncular için sorgulanmaz</p>
              : premier === "loading" ? <p className="d none">Yükleniyor…</p>
              : premier === "error" ? <p className="d none">Premier bilgisi alınamadı</p>
              : premier === null ? <p className="d none">Premier takımı yok</p>
              : (
                <>
                  <p className="m"><b>{premier.name}</b> {premier.tag && <span className="d">#{premier.tag}</span>}</p>
                  <p className="m wrapnames">
                    {premier.members.map((m) => (
                      <span key={m.puuid} className={m.puuid === p.puuid ? "mem me" : "mem"}>{m.hidden ? "isim gizli" : m.name ?? "…"}</span>
                    ))}
                  </p>
                </>
              )}
            {anonymous && (
              <>
                <h2 className="h">Kendi notun</h2>
                <div className="note">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onLabel(draft); e.stopPropagation(); }}
                    placeholder="isim#etiket (tracker'dan baktığın)"
                    aria-label="Oyuncu için kişisel not"
                  />
                  <button className="x" type="button" onClick={() => onLabel(draft)}>Kaydet</button>
                </div>
              </>
            )}
            {entry && entry.history.length >= 2 && (
              <>
                <h2 className="h">Önceki karşılaşmalar</h2>
                {entry.history.slice(-4, -1).reverse().map((h, i) => (
                  <p className="m" key={i}>
                    {assets.maps.get(lookup(h.mapId)) ?? "?"} · {assets.agents.get(lookup(h.agentId))?.name ?? "?"} ({h.side === "ally" ? "takım" : "rakip"})
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
