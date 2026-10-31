import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { MyMatch, RoundAgg } from "./types";

/* Kendi maçlarının round round analizi ve harita/taraf havuzu. Her sayı Riot'un maç kaydından gelir. */

const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);
const P = ({ v }: { v: number | null }) => <>{v == null ? "–" : `%${v}`}</>;

export function sumRounds(list: RoundAgg[]): RoundAgg {
  const z: RoundAgg = { atkRounds: 0, atkWon: 0, defRounds: 0, defWon: 0, fkAtk: 0, fdAtk: 0, fkDef: 0, fdDef: 0, eco: [[0, 0], [0, 0], [0, 0], [0, 0]], deaths: 0, traded: 0, trades: 0, clutch: 0, clutchWon: 0, kast: 0, rounds: 0, multi: 0, plants: 0, defuses: 0 };
  for (const r of list) {
    for (const k of Object.keys(z) as (keyof RoundAgg)[]) {
      if (k === "eco") r.eco.forEach((e, i) => { z.eco[i][0] += e[0]; z.eco[i][1] += e[1]; });
      else (z[k] as number) += r[k] as number;
    }
  }
  return z;
}

const ECO = ["Tabanca", "Eko", "Yarım alım", "Tam alım"];

export function RoundsView({ matches }: { matches: MyMatch[] }) {
  const withRounds = matches.filter((m) => m.rounds && m.rounds.rounds > 0);
  if (!withRounds.length) return <p className="none">Round analizi için rekabet, derecesiz ya da Premier maçı gerekiyor.</p>;
  const r = sumRounds(withRounds.map((m) => m.rounds!));
  const fkAll = r.fkAtk + r.fkDef, fdAll = r.fdAtk + r.fdDef;
  return (
    <div className="rv">
      <p className="m cap0">Son <b>{withRounds.length}</b> maç, <b>{r.rounds}</b> round (rekabet, derecesiz, Premier)</p>
      <div className="kpis rk6">
        <div><b><P v={pct(r.atkWon, r.atkRounds)} /></b><small>Saldırıda round · {r.atkWon}/{r.atkRounds}</small></div>
        <div><b><P v={pct(r.defWon, r.defRounds)} /></b><small>Savunmada round · {r.defWon}/{r.defRounds}</small></div>
        <div><b><P v={pct(r.kast, r.rounds)} /></b><small title="Öldürme, asist, hayatta kalma ya da takaslanma olan round'lar">KAST</small></div>
        <div><b>{r.clutchWon}/{r.clutch}</b><small title="Takımında tek kaldığın round'lar (1vX) ve kazandıkların">Clutch</small></div>
      </div>
      <div className="rgrid">
        <section>
          <h3 className="h2">İlk kan<span className="hv">round'un ilk öldürmesi / ilk ölümü</span></h3>
          <div className="box pad">
            <div className="tr rrow hd2"><span /><span className="num">İlk kan</span><span className="num">İlk ölüm</span><span className="num">Oran</span></div>
            <div className="tr rrow"><span>Saldırı</span><span className="num">{r.fkAtk}</span><span className="num">{r.fdAtk}</span><span className={r.fkAtk >= r.fdAtk ? "num pos" : "num neg"}>{(r.fkAtk / Math.max(1, r.fdAtk)).toFixed(2)}</span></div>
            <div className="tr rrow"><span>Savunma</span><span className="num">{r.fkDef}</span><span className="num">{r.fdDef}</span><span className={r.fkDef >= r.fdDef ? "num pos" : "num neg"}>{(r.fkDef / Math.max(1, r.fdDef)).toFixed(2)}</span></div>
            <div className="tr rrow"><span><b>Toplam</b></span><span className="num"><b>{fkAll}</b></span><span className="num"><b>{fdAll}</b></span><span className={fkAll >= fdAll ? "num pos" : "num neg"}><b>{(fkAll / Math.max(1, fdAll)).toFixed(2)}</b></span></div>
          </div>
          <h3 className="h2">Takas<span className="hv">5 saniye içinde intikam</span></h3>
          <div className="box pad">
            <div className="tr rrow2"><span>Ölümlerinin takaslanan kısmı</span><span className="num"><P v={pct(r.traded, r.deaths)} /> <small className="d">{r.traded}/{r.deaths}</small></span></div>
            <div className="tr rrow2"><span>Senin aldığın intikamlar</span><span className="num">{r.trades}</span></div>
            <div className="tr rrow2"><span>3+ öldürmeli round</span><span className="num">{r.multi}</span></div>
            <div className="tr rrow2"><span>Spike kurma · çözme</span><span className="num">{r.plants} · {r.defuses}</span></div>
          </div>
        </section>
        <section>
          <h3 className="h2">Alım türüne göre round<span className="hv">takımın ortalama alımı</span></h3>
          <div className="box pad">
            <div className="tr rrow hd2"><span /><span className="num">Round</span><span className="num">Kazanılan</span><span className="num">Oran</span></div>
            {r.eco.map((e, i) => (
              <div className="tr rrow" key={ECO[i]}>
                <span>{ECO[i]}</span>
                <span className="num">{e[0]}</span>
                <span className="num">{e[1]}</span>
                <span className="num"><span className="ebar"><i style={{ width: `${pct(e[1], e[0]) ?? 0}%` }} /></span><P v={pct(e[1], e[0])} /></span>
              </div>
            ))}
          </div>
          <p className="m small">Eko: takım ortalaması 1.500'ün altında, yarım alım 1.500–3.700, tam alım 3.700 ve üstü. Tabanca: 1. ve 13. round.</p>
        </section>
      </div>
    </div>
  );
}

