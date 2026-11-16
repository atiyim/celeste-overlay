use std::{env, fs, path::Path, time::SystemTime};

include!("../riot-core/src/hmac.rs");

/// Resmi derleme anahtarı: `CELESTE_BUILD_MASTER` (yalnızca GitHub Actions gizlisi) varsa bu sürüme özel anahtar türetilir
/// ve maskelenmiş iki parça olarak koda yazılır. Ana anahtar uygulamaya girmez. Değişken yoksa (kaynak koddan derleme)
/// anahtar da yoktur: uygulama "resmi olmayan derleme" olarak çalışır ve Celeste sunucularına bağlanamaz.
fn build_key() {
    println!("cargo:rerun-if-env-changed=CELESTE_BUILD_MASTER");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    let out = Path::new(&env::var("OUT_DIR").expect("OUT_DIR")).join("build_key.rs");
    let master = env::var("CELESTE_BUILD_MASTER").unwrap_or_default();
    let code = if master.trim().is_empty() {
        "pub(crate) const PARTS: Option<([u8; 32], [u8; 32])> = None;\n".to_string()
    } else {
        let conf: serde_json::Value = serde_json::from_str(&fs::read_to_string("tauri.conf.json").expect("tauri.conf.json")).expect("tauri.conf.json geçersiz");
        let version = conf["version"].as_str().expect("tauri.conf.json: version");
        let key = hmac_sha256(master.trim().as_bytes(), format!("celeste-build|{version}").as_bytes());
        let nanos = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        let mask = hmac_sha256(format!("{nanos}").as_bytes(), master.as_bytes());
        let mut a = [0u8; 32];
        for i in 0..32 {
            a[31 - i] = key[i] ^ mask[i];
        }
        format!("pub(crate) const PARTS: Option<([u8; 32], [u8; 32])> = Some(({a:?}, {mask:?}));\n")
    };
    fs::write(out, code).expect("build_key.rs yazılamadı");
}

fn main() {
    build_key();
    tauri_build::build()
}
