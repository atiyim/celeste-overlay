export type Phase = "offline" | "menu" | "pregame" | "ingame";

export interface ActRank { seasonId: string; tier: number; peak: number; wins: number; games: number }
export interface Rank {
  current: number; peak: number; rr: number; wins: number; games: number; totalWins: number; totalGames: number;
  leaderboard?: number | null; acts?: ActRank[];
}
export interface WeaponSlot {
  weaponId: string;
  skinId?: string | null;
  levelId?: string | null;
  chromaId?: string | null;
  charmId?: string | null;
  charmLevelId?: string | null;
  items?: string[];
}
export interface SpraySlot { socketId: string; sprayId: string; levelId?: string | null }
export interface Loadout { weapons: WeaponSlot[]; sprays: SpraySlot[]; sprayIds?: string[]; expressionIds?: string[]; allIds?: string[] }

export interface FormEntry { mapId?: string | null; agentId?: string | null; queue?: string | null; won: boolean; kills: number; deaths: number; assists: number;
  rounds?: number; headshots?: number; bodyshots?: number; legshots?: number; damage?: number;
  firstKills?: number; firstDeaths?: number; started?: number;
  weaponKills?: WeaponCount[]; bought?: WeaponCount[] }
export interface RrMatch { mapId: string; rr: number; started: number }
export interface WeaponCount { weaponId: string; count: number }

export interface Player {
  puuid: string;
  team: string;
  name?: string | null;
  hiddenName: boolean;
  level?: number | null;
  agentId: string;
  cardId?: string | null;
  titleId?: string | null;
  rank: Rank;
  party?: string | null;
  partySure: boolean;
  /** Parti bilgisinin kaynağı: Riot Client (kesin), önceki maç ya da son maçlar. */
  partySrc?: "live" | "last" | "history" | null;
  together: { puuid: string; count: number; of: number; last?: boolean }[];
  smurf: number;
  loadout: Loadout;
  isSelf: boolean;
  form: FormEntry[];
  formLoading: boolean;
  deep?: FormEntry[];
  deepLoading?: boolean;
  rrTrend: number[];
  /** Son 20 rekabet maçının haritası ve RR değişimi (en yeni başta). Eski sürüm çekirdeğinde gelmeyebilir. */
  rrMaps?: RrMatch[];
  played24h: number;
  played24hCapped: boolean;
  lastMatchAt?: number | null;
  kd?: number | null;
}

export interface Snapshot {
  phase: Phase;
  matchId?: string | null;
  mapId?: string | null;
  queueId?: string | null;
  players: Player[];
  error?: string | null;
  status?: Status;
}

export interface Status { riotClient: boolean; valorant: boolean; data: boolean; fault?: string | null; detail?: string | null }

export interface StoreOffer { itemId: string; price?: number | null; discounted?: number | null; discountPercent?: number | null }
export interface Wallet { vp?: number | null; rp?: number | null; kc?: number | null }
export interface Store { daily: StoreOffer[]; dailyRemaining?: number | null; night: StoreOffer[]; nightRemaining?: number | null; wallet?: Wallet | null }

export interface MissionState { id: string; complete: boolean; objectives: { id: string; value: number }[]; expiresAt?: string | null }
export interface ContractState { id: string; level: number; xpTowardNext: number; totalXp: number }
export interface Owned { skins: string[]; chromas: string[]; charms: string[]; sprays: string[]; cards: string[]; titles: string[] }
export interface Account {
  wallet?: Wallet | null; missions: MissionState[]; weeklyRefill?: string | null;
  contracts: ContractState[]; activeContract?: string | null; owned: Owned;
}

export interface MyMatch {
  matchId: string; mapId: string; agentId: string; queue: string; won: boolean;
  kills: number; deaths: number; assists: number; acs: number;
  rrDelta?: number | null; tierAfter?: number | null; started: number;
}
export interface MyStats { matches: MyMatch[]; rank: Rank }

export interface PremierMember { puuid: string; name?: string | null; hidden: boolean }
export interface PremierTeam { name: string; tag: string; members: PremierMember[] }

export interface PairCount { puuid: string; count: number }
export interface ReportPlayer {
  puuid: string; name?: string | null; hidden: boolean; team: string; agentId: string; isSelf: boolean; tier: number;
  score: number; rounds: number; kills: number; deaths: number; assists: number;
  headshots: number; bodyshots: number; legshots: number; damage: number; firstKills: number; firstDeaths: number;
  killed: PairCount[]; killedBy: PairCount[]; party?: string | null;
}
export interface ReportTeam { teamId: string; won: boolean; roundsWon: number }
export interface MatchReport { matchId: string; mapId: string; queue: string; started: number; teams: ReportTeam[]; players: ReportPlayer[] }
