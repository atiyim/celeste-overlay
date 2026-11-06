import { lookup, type Assets } from "../../src/assets";
import { useContracts, useNow, useStats } from "./data";
import { QUEUE, left, t, type Key } from "./i18n";
import { SkeletonRows } from "./Skeleton";

const tierColor = (hex?: string) => (hex ? `#${hex.replace("#", "").slice(0, 6)}` : undefined);
const low = (s?: string | null) => (s ?? "").toLowerCase();

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Savaş bileti ve görevler. Riot'un verdiği ilerleme + görsel veritabanındaki görev adları ve seviye XP'leri. */
function Progress({ now }: { now: number }) {
  const q = useContracts();
  if (q.error) return null; // görev bilgisi gelmezse bu bölüm hiç görünmez
  if (!q.data) return <SkeletonRows n={3} />;
  const { c, missions, contracts, seasons } = q.data;

  // Savaş bileti: şu anki act'e bağlı sözleşme.
  const act = seasons.find((s: any) => String(s.type ?? "").endsWith("Act") && Date.parse(s.startTime) <= now && now < Date.parse(s.endTime));
  const def = act && contracts.find((x: any) => x.content?.relationType === "Season" && low(x.content?.relationUuid) === low(act.uuid));
  const mine = def && c.Contracts?.find((x) => low(x.ContractDefinitionID) === low(def.uuid));
  const levels: any[] = def ? (def.content?.chapters ?? []).filter((ch: any) => !ch.isEpilogue).flatMap((ch: any) => ch.levels ?? []) : [];
  const bp = mine && levels.length ? { reached: mine.ProgressionLevelReached, total: levels.length, xp: mine.ProgressionTowardsNextLevel, need: levels[mine.ProgressionLevelReached]?.xp as number | undefined } : null;

  // Görevler: türüne göre (haftalık, günlük, diğer).
  const defs = new Map<string, any>(missions.map((m: any) => [low(m.uuid), m]));
  const groups: Record<string, { title: string; cur: number; need: number; xp: number; done: boolean }[]> = {};
  for (const m of c.Missions ?? []) {
    const d = defs.get(low(m.ID));
    if (!d) continue;
    const type = String(d.type ?? "").split("::").pop() ?? "";
    const g: Key = type === "Weekly" ? "weekly" : type === "Daily" ? "dailyM" : "otherM";
    const cur = Object.values(m.Objectives ?? {}).reduce((n, x) => n + (Number(x) || 0), 0);
    const need = Number(d.progressToComplete) || (d.objectives ?? []).reduce((n: number, o: any) => n + (Number(o.value) || 0), 0) || 1;
    (groups[g] ??= []).push({ title: String(d.title ?? d.displayName ?? ""), cur: Math.min(cur, need), need, xp: Number(d.xpGrant) || 0, done: m.Complete });
  }
  const refill = c.MissionMetadata?.WeeklyRefillTime ? Date.parse(c.MissionMetadata.WeeklyRefillTime) : 0;
  const order: Key[] = ["dailyM", "weekly", "otherM"];

  return (
    <>
      {bp && (
        <section className="bp">
          <div className="bp-top"><b>{t("battlepass")}</b><span>{bp.reached >= bp.total ? t("bpDone") : t("bpLevel", { a: bp.reached, b: bp.total })}</span></div>
          <div className="bar"><i style={{ width: `${Math.min(100, (100 * bp.reached) / bp.total)}%` }} /></div>
          {bp.reached < bp.total && bp.need ? <small>{t("bpXp", { a: bp.xp.toLocaleString(), b: bp.need.toLocaleString() })}</small> : null}
        </section>
      )}
      <h2 className="grp">{t("missions")}{refill > now && <small>{t("refillIn", { t: left(refill - now) })}</small>}</h2>
      {order.every((g) => !groups[g]?.length) && <p className="empty small">{t("noMissions")}</p>}
      {order.filter((g) => groups[g]?.length).map((g) => (
        <div key={g} className="ms-group">
          <small className="ms-type">{t(g)}</small>
          {groups[g].map((m, i) => (
            <div key={i} className={m.done ? "ms done" : "ms"}>
              <span className="ms-t"><b>{m.title}</b><small>{m.done ? t("done") : `${m.cur.toLocaleString()} / ${m.need.toLocaleString()}`}{m.xp ? ` · ${t("xp", { n: m.xp.toLocaleString() })}` : ""}</small></span>
              <div className="bar"><i style={{ width: `${(100 * (m.done ? m.need : m.cur)) / m.need}%` }} /></div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function Profile({ a, riot }: { a: Assets; riot?: string | null }) {
  const s = useStats();
  const now = useNow(30_000);
  const d = s.data;
  const tier = d ? a.tiers.get(d.rank.current) : undefined;
  const pk = d ? a.tiers.get(d.rank.peak) : undefined;
  return (
    <>
      <div className="me-head">
        {tier ? <img src={tier.icon} alt="" /> : <i className="sk sk-sq big" />}
        <div>
          <b>{riot ?? t("yourAccount")}</b>
          {tier && <span style={{ color: tierColor(tier.color) }}>{tier.name} · {d!.rank.rr} RR</span>}
          {pk && d!.rank.peak > 0 && <small>{t("peak")} {pk.name}</small>}
        </div>
      </div>
      <Progress now={now} />
      <h2 className="grp">{t("lastMatches")}</h2>
      {s.error && <p className="empty err">{s.error}</p>}
      {!d && !s.error && <SkeletonRows n={6} />}
      {d?.matches.slice(0, 15).map((m) => {
        const ag = a.agents.get(lookup(m.agentId));
        return (
          <div key={m.matchId} className={m.won ? "mm win" : "mm loss"}>
            {ag ? <img src={ag.icon} alt="" /> : <span />}
            <span className="mm-t"><b>{a.maps.get(lookup(m.mapId)) ?? t("map")}</b><small>{QUEUE(m.queue)}</small></span>
            <span className="mm-k">{m.kills}/{m.deaths}/{m.assists}</span>
            <span className={m.rrDelta != null ? (m.rrDelta >= 0 ? "mm-rr pos" : "mm-rr neg") : "mm-rr"}>{m.rrDelta != null ? `${m.rrDelta > 0 ? "+" : ""}${m.rrDelta}` : m.won ? t("won") : t("lost")}</span>
          </div>
        );
      })}
    </>
  );
}
