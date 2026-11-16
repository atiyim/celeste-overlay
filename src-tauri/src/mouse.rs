//! Fare yan tuşları (Geri / İleri) ve orta tuş için genel dinleme.
//! Yalnızca bir tuş atandığında (ya da atama sırasında) kurulur. Sol/sağ tık, imleç konumu ve tuş vuruşları okunmaz;
//! tık oyuna olduğu gibi geçer. Windows dışında bir şey yapmaz.
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

static ACTIVE: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
static STARTED: AtomicBool = AtomicBool::new(false);

/// Dinlemeyi açar/kapatır. Kanca ilk açılışta kurulur, kapalıyken olayları yok sayar.
#[tauri::command]
pub fn mouse_listen(app: AppHandle, on: bool) {
    ACTIVE.store(on, Ordering::SeqCst);
    #[cfg(windows)]
    if on && !STARTED.swap(true, Ordering::SeqCst) {
        win::start(app);
    }
    #[cfg(not(windows))]
    let _ = app;
}

#[cfg(windows)]
mod win {
    use super::ACTIVE;
    use std::sync::atomic::Ordering;
    use std::sync::OnceLock;
    use tauri::{AppHandle, Emitter};
    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, SetWindowsHookExW, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL,
    };

    static APP: OnceLock<AppHandle> = OnceLock::new();
    const WM_MBUTTONDOWN: usize = 0x0207;
    const WM_XBUTTONDOWN: usize = 0x020B;

    unsafe extern "system" fn proc(code: i32, w: WPARAM, l: LPARAM) -> LRESULT {
        if code >= 0 && ACTIVE.load(Ordering::Relaxed) {
            let name = match w {
                WM_MBUTTONDOWN => Some("middle"),
                WM_XBUTTONDOWN => {
                    let info = &*(l as *const MSLLHOOKSTRUCT);
                    match (info.mouseData >> 16) & 0xffff {
                        1 => Some("x1"),
                        2 => Some("x2"),
                        _ => None,
                    }
                }
                _ => None,
            };
            if let (Some(n), Some(app)) = (name, APP.get()) {
                let _ = app.emit("mouse-btn", n);
            }
        }
        CallNextHookEx(0, code, w, l)
    }

    pub fn start(app: AppHandle) {
        let _ = APP.set(app);
        std::thread::spawn(|| unsafe {
            if SetWindowsHookExW(WH_MOUSE_LL, Some(proc), 0, 0) == 0 {
                return;
            }
            // Düşük seviyeli kanca, kurulduğu iş parçacığında ileti döngüsü ister.
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, 0, 0, 0) > 0 {}
        });
    }
}
