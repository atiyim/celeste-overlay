use crate::model::*;
use crate::session::{fault, fault_of, friendly, Fault, Session};
use anyhow::{anyhow, bail, Result};
use futures::future::join_all;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

// Loadout soket kimlikleri (Riot istemcisinin kullandığı sabitler).
const SOCKET_SKIN: &str = "bcef87d6-209b-46c6-8b19-fbe40bd95abc";
const SOCKET_LEVEL: &str = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const SOCKET_CHROMA: &str = "3ad1b2b2-acdb-4524-852f-954a76ddae0a";
const SOCKET_CHARM: &str = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
const SOCKET_CHARM_LEVEL: &str = "77258665-71d1-4623-bc72-44db9bd5b3b3";

// Cüzdan para birimi ve envanter öğe türü kimlikleri.
const CUR_VP: &str = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";
const CUR_RP: &str = "e59aa87c-4cbf-517a-5983-6e81511be9b7";
const CUR_KC: &str = "85ca954a-41f2-ce94-9b45-8ca3dd39a00d";
const ENT_SKIN_LEVEL: &str = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const ENT_CHROMA: &str = "3ad1b2b2-acdb-4524-852f-954a76ddae0a";
const ENT_CHARM: &str = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
const ENT_SPRAY: &str = "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475";
const ENT_CARD: &str = "3f296c07-64c3-494c-923b-fe692a4fa1bd";
const ENT_TITLE: &str = "de7caa6b-adf7-4588-bbd1-143831e786c6";

const CACHE_TTL: Duration = Duration::from_secs(600);

#[derive(Clone, Default)]
struct Mmr {
    current: u32,
    peak: u32,
    rr: u32,
    wins: u32,
    games: u32,
    total_wins: u32,
    total_games: u32,
}

/// Round kayıtlarından çıkarılan dövüş verisi (tek oyuncu, tek maç).
#[derive(Default, Clone)]
struct Combat {
    hs: u32,
    body: u32,
    leg: u32,
    damage: u32,
    fk: u32,
    fd: u32,
    wkills: HashMap<String, u32>,
    bought: HashMap<String, u32>,
}

fn counts(m: &HashMap<String, u32>) -> Vec<WeaponCount> {
    let mut v: Vec<WeaponCount> = m.iter().map(|(k, c)| WeaponCount { weapon_id: k.clone(), count: *c }).collect();
    v.sort_by(|a, b| b.count.cmp(&a.count).then(a.weapon_id.cmp(&b.weapon_id)));
    v.truncate(4);
    v
}

fn parse_combat(v: &Value) -> HashMap<String, Combat> {
    let n = |x: &Value| x.as_u64().unwrap_or(0) as u32;
    let mut cb: HashMap<String, Combat> = HashMap::new();
    for r in v["roundResults"].as_array().into_iter().flatten() {
        let rn = r["roundNum"].as_u64().unwrap_or(0);
        let mut kills: Vec<&Value> = Vec::new();
        for ps in r["playerStats"].as_array().into_iter().flatten() {
            let Some(sub) = ps["subject"].as_str() else { continue };
            let c = cb.entry(sub.to_string()).or_default();
            for d in ps["damage"].as_array().into_iter().flatten() {
                c.hs += n(&d["headshots"]);
                c.body += n(&d["bodyshots"]);
                c.leg += n(&d["legshots"]);
                c.damage += n(&d["damage"]);
            }
            // Tabanca round'larında (ilk ve 13.) herkes aynı şeyi alır; alışkanlık sayımına katılmaz.
            if rn != 0 && rn != 12 {
                if let Some(w) = ps["economy"]["weapon"].as_str().filter(|w| is_uuid(w)) {
                    *c.bought.entry(w.to_lowercase()).or_default() += 1;
                }
            }
            kills.extend(ps["kills"].as_array().into_iter().flatten());
        }
        if let Some(first) = kills.iter().min_by_key(|k| k["roundTime"].as_u64().unwrap_or(u64::MAX)) {
            if let Some(a) = first["killer"].as_str() {
                cb.entry(a.to_string()).or_default().fk += 1;
            }
            if let Some(a) = first["victim"].as_str() {
                cb.entry(a.to_string()).or_default().fd += 1;
            }
        }
        for k in &kills {
            let fd = &k["finishingDamage"];
            if fd["damageType"].as_str() == Some("Weapon") {
                if let (Some(killer), Some(item)) = (k["killer"].as_str(), fd["damageItem"].as_str().filter(|w| is_uuid(w))) {
                    *cb.entry(killer.to_string()).or_default().wkills.entry(item.to_lowercase()).or_default() += 1;
                }
            }
        }
    }
    cb
}

/// Bir maçtaki tek oyuncunun özeti.
#[derive(Default, Clone)]
struct Pd {
    puuid: String,
    party_id: String,
    team: String,
    agent: String,
    kills: u32,
    deaths: u32,
    assists: u32,
    score: u32,
    rounds: u32,
    combat: Combat,
}

/// Bir maçın özeti: harita, oyuncular ve takımların galibiyeti.
#[derive(Default, Clone)]
struct Detail {
    map_id: String,
    started: u64,
    players: Vec<Pd>,
    won: HashMap<String, bool>,
}

impl Detail {
    fn entry_for(&self, puuid: &str, queue: &str) -> Option<FormEntry> {
        let p = self.players.iter().find(|p| p.puuid == puuid)?;
        Some(FormEntry {
            map_id: self.map_id.clone(),
            agent_id: p.agent.clone(),
            queue: queue.to_string(),
            won: self.won.get(&p.team).copied().unwrap_or(false),
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            rounds: p.rounds,
            headshots: p.combat.hs,
            bodyshots: p.combat.body,
            legshots: p.combat.leg,
            damage: p.combat.damage,
            first_kills: p.combat.fk,
            first_deaths: p.combat.fd,
            weapon_kills: counts(&p.combat.wkills),
            bought: counts(&p.combat.bought),
        })
    }
}

fn parse_detail(v: &Value) -> Detail {
    let n = |x: &Value| x.as_u64().unwrap_or(0) as u32;
    let mut combat = parse_combat(v);
    Detail {
        map_id: v["matchInfo"]["mapId"].as_str().unwrap_or("").to_string(),
        started: v["matchInfo"]["gameStartMillis"].as_u64().unwrap_or(0),
        players: v["players"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|p| {
                Some(Pd {
                    puuid: p["subject"].as_str()?.to_string(),
                    party_id: p["partyId"].as_str().unwrap_or("").to_lowercase(),
                    team: p["teamId"].as_str().unwrap_or("").to_string(),
                    agent: p["characterId"].as_str().unwrap_or("").to_string(),
                    kills: n(&p["stats"]["kills"]),
                    deaths: n(&p["stats"]["deaths"]),
                    assists: n(&p["stats"]["assists"]),
                    score: n(&p["stats"]["score"]),
                    rounds: n(&p["stats"]["roundsPlayed"]),
                    combat: combat.remove(p["subject"].as_str()?).unwrap_or_default(),
                })
            })
            .collect(),
        won: v["teams"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|t| Some((t["teamId"].as_str()?.to_string(), t["won"].as_bool().unwrap_or(false))))
            .collect(),
    }
}

// Son maç özeti, HS% ve rozetler yalnızca rekabet maçlarından hesaplanır (diğer modlar karıştırıp yanıltır).
const FORM_QUEUES: [&str; 1] = ["competitive"];
// Kendi istatistik sayfan tüm ana modları kapsar.
const STATS_QUEUES: [&str; 4] = ["competitive", "unrated", "swiftplay", "premier"];
const FORM_N: usize = 5;
const DETAIL_BUDGET: usize = 10; // her turda en fazla bu kadar maç ayrıntısı çekilir

