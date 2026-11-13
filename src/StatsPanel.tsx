import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { MyStats } from "./types";
import { Empty, PanelHead } from "./ui";
import { MapsView, RoundsView } from "./RoundsView";
import { MMR_GAP, derankRisk, nextRank, rrStats } from "./insights";
import { Goal } from "./Goal";
import { MatchCard } from "./MatchCard";
import type { MyMatch } from "./types";
import { cardOf, type FeedCard } from "./feed";
import { Dashboard } from "./Dashboard";
import { mockStats } from "./mock";

const inTauri = "__TAURI_INTERNALS__" in window;


export function StatsPanel({ assets, onClose, onToast, onShare }: { assets: Assets; onClose: () => void; onToast: (t: string) => void; onShare: (c: FeedCard) => void }) {
  const [data, setData] = useState<MyStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"sum" | "rounds" | "maps">("sum");
  const [card, setCard] = useState<MyMatch | null>(null);

  const load = useCallback(async () => {
    if (!inTauri) { setData(mockStats(assets)); return; } // tarayıcı önizlemesi
    setBusy(true);
    try { setData(await invoke<MyStats>("get_my_stats")); setErr(null); }
    catch (e) { setErr(String(e)); }
    setBusy(false);
  }, [assets]);
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
      <PanelHead
        title="İstatistiklerim"
        sub={<>{cur ? `${cur.name} · ${data!.rank.rr} RR` : "Derece bilgisi yok"}{sum ? ` · son ${sum.n} maç` : ""}</>}
        actions={<button className="x" type="button" onClick={load} disabled={busy}>{busy ? "Yükleniyor" : "Yenile"}</button>}
        onClose={onClose}
      />
      {err && <Empty tone="err" title="İstatistikler alınamadı" text={err} onRetry={inTauri ? load : undefined} />}
      {!err && !data && <Empty text="Maçların okunuyor. İlk açılışta birkaç saniye sürebilir." />}
      {data && !sum && <Empty text="Sayılabilecek maç bulunamadı. Bir rekabet maçı oynayınca burada görünür." />}
      {sum && data && (
        <div className="tabs" role="tablist">
          {([["sum", "Genel"], ["rounds", "Round analizi"], ["maps", "Haritalar"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      )}
      {sum && data && tab === "rounds" && <div className="fade"><RoundsView matches={data.matches} /></div>}
      {sum && data && tab === "maps" && <div className="fade"><MapsView matches={data.matches} assets={assets} /></div>}
      {sum && data && tab === "sum" && (
        <div className="fade">
          <Dashboard matches={data.matches} rank={data.rank} assets={assets} onCard={setCard} />
          {(() => {
            const s = rrStats(data.matches.filter((m) => m.queue === "competitive" && m.rrDelta != null).map((m) => m.rrDelta as number));
            if (!s) return null;
            const nx = nextRank(data.rank.current, data.rank.rr, s);
            const up = s.diff >= MMR_GAP, down = s.diff <= -MMR_GAP;
            return (
              <div className="mmr box">
                <span className={up ? "bd pos" : down ? "bd neg" : "bd gray"}>{up ? "MMR ↑" : down ? "MMR ↓" : "MMR dengede"}</span>
                <span className="m">
                  Kazanınca ort. <b className="pos">+{Math.round(s.gain)}</b>, kaybedince ort. <b className="neg">−{Math.round(s.loss)}</b> RR
                  {nx && assets.tiers.get(nx.tier) ? <> · {assets.tiers.get(nx.tier)!.name} için ≈{nx.wins} galibiyet</> : null}
                  {derankRisk(data.rank.current, data.rank.rr, s) ? <> · <span className="neg">bir mağlubiyette düşebilirsin</span></> : null}
                </span>
              </div>
            );
          })()}
          <Goal assets={assets} tier={data.rank.current} rr={data.rank.rr} deltas={data.matches.filter((m) => m.queue === "competitive" && m.rrDelta != null).map((m) => m.rrDelta as number)} />
        </div>
      )}
      {card && <MatchCard m={card} assets={assets} rank={data?.rank.current} onToast={onToast} onShare={() => { onShare(cardOf(card, assets, data?.rank.current)); setCard(null); }} onClose={() => setCard(null)} />}
    </div>
  );
}
