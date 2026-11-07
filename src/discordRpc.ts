import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { lookup, type Assets } from "./assets";
import type { MyMatch, MyStats, Snapshot } from "./types";
import { score } from "./MatchCard";
import { DISCORD_URL } from "./community";

/* Discord kartı ("Yarışıyor: Celeste Overlay"): oyundaki duruma göre değişir.
   Büyük resim harita (menüde Celeste'nin gökyüzü resmi), küçük resim ajan (rank atlayınca yeni rank).
   Veriler: Riot Client'ın bu bilgisayardaki durumu (skor, sıra, parti) ve overlay'in zaten çektiği maç geçmişi.
   Discord'a yalnızca bu bilgisayarda gider; Celeste'nin sunucusuna hiçbir şey gitmez. */

const inTauri = "__TAURI_INTERNALS__" in window;
const MENU_ART = "https://raw.githubusercontent.com/atiyim/celeste-overlay/main/docs/discord/menu.png";
const DOWNLOAD = "https://github.com/atiyim/celeste-overlay/releases/latest";
const BUTTONS = [
  { label: "Celeste Overlay'i indir", url: DOWNLOAD },
  { label: "Discord sunucusuna katıl", url: DISCORD_URL },
];
/** Maç sonu anı menüde en fazla bu kadar kalır (sıraya girince "Son maç" satırına iner, ajan seçimi başlayınca kalkar). */
const MOMENT_MS = 10 * 60_000;

const QUEUE: Record<string, string> = {
  competitive: "Rekabetçi", unrated: "Derecesiz", swiftplay: "Tam gaz", premier: "Premier", deathmatch: "Ölüm maçı",
  hurm: "Takım ölüm maçı", spikerush: "Spike Rush", ggteam: "Tırmanış", onefa: "Kopya", newmap: "Yeni harita", "": "Özel oyun",
};
const queueName = (q?: string | null) => (q == null ? "Valorant" : QUEUE[q] ?? q.charAt(0).toUpperCase() + q.slice(1));

