export type Phase = "offline" | "menu" | "pregame" | "ingame";

export interface Rank { current: number; peak: number; rr: number; wins: number; games: number; totalWins: number; totalGames: number }
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
  firstKills?: number; firstDeaths?: number;
  weaponKills?: WeaponCount[]; bought?: WeaponCount[] }
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
  smurf: number;
  loadout: Loadout;
  isSelf: boolean;
  form: FormEntry[];
  formLoading: boolean;
  rrTrend: number[];
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
export interface Store { daily: StoreOffer[]; dailyRemaining?: number | null; night: StoreOffer[]; nightRemaining?: number | null }

export interface MyMatch {
  matchId: string; mapId: string; agentId: string; queue: string; won: boolean;
  kills: number; deaths: number; assists: number; acs: number;
  rrDelta?: number | null; tierAfter?: number | null; started: number;
}
export interface MyStats { matches: MyMatch[]; rank: Rank }
