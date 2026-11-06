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
    window.clear_all_browsing_data().map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginState {
    session: bool,
    pending: bool,
    last: Option<LoginResult>,
}

#[tauri::command]
fn login_state(state: State<'_, AppState>) -> LoginState {
    LoginState {
        session: state.engine.has_remote(),
        pending: state.pending.load(std::sync::atomic::Ordering::SeqCst),
        last: state.last.lock().unwrap().clone(),
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
        .manage(AppState { engine: engine.clone(), home: Mutex::new(None), last: Mutex::new(None), pending: Default::default() })
        .invoke_handler(tauri::generate_handler![riot_login, riot_logout, login_state, get_snapshot, get_my_stats, get_store, get_account, deepen_player])
        .setup(move |app| {
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
                                (Some(a), Some(i)) => match engine.login_remote(&a, &i).await {
                                    Ok((riot, puuid)) => LoginResult { ok: true, riot: Some(riot), puuid: Some(puuid), error: None, id_token: Some(i) },
                                    Err(e) => LoginResult { ok: false, riot: None, puuid: None, error: Some(e), id_token: None },
                                },
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