fn form_ids(h: &[(String, String)]) -> Vec<(String, String)> {
    h.iter().filter(|(_, q)| FORM_QUEUES.contains(&q.as_str())).take(FORM_N).cloned().collect()
}

fn to_rank(m: &Mmr) -> Rank {
    Rank {
        current: m.current,
        peak: m.peak.max(m.current),
        rr: m.rr,
        wins: m.wins,
        games: m.games,
        total_wins: m.total_wins,
        total_games: m.total_games,
    }
}

#[derive(Default)]
struct State {
    debug_match: Option<String>,
    debug_party: Option<String>,
    debug_pre: Option<String>,
    health: HashMap<&'static str, (&'static str, String)>,
    session: Option<Session>,
    mmr: HashMap<String, (Instant, Mmr)>,
    history: HashMap<String, (Instant, Vec<(String, String)>)>, // (maç kimliği, kuyruk)
    trend: HashMap<String, (Instant, Vec<i32>)>,
    activity: HashMap<String, (u32, bool, Option<u64>)>,
    hidden_now: HashSet<String>,
    lobbies: HashMap<String, HashSet<String>>, // maç kimliği -> ismini gizleyenler
    premier: HashMap<String, (Instant, Option<PremierTeam>)>,
    details: HashMap<String, Detail>,
    block_until: Option<Instant>,
    names: HashMap<String, String>,
}

pub struct Engine {
    http: reqwest::Client,
    state: Mutex<State>,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    pub fn new() -> Self {
        Self { http: reqwest::Client::new(), state: Mutex::new(State::default()) }
    }

    /// Arayüzün periyodik olarak çağırdığı tek giriş noktası.
    pub async fn snapshot(&self) -> Snapshot {
        let mut st = self.state.lock().await;
        match self.run(&mut st).await {
            Ok(s) => s,
            Err(e) => {
                st.session = None; // süresi dolmuş token / kapanmış istemci: bir sonraki turda yeniden aç
                let f = fault_of(&e);
                Snapshot {
                    phase: Phase::Offline,
                    status: Status {
                        riot_client: f != Fault::NoRiotClient,
                        // Bu iki durum, Valorant'ın çalıştığı doğrulandıktan sonra ortaya çıkar.
                        valorant: matches!(f, Fault::Rejected | Fault::Other),
                        data: false,
                        fault: Some(f.code().to_string()),
                        detail: Some(e.to_string()),
                    },
                    error: Some(friendly(&e)),
                    ..Default::default()
                }
            }
        }
    }

    async fn session(&self, st: &mut State) -> Result<Session> {
        if st.session.is_none() {
            st.session = Some(Session::open().await?);
        }
        st.session.clone().ok_or_else(|| anyhow!("oturum yok"))
    }

    async fn run(&self, st: &mut State) -> Result<Snapshot> {
        let s = self.session(st).await?;

        // Valorant kapalıysa oyun sunucularına hiç sorma; net bir durum döndür.
        if s.valorant_running().await == Some(false) {
            return Ok(Snapshot {
                phase: Phase::Offline,
                status: Status { riot_client: true, valorant: false, data: false, fault: None, detail: None },
                ..Default::default()
            });
        }

        let core = self.get(&s, &s.glz, &format!("/core-game/v1/players/{}", s.puuid)).await?;
        if let Some(mid) = core.as_ref().and_then(|v| v["MatchID"].as_str()) {
            return self.ingame(st, &s, mid).await;
        }
        let pre = self.get(&s, &s.glz, &format!("/pregame/v1/players/{}", s.puuid)).await?;
        if let Some(mid) = pre.as_ref().and_then(|v| v["MatchID"].as_str()) {
            return self.pregame(st, &s, mid).await;
        }
        Ok(Snapshot { phase: Phase::Menu, status: Status::ok(), ..Default::default() })
    }

    /// 200 → Some, 404 → None (o aşamada değiliz), diğerleri hata (token yenilenir).
    async fn get(&self, s: &Session, base: &str, path: &str) -> Result<Option<Value>> {
        let r = self.http.get(format!("{base}{path}")).headers(s.headers()).send().await?;
        let code = r.status().as_u16();
        match code {
            200 => Ok(Some(r.json().await?)),
            404 => Ok(None),
            400 | 401 | 403 => Err(fault(Fault::Rejected, format!("HTTP {code} ({path})"))),
            c => bail!("HTTP {c} ({path})"),
        }
    }

    async fn ingame(&self, st: &mut State, s: &Session, mid: &str) -> Result<Snapshot> {
        let m = self
            .get(s, &s.glz, &format!("/core-game/v1/matches/{mid}"))
            .await?
            .ok_or_else(|| anyhow!("maç bilgisi alınamadı"))?;
        // Donatı alınamazsa liste yine de görünsün (hata tüm tabloyu düşürmesin).
        let loadouts = self.get(s, &s.glz, &format!("/core-game/v1/matches/{mid}/loadouts")).await.unwrap_or(None);

        if st.debug_match.as_deref() != Some(mid) {
            st.debug_match = Some(mid.to_string());
            match loadouts.as_ref() {
                Some(l) => {
                    write_text("loadouts-shape.txt", &shape(l, 7)); // yalnızca yapı, değer yok
                    if let Some(e) = loadout_entries(l).iter().find(|e| entry_subject(e) == Some(s.puuid.as_str())) {
                        write_debug("last-loadout.json", e); // yalnızca kendi donatın
                    }
                }
                None => write_text("loadouts-shape.txt", "loadouts yanıtı alınamadı"),
            }
        }

        let mut players = Vec::new();
        let mut season = String::new();
        for v in m["Players"].as_array().into_iter().flatten() {
            let mut p = basic_player(v, v["TeamID"].as_str().unwrap_or(""), &s.puuid);
            if season.is_empty() {
                season = v["SeasonID"].as_str().unwrap_or("").to_string();
            }
            if let Some(l) = loadouts.as_ref() {
                if let Some(e) = loadout_entries(l).iter().find(|e| entry_subject(e) == Some(p.puuid.as_str())) {
                    p.loadout = parse_loadout(loadout_node(e));
                    collect_uuids(e, &mut p.loadout.all_ids);
                }
            }
            players.push(p);
        }
        self.enrich(st, s, &mut players, &season).await;
        let hidden = st.hidden_now.clone();
        st.lobbies.insert(mid.to_string(), hidden);
        Ok(Snapshot {
            phase: Phase::Ingame,
            match_id: Some(mid.to_string()),
            map_id: m["MapID"].as_str().map(String::from),
            queue_id: m["MatchmakingData"]["QueueID"].as_str().map(String::from),
            players,
            status: Status::ok(),
            error: None,
        })
    }

