mod discord;
mod obs;
mod official;
use riot_core::netlog::{self, NetReport};
use riot_core::{Account, Engine, HealthEntry, MatchReport, MyStats, PremierTeam, Snapshot, Store};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State, WebviewWindow,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

struct AppState {
    engine: Arc<Engine>,
}

#[tauri::command]
async fn get_snapshot(state: State<'_, AppState>) -> Result<Snapshot, String> {
    Ok(state.engine.snapshot().await)
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
async fn get_health(state: State<'_, AppState>) -> Result<Vec<HealthEntry>, String> {
    Ok(state.engine.health().await)
}

#[tauri::command]
async fn get_diagnostics(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.engine.diagnostics().await)
}

#[tauri::command]
async fn get_match_report(state: State<'_, AppState>, match_id: String) -> Result<MatchReport, String> {
    state.engine.match_report(&match_id).await
}

#[tauri::command]
async fn get_premier(state: State<'_, AppState>, puuid: String) -> Result<Option<PremierTeam>, String> {
    state.engine.premier(&puuid).await
}

#[tauri::command]
async fn deepen_player(state: State<'_, AppState>, puuid: String) -> Result<(), String> {
    state.engine.deepen(&puuid).await;
    Ok(())
}

#[tauri::command]
async fn get_riot_id(state: State<'_, AppState>) -> Result<String, String> {
    state.engine.my_riot_id().await
}

#[tauri::command]
async fn get_my_puuid(state: State<'_, AppState>) -> Result<String, String> {
    state.engine.my_puuid().await
}

#[tauri::command]
async fn get_id_token(state: State<'_, AppState>) -> Result<String, String> {
    state.engine.my_id_token().await
}

#[tauri::command]
async fn get_my_stats(state: State<'_, AppState>) -> Result<MyStats, String> {
    state.engine.my_stats().await
}

#[tauri::command]
fn get_net_report() -> NetReport {
    netlog::report()
}

/// "Bu kurulumu doğrula": çalışan dosyanın parmak izini GitHub'daki bu sürümün listesiyle karşılaştırır.
#[tauri::command]
async fn verify_install(app: AppHandle) -> Result<riot_core::verify::InstallCheck, String> {
    let version = app.package_info().version.to_string();
    // Yayın kanalı: geliştirme (tauri dev), Actions deneme derlemesi ya da yayınlanmış sürüm.
    let channel = if cfg!(debug_assertions) { "dev" } else { option_env!("CELESTE_CHANNEL").unwrap_or("release") };
    riot_core::verify::check_install("atiyim/celeste-overlay", &version, channel).await
}

/// OBS tarayıcı kaynağını açar/kapatır; adresi döner.
/// Discord kartı: arayüzün hazırladığı etkinlik (`None`: kaldır).
#[tauri::command]
fn discord_set(activity: Option<serde_json::Value>, enabled: Option<bool>) {
    discord::set(activity, enabled.unwrap_or(true));
}

/// Discord kartının durumu: (bağlı mı, Discord'un son hata mesajı).
#[tauri::command]
fn discord_status() -> (bool, Option<String>) {
    discord::status()
}

/// Kendi Valorant durumun (skor, sıra, parti): Discord kartı için.
#[tauri::command]
async fn get_presence(state: State<'_, AppState>) -> Result<Option<serde_json::Value>, String> {
    Ok(state.engine.my_presence().await)
}

#[tauri::command]
fn obs_set(enabled: bool) -> Result<String, String> {
    obs::set(enabled)
}

/// OBS sayfasının göstereceği son durum (rank, RR, bu seans).
#[tauri::command]
fn obs_push(data: serde_json::Value) {
    obs::push(data.to_string());
}

