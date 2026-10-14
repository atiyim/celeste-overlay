import { useEffect, useState } from "react";
import type { Assets, WeaponInfo } from "./assets";
import { charmIcon, lookup, resolveFlex, resolveSkin, resolveSprays } from "./assets";
import { analyze, formBadge, styleBadge, type WeaponStat } from "./playstyle";
import { TAGS, type Entry, type TagId } from "./seen";
import type { Player } from "./types";

const CATS: [string, string][] = [
  ["Sidearm", "Yan silahlar"], ["SMG", "Hafif makineliler"], ["Shotgun", "Pompalılar"], ["Rifle", "Tüfekler"],
  ["Sniper", "Keskin nişancılar"], ["Heavy", "Ağır silahlar"], ["Melee", "Yakın dövüş"],
];

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
            <span className="skin">
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

export function LoadoutPanel({ p, assets, entry, onLabel, onTag, onClose, onCopy }: PanelProps) {
  const [draft, setDraft] = useState(entry?.label ?? "");

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const by = (cat: string) => assets.weapons.filter((w) => w.category === cat);
  const card = assets.cards.get(lookup(p.cardId));
  const title = assets.titles.get(lookup(p.titleId));
  const cur = assets.tiers.get(p.rank.current);
  const peak = assets.tiers.get(p.rank.peak);
  const agent = assets.agents.get(lookup(p.agentId));

  const sameAgent = p.form.filter((f) => lookup(f.agentId) === lookup(p.agentId));
  const sameKd = (() => {
    const k = sameAgent.reduce((a, f) => a + f.kills, 0), d = sameAgent.reduce((a, f) => a + f.deaths, 0);
    return d ? k / d : k;
  })();
  const play = analyze(p);
  const fb = formBadge(p);
  const sb = styleBadge(play);
  const rrSum = p.rrTrend.reduce((a, b) => a + b, 0);
  const wlist = (list: WeaponStat[], unit: string) =>
    list.slice(0, 3).map((w) => {
      const info = assets.weapons.find((x) => x.id === w.id);
      return info ? (
        <span className="wc" key={w.id}><img src={info.icon} alt="" />{info.name} <b>{w.count}</b> {unit}</span>
      ) : null;
    });

  const sprays = resolveSprays(assets, p.loadout);
  const flex = resolveFlex(assets, p.loadout);

  return (
    <div className="panel" role="dialog" aria-label="Oyuncu donatısı">
      <div className="ph">
        <div>
          <h2 className="t">
            <button className="namebtn" type="button" title="Kullanıcı adını kopyala" onClick={() => onCopy(p.hiddenName && !p.isSelf ? entry?.label ?? null : p.name ?? null)}>
              {p.hiddenName && !p.isSelf ? entry?.label ?? "Oyuncu (isim gizli)" : p.name}
            </button>
          </h2>
          <p className="m">
            {agent?.name} · {cur?.name ?? "Derecesiz"}{p.rank.current > 0 ? ` (${p.rank.rr} RR)` : ""} · Peak {peak?.name ?? "–"}
            {p.level != null ? ` · Seviye ${p.level}` : ""}
          </p>
        </div>
        <button className="x" onClick={onClose} type="button">Kapat</button>
      </div>
      {!p.isSelf && (
        <div className="tagrow">
          <span className="d">Etiket (yalnızca bu bilgisayarda; isim gizli olsa da sonraki maçta görünür):</span>
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
        </div>
      )}
      {p.form.length > 0 && (
        <div className="recent">
          <h2 className="h">
            Son {p.form.length} maç{p.kd != null ? ` · K/D ${p.kd.toFixed(2)}` : ""}
            {sameAgent.length > 0 && agent ? (
              <span className="d"> · {agent.name} ile {sameAgent.length} maç, K/D {sameKd.toFixed(2)}, {sameAgent.filter((f) => f.won).length} galibiyet</span>
            ) : null}
          </h2>
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
        </div>
      )}
      {play && (
        <div className="play">
          <h2 className="h">
            Oynayış · son {play.matches} maç, {play.rounds} round
            {sb ? <span className={`bd ${sb.tone}`} title={sb.tip}>{sb.text}</span> : null}
            {fb ? <span className={`bd ${fb.tone}`} title={fb.tip}>{fb.text}</span> : null}
          </h2>
          <div className="pst">
            <div><b>{play.hsPct != null ? `%${play.hsPct.toFixed(0)}` : "–"}</b><small>Kafa isabeti</small></div>
            <div><b>{play.adr != null ? play.adr.toFixed(0) : "–"}</b><small>Round başı hasar</small></div>
            <div><b>{play.firstKills}</b><small>İlk kan</small></div>
            <div><b>{play.firstDeaths}</b><small>İlk ölüm</small></div>
            <div><b>{p.kd != null ? p.kd.toFixed(2) : "–"}</b><small>K/D</small></div>
          </div>
          {play.killWeapons.length > 0 && <p className="m wl"><span className="d">En çok öldürdüğü silah:</span> {wlist(play.killWeapons, "kill")}</p>}
          {play.bought.length > 0 && <p className="m wl"><span className="d">En çok aldığı silah:</span> {wlist(play.bought, "round")}</p>}
          {p.rrTrend.length > 0 && (
            <p className="m wl">
              <span className="d">Son {p.rrTrend.length} rekabet maçı RR:</span>
              {p.rrTrend.map((r, i) => <span key={i} className={r >= 0 ? "pos" : "neg"}>{r > 0 ? "+" : ""}{r}</span>)}
              <span className="d">(toplam {rrSum > 0 ? "+" : ""}{rrSum})</span>
            </p>
          )}
        </div>
      )}
      {p.hiddenName && !p.isSelf && (
        <div className="note">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onLabel(draft); e.stopPropagation(); }}
            placeholder="Kendi notun: tracker'dan baktığın ismi yaz (isim#etiket)"
            aria-label="Oyuncu için kişisel not"
          />
          <button className="x" type="button" onClick={() => onLabel(draft)}>Kaydet</button>
        </div>
      )}
      {entry && entry.history.length >= 2 && (
        <p className="m">
          Önceki karşılaşmalar:{" "}
          {entry.history.slice(-4, -1).reverse().map((h) =>
            `${assets.maps.get(lookup(h.mapId)) ?? "?"} · ${assets.agents.get(lookup(h.agentId))?.name ?? "?"} (${h.side === "ally" ? "takım" : "rakip"})`,
          ).join(" | ")}
        </p>
      )}
      <div className="cols">
        <div>{CATS.slice(0, 4).map(([c, t]) => <Group key={c} title={t} weapons={by(c)} p={p} a={assets} />)}</div>
        <div>{CATS.slice(4).map(([c, t]) => <Group key={c} title={t} weapons={by(c)} p={p} a={assets} />)}</div>
      </div>

      <h2 className="h">Profil</h2>
      <div className="prof">
        <div>
          <h3>Spreyler</h3>
          {sprays.length ? (
            <div className="sprays">
              {sprays.map((s) => (
                <figure key={s.name}><img src={s.icon} alt={s.name} loading="lazy" /><figcaption>{s.name}</figcaption></figure>
              ))}
            </div>
          ) : <None />}
        </div>
        <div>
          <h3>Flex</h3>
          {flex.length ? flex.map((f) => (
            <div className="chrow" key={f.name}><img src={f.icon} alt="" loading="lazy" /><span>{f.name}</span></div>
          )) : <None />}
        </div>
        <div>
          <h3>Kart ve ünvan</h3>
          {card || title ? (
            <div className="card">
              {card && <img src={card.wide} alt="" loading="lazy" />}
              {title && <span>{title}</span>}
            </div>
          ) : <None />}
        </div>
      </div>
    </div>
  );
}
