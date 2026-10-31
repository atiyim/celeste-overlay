//! OBS tarayıcı kaynağı: yalnızca bu bilgisayardan (127.0.0.1) erişilen küçük bir sayfa.
//! Arayüz son durumu `obs_push` ile bırakır; sayfa birkaç saniyede bir `/data` adresinden okur.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

pub const PORT: u16 = 7317;
static RUNNING: AtomicBool = AtomicBool::new(false);
static ENABLED: AtomicBool = AtomicBool::new(false);
fn data() -> &'static Arc<Mutex<String>> {
    static D: OnceLock<Arc<Mutex<String>>> = OnceLock::new();
    D.get_or_init(|| Arc::new(Mutex::new("{}".to_string())))
}

pub fn url() -> String {
    format!("http://127.0.0.1:{PORT}/")
}

pub fn push(json: String) {
    if let Ok(mut d) = data().lock() {
        *d = json;
    }
}

/// Açar ya da kapatır. Sunucu ilk açılışta bir kez başlar; kapalıyken istekler 503 alır.
pub fn set(enabled: bool) -> Result<String, String> {
    ENABLED.store(enabled, Ordering::SeqCst);
    if enabled && !RUNNING.load(Ordering::SeqCst) {
        let listener = TcpListener::bind(("127.0.0.1", PORT)).map_err(|e| format!("{PORT} numaralı port kullanılamıyor: {e}"))?;
        RUNNING.store(true, Ordering::SeqCst);
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let _ = handle(stream);
            }
        });
    }
    Ok(url())
}

fn handle(mut s: TcpStream) -> std::io::Result<()> {
    s.set_read_timeout(Some(Duration::from_secs(2)))?;
    let mut buf = [0u8; 2048];
    let n = s.read(&mut buf)?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let path = req.split_whitespace().nth(1).unwrap_or("/");
    let (status, ctype, body) = if !ENABLED.load(Ordering::SeqCst) {
        ("503 Service Unavailable", "text/plain; charset=utf-8", "OBS kaynağı kapalı. Celeste Overlay › Ayarlar › Overlay'den aç.".to_string())
    } else if path == "/data" {
        ("200 OK", "application/json; charset=utf-8", data().lock().map(|d| d.clone()).unwrap_or_else(|_| "{}".into()))
    } else if path == "/" || path.starts_with("/?") {
        ("200 OK", "text/html; charset=utf-8", PAGE.to_string())
    } else {
        ("404 Not Found", "text/plain; charset=utf-8", "yok".to_string())
    };
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    s.write_all(head.as_bytes())?;
    s.write_all(body.as_bytes())?;
    s.flush()
}

const PAGE: &str = r#"<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Celeste Overlay · OBS</title>
<style>
  html,body{margin:0;background:transparent;font-family:"Segoe UI",system-ui,sans-serif;color:#ededed;-webkit-font-smoothing:antialiased}
  .w{display:inline-flex;align-items:center;gap:14px;padding:12px 16px 12px 12px;border-radius:14px;background:rgba(8,8,8,.86);border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 30px rgba(0,0,0,.35)}
  .w img{width:52px;height:52px}
  .r b{display:block;font-size:20px;font-weight:700;letter-spacing:-.01em}
  .r small{font-size:13px;color:#a3a3a3}
  .bar{width:170px;height:6px;margin-top:6px;border-radius:3px;background:#262626;overflow:hidden}
  .bar i{display:block;height:100%;border-radius:3px}
  .s{padding-left:14px;border-left:1px solid #2a2a2a;font-size:13px;color:#a3a3a3;line-height:1.5}
  .s b{color:#ededed;font-size:16px}
  .pos{color:#4ade80}.neg{color:#f87171}
  .hide{display:none}
</style></head><body>
<div class="w hide" id="w">
  <img id="ic" alt="">
  <div class="r"><b id="rk">–</b><small id="rr"></small><div class="bar"><i id="br"></i></div></div>
  <div class="s" id="ss"></div>
</div>
<script>
const $ = (id) => document.getElementById(id);
async function tick(){
  try{
    const d = await (await fetch('/data',{cache:'no-store'})).json();
    if(!d.rank){ $('w').classList.add('hide'); return; }
    $('w').classList.remove('hide');
    $('ic').src = d.rank.icon || ''; $('rk').textContent = d.rank.name; $('rk').style.color = d.rank.color || '#ededed';
    $('rr').textContent = d.rank.rr != null ? d.rank.rr + ' RR' : '';
    $('br').style.width = Math.max(0, Math.min(100, d.rank.rr || 0)) + '%'; $('br').style.background = d.rank.color || '#38bdf8';
    const s = d.session;
    $('ss').innerHTML = s && s.games ? `Bu seans<br><b>${s.wins}G ${s.losses}M</b> <span class="${s.rr>=0?'pos':'neg'}">${s.rr>0?'+':''}${s.rr} RR</span>` : 'Bu seans<br><b>henüz maç yok</b>';
  }catch(e){}
}
tick(); setInterval(tick, 3000);
</script></body></html>"#;

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};

    fn get(path: &str) -> String {
        let mut s = std::net::TcpStream::connect(("127.0.0.1", super::PORT)).unwrap();
        write!(s, "GET {path} HTTP/1.1\r\nHost: x\r\n\r\n").unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        out
    }

    #[test]
    fn serves_page_and_data_only_when_enabled() {
        assert!(super::PAGE.contains("/data"));
        super::set(true).unwrap();
        super::push(r#"{"rank":{"name":"Elmas 2","rr":47}}"#.into());
        assert!(get("/").contains("Celeste Overlay · OBS"));
        assert!(get("/data").contains("Elmas 2"));
        assert!(get("/yok").starts_with("HTTP/1.1 404"));
        super::set(false).unwrap();
        assert!(get("/data").starts_with("HTTP/1.1 503"));
    }
}
