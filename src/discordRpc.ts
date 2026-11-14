import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { lookup, type Assets } from "./assets";
import type { MyMatch, MyStats, Snapshot } from "./types";
import { score } from "./MatchCard";
import { DISCORD_URL } from "./community";
import { queueName } from "./queues";

/* Discord kartı ("Celeste Overlay oynuyor"): oyundaki duruma göre değişir.
   Büyük resim harita (menüde Celeste'nin gökyüzü resmi), küçük resim ajan (rank atlayınca yeni rank).
   Veriler: Riot Client'ın bu bilgisayardaki durumu (skor, sıra, parti) ve overlay'in zaten çektiği maç geçmişi.
   Discord'a yalnızca bu bilgisayarda gider; Celeste'nin sunucusuna hiçbir şey gitmez. */

const inTauri = "__TAURI_INTERNALS__" in window;
// Discord dış görselleri adresine göre önbelleğe alır: görsel değişince dosya adı da değişmeli.
const MENU_ART = "https://raw.githubusercontent.com/atiyim/celeste-overlay/main/docs/discord/menu-ay.png";
const DOWNLOAD = "https://github.com/atiyim/celeste-overlay/releases/latest";
const BUTTONS = [
  { label: "⬇️ Overlay'i indir", url: DOWNLOAD },
  { label: "💬 Discord'a katıl", url: DISCORD_URL },
];
/** Maç sonu anı menüde en fazla bu kadar kalır (sıraya girince ya da ajan seçimi başlayınca kalkar). */
const MOMENT_MS = 10 * 60_000;
/** Riot Client'ın durumu bu sıklıkla okunur: skor, sıra ve maç başlangıcı birkaç saniyede yansısın. Yerel istek, internete gitmez. */
const PRESENCE_MS = 2_000;

/** Riot'un durum kaydı iki biçimde gelebiliyor (eski düz ve yeni gruplu); ikisinden de okunur. */
function pres(p: any) {
  if (!p) return null;
  const party = p.partyPresenceData ?? {}, match = p.matchPresenceData ?? {};
  const pick = <T,>(...v: T[]) => v.find((x) => x !== undefined && x !== null && x !== "");
  const num = (...v: unknown[]) => { const x = pick(...v); return typeof x === "number" ? x : undefined; };
  return {
    loop: pick<string>(match.sessionLoopState, p.sessionLoopState) ?? "",
    queue: pick<string>(match.queueId, p.queueId, party.queueId),
    map: pick<string>(match.matchMap, p.matchMap),
    partyState: pick<string>(party.partyState, p.partyState) ?? "",
    size: num(party.partySize, p.partySize),
    max: num(party.maxPartySize, p.maxPartySize),
    queuedAt: parseRiotTime(pick<string>(party.queueEntryTime, p.queueEntryTime)),
    ally: num(party.partyOwnerMatchScoreAllyTeam, p.partyOwnerMatchScoreAllyTeam),
    enemy: num(party.partyOwnerMatchScoreEnemyTeam, p.partyOwnerMatchScoreEnemyTeam),
  };
}
/** "2026.11.08-19.43.21" (UTC) → ms. Sıraya girilmemişse Riot "0001.01.01-…" yazar. */
function parseRiotTime(s?: string): number | undefined {
  const m = s?.match(/^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!m || Number(m[1]) < 2000) return undefined;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

interface Moment { title: string; line: string; rankIcon?: string; rankName?: string; at: number; mapId: string; agentId: string }

/** Maç sonu anı: rank atlama > maçın MVP'si > galibiyet serisi > takımın en iyisi > sonuç. Hepsi maç geçmişinden. */
function momentOf(list: MyMatch[], a: Assets, streamer: boolean): Moment | null {
  const m = list[0];
  if (!m) return null;
  const map = nice(a.maps.get(lookup(m.mapId)) ?? "");
  const sc = score(m);
  const res = `${m.won ? "Zafer" : "Yenilgi"}${sc ? ` ${sc[0]} – ${sc[1]}` : ""}`;
  const rr = !streamer && m.rrDelta != null ? ` · ${m.rrDelta > 0 ? "+" : ""}${m.rrDelta} RR` : "";
  const line = `${res} · ${m.kills}/${m.deaths}/${m.assists}${rr}`;
  const base = { line, at: Date.now(), mapId: m.mapId, agentId: m.agentId };
  const prev = list.slice(1).find((x) => x.queue === m.queue && x.tierAfter);
  if (!streamer && m.tierAfter && prev?.tierAfter && m.tierAfter > prev.tierAfter) {
    const t = a.tiers.get(m.tierAfter);
    if (t) return { ...base, title: `🔺 Yükseldi: ${t.name}`, rankIcon: t.icon, rankName: t.name };
  }
  const board = m.board ?? [];
  const mine = board.find((r) => r.me);
  if (mine && board.length >= 6 && board.every((r) => r.me || r.acs < mine.acs)) return { ...base, title: "🏆 Maçın MVP'si" };
  let streak = 0;
  for (const x of list) { if (x.won) streak++; else break; }
  if (streak >= 3) return { ...base, title: `🔥 ${streak} maçtır kazanıyor` };
  if (mine && board.filter((r) => r.ally).every((r) => r.me || r.acs < mine.acs) && board.some((r) => r.ally && !r.me)) {
    return { ...base, title: "⭐ Takımının en iyisi" };
  }
  return { ...base, title: `Son maç · ${map || queueName(m.queue)}`, line: `${res} · ${m.kills}/${m.deaths}/${m.assists} · ACS ${m.acs}${rr}` };
}

/** Bazı harita adları tamamen büyük harfle geliyor ("DISTRICT"): "District" yap. Harita adları İngilizce, Türkçe küçültme kullanılmaz. */
const nice = (s: string) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : s);