    async fn pregame(&self, st: &mut State, s: &Session, mid: &str) -> Result<Snapshot> {
        let m = self
            .get(s, &s.glz, &format!("/pregame/v1/matches/{mid}"))
            .await?
            .ok_or_else(|| anyhow!("ajan seçimi bilgisi alınamadı"))?;
        let team = m["AllyTeam"]["TeamID"].as_str().unwrap_or("").to_string();
        let mut players: Vec<Player> = m["AllyTeam"]["Players"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|v| basic_player(v, &team, &s.puuid))
            .collect();
        // Ajan seçiminde kaplamalar: bu uç her sürümde olmayabilir; yoksa kaplamalar oyun başlayınca gelir.
        let loadouts = self.get(s, &s.glz, &format!("/pregame/v1/matches/{mid}/loadouts")).await.unwrap_or(None);
        if st.debug_pre.as_deref() != Some(mid) {
            st.debug_pre = Some(mid.to_string());
            let text = match loadouts.as_ref() {
                Some(l) => shape(l, 7), // yalnızca yapı, değer yok
                None => "pregame loadouts yanıtı alınamadı".to_string(),
            };
            write_text("pregame-loadouts-shape.txt", &text);
            let h = if loadouts.is_some() { ("ok", "Kaplamalar ajan seçiminde alındı".to_string()) } else { ("fail", "Ajan seçiminde kaplama verisi gelmedi".to_string()) };
            st.health.insert("pregame", h);
        }
        if let Some(l) = loadouts.as_ref() {
            for p in players.iter_mut() {
                if let Some(e) = loadout_entries(l).iter().find(|e| entry_subject(e) == Some(p.puuid.as_str())) {
                    p.loadout = parse_loadout(loadout_node(e));
                    collect_uuids(e, &mut p.loadout.all_ids);
                }
            }
        }
        self.enrich(st, s, &mut players, "").await;
        Ok(Snapshot {
            phase: Phase::Pregame,
            match_id: Some(mid.to_string()),
            map_id: m["MapID"].as_str().map(String::from),
            queue_id: m["QueueID"].as_str().map(String::from),
            players,
            status: Status::ok(),
            error: None,
        })
    }

    /// İsim, rank ve parti bilgisini ekler. Hata verirse oyuncu satırı eksik kalır, tablo bozulmaz.
    async fn enrich(&self, st: &mut State, s: &Session, players: &mut [Player], season: &str) {
        // İsimler: gizli isimli oyuncular için isim sorgusu YAPILMAZ.
        let need: Vec<String> = players
            .iter()
            .filter(|p| (!p.hidden_name || p.is_self) && !st.names.contains_key(&p.puuid))
            .map(|p| p.puuid.clone())
            .collect();
        if !need.is_empty() {
            if let Ok(r) = self.http.put(format!("{}/name-service/v2/players", s.pd)).headers(s.headers()).json(&need).send().await {
                if let Ok(arr) = r.json::<Vec<Value>>().await {
                    for e in arr {
                        if let (Some(id), Some(n), Some(t)) = (e["Subject"].as_str(), e["GameName"].as_str(), e["TagLine"].as_str()) {
                            st.names.insert(id.to_string(), format!("{n}#{t}"));
                        }
                    }
                }
            }
        }

        // Rank ve maç geçmişi (önbellekli, paralel).
        let now = Instant::now();
        let stale_mmr: Vec<String> = players
            .iter()
            .filter(|p| st.mmr.get(&p.puuid).map_or(true, |(t, _)| now.duration_since(*t) > CACHE_TTL))
            .map(|p| p.puuid.clone())
            .collect();
        for (id, m) in join_all(stale_mmr.iter().map(|id| async move { (id.clone(), self.fetch_mmr(s, id, season).await) })).await {
            if let Some(m) = m {
                st.mmr.insert(id, (Instant::now(), m));
            }
        }
        let stale_hist: Vec<String> = players
            .iter()
            .filter(|p| st.history.get(&p.puuid).map_or(true, |(t, _)| now.duration_since(*t) > CACHE_TTL))
            .map(|p| p.puuid.clone())
            .collect();
        for (id, h) in join_all(stale_hist.iter().map(|id| async move { (id.clone(), self.fetch_history(s, id, 25).await) })).await {
            if let Some((h, act)) = h {
                st.history.insert(id.clone(), (Instant::now(), h));
                st.activity.insert(id, act);
            }
        }

        // RR eğilimi (son rekabet maçlarının RR değişimi).
        let stale_trend: Vec<String> = players
            .iter()
            .filter(|p| st.trend.get(&p.puuid).map_or(true, |(t, _)| now.duration_since(*t) > CACHE_TTL))
            .map(|p| p.puuid.clone())
            .collect();
        for (id, t) in join_all(stale_trend.iter().map(|id| async move { (id.clone(), self.fetch_trend(s, id).await) })).await {
            if let Some(t) = t {
                st.trend.insert(id, (Instant::now(), t));
            }
        }

        // Son maç ayrıntıları: her turda sınırlı sayıda çekilir, hız sınırına (429) takılırsak bir süre durulur.
        if st.details.len() > 600 {
            st.details.clear();
        }
        if st.block_until.map_or(true, |t| Instant::now() >= t) {
            let mut want: Vec<String> = Vec::new();
            for p in players.iter() {
                if let Some((_, h)) = st.history.get(&p.puuid) {
                    for (id, _) in form_ids(h) {
                        if !st.details.contains_key(&id) && !want.contains(&id) {
                            want.push(id);
                        }
                    }
                }
            }
            want.truncate(DETAIL_BUDGET);
            for (id, r) in join_all(want.iter().map(|id| async move { (id.clone(), self.fetch_detail(s, id).await) })).await {
                match r {
                    Ok(d) => {
                        st.details.insert(id, d);
                    }
                    Err(e) => {
                        if e.to_string().contains("429") {
                            st.block_until = Some(Instant::now() + Duration::from_secs(15));
                        }
                    }
                }
            }
        }

        for p in players.iter_mut() {
            p.name = st.names.get(&p.puuid).cloned();
            if let Some((_, m)) = st.mmr.get(&p.puuid) {
                p.rank = to_rank(m);
            }
            p.smurf = smurf_score(p.level, &p.rank);
            if let Some((c, cap, last)) = st.activity.get(&p.puuid) {
                p.played_24h = *c;
                p.played_24h_capped = *cap;
                p.last_match_at = *last;
            }
            p.rr_trend = st.trend.get(&p.puuid).map(|(_, t)| t.clone()).unwrap_or_default();
            match st.history.get(&p.puuid) {
                Some((_, h)) => {
                    for (id, q) in form_ids(h) {
                        match st.details.get(&id) {
                            Some(d) => {
                                if let Some(e) = d.entry_for(&p.puuid, &q) {
                                    p.form.push(e);
                                }
                            }
                            None => p.form_loading = true,
                        }
                    }
                    let (k, d): (u32, u32) = p.form.iter().fold((0, 0), |a, e| (a.0 + e.kills, a.1 + e.deaths));
                    p.kd = if p.form.is_empty() { None } else { Some(k as f32 / d.max(1) as f32) };
                }
                None => p.form_loading = true,
            }
        }
        self.assign_parties(st, s, players).await;
        st.hidden_now = players.iter().filter(|p| p.hidden_name && !p.is_self).map(|p| p.puuid.clone()).collect();
    }

    async fn fetch_mmr(&self, s: &Session, puuid: &str, season: &str) -> Option<Mmr> {
        let v = self.get(s, &s.pd, &format!("/mmr/v1/players/{puuid}")).await.ok()??;
        let lcu = &v["LatestCompetitiveUpdate"];
        let cur_season = lcu["SeasonID"].as_str().filter(|x| !x.is_empty()).unwrap_or(season).to_string();
        let mut out = Mmr {
            current: lcu["TierAfterUpdate"].as_u64().unwrap_or(0) as u32,
            rr: lcu["RankedRatingAfterUpdate"].as_u64().unwrap_or(0) as u32,
            ..Default::default()
        };
        if let Some(seasons) = v["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"].as_object() {
            for (id, info) in seasons {
                let wins_peak = info["WinsByTier"]
                    .as_object()
                    .map(|m| m.keys().filter_map(|k| k.parse::<u32>().ok()).max().unwrap_or(0))
                    .unwrap_or(0);
                let tier = info["CompetitiveTier"].as_u64().unwrap_or(0) as u32;
                out.peak = out.peak.max(wins_peak).max(tier);
                let w = info["NumberOfWins"].as_u64().unwrap_or(0) as u32;
                let g = info["NumberOfGames"].as_u64().unwrap_or(0) as u32;
                out.total_wins += w;
                out.total_games += g;
                if id.as_str() == cur_season {
                    out.wins = w;
                    out.games = g;
                }
            }
        }
        Some(out)
    }

