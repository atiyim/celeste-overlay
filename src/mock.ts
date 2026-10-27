import type { Assets } from "./assets";
import type { Player, Snapshot, WeaponSlot } from "./types";

/* Tarayıcıda (Tauri dışında) geliştirirken gerçek görsellerle rastgele bir maç üretir. */
const pick = <T,>(arr: T[], i: number): T => arr[Math.abs(i) % arr.length];

export function mockSnapshot(a: Assets): Snapshot {
  const agents = [...a.agents.keys()];
  const sprays = [...a.sprays.keys()];
  const charms = [...a.charms.keys()];

  // Her silah için gerçek, süslü kaplamalar (standart ve seviye/chroma kayıtları dışarıda).
  const KEYS = ["gaia", "reaver", "oni", "prime", "elderflame", "glitchpop", "champions", "singularity", "araxys", "kuronami", "ruination", "spectrum", "sentinels", "ion", "origin"];
  const premium = (w: Assets["weapons"][number]): string[] => {
    const wn = w.name.toLowerCase();
    const all = [...a.skins.entries()].filter(([id, s]) => a.skinMeta.has(id) && id !== w.defaultSkinId && s.icon && s.name.toLowerCase().includes(wn) && !/standart|standard|random|rastgele/i.test(s.name));
    const liked = all.filter(([, s]) => KEYS.some((k) => s.name.toLowerCase().includes(k)));
    return (liked.length >= 3 ? liked : all).map(([id]) => id);
  };
  const premiumBy = new Map(a.weapons.map((w) => [w.id, premium(w)] as const));

  const names = ["Sen#TR1", "Kuzey#0412", "", "Mavi#TR1", "Deniz#7731", "Atlas#TR1", "nova#4410", "", "Kaan#TR1", "Zeynep#009"];
  const players: Player[] = names.map((n, i) => {
    const weapons: WeaponSlot[] = a.weapons.map((w, j) => {
      const pool = premiumBy.get(w.id) ?? [];
      const fancy = pool.length > 0 && (i + j) % 5 !== 0;
      return {
        weaponId: w.id,
        skinId: fancy ? pick(pool, i * 7 + j * 3) : w.defaultSkinId,
        chromaId: undefined,
        charmId: (i + j) % 4 === 0 ? pick(charms, i + j) : undefined,
      };
    });
    const cur = 12 + ((i * 3) % 12);
    return {
      puuid: `mock-${i}`,
      team: i < 5 ? "Blue" : "Red",
      name: n || null,
      hiddenName: !n,
      level: i === 6 ? 23 : 60 + i * 17,
      agentId: pick(agents, i * 5),
      rank: { current: cur, peak: cur + (i % 3), rr: 20 + i * 7, wins: 9 + i, games: 17 + i, totalWins: 80 + i, totalGames: 150 + i, leaderboard: i === 0 ? 1240 : null, acts: [0, 1, 2, 3, 4].map((s) => ({ seasonId: `00000000-0000-4000-9000-00000000000${s}`, tier: Math.max(3, cur - s * 2 + (i % 3)), peak: Math.max(3, cur - s * 2 + (i % 3) + 1), wins: 12 + s * 3 + i, games: 24 + s * 5 + i })) },
      party: i === 0 || i === 1 ? "A" : i === 5 || i === 6 ? "B" : null,
      partySure: i === 0 || i === 1,
      together: i === 0 ? [{ puuid: "mock-1", count: 5, of: 5 }] : i === 1 ? [{ puuid: "mock-0", count: 5, of: 5 }] : i === 5 ? [{ puuid: "mock-6", count: 3, of: 5 }] : i === 6 ? [{ puuid: "mock-5", count: 3, of: 5 }] : [],
      smurf: i === 6 ? 78 : 5,
      loadout: { weapons, sprays: [0, 1, 2, 3].map((s) => ({ socketId: `s${s}`, sprayId: pick(sprays, i * 11 + s) })) },
      isSelf: i === 0,
      form: [0, 1, 2, 3, 4].map((j) => ({ mapId: [...a.maps.keys()][j % a.maps.size], agentId: pick(agents, i * 5 + (j % 2)), queue: j === 3 ? "spikerush" : j === 4 && i % 2 ? "unrated" : "competitive", won: (i + j) % 3 !== 0, kills: 10 + ((i * j) % 14), deaths: 8 + ((i + j) % 9), assists: 2 + ((i * 3 + j) % 8), rounds: 22, headshots: 18 + ((i * 5 + j) % 20), bodyshots: 70, legshots: 8, damage: 3300 + i * 90, firstKills: (i + j) % 4, firstDeaths: (i * 2 + j) % 3, started: Date.now() - (25 + j * 47 + i * 9) * 60_000 - j * 3_600_000, weaponKills: [{ weaponId: a.weapons[(i + j) % a.weapons.length].id, count: 5 + j }], bought: [{ weaponId: a.weapons[i % a.weapons.length].id, count: 14 }] })),
      deep: Array.from({ length: 14 }, (_, j) => ({ mapId: [...a.maps.keys()][j % a.maps.size], agentId: pick(agents, i * 5 + (j % 3 === 0 ? 1 : 0)), queue: "competitive", won: (i + j) % 3 !== 0, kills: 9 + ((i * j) % 15), deaths: 8 + ((i + j) % 9), assists: 2 + ((i * 3 + j) % 8), rounds: 22, headshots: 18, bodyshots: 70, legshots: 8, damage: 3300, firstKills: 1, firstDeaths: 1, started: Date.now() - (j + 1) * 3_600_000 })),
      deepLoading: false,
      formLoading: false,
      played24h: i === 3 ? 11 : 2 + (i % 4),
      played24hCapped: false,
      lastMatchAt: Date.now() - (5 + i * 9) * 60000,
      rrTrend: i % 3 === 0 ? [-21, -18, -19, 12, -15] : i % 3 === 1 ? [22, 19, 25, -14, 20] : [10, -12, 15, -9, 11],
      kd: 0.8 + (i % 7) * 0.12,
    };
  });
  return { phase: "ingame", matchId: "mock-match", queueId: "competitive", mapId: [...a.maps.keys()][0], players };
}

