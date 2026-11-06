//! Celeste Overlay — Android.
//!
//! Bilgisayardaki uygulamadan farkı yalnızca oturum: Riot Client yerine Riot'un kendi giriş sayfası
//! (auth.riotgames.com) uygulamanın içinde açılır. Şifre o sayfaya, Riot'a yazılır; uygulama görmez.
//! Giriş bitince Riot, sayfayı playvalorant.com/opt_in adresine belirteçlerle yönlendirir; bu yönlendirme
//! burada yakalanır, sayfa açılmadan uygulamaya geri dönülür. Belirteçler yalnızca bu telefonda, bellekte
//! kalır; Celeste'nin sunucusuna gitmez. Riot'un oturum çerezi telefonun tarayıcı deposunda durur
//! (yeniden girişte şifre sorulmaması için), "Çıkış yap" ile silinir.
//! Uygulama yalnızca okur: oyunda hiçbir işlem yapmaz (ajan kilitlemek, satın almak gibi).

use riot_core::{Account, Engine, MyStats, Snapshot, Store};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State, Url, WebviewUrl, WebviewWindowBuilder};

/// Riot'un web girişi (playvalorant.com'un kullandığı istemci). İstenen: erişim + kimlik belirteci.
const AUTH_URL: &str = "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

struct AppState {
    engine: Arc<Engine>,
    /// Giriş sayfasına gitmeden önceki uygulama adresi (geri dönmek için).
    home: Mutex<Option<Url>>,
    /// Son giriş sonucu: sayfa uygulamaya dönerken yeniden yüklenir, olayı kaçırabilir; buradan okur.
    last: Mutex<Option<LoginResult>>,
    /// Belirteçler alındı, oturum açılıyor.
    pending: std::sync::atomic::AtomicBool,
    /// Erişim belirtecinin bitişi (Unix saniye). Riot'ta yaklaşık 1 saat.
    expires: AtomicU64,
}

/// Belirteçlerle oturum aç; sonuç her iki giriş yolunda (sayfa ya da sessiz yenileme) aynı.
async fn open_session(engine: &Engine, st: &AppState, access: &str, id_token: &str) -> LoginResult {
    match engine.login_remote(access, id_token).await {
        Ok((riot, puuid)) => {
            st.expires.store(riot_core::jwt_exp(access).unwrap_or(0), Ordering::SeqCst);
            LoginResult { ok: true, riot: Some(riot), puuid: Some(puuid), error: None, id_token: Some(id_token.to_string()) }
        }
        Err(e) => LoginResult { ok: false, riot: None, puuid: None, error: Some(e), id_token: None },
    }
}

async fn tokio_timeout<T>(f: impl std::future::Future<Output = T>) -> Option<T> {
    tokio::time::timeout(std::time::Duration::from_secs(12), f).await.ok()
}

/// Son çökmenin kaydı: bir sonraki açılışta uygulamada gösterilir (hatayı bulmak için).
static CRASH_FILE: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

#[tauri::command]
fn last_crash() -> Option<String> {
    let p = CRASH_FILE.get()?;
    let t = std::fs::read_to_string(p).ok()?;
    let _ = std::fs::remove_file(p);
    Some(t)
}

/// Sessiz yenileme: Riot'un bu telefondaki oturum çereziyle giriş adresine sorulur; Riot şifre sormadan
/// yeni belirteçlerle yönlendirir. Sayfa değişmez, ekran yenilenmez. Çerez yoksa ya da Riot şifre isterse
/// "login" döner; o zaman uygulama giriş sayfasını açar.
#[tauri::command]
async fn refresh_session(window: tauri::WebviewWindow, state: State<'_, AppState>) -> Result<LoginResult, String> {
    let url = Url::parse("https://auth.riotgames.com/").map_err(|e| e.to_string())?;
    // Çerez okuma ana iş parçacığını bekler: ayrı iş parçacığında ve süre sınırıyla.
    let w = window.clone();
    let cookies = tokio_timeout(tauri::async_runtime::spawn_blocking(move || w.cookies_for_url(url)))
        .await
        .ok_or("login")?
        .map_err(|_| "login".to_string())?
        .map_err(|_| "login".to_string())?;
    if cookies.is_empty() {
        return Err("login".into());
    }
    let header = cookies.iter().map(|c| format!("{}={}", c.name(), c.value())).collect::<Vec<_>>().join("; ");
    let http = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let r = http
        .get(AUTH_URL)
        .header("Cookie", header)
        .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")
        .send()
        .await
        .map_err(|_| "net".to_string())?;
    let loc = r.headers().get("location").and_then(|v| v.to_str().ok()).and_then(|v| Url::parse(v).ok()).ok_or("login")?;
    let (Some(a), Some(i)) = (frag(&loc, "access_token"), frag(&loc, "id_token")) else { return Err("login".into()) };
    let res = open_session(&state.engine, &state, &a, &i).await;
    *state.last.lock().unwrap() = Some(res.clone());
    if res.ok { Ok(res) } else { Err(res.error.unwrap_or_default()) }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LoginResult {
    ok: bool,
    riot: Option<String>,
    puuid: Option<String>,
    error: Option<String>,
    /// Kimlik belirteci: yalnızca Akış'a giriş için (uygulama içinde kalır).
    id_token: Option<String>,
}

/// URL parçasından (#a=b&c=d) bir değer.
fn frag(url: &Url, key: &str) -> Option<String> {
    url.fragment()?.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=')?;
        (k == key).then(|| v.to_string())
    })
}

