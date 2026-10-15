use anyhow::{anyhow, bail, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use crate::netlog;
use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;

/// Bağlantı sorunlarının arayüzde anlaşılır gösterilebilmesi için sınıflandırması.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Fault {
    NoRiotClient,
    NotLoggedIn,
    NoRegion,
    Rejected,
    Other,
}

impl Fault {
    pub fn code(self) -> &'static str {
        match self {
            Fault::NoRiotClient => "no_riot_client",
            Fault::NotLoggedIn => "not_logged_in",
            Fault::NoRegion => "no_region",
            Fault::Rejected => "rejected",
            Fault::Other => "other",
        }
    }
}

#[derive(Debug)]
pub struct FaultError {
    pub fault: Fault,
    pub msg: String,
}
impl std::fmt::Display for FaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.msg)
    }
}
impl std::error::Error for FaultError {}

pub fn fault(f: Fault, msg: impl Into<String>) -> anyhow::Error {
    FaultError { fault: f, msg: msg.into() }.into()
}
pub fn fault_of(e: &anyhow::Error) -> Fault {
    e.downcast_ref::<FaultError>().map(|x| x.fault).unwrap_or(Fault::Other)
}

/// Kullanıcıya gösterilecek Türkçe açıklama.
pub fn friendly(e: &anyhow::Error) -> String {
    match fault_of(e) {
        Fault::NoRiotClient => "Riot Client açık değil. Riot Client'ı başlat.".into(),
        Fault::NotLoggedIn => "Riot Client'ta giriş yapılmamış görünüyor. Giriş yapıp tekrar dene.".into(),
        Fault::NoRegion => "Bölge bilgisi bulunamadı. Valorant'ı bu bilgisayarda en az bir kez açmış olman gerekiyor.".into(),
        Fault::Rejected => "Riot isteği reddetti (oturum süresi dolmuş ya da oyun güncellenmiş olabilir). Birkaç dakika sonra tekrar dene.".into(),
        Fault::Other => format!("Bağlantı sorunu: {e}"),
    }
}

fn local_app_data() -> Result<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| anyhow!("LOCALAPPDATA bulunamadı"))
}

struct Lockfile {
    port: u16,
    password: String,
}

/// Riot Client açıkken `lockfile` içinde yerel API portu ve parolası bulunur.
fn read_lockfile() -> Result<Lockfile> {
    let path = local_app_data()?.join("Riot Games/Riot Client/Config/lockfile");
    let raw = std::fs::read_to_string(&path).map_err(|_| fault(Fault::NoRiotClient, "Riot Client çalışmıyor"))?;
    let parts: Vec<&str> = raw.trim().split(':').collect();
    if parts.len() < 5 {
        bail!("lockfile beklenmeyen biçimde");
    }
    Ok(Lockfile { port: parts[2].parse()?, password: parts[3].to_string() })
}

