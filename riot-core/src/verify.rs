//! "Bu kurulumu doğrula": çalışan uygulama dosyasının SHA256 parmak izini, GitHub'ın bu sürüm için
//! yayınladığı SHA256SUMS.txt ile karşılaştırır. Dosya GitHub'da açık koddan derlenmişse değerler aynıdır.

use crate::netlog;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallCheck {
    /// "ok": GitHub'daki parmak iziyle birebir aynı · "mismatch": değil · "unavailable": bu sürüm için liste yok.
    pub status: String,
    /// Çalışan dosyanın parmak izi (büyük harf).
    pub own: String,
    /// Eşleşen satırdaki dosya adı (varsa).
    pub matched: Option<String>,
    pub url: String,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02X}")).collect()
}

/// SHA256SUMS.txt satırları: "<HASH>  <dosya adı>".
pub fn parse_sums(text: &str) -> Vec<(String, String)> {
    text.lines()
        .filter_map(|l| {
            let mut it = l.trim().splitn(2, char::is_whitespace);
            let h = it.next()?.trim().to_uppercase();
            let name = it.next().unwrap_or("").trim().to_string();
            (h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit())).then_some((h, name))
        })
        .collect()
}

pub async fn check_install(repo: &str, version: &str) -> Result<InstallCheck, String> {
    let exe = std::env::current_exe().map_err(|e| format!("Uygulama dosyası bulunamadı: {e}"))?;
    let bytes = std::fs::read(&exe).map_err(|e| format!("Uygulama dosyası okunamadı: {e}"))?;
    let own = sha256_hex(&bytes);
    let url = format!("https://github.com/{repo}/releases/download/v{version}/SHA256SUMS.txt");
    let http = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
    let res = netlog::exec(&http, http.get(&url)).await.map_err(|_| "GitHub'a bağlanılamadı. İnternet bağlantını kontrol et.".to_string())?;
    if res.status().as_u16() == 404 {
        return Ok(InstallCheck { status: "unavailable".into(), own, matched: None, url });
    }
    if !res.status().is_success() {
        return Err(format!("GitHub yanıt vermedi (HTTP {}).", res.status().as_u16()));
    }
    let text = res.text().await.map_err(|e| e.to_string())?;
    let matched = parse_sums(&text).into_iter().find(|(h, _)| *h == own).map(|(_, n)| n);
    Ok(InstallCheck { status: if matched.is_some() { "ok" } else { "mismatch" }.into(), own, matched, url })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_parse_and_hash() {
        assert_eq!(sha256_hex(b"test\n"), "F2CA1BB6C7E907D06DAFE4687E579FCE76B37E4E93B7605022DA52E6CCC26FD2");
        let list = parse_sums("f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2  Celeste.Overlay_0.7.1_x64-setup.exe\nbozuk satır\n\n");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].1, "Celeste.Overlay_0.7.1_x64-setup.exe");
        assert!(list[0].0.starts_with("F2CA"));
    }
}
