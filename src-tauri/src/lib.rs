use riot_core::netlog::{self, NetReport};
use riot_core::{Account, Engine, HealthEntry, MatchReport, MyStats, PremierTeam, Snapshot, Store};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
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
async fn get_my_stats(state: State<'_, AppState>) -> Result<MyStats, String> {
    state.engine.my_stats().await
}

#[tauri::command]
fn get_net_report() -> NetReport {
    netlog::report()
}

/// F2 kısayolu şu an bu uygulamaya kayıtlı mı? (Başka bir program tutuyorsa false.)
#[tauri::command]
fn hotkey_ok(app: AppHandle) -> bool {
    app.global_shortcut().is_registered(Shortcut::new(None, Code::F2))
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
    let f2_id = f2.id();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut.id() == f2_id && event.state() == ShortcutState::Pressed {
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
        .invoke_handler(tauri::generate_handler![get_snapshot, get_store, get_account, get_health, get_diagnostics, get_my_stats, get_match_report, get_premier, deepen_player, get_net_report, net_note, hotkey_ok, get_riot_id])
        .setup(move |app| {
            // F2 başka bir uygulamada kayıtlıysa uygulama yine açılır, tepsi simgesi çalışmaya devam eder.
            if let Err(e) = app.global_shortcut().register(f2) {
                eprintln!("F2 kısayolu kaydedilemedi: {e}");
            }
            // Kayıt başarısız olduysa (başka uygulama tutuyor, açılış zamanlaması) veya sonradan düştüyse sessizce yeniden dener.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(4));
                let key = Shortcut::new(None, Code::F2);
                if !handle.global_shortcut().is_registered(key) {
                    let _ = handle.global_shortcut().register(key);
                }
            });

            let toggle_item = MenuItem::with_id(app, "toggle", "Göster / Gizle (F2)", true, None::<&str>)?;
            let reset_item = MenuItem::with_id(app, "reset", "Konumu sıfırla", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &reset_item, &quit_item])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("Celeste Overlay (F2: göster/gizle)")
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