/** Riot'un durum kaydı iki biçimde gelebiliyor (eski düz ve yeni gruplu); ikisinden de okunur. */
function pres(p: any) {
  if (!p) return null;
  const party = p.partyPresenceData ?? {}, match = p.matchPresenceData ?? {};
  const pick = <T,>(...v: T[]) => v.find((x) => x !== undefined && x !== null && x !== "");
  const num = (...v: unknown[]) => { const x = pick(...v); return typeof x === "number" ? x : undefined; };
  return {
    loop: pick<string>(match.sessionLoopState, p.sessionLoopState) ?? "",
    queue: pick<string>(match.queueId, p.queueId, party.queueId),
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

interface Moment { title: string; line: string; short: string; rankIcon?: string; rankName?: string; at: number; mapId: string; agentId: string }

/** Maç sonu anı: rank atlama > maçın MVP'si > galibiyet serisi > takımın en iyisi > sonuç. Hepsi maç geçmişinden. */
function momentOf(list: MyMatch[], a: Assets, streamer: boolean): Moment | null {
  const m = list[0];
  if (!m) return null;
  const map = a.maps.get(lookup(m.mapId)) ?? "";
  const sc = score(m);
  const res = `${m.won ? "Zafer" : "Yenilgi"}${sc ? ` ${sc[0]} – ${sc[1]}` : ""}`;
  const rr = !streamer && m.rrDelta != null ? ` · ${m.rrDelta > 0 ? "+" : ""}${m.rrDelta} RR` : "";
  const line = `${m.kills}/${m.deaths}/${m.assists} · ACS ${m.acs}${rr}`;
  const base = { line, at: Date.now(), mapId: m.mapId, agentId: m.agentId };
  const prev = list.slice(1).find((x) => x.queue === m.queue && x.tierAfter);
  if (!streamer && m.tierAfter && prev?.tierAfter && m.tierAfter > prev.tierAfter) {
    const t = a.tiers.get(m.tierAfter);
    if (t) return { ...base, title: `🔺 Yükseldi: ${t.name}`, short: `${res} · ${t.name}`, rankIcon: t.icon, rankName: t.name };
  }
  const board = m.board ?? [];
  const mine = board.find((r) => r.me);
  if (mine && board.length >= 6 && board.every((r) => r.me || r.acs < mine.acs)) return { ...base, title: `🏆 Maçın MVP'si · ${res}`, short: `${res} · MVP` };
  let streak = 0;
  for (const x of list) { if (x.won) streak++; else break; }
  if (streak >= 3) return { ...base, title: `🔥 ${streak} maçtır kazanıyor`, short: `${res} · ${streak} galibiyet serisi` };
  if (mine && board.filter((r) => r.ally).every((r) => r.me || r.acs < mine.acs) && board.some((r) => r.ally && !r.me)) {
    return { ...base, title: `⭐ Takımının en iyisi · ${res}`, short: `${res} · takımın en iyisi` };
  }
  return { ...base, title: `${res} · ${map}`, short: res };
}

const cut = (s: string) => (s.length > 120 ? `${s.slice(0, 119)}…` : s.length < 2 ? `${s}  ` : s);

/** Discord kartını oyunun durumuna göre güncel tutar. `on`: ayar (varsayılan açık). */
export function useDiscordPresence(snapNow: Snapshot, assetsNow: Assets | null, onNow: boolean, streamerNow: boolean) {
  // Zamanlayıcılar her zaman en güncel durumu okusun diye.
  const cur = useRef({ snap: snapNow, assets: assetsNow, on: onNow, streamer: streamerNow });
  cur.current = { snap: snapNow, assets: assetsNow, on: onNow, streamer: streamerNow };
  const { snap, assets, on, streamer } = cur.current;
  const presRef = useRef<{ at: number; v: ReturnType<typeof pres> }>({ at: 0, v: null });
  const since = useRef<{ key: string; at: number }>({ key: "", at: Date.now() });
  const moment = useRef<Moment | null>(null);
  const lastMatch = useRef<string | null>(null);
  const prevPhase = useRef(snapNow.phase);
  const timers = useRef<number[]>([]);

  // Maç bitince: maç geçmişi Riot'ta birkaç saniye geç düşebildiği için birkaç kez sorulur.
  useEffect(() => {
    if (!inTauri || !on || !assets) return;
    if (snap.phase === "ingame" && snap.matchId) lastMatch.current = snap.matchId;
    if (snap.phase === "pregame" || snap.phase === "ingame") { moment.current = null; timers.current.forEach(window.clearTimeout); }
    if (prevPhase.current === "ingame" && snap.phase !== "ingame") {
      const expect = lastMatch.current;
      timers.current.forEach(window.clearTimeout);
      timers.current = [15_000, 45_000, 100_000].map((d) => window.setTimeout(async () => {
        try {
          const s = await invoke<MyStats>("get_my_stats");
          if (expect && s.matches[0]?.matchId !== expect) return;
          if (cur.current.snap.phase !== "menu") return;
          moment.current = momentOf(s.matches, assets, cur.current.streamer);
          timers.current.forEach(window.clearTimeout);
          push();
        } catch { /* sonraki denemede */ }
      }, d));
    }
    prevPhase.current = snap.phase;
  }, [snap.phase, snap.matchId, on, assets]);

  const push = async () => {
    if (!inTauri) return;
    const { snap, assets, on, streamer } = cur.current;
    if (!on || !assets || snap.phase === "offline") { invoke("discord_set", { activity: null }).catch(() => undefined); return; }
    // Riot Client'ın durum kaydı en fazla 10 saniyede bir sorulur (yalnızca bu bilgisayarda).
    if (Date.now() - presRef.current.at > 10_000) {
      presRef.current = { at: Date.now(), v: pres(await invoke<unknown>("get_presence").catch(() => null)) };
    }
    const p = presRef.current.v;
    const me = snap.players.find((x) => x.isSelf);
    const agent = me?.agentId ? assets.agents.get(lookup(me.agentId)) : undefined;
    const tier = me && me.rank.current > 0 ? assets.tiers.get(me.rank.current) : undefined;
    const mapKey = snap.mapId ? lookup(snap.mapId) : "";
    const mapName = assets.maps.get(mapKey) ?? "";
    const mapArt = assets.mapArt.get(mapKey);
    const q = queueName(snap.queueId ?? p?.queue);
    const party = p?.size && p.max && p.max > 1 ? { size: [p.size, p.max] } : undefined;
    const mo = moment.current && Date.now() - moment.current.at < MOMENT_MS ? moment.current : null;
    const queued = snap.phase === "menu" && p?.partyState === "MATCHMAKING";

    // Sayaç: her durum kendi başlangıcından sayılır.
    const key = snap.phase === "ingame" || snap.phase === "pregame" ? `${snap.phase}:${snap.matchId}` : queued ? "queue" : "menu";
    if (since.current.key !== key) since.current = { key, at: Date.now() };
    const start = queued && p?.queuedAt ? p.queuedAt : since.current.at;

    const agentText = agent ? `${agent.name}${tier && !streamer ? ` · ${tier.name}${me ? ` · ${me.rank.rr} RR` : ""}` : ""}` : undefined;
    let a: Record<string, unknown>;
    if (snap.phase === "ingame") {
      const sc = !streamer && p?.ally != null && p.enemy != null && p.ally + p.enemy > 0 ? p : null;
      const lead = sc ? (sc.ally! > sc.enemy! ? "Önde" : sc.ally! < sc.enemy! ? "Geride" : "Berabere") : "";
      a = {
        details: `${q}${mapName ? ` · ${mapName}` : ""}`, state: sc ? `${sc.ally} – ${sc.enemy} · ${lead}` : "Maçta",
        large_image: mapArt ?? MENU_ART, large_text: mapName || "Valorant", small_image: agent?.icon, small_text: agentText,
        status_display_type: sc ? 1 : 2,
      };
    } else if (snap.phase === "pregame") {
      a = {
        details: `${q}${mapName ? ` · ${mapName}` : ""}`, state: me?.agentState === "locked" && agent ? `${agent.name} kilitledi` : "Ajan seçiyor",
        large_image: mapArt ?? MENU_ART, large_text: mapName || "Ajan seçimi", small_image: agent?.icon, small_text: agentText, status_display_type: 2,
      };
    } else if (queued) {
      a = {
        details: `${q} · Maç aranıyor`, state: mo ? `Son maç: ${mo.short}` : "Sırada",
        large_image: MENU_ART, large_text: "Celeste Overlay", status_display_type: 2,
      };
    } else if (mo) {
      const art = mo.rankIcon ?? assets.mapArt.get(lookup(mo.mapId)) ?? MENU_ART;
      const ag = assets.agents.get(lookup(mo.agentId));
      a = {
        details: mo.title, state: mo.line,
        large_image: art, large_text: mo.rankName ?? assets.maps.get(lookup(mo.mapId)) ?? "Son maç",
        small_image: mo.rankIcon ? ag?.icon : tier?.icon && !streamer ? tier.icon : ag?.icon,
        small_text: mo.rankIcon ? ag?.name : tier && !streamer ? tier.name : ag?.name,
        status_display_type: 2,
      };
    } else {
      a = { details: "Menüde", state: party ? "Partide" : "Tek başına", large_image: MENU_ART, large_text: "Celeste Overlay", status_display_type: 0 };
    }

    const assetsObj = Object.fromEntries(
      Object.entries({ large_image: a.large_image, large_text: a.large_text, small_image: a.small_image, small_text: a.small_text, large_url: DOWNLOAD })
        .filter(([, v]) => typeof v === "string" && v)
        .map(([k, v]) => [k, k.endsWith("_text") ? cut(v as string) : v]),
    );
    const activity = {
      type: 5, // "Yarışıyor"
      status_display_type: a.status_display_type,
      details: cut(String(a.details)),
      state: cut(String(a.state)),
      timestamps: { start: Math.floor(start / 1000) },
      assets: assetsObj,
      party,
      buttons: BUTTONS,
    };
    invoke("discord_set", { activity }).catch(() => undefined);
  };

  // Her yeni durumda ve en az 15 saniyede bir (sıra durumu ve skor için).
  useEffect(() => {
    push();
  }, [snap, on, streamer, assets]);
  useEffect(() => {
    if (!inTauri) return;
    const t = window.setInterval(push, 15_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => () => { if (inTauri) invoke("discord_set", { activity: null }).catch(() => undefined); }, []);
}