const cut = (s: string) => (s.length > 120 ? `${s.slice(0, 119)}…` : s.length < 2 ? `${s}  ` : s);

type Phase = Snapshot["phase"];
const LOOP: Record<string, Phase> = { MENUS: "menu", PREGAME: "pregame", INGAME: "ingame" };

/** Discord kartını oyunun durumuna göre güncel tutar. `on`: ayar (varsayılan açık). */
export function useDiscordPresence(snapNow: Snapshot, assetsNow: Assets | null, onNow: boolean, streamerNow: boolean) {
  // Zamanlayıcılar her zaman en güncel durumu okusun diye.
  const cur = useRef({ snap: snapNow, assets: assetsNow, on: onNow, streamer: streamerNow });
  cur.current = { snap: snapNow, assets: assetsNow, on: onNow, streamer: streamerNow };
  const pr = useRef<ReturnType<typeof pres>>(null);
  const since = useRef<{ key: string; at: number }>({ key: "", at: Date.now() });
  const moment = useRef<Moment | null>(null);
  const lastMatch = useRef<string | null>(null);
  const prevPhase = useRef<Phase>(snapNow.phase);
  const timers = useRef<number[]>([]);

  /** Asıl durum: Riot Client'ın kendi kaydı (anında değişir); yoksa overlay'in son okuması. */
  const phaseOf = (): Phase => {
    const { snap } = cur.current;
    if (snap.phase === "offline") return "offline";
    return LOOP[pr.current?.loop ?? ""] ?? snap.phase;
  };

  // Maç bitince: maç geçmişi Riot'ta birkaç saniye geç düşebildiği için birkaç kez sorulur.
  const onPhase = (phase: Phase) => {
    const { snap, assets } = cur.current;
    if (phase === "ingame" && snap.matchId) lastMatch.current = snap.matchId;
    if (phase === "pregame" || phase === "ingame") { moment.current = null; timers.current.forEach(window.clearTimeout); }
    if (prevPhase.current === "ingame" && phase === "menu" && assets) {
      const expect = lastMatch.current;
      timers.current.forEach(window.clearTimeout);
      timers.current = [15_000, 45_000, 100_000].map((d) => window.setTimeout(async () => {
        try {
          const s = await invoke<MyStats>("get_my_stats");
          if (expect && s.matches[0]?.matchId !== expect) return;
          if (phaseOf() !== "menu") return;
          moment.current = momentOf(s.matches, assets, cur.current.streamer);
          timers.current.forEach(window.clearTimeout);
          push();
        } catch { /* sonraki denemede */ }
      }, d));
    }
    prevPhase.current = phase;
  };

  const push = () => {
    if (!inTauri) return;
    const { snap, assets, on, streamer } = cur.current;
    const phase = phaseOf();
    if (phase !== prevPhase.current) onPhase(phase);
    if (!on || !assets || phase === "offline") { invoke("discord_set", { activity: null, enabled: on }).catch(() => undefined); return; }
    const p = pr.current;
    // Overlay'in okuması bir adım geride olabilir (ör. menüde kalmış): o zaman harita ve mod Riot'un kaydından.
    const fresh = snap.phase === phase;
    const me = snap.players.find((x) => x.isSelf);
    const agent = fresh && me?.agentId ? assets.agents.get(lookup(me.agentId)) : undefined;
    const tier = me && me.rank.current > 0 && !streamer ? assets.tiers.get(me.rank.current) : undefined;
    const mapId = (fresh && snap.mapId) || p?.map || "";
    const mapKey = mapId ? lookup(mapId) : "";
    const mapName = nice(assets.maps.get(mapKey) ?? "");
    const mapArt = assets.mapArt.get(mapKey);
    const q = queueName((fresh && snap.queueId) || p?.queue) || "Valorant";
    // Parti sayısı yazıyla gösterilir; Discord'un kendi "(1 / 5)" eki yazıyla çakışmasın diye party alanı gönderilmez.
    const partyText = `Parti (${Math.max(1, p?.size ?? 1)}/${Math.max(2, p?.max ?? 5)})`;
    const queued = phase === "menu" && p?.partyState === "MATCHMAKING";
    if (queued) moment.current = null;
    const mo = moment.current && Date.now() - moment.current.at < MOMENT_MS ? moment.current : null;

    // Sayaç: her durum kendi başlangıcından sayılır.
    const key = phase === "ingame" || phase === "pregame" ? `${phase}:${(fresh && snap.matchId) || mapId}` : queued ? "queue" : "menu";
    if (since.current.key !== key) since.current = { key, at: Date.now() };
    const start = queued && p?.queuedAt ? p.queuedAt : since.current.at;

    const agentText = agent ? `${agent.name}${tier ? ` · ${tier.name}` : ""}` : undefined;
    const rankText = tier ? `${tier.name} · ${me!.rank.rr} RR` : undefined;
    // Sade kart: başlık her zaman "Celeste Overlay", altında iki satır. Ayrıntı ikonların üstüne gelince görünür.
    let a: { details: string; state: string; large: string; small?: string; smallText?: string };
    if (phase === "ingame") {
      const sc = !streamer && p?.ally != null && p.enemy != null && p.ally + p.enemy > 0 ? `${p.ally} – ${p.enemy}` : "";
      a = { details: q, state: [mapName, sc].filter(Boolean).join(" · ") || "Maçta", large: mapArt ?? MENU_ART, small: agent?.icon, smallText: agentText };
    } else if (phase === "pregame") {
      const st = me?.agentState === "locked" && agent ? `${agent.name} kilitledi` : "Ajan seçiyor";
      a = { details: q, state: [mapName, st].filter(Boolean).join(" · "), large: mapArt ?? MENU_ART, small: agent?.icon, smallText: agentText };
    } else if (queued) {
      a = { details: q, state: "Maç aranıyor", large: MENU_ART, small: tier?.icon, smallText: rankText };
    } else if (mo) {
      const ag = assets.agents.get(lookup(mo.agentId));
      a = {
        details: mo.title, state: mo.line,
        large: mo.rankIcon ?? assets.mapArt.get(lookup(mo.mapId)) ?? MENU_ART,
        small: mo.rankIcon ? ag?.icon : tier?.icon ?? ag?.icon,
        smallText: mo.rankIcon ? ag?.name : rankText ?? ag?.name,
      };
    } else {
      a = { details: "Menüde", state: partyText, large: MENU_ART, small: tier?.icon, smallText: rankText };
    }

    const activity = {
      type: 0, // "Celeste Overlay oynuyor"
      status_display_type: 0, // başlık ve durum satırı her zaman "Celeste Overlay"
      details: cut(a.details),
      state: cut(a.state),
      timestamps: { start: Math.floor(start / 1000) },
      assets: {
        large_image: a.large,
        large_url: DOWNLOAD,
        ...(a.small ? { small_image: a.small, ...(a.smallText ? { small_text: cut(a.smallText) } : {}) } : {}),
      },
      buttons: BUTTONS,
    };
    invoke("discord_set", { activity }).catch(() => undefined);
  };

  // Overlay'in her yeni okumasında.
  useEffect(() => { push(); }, [snapNow, onNow, streamerNow, assetsNow]);
  // Riot Client'ın durumu: birkaç saniyede bir. Aynı içerik Discord'a tekrar gönderilmez.
  useEffect(() => {
    if (!inTauri) return;
    let live = true;
    const tick = async () => {
      const { on, snap } = cur.current;
      if (on && snap.phase !== "offline") {
        const v = pres(await invoke<unknown>("get_presence").catch(() => null));
        if (!live) return;
        pr.current = v;
      } else pr.current = null;
      push();
    };
    tick();
    const t = window.setInterval(tick, PRESENCE_MS);
    return () => { live = false; window.clearInterval(t); };
  }, []);
  useEffect(() => () => { if (inTauri) invoke("discord_set", { activity: null }).catch(() => undefined); }, []);
}
