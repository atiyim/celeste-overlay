import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets, SkinMeta } from "./assets";
import { cachedJson } from "./assets";
import type { Account, ContractState } from "./types";
import { WalletBar, nf } from "./StorePanel";
import { Empty, PanelHead } from "./ui";

const inTauri = "__TAURI_INTERNALS__" in window;

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Defs { missions: Map<string, any>; contracts: Map<string, any>; seasons: Map<string, any> }

async function loadDefs(): Promise<Defs> {
  const [m, c, s] = await Promise.all([
    cachedJson<any[]>("/missions").catch(() => []),
    cachedJson<any[]>("/contracts").catch(() => []),
    cachedJson<any[]>("/seasons").catch(() => []),
  ]);
  const by = (l: any[]) => new Map(l.map((x) => [String(x.uuid).toLowerCase(), x]));
  return { missions: by(m), contracts: by(c), seasons: by(s) };
}

const untilText = (iso?: string | null) => {
  if (!iso) return "";
  const sec = Math.floor((Date.parse(iso) - Date.now()) / 1000);
  if (!(sec > 0)) return "";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d} gün ${h} sa` : h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
};

/* ---------- görevler ---------- */
function Missions({ acc, defs }: { acc: Account; defs: Defs | null }) {
  const rows = useMemo(() => {
    const out = acc.missions.map((m) => {
      const d = defs?.missions.get(m.id);
      const type = String(d?.type ?? "").split("::").pop() ?? "";
      const need = Number(d?.objectives?.[0]?.value ?? d?.progressToComplete ?? 0);
      const have = m.objectives.reduce((x, o) => Math.max(x, o.value), 0);
      const raw = String(d?.title ?? d?.displayName ?? "Görev");
      return { m, type, need, have: m.complete ? need : Math.min(have, need || have), title: raw.replace("{value}", String(need)), xp: Number(d?.xpGrant ?? 0) };
    });
    return out.filter((r) => r.type !== "Tutorial" && r.type !== "NPE").sort((a, b) => Number(a.m.complete) - Number(b.m.complete));
  }, [acc, defs]);

  const groups: [string, typeof rows][] = [
    ["Günlük", rows.filter((r) => r.type === "Daily")],
    ["Haftalık", rows.filter((r) => r.type === "Weekly")],
    ["Diğer", rows.filter((r) => r.type !== "Daily" && r.type !== "Weekly")],
  ];
  if (!rows.length) return <p className="none">Aktif görev bulunamadı.</p>;
  return (
    <>
      {groups.filter(([, l]) => l.length).map(([name, list]) => (
        <section key={name}>
          <h3 className="h2">{name}{name === "Haftalık" && untilText(acc.weeklyRefill) ? <span className="hv">{untilText(acc.weeklyRefill)} sonra yenilenir</span> : null}</h3>
          <div className="tb box pad">
            {list.map(({ m, title, need, have, xp }) => (
              <div key={m.id} className={`msn${m.complete ? " done" : ""}`}>
                <span className="mt">{title}</span>
                <span className="mbar"><i style={{ width: `${need ? Math.min(100, (100 * have) / need) : m.complete ? 100 : 0}%` }} /></span>
                <span className="mp">{m.complete ? "Tamam" : need ? `${have}/${need}` : "–"}</span>
                <span className="mx">{xp ? `${nf(xp)} XP` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/* ---------- battle pass ---------- */
function Pass({ acc, defs }: { acc: Account; defs: Defs | null }) {
  const found = useMemo(() => {
    if (!defs) return null;
    let best: { c: ContractState; def: any; start: number; season?: any } | null = null;
    for (const c of acc.contracts) {
      const def = defs.contracts.get(c.id);
      if (!def || def.content?.relationType !== "Season") continue;
      const season = defs.seasons.get(String(def.content.relationUuid).toLowerCase());
      const start = Date.parse(season?.startTime ?? "") || 0;
      if (!best || start > best.start) best = { c, def, start, season };
    }
    return best;
  }, [acc, defs]);
  if (!found) return <p className="none">Aktif battle pass bilgisi alınamadı.</p>;
  const levels: any[] = (found.def.content.chapters ?? []).filter((x: any) => !x.isEpilogue).flatMap((x: any) => x.levels ?? []);
  const total = levels.length;
  const need = Number(levels[found.c.level]?.xp ?? 0);
  const pct = need > 0 && found.c.xpTowardNext <= need ? (100 * found.c.xpTowardNext) / need : null;
  const ends = untilText(found.season?.endTime);
  return (
    <div className="bp">
      <div className="bph">
        <b>{found.def.displayName}</b>
        <span className="hv">{ends ? `${ends} sonra biter` : ""}</span>
      </div>
      <div className="bpl"><b>{found.c.level}</b>{total ? <small> / {total} seviye</small> : <small> seviye</small>}</div>
      {pct != null && <span className="mbar big"><i style={{ width: `${pct}%` }} /></span>}
      <div className="bpx">
        {need > 0 ? `${nf(found.c.xpTowardNext)} / ${nf(need)} XP` : `${nf(found.c.xpTowardNext)} XP`}
        <span>Toplam {nf(found.c.totalXp)} XP</span>
      </div>
    </div>
  );
}

/* ---------- envanter ---------- */
function Inventory({ acc, assets }: { acc: Account; assets: Assets }) {
  const [tier, setTier] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const owned = useMemo(() => new Set(acc.owned.skins), [acc]);

  const skins = useMemo(() => {
    const seen = new Set<string>();
    const list: (SkinMeta & { rank: number; full: boolean })[] = [];
    for (const id of owned) {
      const sid = assets.levelToSkin.get(id);
      const meta = sid ? assets.skinMeta.get(sid) : undefined;
      if (!meta || seen.has(meta.id) || /^(standart|standard|rastgele|random)/i.test(meta.name)) continue;
      seen.add(meta.id);
      list.push({ ...meta, rank: assets.contentTiers.get(meta.tierId)?.rank ?? 0, full: meta.levels.every((l) => owned.has(l)) });
    }
    return list.sort((a, b) => b.rank - a.rank || a.weapon.localeCompare(b.weapon, "tr") || a.name.localeCompare(b.name, "tr"));
  }, [owned, assets]);

  const byTier = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of skins) m.set(s.tierId, (m.get(s.tierId) ?? 0) + 1);
    return [...m.entries()].map(([id, n]) => ({ id, n, t: assets.contentTiers.get(id) })).sort((a, b) => (b.t?.rank ?? 0) - (a.t?.rank ?? 0));
  }, [skins, assets]);

  const uniq = (ids: string[], map: Map<string, { name: string }>) => new Set(ids.map((i) => map.get(i.toLowerCase())?.name).filter(Boolean)).size;
  const chromaCount = useMemo(() => {
    let n = 0;
    for (const id of acc.owned.chromas) { const c = assets.chromas.get(id); if (c && c.index > 0) n++; }
    return n;
  }, [acc, assets]);
  const cardCount = acc.owned.cards.filter((i) => assets.cards.has(i)).length;
  const titleCount = acc.owned.titles.filter((i) => assets.titles.has(i)).length;

  const shown = skins.filter((s) => !tier || s.tierId === tier);
  const list = all ? shown : shown.slice(0, 20);

  return (
    <>
      <div className="kpis own">
        <div><b>{skins.length}</b><small>Kaplama</small></div>
        <div><b>{skins.filter((s) => s.full).length}</b><small>Tam yükseltilmiş</small></div>
        <div><b>{chromaCount}</b><small>Ek renk</small></div>
        <div><b>{uniq(acc.owned.charms, assets.charms)}</b><small>Silah süsü</small></div>
        <div><b>{uniq(acc.owned.sprays, assets.sprays)}</b><small>Sprey</small></div>
        <div><b>{cardCount}</b><small>Kart</small></div>
        <div><b>{titleCount}</b><small>Unvan</small></div>
      </div>

      <h3 className="h2">Nadirlik<span className="hv">Filtrelemek için seç</span></h3>
      <div className="tiers">
        {byTier.map(({ id, n, t }) => (
          <button key={id} type="button" className={`tierchip${tier === id ? " on" : ""}`} style={{ ["--tc" as string]: t?.color ?? "#888" }} onClick={() => { setTier(tier === id ? null : id); setAll(false); }}>
            <i />{t?.name ?? "Diğer"}<b>{n}</b>
          </button>
        ))}
      </div>

      <h3 className="h2">Vitrin<span className="hv">{shown.length} kaplama</span></h3>
      {list.length ? (
        <div className="vit">
          {list.map((s) => {
            const t = assets.contentTiers.get(s.tierId);
            return (
              <figure key={s.id} className="vi" style={{ ["--tc" as string]: t?.color ?? "#555" }} title={`${s.name} · ${s.weapon}`}>
                <div className="vimg">{s.icon ? <img src={s.icon} alt="" loading="lazy" /> : null}</div>
                <figcaption><span className="oname">{s.name}</span><small>{s.weapon}{s.full ? " · Tam" : ""}</small></figcaption>
              </figure>
            );
          })}
        </div>
      ) : <p className="none">Bu nadirlikte kaplama yok.</p>}
      {!all && shown.length > list.length && (
        <button type="button" className="more" onClick={() => setAll(true)}>Tümünü göster ({shown.length})</button>
      )}
    </>
  );
}

export function AccountPanel({ assets, onClose }: { assets: Assets; onClose: () => void }) {
  const [acc, setAcc] = useState<Account | null>(null);
  const [defs, setDefs] = useState<Defs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"sum" | "inv">("sum");

  const load = useCallback(async () => {
    if (!inTauri) { setErr("Hesap bilgileri yalnızca masaüstü uygulamasında çalışır."); return; }
    setBusy(true);
    try { setAcc(await invoke<Account>("get_account")); setErr(null); }
    catch (e) { setErr(String(e)); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); loadDefs().then(setDefs); }, [load]);

  return (
    <div className="panel" role="dialog" aria-label="Hesabım">
      <PanelHead
        title="Hesabım"
        sub="Cüzdan, görevler, battle pass ve envanter. Valorant kapalıyken de çalışır; Riot Client'ta oturum açık olması yeter."
        actions={<button className="x" type="button" onClick={load} disabled={busy}>{busy ? "Yükleniyor" : "Yenile"}</button>}
        onClose={onClose}
      />
      {err && <Empty tone="err" title="Hesap bilgileri alınamadı" text={err} onRetry={inTauri ? load : undefined} />}
      {acc && (
        <>
          <WalletBar w={acc.wallet} />
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "sum"} className={tab === "sum" ? "on" : ""} onClick={() => setTab("sum")}>Görevler ve pass</button>
            <button type="button" role="tab" aria-selected={tab === "inv"} className={tab === "inv" ? "on" : ""} onClick={() => setTab("inv")}>Envanter</button>
          </div>
          <div className="tabbody fade" key={tab}>
            {tab === "sum" ? (
              <div className="accgrid">
                <div><h3 className="h2">Battle pass</h3><Pass acc={acc} defs={defs} /></div>
                <div><Missions acc={acc} defs={defs} /></div>
              </div>
            ) : <Inventory acc={acc} assets={assets} />}
          </div>
        </>
      )}
    </div>
  );
}