/* Tarayıcıda geliştirirken Şeffaflık paneli için gerçekçi sahte kayıt. */
const MOCK_REQS: [string, string, string, string, string, "okuma" | "sorgu"][] = [
  ["GET", "127.0.0.1", "local", "/product-session/v1/external-sessions", "Valorant açık mı?", "okuma"],
  ["GET", "glz-eu-1.eu.a.pvp.net", "riot", "/core-game/v1/players/3f9a…c2", "Maç var mı?", "okuma"],
  ["GET", "glz-eu-1.eu.a.pvp.net", "riot", "/core-game/v1/matches/8d41…07", "Maç oyuncuları", "okuma"],
  ["GET", "glz-eu-1.eu.a.pvp.net", "riot", "/core-game/v1/matches/8d41…07/loadouts", "Oyuncuların kaplamaları", "okuma"],
  ["PUT", "pd.eu.a.pvp.net", "riot", "/name-service/v2/players", "İsim sorgusu (ismini gizleyenler hariç)", "sorgu"],
  ["GET", "pd.eu.a.pvp.net", "riot", "/mmr/v1/players/b27c…5e", "Rank bilgisi", "okuma"],
  ["GET", "pd.eu.a.pvp.net", "riot", "/match-history/v1/history/b27c…5e", "Maç geçmişi", "okuma"],
  ["GET", "pd.eu.a.pvp.net", "riot", "/match-details/v1/matches/1c9e…a4", "Maç ayrıntısı", "okuma"],
  ["GET", "127.0.0.1", "local", "/chat/v4/presences", "Parti bilgisi", "okuma"],
];
export function mockNet(n: number): import("./net").NetReport {
  const now = Date.now();
  const entries = Array.from({ length: 40 }, (_, i) => {
    const r = MOCK_REQS[(i * 5 + n) % MOCK_REQS.length];
    return { t: now - i * 1800 - (n % 3) * 300, method: r[0], host: r[1], target: r[2] as "local" | "riot", path: r[3], what: r[4], kind: r[5], status: i === 17 ? 404 : 200, ms: 22 + ((i * 37) % 140) };
  });
  return {
    entries, total: 412 + n * 3, reads: 371 + n * 3, queries: 41, writes: 0, errors: 3, lastMinute: 24,
    hosts: [
      { host: "glz-eu-1.eu.a.pvp.net", target: "riot", count: 168 },
      { host: "pd.eu.a.pvp.net", target: "riot", count: 203 },
      { host: "127.0.0.1", target: "local", count: 57 },
      { host: "valorant-api.com", target: "assets", count: 6 },
      { host: "github.com", target: "github", count: 1 },
    ],
    hiddenSkipped: 2, since: now - 3_600_000,
  };
}