    async fn fetch_trend(&self, s: &Session, puuid: &str) -> Option<Vec<i32>> {
        let v = self
            .get(s, &s.pd, &format!("/mmr/v1/players/{puuid}/competitiveupdates?startIndex=0&endIndex=5&queue=competitive"))
            .await
            .ok()??;
        Some(v["Matches"].as_array()?.iter().filter_map(|m| m["RankedRatingEarned"].as_i64().map(|x| x as i32)).collect())
    }

    async fn fetch_history(&self, s: &Session, puuid: &str, n: usize) -> Option<(Vec<(String, String)>, (u32, bool, Option<u64>))> {
        let v = self.get(s, &s.pd, &format!("/match-history/v1/history/{puuid}?startIndex=0&endIndex={n}")).await.ok()??;
        let arr = v["History"].as_array()?;
        let list: Vec<(String, String)> = arr
            .iter()
            .filter_map(|h| Some((h["MatchID"].as_str()?.to_string(), h["QueueID"].as_str().unwrap_or("").to_lowercase())))
            .collect();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
        let starts: Vec<u64> = arr.iter().filter_map(|h| h["GameStartTime"].as_u64()).collect();
        let day = 24 * 3600 * 1000;
        let count = starts.iter().filter(|t| now.saturating_sub(**t) <= day).count() as u32;
        let capped = !starts.is_empty() && count as usize == starts.len() && starts.len() >= n.min(arr.len()) && arr.len() >= n;
        Some((list, (count, capped, starts.iter().max().copied())))
    }

    async fn fetch_detail(&self, s: &Session, id: &str) -> Result<Detail> {
        Ok(match self.get(s, &s.pd, &format!("/match-details/v1/matches/{id}")).await? {
            Some(v) => parse_detail(&v),
            None => Detail::default(), // maç bulunamadı: tekrar sorma
        })
    }

    /// Kendi mağazan ve gece mağazan. Valorant'ın açık olması gerekmez; Riot Client açık ve giriş yapılmış olmalı.
    /// Verilen oyuncuların isimlerini önbelleğe alır. Çağıran, ismini gizleyenleri listeye KOYMAMALIDIR.
    async fn load_names(&self, st: &mut State, s: &Session, ids: &[String]) {
        let need: Vec<&String> = ids.iter().filter(|i| !st.names.contains_key(*i)).collect();
        if need.is_empty() {
            return;
        }
        if let Ok(r) = self.http.put(format!("{}/name-service/v2/players", s.pd)).headers(s.headers()).json(&need).send().await {
            if let Ok(arr) = r.json::<Vec<Value>>().await {
                for e in arr {
                    if let (Some(id), Some(n), Some(t)) = (e["Subject"].as_str(), e["GameName"].as_str(), e["TagLine"].as_str()) {
                        st.names.insert(id.to_string(), format!("{n}#{t}"));
                    }
                }
            }
        }
    }

    /// Bitmiş bir maçın tam raporu (10 oyuncunun hepsi). Maç kaydı hazır değilse hata döner; arayüz tekrar dener.
    pub async fn match_report(&self, match_id: &str) -> Result<MatchReport, String> {
        let r = self.match_report_inner(match_id).await;
        let mut st = self.state.lock().await;
        match &r {
            Ok(_) => st.health.insert("report", ("ok", "Maç raporu alındı".to_string())),
            Err(e) => st.health.insert("report", ("fail", scrub(e))),
        };
        r
    }

    async fn match_report_inner(&self, match_id: &str) -> Result<MatchReport, String> {
        let mut st = self.state.lock().await;
        let s = self.session(&mut st).await.map_err(|e| friendly(&e))?;
        let v = match self.get(&s, &s.pd, &format!("/match-details/v1/matches/{match_id}")).await {
            Ok(Some(v)) => v,
            Ok(None) => return Err("Maç kaydı henüz hazır değil.".into()),
            Err(e) => return Err(friendly(&e)),
        };
        let d = parse_detail(&v);
        if d.players.is_empty() {
            return Err("Maç kaydı henüz hazır değil.".into());
        }
        let pairs = parse_pairs(&v);
        // İsmini gizleyenlerin ismi gösterilmez. Lobi bilgisi yoksa yalnızca kendi ismin gösterilir.
        let known = st.lobbies.get(match_id).cloned();
        let hides = |p: &str| p != s.puuid && known.as_ref().map_or(true, |h| h.contains(p));
        let ids: Vec<String> = d.players.iter().filter(|p| !hides(&p.puuid)).map(|p| p.puuid.clone()).collect();
        self.load_names(&mut st, &s, &ids).await;
        let tiers: HashMap<String, u32> = v["players"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|p| Some((p["subject"].as_str()?.to_string(), p["competitiveTier"].as_u64().unwrap_or(0) as u32)))
            .collect();
        // pairs: killer -> victim; killed_by: victim -> killer
        let mut by: HashMap<String, HashMap<String, u32>> = HashMap::new();
        for (a, vs) in &pairs {
            for (b, c) in vs {
                *by.entry(b.clone()).or_default().entry(a.clone()).or_default() += c;
            }
        }
        let letters = party_letters(&d.players);
        let players = d
            .players
            .iter()
            .map(|p| ReportPlayer {
                party: letters.get(&p.puuid).cloned(),
                puuid: p.puuid.clone(),
                name: if hides(&p.puuid) { None } else { st.names.get(&p.puuid).cloned() },
                hidden: hides(&p.puuid),
                team: p.team.clone(),
                agent_id: p.agent.clone(),
                is_self: p.puuid == s.puuid,
                tier: tiers.get(&p.puuid).copied().unwrap_or(0),
                score: p.score,
                rounds: p.rounds,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                headshots: p.combat.hs,
                bodyshots: p.combat.body,
                legshots: p.combat.leg,
                damage: p.combat.damage,
                first_kills: p.combat.fk,
                first_deaths: p.combat.fd,
                killed: top_pairs(pairs.get(&p.puuid)),
                killed_by: top_pairs(by.get(&p.puuid)),
            })
            .collect();
        let teams = v["teams"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|t| ReportTeam {
                team_id: t["teamId"].as_str().unwrap_or("").to_string(),
                won: t["won"].as_bool().unwrap_or(false),
                rounds_won: t["roundsWon"].as_u64().unwrap_or(0) as u32,
            })
            .collect();
        Ok(MatchReport {
            match_id: match_id.to_string(),
            map_id: d.map_id.clone(),
            queue: v["matchInfo"]["queueID"].as_str().unwrap_or("").to_string(),
            started: d.started,
            teams,
            players,
        })
    }

    /// Oyuncunun Premier takımı (varsa). İsmini gizleyen oyuncular için sorgu YAPILMAZ.
    pub async fn premier(&self, puuid: &str) -> Result<Option<PremierTeam>, String> {
        let r = self.premier_inner(puuid).await;
        let mut st = self.state.lock().await;
        match &r {
            Ok(_) => st.health.insert("premier", ("ok", "Premier bilgisi alındı".to_string())),
            Err(e) => st.health.insert("premier", ("fail", scrub(e))),
        };
        r
    }

