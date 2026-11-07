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

/// Geri tuşu ana ekrandayken: uygulamayı kapatmak yerine arka plana al (diğer uygulamalar gibi).
/// Kapatmak (Activity'nin bitmesi) uygulama sürecini sonlandırırken çöküyordu.
#[tauri::command]
fn minimize(window: tauri::WebviewWindow) {
    #[cfg(target_os = "android")]
    let _ = window.with_webview(|w| {
        w.jni_handle().exec(|env, activity, _| {
            if env.call_method(activity, "moveTaskToBack", "(Z)Z", &[jni::objects::JValue::Bool(1)]).is_err() {
                let _ = env.exception_clear();
            }
        });
    });
    #[cfg(not(target_os = "android"))]
    let _ = window;
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

/// Çıkış: bellekteki belirteçler ve Riot'un bu telefondaki oturum çerezleri silinir.
/// (Önceki yol tarayıcı önbelleğini ve geçmişini siliyordu; çerezleri silmiyordu ve hesap değiştirirken
/// uygulamayı kapatıyordu. Artık yalnızca çerezler, Android'in kendi çerez yöneticisiyle silinir.)
#[tauri::command]
async fn riot_logout(window: tauri::WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.logout_remote().await;
    *state.last.lock().unwrap() = None;
    state.expires.store(0, Ordering::SeqCst);
    clear_cookies(&window);
    Ok(())
}

#[cfg(target_os = "android")]
fn clear_cookies(window: &tauri::WebviewWindow) {
    use jni::objects::{JObject, JValue};
    let _ = window.with_webview(|w| {
        w.jni_handle().exec(|env, _activity, _webview| {
            let ok = (|| -> jni::errors::Result<()> {
                let cm = env.call_static_method("android/webkit/CookieManager", "getInstance", "()Landroid/webkit/CookieManager;", &[])?.l()?;
                env.call_method(&cm, "removeAllCookies", "(Landroid/webkit/ValueCallback;)V", &[JValue::Object(&JObject::null())])?;
                env.call_method(&cm, "flush", "()V", &[])?;
                Ok(())
            })();
            if ok.is_err() {
                let _ = env.exception_clear();
            }
        });
    });
}

#[cfg(not(target_os = "android"))]
fn clear_cookies(window: &tauri::WebviewWindow) {
    let _ = window.clear_all_browsing_data();
}

/// Kullanım sayımı için platform: x86_64 APK'sı BlueStacks gibi bilgisayar emülatörleri içindir.
#[tauri::command]
fn platform() -> &'static str {
    if cfg!(target_arch = "x86_64") { "emulator" } else { "android" }
}

/// Yalnızca emülatör testindeki derlemede açık: arayüz hesap değiştirme adımlarını kendisi dener.
#[tauri::command]
fn selftest() -> bool {
    cfg!(feature = "selftest")
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
async fn get_owned(state: State<'_, AppState>, kind: String) -> Result<serde_json::Value, String> {
    state.engine.owned(&kind).await
}

#[tauri::command]
async fn get_contracts(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.engine.contracts().await
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
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { engine: engine.clone(), home: Mutex::new(None), last: Mutex::new(None), pending: Default::default(), expires: AtomicU64::new(0) })
        .invoke_handler(tauri::generate_handler![riot_login, riot_logout, last_crash, minimize, selftest, platform, login_state, get_snapshot, get_my_stats, get_store, get_account, get_owned, get_contracts, deepen_player])
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
        .build(tauri::generate_context!())
        .expect("Celeste başlatılamadı")
        .run(|_app, event| {
            // Android'de ekran kapanınca (geri tuşu vb.) uygulama süreci sonlandırılmaya çalışılır; bu sırada
            // grafik sürücüsü çöküyordu ("uygulama sürekli duruyor"). Süreç açık kalır, Android gerektiğinde kendisi kapatır.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                // Android: ekran (Activity) kapanınca süreç normal yoldan sonlandırılırsa grafik sürücüsü çöküyor;
                // süreci açık bırakınca da bir sonraki açılışta ekran beyaz kalıyor (WebView yeniden kurulmuyor).
                // Çözüm: süreci, Android'in arka plandaki uygulamaları kapattığı yolla (SIGKILL) hemen bitirmek.
                // Böylece çökme olmaz, bir sonraki açılış da her zaman temiz başlar.
                #[cfg(target_os = "android")]
                unsafe {
                    libc::kill(libc::getpid(), libc::SIGKILL);
                }
                #[cfg(not(target_os = "android"))]
                let _ = &api;
                #[cfg(target_os = "android")]
                api.prevent_exit();
            }
        });
}
