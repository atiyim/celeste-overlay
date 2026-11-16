//! Resmi derleme imzası.
//!
//! Celeste'nin sunucuları (Akış, roller, Premium, hesap bağlama, sayım, form) yalnızca resmi derlemelere hizmet verir
//! (LICENSE, madde 4). Resmi derleme her isteği imzalar; sunucu imzayı doğrular.
//!
//! - Ana anahtar yalnızca GitHub Actions gizlisinde ve sunucuda durur; uygulamaya girmez.
//! - Derleme sırasında ana anahtardan o sürüme özel bir anahtar türetilir: `HMAC(ana, "celeste-build|<sürüm>")`.
//!   Uygulamada yalnızca bu sürüm anahtarı bulunur; en düşük sürüm yükseltildiğinde eski sürümlerin anahtarı işe yaramaz.
//! - İmza isteğe bağlıdır: `HMAC(sürüm anahtarı, "<zaman>|<sürüm>|<METOT>|<yol+sorgu>|<gövde sha256>")`.
//!   Ele geçen bir imza başka bir istekte kullanılamaz.
//!
//! Kaynak koddan derlenen kopyalarda anahtar yoktur; imza üretilmez ve sunucu isteği geri çevirir.

include!("hmac.rs");

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Sürüme özel anahtar (derleme sırasında ve testlerde kullanılır).
pub fn version_key(master: &str, version: &str) -> [u8; 32] {
    hmac_sha256(master.trim().as_bytes(), format!("celeste-build|{version}").as_bytes())
}

/// İsteğin imzası (hex). `path_query`: "/api/feed/posts?v=0.8.2" gibi, `b` parametresi olmadan.
pub fn sign(key: &[u8; 32], ts: u64, version: &str, method: &str, path_query: &str, body_hash: &str) -> String {
    hex(&hmac_sha256(key, format!("{ts}|{version}|{method}|{path_query}|{body_hash}").as_bytes()))
}

/// İmzalanabilir istek mi? Yalnızca Celeste API yolları, bilinen metotlar ve 64 haneli gövde özeti kabul edilir.
pub fn signable(method: &str, path_query: &str, body_hash: &str) -> bool {
    matches!(method, "GET" | "POST")
        && path_query.starts_with("/api/")
        && path_query.len() <= 2048
        && body_hash.len() == 64
        && body_hash.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_matches_rfc_4231() {
        // RFC 4231, test 2
        let mac = hmac_sha256(b"Jefe", b"what do ya want for nothing?");
        assert_eq!(hex(&mac), "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    }

    #[test]
    fn signature_matches_server() {
        // Aynı vektör sunucu testinde de var (celeste/tests/build-check.test.ts).
        let key = version_key("test-ana-anahtar", "0.8.2");
        assert_eq!(hex(&key), "b37d5637920e7e2e4e336bab24552568b28e3ff469fe8eb9d9a1815ef368ab1d");
        let empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assert_eq!(sign(&key, 1_800_000_000, "0.8.2", "GET", "/api/feed/posts?tab=new&v=0.8.2", empty), "467de18e93983980bdf5cbf1ecf90f350de4259385dbf995df70006381295d1e");
    }

    #[test]
    fn only_api_requests_are_signable() {
        let h = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assert!(signable("POST", "/api/feed/login?v=0.8.2", h));
        assert!(!signable("DELETE", "/api/feed/login", h));
        assert!(!signable("GET", "/auth/login", h));
        assert!(!signable("GET", "/api/feed", "abc"));
    }
}