    async fn premier_inner(&self, puuid: &str) -> Result<Option<PremierTeam>, String> {
        let mut st = self.state.lock().await;
        if st.hidden_now.contains(puuid) {
            return Ok(None);
        }
        if let Some((t, v)) = st.premier.get(puuid) {
            if t.elapsed() < Duration::from_secs(1800) {
                return Ok(v.clone());
            }
        }
        let s = self.session(&mut st).await.map_err(|e| friendly(&e))?;
        let pl = match self.get(&s, &s.pd, &format!("/premier/v1/players/{puuid}")).await {
            Ok(Some(v)) => v,
            Ok(None) => {
                st.premier.insert(puuid.to_string(), (Instant::now(), None));
                return Ok(None);
            }
            Err(e) => return Err(friendly(&e)),
        };
        write_text("premier-player-shape.txt", &shape(&pl, 4)); // yalnızca yapı, değer yok
        let rid = ["rosterId", "rosterID", "RosterID", "roster_id"]
            .iter()
            .find_map(|k| pl[*k].as_str())
            .or_else(|| pl["roster"]["id"].as_str())
            .map(String::from);
        let Some(rid) = rid.filter(|r| !r.is_empty()) else {
            st.premier.insert(puuid.to_string(), (Instant::now(), None));
            return Ok(None);
        };
        let ro = match self.get(&s, &s.pd, &format!("/premier/v1/rosters/{rid}")).await {
            Ok(Some(v)) => v,
            Ok(None) => return Ok(None),
            Err(e) => return Err(friendly(&e)),
        };
        write_text("premier-roster-shape.txt", &shape(&ro, 4));
        let ids: Vec<String> = ro["members"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|m| ["puuid", "subject", "id"].iter().find_map(|k| m[*k].as_str()).map(String::from))
            .collect();
        let show: Vec<String> = ids.iter().filter(|i| !st.hidden_now.contains(*i)).cloned().collect();
        self.load_names(&mut st, &s, &show).await;
        let team = PremierTeam {
            name: ro["name"].as_str().unwrap_or("").to_string(),
            tag: ro["tag"].as_str().unwrap_or("").to_string(),
            members: ids
                .iter()
                .map(|i| {
                    let hidden = st.hidden_now.contains(i);
                    PremierMember { puuid: i.clone(), name: if hidden { None } else { st.names.get(i).cloned() }, hidden }
                })
                .collect(),
        };
        let out = if team.name.is_empty() && team.members.is_empty() { None } else { Some(team) };
        st.premier.insert(puuid.to_string(), (Instant::now(), out.clone()));
        Ok(out)
    }

    pub async fn store(&self) -> Result<Store, String> {
        let r = self.store_inner().await;
        if let Err(e) = &r {
            self.state.lock().await.health.insert("store", ("fail", scrub(e)));
        }
        r
    }

    async fn store_inner(&self) -> Result<Store, String> {
        let mut st = self.state.lock().await;
        let s = self.session(&mut st).await.map_err(|e| {
            st.session = None;
            friendly(&e)
        })?;
        let r = self
            .http
            .post(format!("{}/store/v3/storefront/{}", s.pd, s.puuid))
            .headers(s.headers())
            .json(&serde_json::json!({}))
            .send()
            .await;
        let v: Value = match r {
            Ok(r) if r.status().is_success() => r.json().await.map_err(|e| format!("Mağaza yanıtı okunamadı: {e}"))?,
            Ok(r) => {
                let c = r.status().as_u16();
                if matches!(c, 400 | 401 | 403) {
                    st.session = None;
                }
                // Eski uç nokta (fiyatsız) ile bir kez daha dene.
                match self.get(&s, &s.pd, &format!("/store/v2/storefront/{}", s.puuid)).await {
                    Ok(Some(v)) => v,
                    Ok(None) => return Err(format!("Mağaza bilgisi bulunamadı (HTTP {c}).")),
                    Err(e) => return Err(format!("Mağaza alınamadı (HTTP {c}). {}", friendly(&e))),
                }
            }
            Err(e) => return Err(format!("Mağaza alınamadı: {e}")),
        };
        let mut store = parse_store(&v);
        store.wallet = self.wallet(&s).await;
        st.health.insert("store", ("ok", format!("{} günlük teklif", store.daily.len())));
        Ok(store)
    }

    /// Cüzdan: VP, Radianite (RP) ve Kingdom Credits. Alınamazsa mağaza yine de görünür.
    async fn wallet(&self, s: &Session) -> Option<Wallet> {
        let v = self.get(s, &s.pd, &format!("/store/v1/wallet/{}", s.puuid)).await.ok()??;
        let b = &v["Balances"];
        let n = |id: &str| b[id].as_u64().map(|x| x as u32);
        Some(Wallet { vp: n(CUR_VP), rp: n(CUR_RP), kc: n(CUR_KC) })
    }

    /// Hesap özeti: cüzdan, görevler, battle pass ilerlemesi ve sahip olunan öğeler.
    pub async fn account(&self) -> Result<Account, String> {
        let r = self.account_inner().await;
        let mut st = self.state.lock().await;
        match &r {
            Err(e) => {
                st.health.insert("account", ("fail", scrub(e)));
            }
            Ok(a) => {
                let (w, c, o) = (a.wallet.is_some(), !a.contracts.is_empty(), !a.owned.skins.is_empty());
                let missing: Vec<&str> = [(!w, "cüzdan"), (!c, "görevler"), (!o, "envanter")].iter().filter(|x| x.0).map(|x| x.1).collect();
                if missing.is_empty() {
                    st.health.insert("account", ("ok", "Cüzdan, görevler ve envanter alındı".to_string()));
                } else {
                    st.health.insert("account", ("warn", format!("Alınamayan: {}", missing.join(", "))));
                }
            }
        }
        r
    }

