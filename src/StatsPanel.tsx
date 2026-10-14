import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { MyStats } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;

const QUEUE: Record<string, string> = { competitive: "Rekabetçi", unrated: "Derecesiz", swiftplay: "Hızlı", premier: "Premier" };

function ago(ms: number): string {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 60) return `${m}dk`;
  if (m < 1440) return `${Math.floor(m / 60)}sa`;
  return `${Math.floor(m / 1440)}g`;
}

export function StatsPanel({ assets, onClose }: { assets: Assets; onClose: () => void }) {
  const [data, setData] = useState<MyStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!inTauri) { setErr("İstatistikler yalnızca masaüstü uygulamasında çalışır."); return; }
    setBusy(true);
    try { setData(await invoke<MyStats>("get_my_stats")); setErr(null); }
    catch (e) { setErr(String(e)); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sum = useMemo(() => {
    const ms = data?.matches ?? [];
    if (!ms.length) return null;
    const w = ms.filter((m) => m.won).length;
    const k = ms.reduce((x, m) => x + m.kills, 0), d = ms.reduce((x, m) => x + m.deaths, 0);
    const acs = Math.round(ms.reduce((x, m) => x + m.acs, 0) / ms.length);
    const rr = ms.reduce((x, m) => x + (m.rrDelta ?? 0), 0);
    const byAgent = new Map<string, { n: number; w: number; k: number; d: number }>();
    for (const m of ms) {
      const e = byAgent.get(lookup(m.agentId)) ?? { n: 0, w: 0, k: 0, d: 0 };
      e.n++; e.w += m.won ? 1 : 0; e.k += m.kills; e.d += m.deaths;
      byAgent.set(lookup(m.agentId), e);
    }
    return { n: ms.length, w, wr: Math.round((100 * w) / ms.length), kd: d ? k / d : k, acs, rr,
      agents: [...byAgent.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5) };
  }, [data]);

  const cur = data ? assets.tiers.get(data.rank.current) : undefined;

  return (
    <div className="panel" role="dialog" aria-label="İstatistiklerim">
      <div className="ph">
        <div>
          <h2 className="t">İstatistiklerim</h2>
          <p className="m">
            {cur ? `${cur.name} · ${data!.rank.rr} RR` : "Derece bilgisi yok"}
            {sum ? ` · son ${sum.n} maç` : ""}
          </p>
        </div>
        <span className="zoom">
          <button type="button" onClick={load} disabled={busy}>{busy ? "Yükleniyor…" : "Yenile"}</button>
          <button type="button" onClick={onClose}>Kapat</button>
        </span>
      </div>
      {err && <p className="empty">{err}</p>}
      {!err && !data && <p className="empty">Maçların okunuyor… (ilk seferde birkaç saniye sürebilir)</p>}
      {data && !sum && <p className="empty">Henüz sayılabilecek maç bulunamadı.</p>}
      {sum && data && (
        <div className="stgrid">
          <div>
            <div className="kpis">
              <div><b>%{sum.wr}</b><small>Kazanma · {sum.w}/{sum.n}</small></div>
              <div><b>{sum.kd.toFixed(2)}</b><small>K/D</small></div>
              <div><b>{sum.acs}</b><small>Ort. ACS</small></div>
              <div><b className={sum.rr >= 0 ? "pos" : "neg"}>{sum.rr > 0 ? "+" : ""}{sum.rr}</b><small>RR (rekabetçi)</small></div>
            </div>
            <h2 className="h">Ajan bazlı</h2>
            {sum.agents.map(([id, e]) => {
              const ag = assets.agents.get(id);
              return (
                <div className="ag" key={id}>
                  {ag && <img src={ag.icon} alt="" />}
                  <span className="an">{ag?.name ?? "?"}</span>
                  <span className="d">{e.n} maç</span>
                  <span>%{Math.round((100 * e.w) / e.n)}</span>
                  <span>K/D {(e.d ? e.k / e.d : e.k).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div>
            <h2 className="h" style={{ marginTop: 0 }}>Son maçlar</h2>
            {data.matches.slice(0, 10).map((m) => {
              const ag = assets.agents.get(lookup(m.agentId));
              return (
                <div className="mm" key={m.matchId} title={QUEUE[m.queue] ?? m.queue}>
                  <span className={m.won ? "fc win" : "fc loss"}>{m.won ? "W" : "L"}</span>
                  <span className="mmap">{assets.maps.get(lookup(m.mapId)) ?? "?"}</span>
                  <span className="mag">{ag?.name ?? "?"}</span>
                  <span>{m.kills}/{m.deaths}/{m.assists}</span>
                  <span className="d">{m.acs}</span>
                  <span className={m.rrDelta == null ? "d" : m.rrDelta >= 0 ? "pos" : "neg"}>{m.rrDelta == null ? "–" : `${m.rrDelta > 0 ? "+" : ""}${m.rrDelta}`}</span>
                  <span className="d">{ago(m.started)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
