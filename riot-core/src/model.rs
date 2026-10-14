use serde::Serialize;

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    #[default]
    Offline,
    Menu,
    Pregame,
    Ingame,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub phase: Phase,
    pub status: Status,
    pub match_id: Option<String>,
    pub map_id: Option<String>,
    pub queue_id: Option<String>,
    pub players: Vec<Player>,
    pub error: Option<String>,
}

/// Bağlantı durumu: arayüzdeki gösterge ve açıklayıcı mesajlar için.
#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub riot_client: bool,
    pub valorant: bool,
    pub data: bool,
    /// "no_riot_client" | "not_logged_in" | "no_region" | "rejected" | "other"
    pub fault: Option<String>,
    pub detail: Option<String>,
}

impl Status {
    pub fn ok() -> Self {
        Self { riot_client: true, valorant: true, data: true, fault: None, detail: None }
    }
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub puuid: String,
    pub team: String,
    /// Oyuncu ismini gizlediyse (veya gizli mod açıksa) `None` kalır.
    pub name: Option<String>,
    pub hidden_name: bool,
    /// Oyuncu seviyesini gizlediyse `None`.
    pub level: Option<u32>,
    pub agent_id: String,
    pub card_id: Option<String>,
    pub title_id: Option<String>,
    pub rank: Rank,
    /// Parti harfi. `party_sure` doğruysa Riot'un parti kimliğinden gelir (kesin);
    /// değilse son maçlarda sık birlikte oynamaktan gelir (yalnızca geçmiş bilgisi).
    pub party: Option<String>,
    pub party_sure: bool,
    /// Bu lobideki takım arkadaşlarıyla son maçlarda aynı partide girilen maç sayıları.
    pub together: Vec<Together>,
    /// 0-100 arası smurf olasılığı (sezgisel).
    pub smurf: u8,
    pub loadout: Loadout,
    pub is_self: bool,
    /// Son 5 maç (en yeni başta). Maç ayrıntıları yüklenirken `form_loading` true olur.
    pub form: Vec<FormEntry>,
    pub form_loading: bool,
    /// Son rekabet maçlarındaki RR değişimi (en yeni başta).
    pub rr_trend: Vec<i32>,
    /// Son 24 saatte oynadığı maç sayısı (son 15 maç içinde; hepsi 24 saat içindeyse `played_24h_capped`).
    pub played_24h: u32,
    pub played_24h_capped: bool,
    /// Son maçının başlangıç zamanı (ms, unix).
    pub last_match_at: Option<u64>,
    /// Bu maçlardaki toplam öldürme / ölüm oranı.
    pub kd: Option<f32>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Together {
    pub puuid: String,
    /// Aynı parti kimliğini paylaştıkları maç sayısı / bu oyuncunun incelenen maç sayısı.
    pub count: u32,
    pub of: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct FormEntry {
    pub map_id: String,
    pub agent_id: String,
    pub queue: String,
    pub won: bool,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub rounds: u32,
    /// Kafa / gövde / bacak isabet sayıları ve verilen toplam hasar.
    pub headshots: u32,
    pub bodyshots: u32,
    pub legshots: u32,
    pub damage: u32,
    /// Round'un ilk öldürmesini yaptığı / ilk ölen taraf olduğu round sayısı.
    pub first_kills: u32,
    pub first_deaths: u32,
    /// Bu maçta silah başına öldürme sayısı ve (tabanca round'ları hariç) satın aldığı silahlar.
    pub weapon_kills: Vec<WeaponCount>,
    pub bought: Vec<WeaponCount>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeaponCount {
    pub weapon_id: String,
    pub count: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Rank {
    pub current: u32,
    pub peak: u32,
    pub rr: u32,
    /// Son oynanan rekabet act'indeki galibiyet/maç sayısı.
    pub wins: u32,
    pub games: u32,
    /// Tüm act'lerdeki toplam rekabet galibiyet/maç sayısı.
    pub total_wins: u32,
    pub total_games: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Loadout {
    pub weapons: Vec<WeaponSlot>,
    pub sprays: Vec<SpraySlot>,
    /// Sprey ve flex alt ağaçlarındaki tüm kimlikler (yapıdan bağımsız çözümleme için).
    pub spray_ids: Vec<String>,
    pub expression_ids: Vec<String>,
    /// Oyuncunun donatı kaydındaki tüm kimlikler (sprey/flex yanıtın neresinde olursa olsun bulunsun diye).
    pub all_ids: Vec<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeaponSlot {
    pub weapon_id: String,
    pub skin_id: Option<String>,
    pub level_id: Option<String>,
    pub chroma_id: Option<String>,
    pub charm_id: Option<String>,
    pub charm_level_id: Option<String>,
    /// Yuvadaki tüm soketlerin öğe kimlikleri (soket sabitlerine bağlı olmadan çözümlemek için).
    pub items: Vec<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SpraySlot {
    pub socket_id: String,
    pub spray_id: String,
    pub level_id: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoreOffer {
    pub item_id: String,
    pub price: Option<u32>,
    pub discounted: Option<u32>,
    pub discount_percent: Option<u32>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Store {
    pub daily: Vec<StoreOffer>,
    pub daily_remaining: Option<u64>,
    pub night: Vec<StoreOffer>,
    pub night_remaining: Option<u64>,
    pub wallet: Option<Wallet>,
}

/// Bir özelliğin son durumu. `state`: "ok", "warn", "fail" ya da "idle" (henüz denenmedi).
#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct HealthEntry {
    pub id: String,
    pub label: String,
    pub state: String,
    pub detail: String,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Wallet {
    pub vp: Option<u32>,
    pub rp: Option<u32>,
    pub kc: Option<u32>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ObjectiveProgress {
    pub id: String,
    pub value: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MissionState {
    pub id: String,
    pub complete: bool,
    pub objectives: Vec<ObjectiveProgress>,
    pub expires_at: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ContractState {
    pub id: String,
    pub level: u32,
    pub xp_toward_next: u32,
    pub total_xp: u64,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Owned {
    pub skins: Vec<String>,
    pub chromas: Vec<String>,
    pub charms: Vec<String>,
    pub sprays: Vec<String>,
    pub cards: Vec<String>,
    pub titles: Vec<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub wallet: Option<Wallet>,
    pub missions: Vec<MissionState>,
    pub weekly_refill: Option<String>,
    pub contracts: Vec<ContractState>,
    pub active_contract: Option<String>,
    pub owned: Owned,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MyMatch {
    pub match_id: String,
    pub map_id: String,
    pub agent_id: String,
    pub queue: String,
    pub won: bool,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub acs: u32,
    pub rr_delta: Option<i32>,
    pub tier_after: Option<u32>,
    pub started: u64,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MyStats {
    pub matches: Vec<MyMatch>,
    pub rank: Rank,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PremierMember {
    pub puuid: String,
    pub name: Option<String>,
    pub hidden: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PremierTeam {
    pub name: String,
    pub tag: String,
    pub members: Vec<PremierMember>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PairCount {
    pub puuid: String,
    pub count: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReportPlayer {
    pub puuid: String,
    /// Maç öncesi ismini gizleyen oyuncuların ismi burada da gösterilmez.
    pub name: Option<String>,
    pub hidden: bool,
    pub team: String,
    pub agent_id: String,
    pub is_self: bool,
    pub tier: u32,
    pub score: u32,
    pub rounds: u32,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub headshots: u32,
    pub bodyshots: u32,
    pub legshots: u32,
    pub damage: u32,
    pub first_kills: u32,
    pub first_deaths: u32,
    /// En çok öldürdüğü / tarafından en çok öldürüldüğü oyuncular.
    pub killed: Vec<PairCount>,
    pub killed_by: Vec<PairCount>,
    /// Maçtaki gerçek parti harfi (aynı parti kimliğini paylaşan 2+ oyuncu); solo ise boş.
    pub party: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReportTeam {
    pub team_id: String,
    pub won: bool,
    pub rounds_won: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MatchReport {
    pub match_id: String,
    pub map_id: String,
    pub queue: String,
    pub started: u64,
    pub teams: Vec<ReportTeam>,
    pub players: Vec<ReportPlayer>,
}