    async fn account_inner(&self) -> Result<Account, String> {
        let mut st = self.state.lock().await;
        let s = self.session(&mut st).await.map_err(|e| {
            st.session = None;
            friendly(&e)
        })?;
        let sr = &s;
        let types = [ENT_SKIN_LEVEL, ENT_CHROMA, ENT_CHARM, ENT_SPRAY, ENT_CARD, ENT_TITLE];
        let ents = join_all(types.iter().map(|t| async move {
            let v = self.get(sr, &sr.pd, &format!("/store/v1/entitlements/{}/{t}", sr.puuid)).await.ok().flatten();
            v.map(|v| {
                v["Entitlements"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|e| e["ItemID"].as_str().map(|x| x.to_lowercase()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
        }))
        .await;
        let mut it = ents.into_iter();
        let owned = Owned {
            skins: it.next().unwrap_or_default(),
            chromas: it.next().unwrap_or_default(),
            charms: it.next().unwrap_or_default(),
            sprays: it.next().unwrap_or_default(),
            cards: it.next().unwrap_or_default(),
            titles: it.next().unwrap_or_default(),
        };
        let wallet = self.wallet(&s).await;
        let contracts = self.get(&s, &s.pd, &format!("/contracts/v1/contracts/{}", s.puuid)).await.ok().flatten();
        let mut acc = Account { wallet, owned, ..Default::default() };
        if let Some(c) = contracts {
            for m in c["Missions"].as_array().into_iter().flatten() {
                let Some(id) = m["ID"].as_str() else { continue };
                acc.missions.push(MissionState {
                    id: id.to_lowercase(),
                    complete: m["Complete"].as_bool().unwrap_or(false),
                    objectives: m["Objectives"]
                        .as_object()
                        .into_iter()
                        .flatten()
                        .map(|(k, v)| ObjectiveProgress { id: k.to_lowercase(), value: v.as_u64().unwrap_or(0) as u32 })
                        .collect(),
                    expires_at: m["ExpirationTime"].as_str().map(|x| x.to_string()),
                });
            }
            acc.weekly_refill = c["MissionMetadata"]["WeeklyRefillTime"].as_str().map(|x| x.to_string());
            acc.active_contract = c["ActiveSpecialContract"].as_str().map(|x| x.to_lowercase());
            for k in c["Contracts"].as_array().into_iter().flatten() {
                let Some(id) = k["ContractDefinitionID"].as_str() else { continue };
                acc.contracts.push(ContractState {
                    id: id.to_lowercase(),
                    level: k["ProgressionLevelReached"].as_u64().unwrap_or(0) as u32,
                    xp_toward_next: k["ProgressionTowardsNextLevel"].as_u64().unwrap_or(0) as u32,
                    total_xp: k["ContractProgression"]["TotalProgressionEarned"].as_u64().unwrap_or(0),
                });
            }
        }
        Ok(acc)
    }

    /// Kendi son maçların: harita, ajan, K/D/A, ACS ve (rekabette) RR değişimi.
    pub async fn my_stats(&self) -> Result<MyStats, String> {
        let mut st = self.state.lock().await;
        let s = self.session(&mut st).await.map_err(|e| {
            st.session = None;
            friendly(&e)
        })?;
        let hist = match self.fetch_history(&s, &s.puuid, 25).await {
            Some((h, _)) => h,
            None => self.fetch_history(&s, &s.puuid, 15).await.ok_or_else(|| "Maç geçmişi alınamadı.".to_string())?.0,
        };
        let ids: Vec<(String, String)> =
            hist.into_iter().filter(|(_, q)| STATS_QUEUES.contains(&q.as_str())).take(20).collect();

        // Eksik maç ayrıntılarını 5'erli gruplarla çek; hız sınırına takılırsak elimizdekiyle devam et.
        let want: Vec<String> = ids.iter().filter(|(id, _)| !st.details.contains_key(id)).map(|(id, _)| id.clone()).collect();
        let sr = &s;
        'outer: for chunk in want.chunks(5) {
            for (id, r) in join_all(chunk.iter().map(|id| async move { (id.clone(), self.fetch_detail(sr, id).await) })).await {
                match r {
                    Ok(d) => {
                        st.details.insert(id, d);
                    }
                    Err(e) => {
                        if e.to_string().contains("429") {
                            break 'outer;
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }

        // Rekabet RR değişimi
        let mut rr: HashMap<String, (i32, u32)> = HashMap::new();
        if let Ok(Some(v)) = self
            .get(&s, &s.pd, &format!("/mmr/v1/players/{}/competitiveupdates?startIndex=0&endIndex=25&queue=competitive", s.puuid))
            .await
        {
            for m in v["Matches"].as_array().into_iter().flatten() {
                if let Some(id) = m["MatchID"].as_str() {
                    rr.insert(
                        id.to_string(),
                        (m["RankedRatingEarned"].as_i64().unwrap_or(0) as i32, m["TierAfterUpdate"].as_u64().unwrap_or(0) as u32),
                    );
                }
            }
        }

        let rank = self.fetch_mmr(&s, &s.puuid, "").await.map(|m| to_rank(&m)).unwrap_or_default();
        let mut matches = Vec::new();
        for (id, q) in &ids {
            let Some(d) = st.details.get(id) else { continue };
            let Some(p) = d.players.iter().find(|p| p.puuid == s.puuid) else { continue };
            matches.push(MyMatch {
                match_id: id.clone(),
                map_id: d.map_id.clone(),
                agent_id: p.agent.clone(),
                queue: q.clone(),
                won: d.won.get(&p.team).copied().unwrap_or(false),
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                acs: if p.rounds > 0 { p.score / p.rounds } else { 0 },
                rr_delta: rr.get(id).map(|x| x.0),
                tier_after: rr.get(id).map(|x| x.1),
                started: d.started,
            });
        }
        Ok(MyStats { matches, rank })
    }
}

const VP: &str = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";

/// Fiyat haritasından (para birimi → miktar) VP miktarını alır.
fn parse_pairs(v: &Value) -> HashMap<String, HashMap<String, u32>> {
    let mut m: HashMap<String, HashMap<String, u32>> = HashMap::new();
    for r in v["roundResults"].as_array().into_iter().flatten() {
        for ps in r["playerStats"].as_array().into_iter().flatten() {
            for k in ps["kills"].as_array().into_iter().flatten() {
                if let (Some(a), Some(b)) = (k["killer"].as_str(), k["victim"].as_str()) {
                    *m.entry(a.to_string()).or_default().entry(b.to_string()).or_default() += 1;
                }
            }
        }
    }
    m
}

fn top_pairs(m: Option<&HashMap<String, u32>>) -> Vec<PairCount> {
    let mut v: Vec<PairCount> = m.into_iter().flatten().map(|(k, c)| PairCount { puuid: k.clone(), count: *c }).collect();
    v.sort_by(|a, b| b.count.cmp(&a.count).then(a.puuid.cmp(&b.puuid)));
    v.truncate(3);
    v
}

fn vp(cost: &Value) -> Option<u32> {
    cost[VP]
        .as_u64()
        .or_else(|| cost.as_object().and_then(|m| m.values().find_map(|x| x.as_u64())))
        .map(|x| x as u32)
}

fn first_item(rewards: &Value) -> Option<String> {
    rewards.as_array()?.first()?["ItemID"].as_str().map(|x| x.to_lowercase())
}

/// Mağaza yanıtını (v3, eksikse v2 biçimi) sadeleştirir.
fn parse_store(v: &Value) -> Store {
    let layout = &v["SkinsPanelLayout"];
    let mut daily = Vec::new();
    if let Some(arr) = layout["SingleItemStoreOffers"].as_array() {
        for o in arr {
            if let Some(id) = first_item(&o["Rewards"]).or_else(|| o["OfferID"].as_str().map(|x| x.to_lowercase())) {
                daily.push(StoreOffer { item_id: id, price: vp(&o["Cost"]), ..Default::default() });
            }
        }
    } else if let Some(arr) = layout["SingleItemOffers"].as_array() {
        for id in arr.iter().filter_map(|x| x.as_str()) {
            daily.push(StoreOffer { item_id: id.to_lowercase(), ..Default::default() });
        }
    }
    let bonus = &v["BonusStore"];
    let mut night = Vec::new();
    for o in bonus["BonusStoreOffers"].as_array().into_iter().flatten() {
        let offer = &o["Offer"];
        if let Some(id) = first_item(&offer["Rewards"]).or_else(|| offer["OfferID"].as_str().map(|x| x.to_lowercase())) {
            night.push(StoreOffer {
                item_id: id,
                price: vp(&offer["Cost"]),
                discounted: vp(&o["DiscountCosts"]),
                discount_percent: o["DiscountPercent"].as_u64().map(|x| x as u32),
            });
        }
    }
    Store {
        daily,
        daily_remaining: layout["SingleItemOffersRemainingDurationInSeconds"].as_u64(),
        night,
        night_remaining: bonus["BonusStoreRemainingDurationInSeconds"].as_u64(),
        wallet: None,
    }
}

fn basic_player(v: &Value, team: &str, me: &str) -> Player {
    let id = &v["PlayerIdentity"];
    let hidden = id["Incognito"].as_bool().unwrap_or(false);
    let level = if id["HideAccountLevel"].as_bool().unwrap_or(false) {
        None
    } else {
        id["AccountLevel"].as_u64().map(|l| l as u32)
    };
    let puuid = v["Subject"].as_str().unwrap_or("").to_string();
    Player {
        is_self: puuid == me,
        puuid,
        team: team.to_string(),
        hidden_name: hidden,
        level,
        agent_id: v["CharacterID"].as_str().unwrap_or("").to_string(),
        card_id: id["PlayerCardID"].as_str().map(String::from),
        title_id: id["PlayerTitleID"].as_str().map(String::from),
        ..Default::default()
    }
}

fn is_uuid(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36 && [8, 13, 18, 23].iter().all(|&i| b[i] == b'-')
}

/// Bir JSON alt ağacındaki tüm UUID metinlerini (küçük harfle, tekrarsız) toplar.
fn collect_uuids(v: &Value, out: &mut Vec<String>) {
    match v {
        Value::String(s) if is_uuid(s) => {
            let l = s.to_lowercase();
            if !out.contains(&l) {
                out.push(l);
            }
        }
        Value::Array(a) => a.iter().for_each(|x| collect_uuids(x, out)),
        Value::Object(m) => m.values().for_each(|x| collect_uuids(x, out)),
        _ => {}
    }
}

fn loadout_entries(l: &Value) -> Vec<&Value> {
    l["Loadouts"].as_array().or_else(|| l.as_array()).map(|a| a.iter().collect()).unwrap_or_default()
}
fn loadout_node(e: &Value) -> &Value {
    if e["Loadout"].is_object() { &e["Loadout"] } else { e }
}
fn entry_subject(e: &Value) -> Option<&str> {
    e["Loadout"]["Subject"].as_str().or_else(|| e["Subject"].as_str())
}

fn weapon_slot(wid: &str, it: &Value) -> WeaponSlot {
    let sock = |key: &str| it["Sockets"][key]["Item"]["ID"].as_str().map(String::from);
    let mut items = Vec::new();
    collect_uuids(it, &mut items);
    items.retain(|x| x != &wid.to_lowercase());
    WeaponSlot {
        weapon_id: wid.to_string(),
        skin_id: sock(SOCKET_SKIN),
        level_id: sock(SOCKET_LEVEL),
        chroma_id: sock(SOCKET_CHROMA),
        charm_id: sock(SOCKET_CHARM),
        charm_level_id: sock(SOCKET_CHARM_LEVEL),
        items,
    }
}

fn parse_loadout(l: &Value) -> Loadout {
    let mut weapons = Vec::new();
    match &l["Items"] {
        Value::Object(m) => {
            for (k, it) in m {
                weapons.push(weapon_slot(it["ID"].as_str().unwrap_or(k), it));
            }
        }
        Value::Array(a) => {
            for it in a {
                if let Some(wid) = it["ID"].as_str() {
                    weapons.push(weapon_slot(wid, it));
                }
            }
        }
        _ => {}
    }
    let sprays = l["Sprays"]["SpraySelections"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|s| SpraySlot {
                    socket_id: s["SocketID"].as_str().unwrap_or("").to_string(),
                    spray_id: s["SprayID"].as_str().unwrap_or("").to_string(),
                    level_id: s["LevelID"].as_str().map(String::from),
                })
                .collect()
        })
        .unwrap_or_default();
    let (mut spray_ids, mut expression_ids) = (Vec::new(), Vec::new());
    collect_uuids(&l["Sprays"], &mut spray_ids);
    collect_uuids(&l["Expressions"], &mut expression_ids);
    Loadout { weapons, sprays, spray_ids, expression_ids, all_ids: Vec::new() }
}

/// Yanıtın yapısını (anahtarlar ve tipler, değerler olmadan) kısa bir metne çevirir.
fn shape(v: &Value, depth: usize) -> String {
    match v {
        Value::Object(m) => {
            if depth == 0 {
                return "{…}".into();
            }
            let mut parts: Vec<String> = m
                .iter()
                .take(3)
                .map(|(k, x)| format!("{}: {}", if is_uuid(k) { "<uuid>" } else { k.as_str() }, shape(x, depth - 1)))
                .collect();
            if m.len() > 3 {
                parts.push(format!("…(+{})", m.len() - 3));
            }
            format!("{{{}}}", parts.join(", "))
        }
        Value::Array(a) => format!("[{} x {}]", a.len(), a.first().map(|x| shape(x, depth.saturating_sub(1))).unwrap_or_default()),
        Value::String(s) => if is_uuid(s) { "uuid".into() } else { "str".into() },
        Value::Number(_) => "num".into(),
        Value::Bool(_) => "bool".into(),
        Value::Null => "null".into(),
    }
}

/// Sezgisel smurf olasılığı: düşük hesap seviyesi + yüksek rank + yüksek galibiyet oranı.
/// Kesin bir kanıt değildir; arayüzde "olası" olarak gösterilir.
fn smurf_score(level: Option<u32>, rank: &Rank) -> u8 {
    let mut score: i32 = 0;
    let high_rank = rank.current >= 12; // Altın 1 ve üstü
    if let Some(l) = level {
        score += match l {
            0..=29 => 40,
            30..=59 => 25,
            60..=99 => 10,
            _ => 0,
        };
        if high_rank && l < 60 {
            score += 25;
        }
    }
    if rank.games >= 10 {
        let wr = rank.wins as f32 / rank.games as f32;
        if wr > 0.62 {
            score += 20;
        }
    } else if rank.current >= 15 {
        score += 10;
    }
    score.clamp(0, 100) as u8
}

/// Kişisel veri sızmasın diye metindeki oyuncu/maç kimliklerini (UUID) `<id>` ile değiştirir.
fn scrub(s: &str) -> String {
    let mut out = String::new();
    let mut run = String::new();
    let flush = |run: &mut String, out: &mut String| {
        let hex = run.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
        let looks_id = (run.len() == 36 && run.matches('-').count() == 4) || (run.len() >= 32 && hex);
        out.push_str(if looks_id { "<id>" } else { run.as_str() });
        run.clear();
    };
    for c in s.chars() {
        if c.is_ascii_alphanumeric() || c == '-' {
            run.push(c);
        } else {
            flush(&mut run, &mut out);
            out.push(c);
        }
    }
    flush(&mut run, &mut out);
    out
}

const HEALTH: [(&str, &str); 6] = [
    ("store", "Mağaza"),
    ("account", "Hesabım"),
    ("report", "Maç raporu"),
    ("party", "Canlı parti"),
    ("pregame", "Ajan seçiminde kaplamalar"),
    ("premier", "Premier"),
];

fn debug_dir() -> std::path::PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("valorant-overlay-debug")
}

impl Engine {
    /// Özelliklerin son durumu; denenmeyenler "idle" görünür.
    pub async fn health(&self) -> Vec<HealthEntry> {
        let st = self.state.lock().await;
        HEALTH
            .iter()
            .map(|(id, label)| {
                let (state, detail) = st.health.get(id).cloned().unwrap_or(("idle", "Henüz denenmedi".to_string()));
                HealthEntry { id: id.to_string(), label: label.to_string(), state: state.to_string(), detail }
            })
            .collect()
    }

    /// Paylaşılabilir tanı metni: özellik durumları ve yapı dosyaları. İsim, kimlik ve token içermez.
    pub async fn diagnostics(&self) -> String {
        let mut out = String::from("Özellik durumu\n");
        for h in self.health().await {
            let mark = match h.state.as_str() {
                "ok" => "OK",
                "warn" => "KISMEN",
                "fail" => "HATA",
                _ => "-",
            };
            out.push_str(&format!("  {mark} {}: {}\n", h.label, h.detail));
        }
        for f in ["party-check.txt", "pregame-loadouts-shape.txt", "loadouts-shape.txt", "premier-player-shape.txt", "premier-roster-shape.txt"] {
            if let Ok(t) = std::fs::read_to_string(debug_dir().join(f)) {
                let t: String = t.chars().take(3000).collect();
                out.push_str(&format!("\n[{f}]\n{}\n", scrub(&t)));
            }
        }
        out
    }
}

/// Maç kaydındaki parti kimliklerinden gerçek parti harfleri (A, B, ...). Solo oyuncuya harf verilmez.
fn party_letters(players: &[Pd]) -> HashMap<String, String> {
    let mut order: Vec<&str> = Vec::new();
    for p in players {
        if !p.party_id.is_empty() && !order.contains(&p.party_id.as_str()) {
            order.push(&p.party_id);
        }
    }
    let mut out = HashMap::new();
    let mut label = b'A';
    for id in order {
        let members: Vec<&Pd> = players.iter().filter(|p| p.party_id == id).collect();
        if members.len() > 1 {
            for m in members {
                out.insert(m.puuid.clone(), (label as char).to_string());
            }
            label += 1;
        }
    }
    out
}

fn find(p: &mut Vec<usize>, x: usize) -> usize {
    if p[x] != x {
        let r = find(p, p[x]);
        p[x] = r;
    }
    p[x]
}

/// Geçmişte aynı partide girilen maç sayısı eşiği ("sık birlikte").
const TOGETHER_MIN: u32 = 3;

impl Engine {
    /// Parti bilgisi yalnızca kesin kaynaklardan gelir:
    /// 1) Riot Client'ın canlı parti kimliği (kesin), 2) geçmiş maç kayıtlarındaki parti kimliği
    /// (yalnızca "son maçlarda birlikte girdiler" bilgisi; şu anki lobi için kanıt sayılmaz).
    async fn assign_parties(&self, st: &mut State, s: &Session, players: &mut [Player]) {
        let n = players.len();

        // 1) Canlı parti kimliği
        let live = s.party_ids().await;
        let ids: HashMap<String, String> = live.as_ref().map(|(_, m)| m.clone()).unwrap_or_default();
        let mut label = b'A';
        let mut order: Vec<String> = Vec::new();
        for p in players.iter() {
            if let Some(id) = ids.get(&p.puuid) {
                if !order.contains(id) {
                    order.push(id.clone());
                }
            }
        }
        for id in &order {
            let idx: Vec<usize> = (0..n).filter(|&i| ids.get(&players[i].puuid) == Some(id)).collect();
            if idx.len() > 1 {
                for i in idx {
                    players[i].party = Some((label as char).to_string());
                    players[i].party_sure = true;
                }
                label += 1;
            }
        }

        // Tanı: bu lobide canlı parti verisi geldi mi? (yalnızca sayılar, kimlik yok)
        let key = {
            let mut v: Vec<&str> = players.iter().map(|p| p.puuid.as_str()).collect();
            v.sort();
            v.join(",")
        };
        if st.debug_party.as_deref() != Some(key.as_str()) {
            st.debug_party = Some(key);
            let text = match &live {
                None => "Riot Client sohbet listesi (presences) alınamadı.".to_string(),
                Some((total, map)) => {
                    let found = players.iter().filter(|p| map.contains_key(&p.puuid)).count();
                    let mut sizes: HashMap<&String, usize> = HashMap::new();
                    for p in players.iter() {
                        if let Some(id) = map.get(&p.puuid) {
                            *sizes.entry(id).or_default() += 1;
                        }
                    }
                    let mut sz: Vec<usize> = sizes.into_values().collect();
                    sz.sort_unstable_by(|a, b| b.cmp(a));
                    format!(
                        "Listedeki Valorant kaydı: {total}\nLobideki oyuncu: {n}\nParti kimliği bulunan lobi oyuncusu: {found}\nParti grup boyutları: {sz:?}\n"
                    )
                }
            };
            write_text("party-check.txt", &text);
            let h = match &live {
                None => ("fail", "Riot Client sohbet listesi alınamadı".to_string()),
                Some((_, map)) => {
                    let found = players.iter().filter(|p| map.contains_key(&p.puuid)).count();
                    if found >= n {
                        ("ok", format!("{found}/{n} oyuncu için canlı parti verisi"))
                    } else {
                        ("warn", format!("{found}/{n} oyuncu için canlı parti verisi"))
                    }
                }
            };
            st.health.insert("party", h);
        }

        // 2) Geçmiş: aynı takımdaki iki oyuncunun son maçlarında ortak parti kimliği
        let mut parent: Vec<usize> = (0..n).collect();
        for i in 0..n {
            players[i].together.clear();
            let Some((_, h)) = st.history.get(&players[i].puuid) else { continue };
            let ds: Vec<&Detail> = form_ids(h).iter().filter_map(|(id, _)| st.details.get(id)).collect();
            if ds.is_empty() {
                continue;
            }
            for j in 0..n {
                if i == j || players[i].team != players[j].team {
                    continue;
                }
                let count = ds
                    .iter()
                    .filter(|d| {
                        let a = d.players.iter().find(|x| x.puuid == players[i].puuid).map(|x| x.party_id.as_str());
                        let b = d.players.iter().find(|x| x.puuid == players[j].puuid).map(|x| x.party_id.as_str());
                        matches!((a, b), (Some(a), Some(b)) if !a.is_empty() && a == b)
                    })
                    .count() as u32;
                if count > 0 {
                    players[i].together.push(Together { puuid: players[j].puuid.clone(), count, of: ds.len() as u32 });
                }
            }
            players[i].together.sort_by(|a, b| b.count.cmp(&a.count));
        }
        for i in 0..n {
            for t in &players[i].together {
                if t.count >= TOGETHER_MIN {
                    if let Some(j) = players.iter().position(|p| p.puuid == t.puuid) {
                        let (ri, rj) = (find(&mut parent, i), find(&mut parent, j));
                        parent[ri] = rj;
                    }
                }
            }
        }
        let mut groups: HashMap<usize, Vec<usize>> = HashMap::new();
        for i in 0..n {
            let r = find(&mut parent, i);
            groups.entry(r).or_default().push(i);
        }
        let mut ordered: Vec<Vec<usize>> = groups.into_values().filter(|g| g.len() > 1).collect();
        ordered.sort_by_key(|g| g[0]);
        for g in ordered {
            // Canlı parti kimliği olan oyuncuların etiketi değişmez.
            if g.iter().any(|&i| players[i].party_sure) {
                continue;
            }
            for i in g {
                players[i].party = Some((label as char).to_string());
            }
            label += 1;
        }
    }
}

/// Kaplama eşleşmesi sorunlarını incelemek için kendi donatının ham halini yazar.
fn write_text(name: &str, text: &str) {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("valorant-overlay-debug");
    let _ = std::fs::create_dir_all(&base);
    let _ = std::fs::write(base.join(name), text);
}

fn write_debug(name: &str, v: &Value) {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("valorant-overlay-debug");
    let _ = std::fs::create_dir_all(&base);
    let _ = std::fs::write(base.join(name), serde_json::to_string_pretty(v).unwrap_or_default());
}