fn go_home(app: &tauri::AppHandle) {
    let home = app.state::<AppState>().home.lock().unwrap().clone();
    if let (Some(w), Some(u)) = (app.get_webview_window("main"), home) {
        let _ = w.navigate(u);
    }
}

/// Giriş sayfasını aç. Riot'ta oturum hâlâ açıksa (çerez) sayfa anında geri yönlenir; şifre sorulmaz.
#[tauri::command]
fn riot_login(window: tauri::WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(u) = window.url() {
        if u.host_str() != Some("auth.riotgames.com") {
            *state.home.lock().unwrap() = Some(u);
        }
    }
    window.navigate(Url::parse(AUTH_URL).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Çıkış: bellekteki belirteçler ve bu uygulamanın tarayıcı deposu (Riot'un oturum çerezi dahil) silinir.
#[tauri::command]
async fn riot_logout(window: tauri::WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.logout_remote().await;
    *state.last.lock().unwrap() = None;
    state.expires.store(0, Ordering::SeqCst);
    window.clear_all_browsing_data().map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginState {
    session: bool,
    pending: bool,
    last: Option<LoginResult>,
    /// Oturumun bitişi (Unix saniye); 0 = bilinmiyor.
    expires: u64,
}

#[tauri::command]
fn login_state(state: State<'_, AppState>) -> LoginState {
    LoginState {
        session: state.engine.has_remote(),
        pending: state.pending.load(std::sync::atomic::Ordering::SeqCst),
        last: state.last.lock().unwrap().clone(),
        expires: state.expires.load(Ordering::SeqCst),
    }
}

#[tauri::command]
async fn get_snapshot(state: State<'_, AppState>) -> Result<Snapshot, String> {
    Ok(state.engine.snapshot().await)
}

#[tauri::command]
async fn get_my_stats(state: State<'_, AppState>) -> Result<MyStats, String> {
    state.engine.my_stats().await
}

#[tauri::command]
async fn get_store(state: State<'_, AppState>) -> Result<Store, String> {
    state.engine.store().await
}

#[tauri::command]
async fn get_account(state: State<'_, AppState>) -> Result<Account, String> {
    state.engine.account().await
}

#[tauri::command]
async fn deepen_player(state: State<'_, AppState>, puuid: String) -> Result<(), String> {
    state.engine.deepen(&puuid).await;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine = Arc::new(Engine::new());
    tauri::Builder::default()
        .manage(AppState { engine: engine.clone(), home: Mutex::new(None), last: Mutex::new(None), pending: Default::default(), expires: AtomicU64::new(0) })
        .invoke_handler(tauri::generate_handler![riot_login, riot_logout, refresh_session, last_crash, login_state, get_snapshot, get_my_stats, get_store, get_account, deepen_player])
        .setup(move |app| {
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
                let _ = CRASH_FILE.set(dir.join("last-crash.txt"));
                let prev = std::panic::take_hook();
                std::panic::set_hook(Box::new(move |info| {
                    if let Some(p) = CRASH_FILE.get() {
                        let at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
                        let _ = std::fs::write(p, format!("{at}\n{info}"));
                    }
                    prev(info);
                }));
            }
            let handle = app.handle().clone();
            let engine = engine.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Celeste")
                .on_navigation(move |url| {
                    // Riot girişten sonra buraya yönlendirir: belirteçleri al, sayfayı açma, uygulamaya dön.
                    if url.host_str() == Some("playvalorant.com") {
                        let access = frag(url, "access_token");
                        let id_token = frag(url, "id_token");
                        let (handle, engine) = (handle.clone(), engine.clone());
                        handle.state::<AppState>().pending.store(true, std::sync::atomic::Ordering::SeqCst);
                        tauri::async_runtime::spawn(async move {
                            go_home(&handle);
                            let res = match (access, id_token) {
                                (Some(a), Some(i)) => open_session(&engine, &handle.state::<AppState>(), &a, &i).await,
                                _ => LoginResult { ok: false, riot: None, puuid: None, error: Some("Riot giriş bilgisi vermedi. Tekrar dene.".into()), id_token: None },
                            };
                            let st = handle.state::<AppState>();
                            *st.last.lock().unwrap() = Some(res.clone());
                            st.pending.store(false, std::sync::atomic::Ordering::SeqCst);
                            let _ = handle.emit("riot-login", res);
                        });
                        return false;
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Celeste başlatılamadı");
}
