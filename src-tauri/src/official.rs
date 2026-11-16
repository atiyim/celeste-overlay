//! Resmi derleme imzası (ayrıntı: riot_core::official). Anahtar yalnızca resmi derlemede bulunur.
use riot_core::official::{sign, signable};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

include!(concat!(env!("OUT_DIR"), "/build_key.rs"));

fn key() -> Option<[u8; 32]> {
    PARTS.map(|(a, mask)| {
        let mut k = [0u8; 32];
        for i in 0..32 {
            k[i] = a[31 - i] ^ mask[i];
        }
        k
    })
}

/// Bu derleme resmi mi? (Kaynak koddan derlenen kopyalarda false: lisans ekranı gösterilir.)
#[tauri::command]
pub fn build_official() -> bool {
    PARTS.is_some()
}

/// Celeste sunucusuna giden isteği imzalar: "<zaman>.<imza>". Resmi olmayan derlemede ya da geçersiz istekte None.
#[tauri::command]
pub fn sign_request(app: AppHandle, method: String, path_query: String, body_hash: String) -> Option<String> {
    let key = key()?;
    if !signable(&method, &path_query, &body_hash) {
        return None;
    }
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    let version = app.package_info().version.to_string();
    Some(format!("{ts}.{}", sign(&key, ts, &version, &method, &path_query, &body_hash)))
}
