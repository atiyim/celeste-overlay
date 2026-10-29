//! Ağ günlüğü: uygulamanın attığı her isteği kaydeder ve Şeffaflık paneline sunar.
//! Tüm Riot istekleri `exec` üzerinden geçer. Kayıt yalnızca bellekte tutulur (son 300 istek), diske yazılmaz.
//! Token, çerez ve istek gövdesi hiçbir zaman kaydedilmez; uzun kimlikler maskelenir.
use serde::Serialize;
use std::collections::{HashSet, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

const CAP: usize = 300;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetEntry {
    /// Unix zamanı, milisaniye.
    pub t: u64,
    pub method: String,
    pub host: String,
    /// "local" | "riot" | "assets" | "github" | "celeste" | "other"
    pub target: String,
    /// Türkçe açıklama: istek ne için atıldı.
    pub what: String,
    /// Maskelenmiş adres yolu.
    pub path: String,
    /// "okuma" | "sorgu" | "yazma"
    pub kind: String,
    /// HTTP durum kodu; bağlantı kurulamadıysa 0.
    pub status: u16,
    pub ms: u32,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HostCount {
    pub host: String,
    pub target: String,
    pub count: u64,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct NetReport {
    /// En yeni üstte.
    pub entries: Vec<NetEntry>,
    pub total: u64,
    pub reads: u64,
    pub queries: u64,
    pub writes: u64,
    pub errors: u64,
    /// Son 60 saniyedeki istek sayısı.
    pub last_minute: u32,
    pub hosts: Vec<HostCount>,
    /// Bu oturumda görülen, ismini gizleyen ve ismi sorgulanmayan oyuncu sayısı.
    pub hidden_skipped: u32,
    pub since: u64,
}

#[derive(Default)]
struct Log {
    entries: VecDeque<NetEntry>,
    total: u64,
    reads: u64,
    queries: u64,
    writes: u64,
    errors: u64,
    hosts: Vec<HostCount>,
    hidden: HashSet<String>,
    since: u64,
}

fn log() -> &'static Mutex<Log> {
    static L: OnceLock<Mutex<Log>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(Log { since: now_ms(), ..Default::default() }))
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Adresi parçalar: (sunucu, hedef türü).
fn classify(host: &str) -> &'static str {
    if host == "127.0.0.1" || host == "localhost" {
        "local"
    } else if host.ends_with("pvp.net") || host.ends_with("riotgames.com") {
        "riot"
    } else if host.ends_with("valorant-api.com") {
        "assets"
    } else if host.ends_with("github.com") || host.ends_with("githubusercontent.com") {
        "github"
    } else if host.starts_with("celeste-feed.") && host.ends_with(".workers.dev") {
        "celeste"
    } else {
        "other"
    }
}

/// Uzun kimlikleri (oyuncu, maç) maskeler: a1b2c3d4-… → a1b2…d4
fn mask_path(path: &str) -> String {
    path.split('/')
        .map(|s| {
            if s.len() >= 32 {
                format!("{}…{}", &s[..4], &s[s.len() - 2..])
            } else {
                s.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// Bu istek ne için? Sıra önemli: özel olan önce.
fn describe(path: &str) -> &'static str {
    let rules: [(&str, &str); 24] = [
        ("/api/overlay/ping", "Anonim kullanım sayımı (rastgele kimlik ve sürüm)"),
        ("/api/overlay/feedback", "Öneri / Hata formu (yalnızca Gönder'e basınca)"),
        ("/entitlements/v1/token", "Oturum bilgisi (açık Riot Client'tan, giriş yapılmaz)"),
        ("external-sessions", "Valorant açık mı?"),
        ("/chat/v4/presences", "Parti bilgisi"),
        ("/loadouts", "Oyuncuların kaplamaları"),
        ("/core-game/v1/players", "Maç var mı?"),
        ("/core-game/v1/matches", "Maç oyuncuları"),
        ("/pregame/v1/players", "Ajan seçimi var mı?"),
        ("/pregame/v1/matches", "Ajan seçimi oyuncuları"),
        ("/name-service/", "İsim sorgusu (ismini gizleyenler hariç)"),
        ("competitiveupdates", "Rank değişimi"),
        ("/mmr/", "Rank bilgisi"),
        ("/match-history/", "Maç geçmişi"),
        ("/match-details/", "Maç ayrıntısı"),
        ("/premier/", "Premier takımı"),
        ("/store/v1/wallet", "Bakiye"),
        ("/store/v1/entitlements", "Envanter"),
        ("/store/", "Günlük ve gece mağazası"),
        ("/contracts/", "Görevler ve battle pass"),
        ("/v1/version", "Oyun sürümü"),
        ("/v1/", "Görsel ve isim sözlüğü"),
        ("/releases/", "Güncelleme denetimi"),
        ("latest.json", "Güncelleme denetimi"),
    ];
    for (k, v) in rules {
        if path.contains(k) {
            return v;
        }
    }
    "Diğer"
}

/// Yazma isteği değil, yalnızca veri sorgulayan POST/PUT çağrıları. Burada olmayan her POST/PUT/DELETE "yazma" sayılır.
fn is_query(method: &str, path: &str) -> bool {
    (method == "PUT" && path.contains("/name-service/")) || (method == "POST" && path.contains("/store/") && path.contains("/storefront/"))
}

fn record(method: &str, url: &reqwest::Url, status: u16, ms: u32) {
    let host = url.host_str().unwrap_or("?").to_string();
    let target = classify(&host).to_string();
    let path = url.path();
    let kind = if method == "GET" || method == "HEAD" {
        "okuma"
    } else if target == "celeste" && path == "/api/overlay/feedback" {
        // Riot'ta bir şey değiştirmez: kullanıcının kendi yazdığı formu Celeste'ye gönderir.
        "gönderim"
    } else if is_query(method, path) {
        "sorgu"
    } else {
        "yazma"
    };
    let e = NetEntry {
        t: now_ms(),
        method: method.to_string(),
        host: host.clone(),
        target: target.clone(),
        what: describe(path).to_string(),
        path: mask_path(path),
        kind: kind.to_string(),
        status,
        ms,
    };
    let Ok(mut l) = log().lock() else { return };
    l.total += 1;
    match kind {
        "okuma" => l.reads += 1,
        "sorgu" => l.queries += 1,
        "gönderim" => {}
        _ => l.writes += 1,
    }
    if status == 0 || status >= 400 {
        l.errors += 1;
    }
    match l.hosts.iter_mut().find(|h| h.host == host) {
        Some(h) => h.count += 1,
        None => l.hosts.push(HostCount { host, target, count: 1 }),
    }
    if l.entries.len() >= CAP {
        l.entries.pop_front();
    }
    l.entries.push_back(e);
}

/// İsteği gönderir ve kaydeder. Yanıt ya da hata olduğu gibi döner.
pub async fn exec(client: &reqwest::Client, rb: reqwest::RequestBuilder) -> reqwest::Result<reqwest::Response> {
    let req = rb.build()?;
    let method = req.method().as_str().to_string();
    let url = req.url().clone();
    let t0 = Instant::now();
    let res = client.execute(req).await;
    let ms = t0.elapsed().as_millis().min(u32::MAX as u128) as u32;
    record(&method, &url, res.as_ref().map(|r| r.status().as_u16()).unwrap_or(0), ms);
    res
}

/// Arayüzün (WebView) kendi attığı istekleri bildirmesi için: sözlük dosyaları gibi.
pub fn note(method: &str, url: &str, status: u16, ms: u32) {
    if let Ok(u) = reqwest::Url::parse(url) {
        let m = method.to_uppercase();
        record(&m, &u, status, ms);
    }
}

/// İsmi gizli bir oyuncu görüldü; ismi sorgulanmadı.
pub fn skipped_hidden(id: &str) {
    if let Ok(mut l) = log().lock() {
        l.hidden.insert(id.to_string());
    }
}

pub fn report() -> NetReport {
    let Ok(l) = log().lock() else { return NetReport::default() };
    let now = now_ms();
    let mut hosts = l.hosts.clone();
    hosts.sort_by(|a, b| b.count.cmp(&a.count));
    NetReport {
        entries: l.entries.iter().rev().cloned().collect(),
        total: l.total,
        reads: l.reads,
        queries: l.queries,
        writes: l.writes,
        errors: l.errors,
        last_minute: l.entries.iter().filter(|e| now.saturating_sub(e.t) < 60_000).count() as u32,
        hosts,
        hidden_skipped: l.hidden.len() as u32,
        since: l.since,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Günlük ortak olduğu için sayaçlara bakan testler sırayla çalışır.
    static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn masks_long_ids() {
        let p = mask_path("/mmr/v1/players/0d2e5b3a-1111-2222-3333-444455556666/competitiveupdates");
        assert_eq!(p, "/mmr/v1/players/0d2e…66/competitiveupdates");
    }

    #[test]
    fn classifies_hosts() {
        assert_eq!(classify("127.0.0.1"), "local");
        assert_eq!(classify("pd.eu.a.pvp.net"), "riot");
        assert_eq!(classify("glz-eu-1.eu.a.pvp.net"), "riot");
        assert_eq!(classify("valorant-api.com"), "assets");
        assert_eq!(classify("example.com"), "other");
        assert_eq!(classify("celeste-feed.celestimbenim.workers.dev"), "celeste");
        assert_eq!(classify("baska.workers.dev"), "other");
    }

    #[test]
    fn only_known_queries_are_not_writes() {
        assert!(is_query("PUT", "/name-service/v2/players"));
        assert!(is_query("POST", "/store/v3/storefront/abc"));
        assert!(!is_query("POST", "/anything/else"));
        assert!(!is_query("DELETE", "/name-service/v2/players"));
    }

    #[test]
    fn describes_specific_before_general() {
        assert_eq!(describe("/core-game/v1/matches/x/loadouts"), "Oyuncuların kaplamaları");
        assert_eq!(describe("/mmr/v1/players/x/competitiveupdates"), "Rank değişimi");
        assert_eq!(describe("/store/v1/wallet/x"), "Bakiye");
        assert_eq!(describe("/api/overlay/ping"), "Anonim kullanım sayımı (rastgele kimlik ve sürüm)");
    }

    #[test]
    fn feedback_form_is_not_a_riot_write() {
        let _g = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
        let before = report();
        note("POST", "https://celeste-feed.celestimbenim.workers.dev/api/overlay/feedback", 201, 80);
        let after = report();
        assert_eq!(after.writes, before.writes);
        let e = after.entries.iter().rev().find(|e| e.path == "/api/overlay/feedback").unwrap();
        assert_eq!(e.kind, "gönderim");
        assert_eq!(e.target, "celeste");
        assert_eq!(e.what, "Öneri / Hata formu (yalnızca Gönder'e basınca)");
    }

    #[tokio::test]
    async fn exec_records_requests() {
        use std::io::{Read, Write};
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for _ in 0..2 {
                let (mut c, _) = l.accept().unwrap();
                let mut b = [0u8; 1024];
                let _ = c.read(&mut b);
                let _ = c.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}");
            }
        });
        let c = reqwest::Client::new();
        let _g = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
        let before = report();
        exec(&c, c.get(format!("http://127.0.0.1:{port}/mmr/v1/players/0d2e5b3a-1111-2222-3333-444455556666"))).await.unwrap();
        exec(&c, c.delete(format!("http://127.0.0.1:{port}/x"))).await.unwrap();
        let after = report();
        assert_eq!(after.total - before.total, 2);
        assert_eq!(after.reads - before.reads, 1);
        assert_eq!(after.writes - before.writes, 1);
        let e = after.entries.iter().find(|e| e.path.contains("0d2e…66")).unwrap();
        assert_eq!(e.what, "Rank bilgisi");
        assert_eq!(e.target, "local");
        assert_eq!(e.status, 200);
    }
}