/// Maç kartı: PNG baytları ham gövde olarak gelir, panoya resim olarak kopyalanır.
#[tauri::command]
fn card_copy(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    let tauri::ipc::InvokeBody::Raw(png) = request.body() else { return Err("Görsel gelmedi.".into()) };
    let img = tauri::image::Image::from_bytes(png).map_err(|e| e.to_string())?;
    app.clipboard().write_image(&img).map_err(|e| e.to_string())
}

/// Maç kartı: Resimler/Celeste Overlay klasörüne kaydeder ve klasörde gösterir. Dosya yolunu döner.
#[tauri::command]
fn card_save(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;
    let tauri::ipc::InvokeBody::Raw(png) = request.body() else { return Err("Görsel gelmedi.".into()) };
    if png.len() < 8 || &png[1..4] != b"PNG" {
        return Err("Geçersiz görsel.".into());
    }
    let dir = app.path().picture_dir().map_err(|e| e.to_string())?.join("Celeste Overlay");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name: String = request
        .headers()
        .get("x-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("mac-karti")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(60)
        .collect();
    let name = if name.is_empty() { "mac-karti".to_string() } else { name };
    let path = dir.join(format!("{name}.png"));
    std::fs::write(&path, png).map_err(|e| e.to_string())?;
    let _ = app.opener().reveal_item_in_dir(&path);
    Ok(path.display().to_string())
}

/// Göster/gizle kısayolu (varsayılan F2). Ayarlardan değiştirilebilir.
static HOTKEY: Mutex<Option<Shortcut>> = Mutex::new(None);
/// Ayarlarda yeni tuş seçilirken kısayol geçici olarak bırakılır; otomatik yeniden kayıt da durur.
static CAPTURING: AtomicBool = AtomicBool::new(false);

fn current_hotkey() -> Option<Shortcut> {
    HOTKEY.lock().ok().and_then(|g| g.clone())
}

/// Kısayol şu an bu uygulamaya kayıtlı mı? (Başka bir program tutuyorsa false.)
#[tauri::command]
fn hotkey_ok(app: AppHandle) -> bool {
    current_hotkey().map(|k| app.global_shortcut().is_registered(k)).unwrap_or(false)
}

/// Yeni göster/gizle tuşunu kaydeder ("F2", "Control+Shift+F6"). Başarısızsa eski tuş çalışmaya devam eder.
#[tauri::command]
fn set_hotkey(app: AppHandle, accel: String) -> Result<(), String> {
    let new: Shortcut = accel.parse().map_err(|_| "Bu tuş desteklenmiyor".to_string())?;
    let gs = app.global_shortcut();
    let mut cur = HOTKEY.lock().map_err(|_| "Kısayol ayarlanamadı".to_string())?;
    let same = cur.as_ref().map(|c| c.id() == new.id()).unwrap_or(false);
    if !gs.is_registered(new.clone()) {
        gs.register(new.clone()).map_err(|_| "Bu tuşu başka bir program kullanıyor".to_string())?;
    }
    if !same {
        if let Some(old) = cur.take() {
            let _ = gs.unregister(old);
        }
    }
    *cur = Some(new);
    Ok(())
}

/// Tuş seçerken: mevcut kısayolu bırakır ki seçilen tuş arayüze ulaşsın; bitince geri alır.
#[tauri::command]
fn hotkey_capture(app: AppHandle, on: bool) {
    CAPTURING.store(on, Ordering::SeqCst);
    if let Some(k) = current_hotkey() {
        let gs = app.global_shortcut();
        if on {
            let _ = gs.unregister(k);
        } else if !gs.is_registered(k.clone()) {
            let _ = gs.register(k);
        }
    }
}

/// Arayüzün kendi attığı istekleri (sözlük dosyaları, güncelleme denetimi) günlüğe ekler.
#[tauri::command]
fn net_note(method: String, url: String, status: u16, ms: u32) {
    netlog::note(&method, &url, status, ms);
}

/// Overlay'i öne getirir, odağı alır (oyun fare/klavye girdisini görmez) ve tıklanabilir yapar.
fn show_interactive(w: &WebviewWindow) {
    // Otomatik gizlemeden kalan minik (2×2) pencereyi, arayüzün olayı gelmese bile geri büyüt.
    if w.outer_size().map(|s| s.width < 80).unwrap_or(false) {
        let _ = w.set_size(LogicalSize::new(900.0, 600.0));
    }
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_always_on_top(true);
    let _ = w.set_ignore_cursor_events(false);
    let _ = w.set_focus();
    let _ = w.emit("overlay-activated", ());
}

/// F2 ve tepsi simgesi aynı işi yapar: görünürse tamamen gizle (tepsiye), değilse öne al.
/// Tuşa basılı tutulunca Windows tekrarlayan bildirim yollar; hızlı art arda gelen basışları yok sayar.
static LAST_TOGGLE: AtomicU64 = AtomicU64::new(0);

fn toggle_overlay(app: &AppHandle) {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    let prev = LAST_TOGGLE.swap(now, Ordering::SeqCst);
    if now.saturating_sub(prev) < 250 {
        return;
    }
    let Some(w) = app.get_webview_window("main") else { return };
    // Otomatik gizlemede pencere minik bir noktaya iner: bu durumda F2 "göster" demektir.
    let tiny = w.outer_size().map(|s| s.width < 80).unwrap_or(false);
    let showing = w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false) && !tiny;
    if showing {
        let _ = w.hide();
    } else {
        show_interactive(&w);
    }
}