fn read_game_log() -> Result<String> {
    let path = local_app_data()?.join("VALORANT/Saved/Logs/ShooterGame.log");
    let bytes = std::fs::read(&path).map_err(|_| fault(Fault::NoRegion, "Valorant günlüğü bulunamadı"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Günlükteki glz adresinden bölge/shard bilgisini okur.
fn endpoints(log: &str) -> Result<(String, String)> {
    const MARK: &str = "https://glz-";
    let i = log.find(MARK).ok_or_else(|| fault(Fault::NoRegion, "Bölge bilgisi günlükte yok"))?;
    let rest = &log[i + MARK.len()..];
    let end = rest.find(".a.pvp.net").ok_or_else(|| fault(Fault::NoRegion, "glz adresi çözümlenemedi"))?;
    let host = &rest[..end]; // örn. "eu-1.eu"
    let (left, shard) = host.split_once('.').ok_or_else(|| fault(Fault::NoRegion, "glz adresi çözümlenemedi"))?;
    let region = left.split('-').next().unwrap_or(left);
    Ok((
        format!("https://glz-{region}-1.{shard}.a.pvp.net"),
        format!("https://pd.{shard}.a.pvp.net"),
    ))
}

/// Günlükteki "CI server version: release-09.05-9-2635082" satırından istemci sürümünü üretir
/// (Riot'un beklediği biçim: release-09.05-shipping-9-2635082).
fn log_version(log: &str) -> Option<String> {
    const MARK: &str = "CI server version: ";
    let i = log.find(MARK)?;
    let line = log[i + MARK.len()..].lines().next()?.trim();
    if line.is_empty() || line.contains(' ') {
        return None;
    }
    let mut parts: Vec<&str> = line.split('-').collect();
    if parts.len() < 3 {
        return None;
    }
    if !parts.contains(&"shipping") {
        parts.insert(2, "shipping");
    }
    Some(parts.join("-"))
}

#[derive(Deserialize)]
struct Entitlements {
    #[serde(rename = "accessToken")]
    access_token: String,
    token: String,
    subject: String,
}

#[derive(Clone)]
pub struct Session {
    pub puuid: String,
    pub glz: String,
    pub pd: String,
    access: String,
    entitlement: String,
    version: String,
    local: reqwest::Client,
    port: u16,
    password: String,
}

impl Session {
    /// Kullanıcıdan giriş istemez: zaten açık olan Riot Client oturumunu kullanır.
    /// Valorant'ın açık olması gerekmez (mağaza gibi özellikler yalnızca Riot Client ister).
    pub async fn open() -> Result<Self> {
        let lock = read_lockfile()?;
        let local = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .timeout(Duration::from_secs(5))
            .build()?;
        let resp = netlog::exec(
            &local,
            local.get(format!("https://127.0.0.1:{}/entitlements/v1/token", lock.port)).basic_auth("riot", Some(&lock.password)),
        )
        .await
            .map_err(|_| fault(Fault::NoRiotClient, "Riot Client'a bağlanılamadı"))?;
        if !resp.status().is_success() {
            return Err(fault(Fault::NotLoggedIn, format!("Riot Client oturum bilgisi vermedi (HTTP {})", resp.status().as_u16())));
        }
        let ent: Entitlements = resp.json().await.map_err(|_| fault(Fault::NotLoggedIn, "Oturum bilgisi okunamadı"))?;

        let log = read_game_log()?;
        let (glz, pd) = endpoints(&log)?;
        let version = match log_version(&log) {
            Some(v) => v,
            None => {
                // Günlükte yoksa eski yönteme dön.
                let c = reqwest::Client::new();
                let ver: Value = netlog::exec(&c, c.get("https://valorant-api.com/v1/version")).await?.json().await?;
                ver["data"]["riotClientVersion"]
                    .as_str()
                    .ok_or_else(|| anyhow!("istemci sürümü alınamadı"))?
                    .to_string()
            }
        };
        Ok(Self {
            puuid: ent.subject,
            glz,
            pd,
            access: ent.access_token,
            entitlement: ent.token,
            version,
            local,
            port: lock.port,
            password: lock.password,
        })
    }

    /// Valorant çalışıyor mu? Riot Client'ın yerel API'sine sorulur. Öğrenilemezse None.
    pub async fn valorant_running(&self) -> Option<bool> {
        let r = netlog::exec(
            &self.local,
            self.local.get(format!("https://127.0.0.1:{}/product-session/v1/external-sessions", self.port)).basic_auth("riot", Some(&self.password)),
        )
        .await
        .ok()?;
        if !r.status().is_success() {
            return None;
        }
        let v: Value = r.json().await.ok()?;
        let obj = v.as_object()?;
        Some(obj.values().any(|e| e["productId"].as_str() == Some("valorant")))
    }

    /// Riot Client'ın yerel sohbet listesinden oyuncuların parti kimliklerini okur.
    /// Dönüş: (listedeki Valorant kaydı sayısı, oyuncu → partyId). Liste alınamazsa None.
    pub async fn party_ids(&self) -> Option<(usize, std::collections::HashMap<String, String>)> {
        let r = netlog::exec(
            &self.local,
            self.local.get(format!("https://127.0.0.1:{}/chat/v4/presences", self.port)).basic_auth("riot", Some(&self.password)),
        )
        .await
        .ok()?;
        if !r.status().is_success() {
            return None;
        }
        let v: Value = r.json().await.ok()?;
        let mut total = 0;
        let mut map = std::collections::HashMap::new();
        for e in v["presences"].as_array()? {
            if e["product"].as_str() != Some("valorant") {
                continue;
            }
            total += 1;
            let (Some(puuid), Some(raw)) = (e["puuid"].as_str(), e["private"].as_str()) else { continue };
            let Ok(bytes) = STANDARD.decode(raw) else { continue };
            let Ok(p) = serde_json::from_slice::<Value>(&bytes) else { continue };
            let id = p["partyId"].as_str().or_else(|| p["partyPresenceData"]["partyId"].as_str()).filter(|x| !x.is_empty());
            if let Some(id) = id {
                map.insert(puuid.to_lowercase(), id.to_lowercase());
            }
        }
        Some((total, map))
    }

    pub fn headers(&self) -> HeaderMap {
        let platform = STANDARD.encode(
            r#"{"platformType":"PC","platformOS":"Windows","platformOSVersion":"10.0.19042.1.256.64bit","platformChipset":"Unknown"}"#,
        );
        let mut h = HeaderMap::new();
        let mut put = |k: &'static str, v: String| {
            if let Ok(v) = HeaderValue::from_str(&v) {
                h.insert(k, v);
            }
        };
        put("x-riot-entitlements-jwt", self.entitlement.clone());
        put("x-riot-clientversion", self.version.clone());
        put("x-riot-clientplatform", platform);
        if let Ok(v) = HeaderValue::from_str(&format!("Bearer {}", self.access)) {
            h.insert(AUTHORIZATION, v);
        }
        h
    }
}
