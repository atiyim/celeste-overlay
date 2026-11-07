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

/// Sohbet listesindeki bir Valorant kaydının yalnızca yapısı (isim ve kimlik içermez); tanı içindir.
#[derive(Default, Clone)]
pub struct PresenceRow {
    pub puuid: String,
    pub has_private: bool,
    pub decoded: bool,
    pub keys: Vec<String>,
    pub party_id: bool,
    pub party_size: Option<u64>,
    pub state: String,
}

#[derive(Default)]
pub struct PartyScan {
    /// Listedeki tüm kayıt (her ürün).
    pub all: usize,
    /// Valorant kaydı sayısı.
    pub total: usize,
    pub ids: std::collections::HashMap<String, String>,
    pub rows: Vec<PresenceRow>,
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
    /// 0: uzak oturum (telefon). Riot Client'ın yerel API'si yok; yerel istekler atlanır.
    port: u16,
    password: String,
}

/// Bölge (PAS'ın verdiği "eu", "na", "latam", "br", "ap", "kr") → (glz, pd) adresleri.
pub fn region_endpoints(region: &str) -> Option<(String, String)> {
    let (region, shard) = match region {
        "eu" => ("eu", "eu"),
        "na" => ("na", "na"),
        "latam" => ("latam", "na"),
        "br" => ("br", "na"),
        "ap" => ("ap", "ap"),
        "kr" => ("kr", "kr"),
        _ => return None,
    };
    Some((format!("https://glz-{region}-1.{shard}.a.pvp.net"), format!("https://pd.{shard}.a.pvp.net")))
}

/// JWT'nin gövdesinden bir alan (imza doğrulanmaz; yalnızca kendi belirtecimizden puuid okumak için).
/// Belirtecin bitiş zamanı (Unix saniye).
pub fn jwt_exp(token: &str) -> Option<u64> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let body = token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(body.trim_end_matches('=')).ok()?;
    let v: Value = serde_json::from_slice(&bytes).ok()?;
    v["exp"].as_u64()
}