export function MapsView({ matches, assets }: { matches: MyMatch[]; assets: Assets }) {
  const by = new Map<string, { n: number; w: number; k: number; d: number; r: RoundAgg[] }>();
  for (const m of matches) {
    const key = lookup(m.mapId);
    const e = by.get(key) ?? { n: 0, w: 0, k: 0, d: 0, r: [] };
    e.n++; e.w += m.won ? 1 : 0; e.k += m.kills; e.d += m.deaths;
    if (m.rounds) e.r.push(m.rounds);
    by.set(key, e);
  }
  const rows = [...by.entries()].map(([id, e]) => ({ id, name: assets.maps.get(id) ?? "?", ...e, s: e.r.length ? sumRounds(e.r) : null })).sort((a, b) => b.n - a.n);
  if (!rows.length) return <p className="none">Maç bulunamadı.</p>;
  const ranked = rows.filter((x) => x.n >= 3);
  const best = ranked.length >= 2 ? [...ranked].sort((a, b) => b.w / b.n - a.w / a.n)[0] : null;
  const worst = ranked.length >= 2 ? [...ranked].sort((a, b) => a.w / a.n - b.w / b.n)[0] : null;
  return (
    <div className="mv">
      {best && worst && best.id !== worst.id && (
        <p className="m cap0">En iyi haritan <b className="pos">{best.name}</b> (%{pct(best.w, best.n)}), en zayıfın <b className="neg">{worst.name}</b> (%{pct(worst.w, worst.n)}). En az 3 maç oynanan haritalar sayıldı.</p>
      )}
      <div className="box pad">
        <div className="tr mrow hd2"><span>Harita</span><span className="num">Maç</span><span className="num">Galibiyet</span><span className="num">Saldırı</span><span className="num">Savunma</span><span className="num">K/D</span></div>
        {rows.map((x) => (
          <div className="tr mrow" key={x.id}>
            <span>{x.name}</span>
            <span className="num d">{x.n}</span>
            <span className={x.w / x.n >= 0.5 ? "num pos" : "num neg"}>%{pct(x.w, x.n)}</span>
            <span className="num">{x.s ? <P v={pct(x.s.atkWon, x.s.atkRounds)} /> : "–"}</span>
            <span className="num">{x.s ? <P v={pct(x.s.defWon, x.s.defRounds)} /> : "–"}</span>
            <span className="num">{(x.d ? x.k / x.d : x.k).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <p className="m small">Saldırı ve savunma sütunları round kazanma oranıdır (rekabet, derecesiz, Premier).</p>
    </div>
  );
}