fn reset_position(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_position(PhysicalPosition::new(40, 40));
        show_interactive(&w);
    }
}

pub fn run() {
    let f2 = Shortcut::new(None, Code::F2);
    if let Ok(mut g) = HOTKEY.lock() {
        *g = Some(f2.clone());
    }

    tauri::Builder::default()
        // Tek kopya: uygulama zaten açıkken tekrar açılırsa yeni kopya başlamaz, açık olan öne gelir.
        // (Overlay maçta gizlendiğinde "kapandı" sanılıp defalarca açılmasın.)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                show_interactive(&w);
                let _ = w.emit("second-instance", ());
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    let mine = current_hotkey().map(|k| k.id() == shortcut.id()).unwrap_or(false);
                    if mine && event.state() == ShortcutState::Pressed {
                        toggle_overlay(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState { engine: Arc::new(Engine::new()) })
        .invoke_handler(tauri::generate_handler![get_snapshot, get_store, get_account, get_health, get_diagnostics, get_my_stats, get_match_report, get_premier, deepen_player, get_net_report, net_note, hotkey_ok, set_hotkey, hotkey_capture, official::build_official, official::sign_request, get_riot_id, get_my_puuid, get_id_token, verify_install, obs_set, obs_push, card_copy, card_save, discord_set, discord_status, get_presence])
        .setup(move |app| {
            // F2 başka bir uygulamada kayıtlıysa uygulama yine açılır, tepsi simgesi çalışmaya devam eder.
            if let Err(e) = app.global_shortcut().register(f2) {
                eprintln!("F2 kısayolu kaydedilemedi: {e}");
            }
            // Kayıt başarısız olduysa (başka uygulama tutuyor, açılış zamanlaması) veya sonradan düştüyse sessizce yeniden dener.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(4));
                if CAPTURING.load(Ordering::SeqCst) {
                    continue;
                }
                if let Some(key) = current_hotkey() {
                    if !handle.global_shortcut().is_registered(key.clone()) {
                        let _ = handle.global_shortcut().register(key);
                    }
                }
            });

            let toggle_item = MenuItem::with_id(app, "toggle", "Göster / Gizle", true, None::<&str>)?;
            let reset_item = MenuItem::with_id(app, "reset", "Konumu sıfırla", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &reset_item, &quit_item])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("Celeste Overlay")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_overlay(app),
                    "reset" => reset_position(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        toggle_overlay(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("uygulama başlatılamadı");
}