fn jwt_claim(token: &str, key: &str) -> Option<String> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let body = token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(body.trim_end_matches('=')).ok()?;
    let v: Value = serde_json::from_slice(&bytes).ok()?;
    v[key].as_str().map(String::from)
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

    /// Telefon: Riot'un giriş sayfasından alınan erişim ve kimlik belirteçleriyle uzak oturum.
    /// Riot Client gerekmez; oyun sunucularına (glz/pd) aynı biçimde sorulur. Belirteçler yalnızca bu cihazda kalır.
    pub async fn from_tokens(access: &str, id_token: &str) -> Result<Self> {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(10)).build()?;
        let bearer = format!("Bearer {access}");
        // Hak belirteci (entitlements)
        let ent: Value = netlog::exec(&http, http.post("https://entitlements.auth.riotgames.com/api/token/v1").header(AUTHORIZATION, &bearer).json(&serde_json::json!({})))
            .await
            .map_err(|_| fault(Fault::NotLoggedIn, "Riot'a bağlanılamadı"))?
            .json()
            .await
            .map_err(|_| fault(Fault::NotLoggedIn, "Riot oturum bilgisi okunamadı"))?;
        let entitlement = ent["entitlements_token"].as_str().ok_or_else(|| fault(Fault::NotLoggedIn, "Riot oturumu açılamadı, yeniden giriş yap"))?.to_string();
        // Bölge
        let geo: Value = netlog::exec(
            &http,
            http.put("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant").header(AUTHORIZATION, &bearer).json(&serde_json::json!({ "id_token": id_token })),
        )
        .await
        .map_err(|_| fault(Fault::NoRegion, "Bölge bilgisi alınamadı"))?
        .json()
        .await
        .map_err(|_| fault(Fault::NoRegion, "Bölge bilgisi okunamadı"))?;
        let region = geo["affinities"]["live"].as_str().unwrap_or("");
        let (glz, pd) = region_endpoints(region).ok_or_else(|| fault(Fault::NoRegion, format!("Bilinmeyen bölge: {region}")))?;
        let puuid = jwt_claim(access, "sub").ok_or_else(|| fault(Fault::NotLoggedIn, "Hesap kimliği okunamadı"))?.to_lowercase();
        let ver: Value = netlog::exec(&http, http.get("https://valorant-api.com/v1/version")).await?.json().await?;
        let version = ver["data"]["riotClientVersion"].as_str().ok_or_else(|| anyhow!("istemci sürümü alınamadı"))?.to_string();
        Ok(Self { puuid, glz, pd, access: access.to_string(), entitlement, version, local: http, port: 0, password: String::new() })
    }

    /// Uzak (telefon) oturumu mu?
    pub fn is_remote(&self) -> bool {
        self.port == 0
    }

    /// Valorant çalışıyor mu? Riot Client'ın yerel API'sine sorulur. Öğrenilemezse None.
    pub async fn valorant_running(&self) -> Option<bool> {
        if self.is_remote() {
            return None;
        }
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
    pub async fn party_ids(&self) -> Option<PartyScan> {
        if self.is_remote() {
            return None;
        }
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
        let list = v["presences"].as_array()?;
        let mut scan = PartyScan { all: list.len(), ..Default::default() };
        for e in list {
            if e["product"].as_str() != Some("valorant") {
                continue;
            }
            scan.total += 1;
            let Some(puuid) = e["puuid"].as_str() else { continue };
            let mut row = PresenceRow { puuid: puuid.to_lowercase(), ..Default::default() };
            if let Some(raw) = e["private"].as_str().filter(|x| !x.is_empty()) {
                row.has_private = true;
                if let Some(p) = STANDARD.decode(raw).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()) {
                    row.decoded = true;
                    row.keys = p.as_object().map(|o| o.keys().cloned().collect()).unwrap_or_default();
                    row.keys.sort();
                    row.state = p["sessionLoopState"].as_str().unwrap_or("").to_string();
                    row.party_size = p["partySize"].as_u64().or_else(|| p["partyPresenceData"]["partySize"].as_u64());
                    let id = p["partyId"].as_str().or_else(|| p["partyPresenceData"]["partyId"].as_str()).filter(|x| !x.is_empty());
                    if let Some(id) = id {
                        row.party_id = true;
                        scan.ids.insert(row.puuid.clone(), id.to_lowercase());
                    }
                }
            }
            scan.rows.push(row);
        }
        Some(scan)
    }

    /// Kendi Valorant durumun (Riot Client'ın yerel sohbet listesindeki şifresiz "private" alanı, çözülmüş hali):
    /// oturum durumu, sıra, harita, parti büyüklüğü, sıraya giriş zamanı, maçtaki skor. Discord kartı için.
    /// Riot bu alanın biçimini değiştirebilir; çağıran taraf alanları yoksa göstermez.
    pub async fn my_presence(&self) -> Option<Value> {
        if self.is_remote() {
            return None;
        }
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
        let me = self.puuid.to_lowercase();
        let e = v["presences"].as_array()?.iter().find(|e| e["product"].as_str() == Some("valorant") && e["puuid"].as_str().map(|p| p.to_lowercase()) == Some(me.clone()))?;
        let raw = e["private"].as_str().filter(|x| !x.is_empty())?;
        STANDARD.decode(raw).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok())
    }

    /// Kendi Riot ID'n ("isim#etiket"), Riot Client'ın yerel API'sinden. Valorant'ın açık olması gerekmez.
    pub async fn local_riot_id(&self) -> Option<String> {
        if self.is_remote() {
            return None;
        }
        for path in ["/chat/v1/session", "/player-account/aliases/v1/active"] {
            let Ok(r) = netlog::exec(
                &self.local,
                self.local.get(format!("https://127.0.0.1:{}{path}", self.port)).basic_auth("riot", Some(&self.password)),
            )
            .await
            else {
                continue;
            };
            if !r.status().is_success() {
                continue;
            }
            let Ok(v) = r.json::<Value>().await else { continue };
            let v = if v.is_array() { v[0].clone() } else { v };
            let name = v["game_name"].as_str().unwrap_or("").trim();
            let tag = v["game_tag"].as_str().or_else(|| v["tag_line"].as_str()).unwrap_or("").trim();
            if !name.is_empty() && !tag.is_empty() {
                return Some(format!("{name}#{tag}"));
            }
        }
        None
    }

    /// Riot'un imzaladığı kimlik belirteci (id_token), Riot Client'ın yerel API'sinden. Akış'ta hesabın sana ait
    /// olduğunu kanıtlamak için siteye bir kez gönderilir. Kimlik belirteci API çağrısı yapmaya yaramaz
    /// (erişim belirteci değildir); site imzayı Riot'un açık anahtarıyla doğrular ve saklamaz.
    pub async fn local_id_token(&self) -> Option<String> {
        if self.is_remote() {
            return None;
        }
        for path in ["/rso-auth/v1/authorization/id-token", "/rso-auth/v1/authorization"] {
            let Ok(r) = netlog::exec(
                &self.local,
                self.local.get(format!("https://127.0.0.1:{}{path}", self.port)).basic_auth("riot", Some(&self.password)),
            )
            .await
            else {
                continue;
            };
            if !r.status().is_success() {
                continue;
            }
            let Ok(v) = r.json::<Value>().await else { continue };
            let t = v["token"].as_str().or_else(|| v["idToken"]["token"].as_str()).unwrap_or("");
            if t.split('.').count() == 3 {
                return Some(t.to_string());
            }
        }
        None
    }

    pub fn headers(&self) -> HeaderMap {
        // Telefonda da oyun sunucuları PC istemcisi biçimini bekler.
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

#[cfg(test)]
mod remote_tests {
    use super::*;

    #[test]
    fn regions_map_to_shards() {
        assert_eq!(region_endpoints("eu").unwrap().0, "https://glz-eu-1.eu.a.pvp.net");
        assert_eq!(region_endpoints("latam").unwrap(), ("https://glz-latam-1.na.a.pvp.net".to_string(), "https://pd.na.a.pvp.net".to_string()));
        assert!(region_endpoints("xx").is_none());
    }

    #[test]
    fn reads_sub_from_jwt() {
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        let body = URL_SAFE_NO_PAD.encode(r#"{"sub":"ABC-123","iss":"x"}"#);
        assert_eq!(jwt_claim(&format!("h.{body}.s"), "sub").as_deref(), Some("ABC-123"));
        assert_eq!(jwt_claim("bozuk", "sub"), None);
    }
}
