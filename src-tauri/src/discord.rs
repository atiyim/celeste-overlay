//! Discord "Oynuyor / Yarışıyor" kartı (Rich Presence).
//! Discord masaüstü uygulamasıyla bu bilgisayardaki yerel kanal üzerinden konuşur (internete bir şey gitmez).
//! Discord kapalıysa sessizce bekler, açılınca bağlanır. Arayüz yalnızca ne gösterileceğini söyler; aynı içerik
//! tekrar gönderilmez (Discord'un sınırı: 20 saniyede 5 güncelleme).

use serde_json::{json, Value};
use std::io::{Read, Write};
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Discord Developer Portal → uygulama → Application ID. Gizli değildir.
pub const CLIENT_ID: &str = "1568761057885818932";

trait Pipe: Read + Write + Send {}
impl<T: Read + Write + Send> Pipe for T {}

struct Conn {
    io: Box<dyn Pipe>,
    nonce: u64,
}

impl Conn {
    /// Discord'un yerel kanalını bulup el sıkışır. Hata metni Ayarlar'da gösterilir.
    fn open() -> Result<Conn, String> {
        let mut last = String::from("Discord bulunamadı. Masaüstü uygulaması açık mı?");
        for i in 0..10 {
            let Some(io) = connect(i) else { continue };
            let mut c = Conn { io, nonce: 0 };
            note(Phase::Handshake, None);
            if let Err(e) = c.send(0, &json!({ "v": 1, "client_id": CLIENT_ID })) {
                last = format!("Discord'a yazılamadı: {e}");
                continue;
            }
            // İlk yanıt READY (op 1) olmalı; CLOSE (op 2) gelirse Discord nedenini yazar.
            match c.recv() {
                Ok((1, _)) => return Ok(c),
                Ok((op, v)) => last = format!("Discord bağlantıyı kabul etmedi ({op}): {}", v["message"].as_str().unwrap_or("neden yok")),
                Err(e) => last = format!("Discord yanıt vermedi: {e}"),
            }
        }
        Err(last)
    }

    fn send(&mut self, op: u32, v: &Value) -> std::io::Result<()> {
        let body = serde_json::to_vec(v).unwrap_or_default();
        let mut buf = Vec::with_capacity(8 + body.len());
        buf.extend_from_slice(&op.to_le_bytes());
        buf.extend_from_slice(&(body.len() as u32).to_le_bytes());
        buf.extend_from_slice(&body);
        self.io.write_all(&buf)?;
        self.io.flush()
    }

    fn recv(&mut self) -> std::io::Result<(u32, Value)> {
        let mut head = [0u8; 8];
        self.io.read_exact(&mut head)?;
        let op = u32::from_le_bytes([head[0], head[1], head[2], head[3]]);
        let len = u32::from_le_bytes([head[4], head[5], head[6], head[7]]) as usize;
        if len > 1 << 20 {
            return Err(std::io::Error::other("çok büyük"));
        }
        let mut body = vec![0u8; len];
        self.io.read_exact(&mut body)?;
        Ok((op, serde_json::from_slice(&body).unwrap_or(Value::Null)))
    }

    fn set_activity(&mut self, activity: &Option<Value>) -> std::io::Result<()> {
        self.nonce += 1;
        let msg = json!({
            "cmd": "SET_ACTIVITY",
            "args": { "pid": std::process::id(), "activity": activity },
            "nonce": self.nonce.to_string(),
        });
        self.send(1, &msg)?;
        // Araya başka bir olay girebilir: bu isteğin yanıtı (aynı nonce) gelene kadar oku.
        let v = loop {
            let (op, v) = self.recv()?;
            if op == 2 {
                return Err(std::io::Error::other("Discord bağlantıyı kapattı"));
            }
            if v["nonce"].as_str() == Some(self.nonce.to_string().as_str()) {
                break v;
            }
        };
        if v["evt"].as_str() == Some("ERROR") {
            let msg = v["data"]["message"].as_str().unwrap_or("neden yok");
            note(Phase::Connected, Some(format!("Discord kartı kabul etmedi: {msg}")));
        } else {
            note(Phase::Connected, None);
        }
        Ok(())
    }
}

#[cfg(windows)]
fn connect(i: u8) -> Option<Box<dyn Pipe>> {
    let f = std::fs::OpenOptions::new().read(true).write(true).open(format!(r"\\?\pipe\discord-ipc-{i}")).ok()?;
    Some(Box::new(f))
}

#[cfg(unix)]
fn connect(i: u8) -> Option<Box<dyn Pipe>> {
    let base = std::env::var("XDG_RUNTIME_DIR").or_else(|_| std::env::var("TMPDIR")).unwrap_or_else(|_| "/tmp".into());
    let s = std::os::unix::net::UnixStream::connect(format!("{base}/discord-ipc-{i}")).ok()?;
    Some(Box::new(s))
}

#[cfg(not(any(windows, unix)))]
fn connect(_: u8) -> Option<Box<dyn Pipe>> {
    None
}

static TX: OnceLock<Sender<Option<Value>>> = OnceLock::new();
#[derive(Clone, Copy, PartialEq)]
enum Phase {
    /// Kanal açıldı, Discord'un cevabı bekleniyor.
    Handshake,
    Connected,
    Failed,
}

struct Status {
    phase: Phase,
    error: Option<String>,
    since: Instant,
}

static STATUS: Mutex<Option<Status>> = Mutex::new(None);

fn note(phase: Phase, error: Option<String>) {
    let mut st = STATUS.lock().unwrap();
    let since = match st.as_ref() {
        Some(s) if s.phase == phase => s.since,
        _ => Instant::now(),
    };
    *st = Some(Status { phase, error, since });
}

/// Ayarlardaki "Discord'da göster". Kapalıyken Discord'a hiç bağlanılmaz.
static ENABLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

/// Kartı güncelle (`None`: kartı kaldır). `enabled: false`: bağlantıyı kapat.
pub fn set(activity: Option<Value>, enabled: bool) {
    ENABLED.store(enabled, std::sync::atomic::Ordering::Relaxed);
    let tx = TX.get_or_init(|| {
        let (tx, rx) = channel::<Option<Value>>();
        std::thread::Builder::new().name("discord".into()).spawn(move || run(rx)).ok();
        tx
    });
    let _ = tx.send(activity);
}

/// (Discord'a bağlı mı, kullanıcıya gösterilecek açıklama)
pub fn status() -> (bool, Option<String>) {
    let st = STATUS.lock().unwrap();
    match st.as_ref() {
        None => (false, None),
        Some(s) => match s.phase {
            Phase::Connected => (true, s.error.clone()),
            Phase::Handshake if s.since.elapsed() > Duration::from_secs(8) => (false, Some("Discord yanıt vermiyor. Discord'u tamamen kapatıp yeniden açmayı dene.".into())),
            Phase::Handshake => (false, None),
            Phase::Failed => (false, s.error.clone()),
        },
    }
}

fn run(rx: std::sync::mpsc::Receiver<Option<Value>>) {
    let mut conn: Option<Conn> = None;
    let mut want: Option<Value> = None;
    let mut sent: Option<String> = None;
    let mut retry_at = Instant::now();
    // Discord'un sınırı: 20 saniyede 5 güncelleme. Sınıra kadar anında gönderilir, sonra sıra beklenir.
    let mut sends: std::collections::VecDeque<Instant> = std::collections::VecDeque::new();
    loop {
        match rx.recv_timeout(Duration::from_secs(10)) {
            Ok(a) => want = a,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }
        while let Ok(a) = rx.try_recv() {
            want = a;
        }
        if CLIENT_ID == "0" {
            continue; // uygulama kimliği girilmemiş
        }
        let key = want.as_ref().map(|v| v.to_string());
        if !ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
            if let Some(mut c) = conn.take() {
                let _ = c.set_activity(&None);
            }
            *STATUS.lock().unwrap() = None;
            sent = None;
            continue;
        }
        if conn.is_none() {
            // Valorant kapalıyken de bağlanılır: Ayarlar Discord'un durumunu gösterebilsin. Kart yalnızca oyun açıkken gider.
            if Instant::now() < retry_at {
                continue;
            }
            sent = None;
            match Conn::open() {
                Ok(c) => {
                    conn = Some(c);
                    note(Phase::Connected, None);
                }
                Err(e) => {
                    note(Phase::Failed, Some(e));
                    retry_at = Instant::now() + Duration::from_secs(15); // Discord kapalı: 15 saniyede bir dene
                    continue;
                }
            }
        }
        if key == sent {
            continue;
        }
        while sends.front().is_some_and(|t| t.elapsed() >= Duration::from_secs(20)) {
            sends.pop_front();
        }
        if sends.len() >= 5 {
            let wait = Duration::from_secs(20).saturating_sub(sends[0].elapsed()) + Duration::from_millis(100);
            std::thread::sleep(wait);
            sends.pop_front();
            // Beklerken gelen en son durum gönderilir.
            while let Ok(a) = rx.try_recv() {
                want = a;
            }
        }
        let key = want.as_ref().map(|v| v.to_string());
        if key == sent {
            continue;
        }
        let res = conn.as_mut().map(|c| c.set_activity(&want)).unwrap_or_else(|| Err(std::io::Error::other("bağlantı yok")));
        sends.push_back(Instant::now());
        match res {
            Ok(()) => sent = key,
            Err(e) => {
                conn = None;
                note(Phase::Failed, Some(format!("Discord bağlantısı koptu: {e}")));
                retry_at = Instant::now() + Duration::from_secs(5);
            }
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn frames_and_nonce() {
        let (a, mut b) = std::os::unix::net::UnixStream::pair().unwrap();
        let server = std::thread::spawn(move || {
            let mut fake = Conn { io: Box::new(b.try_clone().unwrap()), nonce: 0 };
            let (op, v) = fake.recv().unwrap();
            assert_eq!(op, 1);
            assert_eq!(v["cmd"], "SET_ACTIVITY");
            assert_eq!(v["args"]["activity"]["type"], 5);
            // önce alakasız bir olay, sonra hata yanıtı
            fake.send(1, &json!({ "evt": "READY", "nonce": null })).unwrap();
            fake.send(1, &json!({ "evt": "ERROR", "nonce": v["nonce"], "data": { "message": "bad" } })).unwrap();
            let _ = b.flush();
        });
        let mut c = Conn { io: Box::new(a), nonce: 0 };
        c.set_activity(&Some(json!({ "type": 5, "details": "Menüde" }))).unwrap();
        server.join().unwrap();
        assert_eq!(status().1.as_deref(), Some("Discord kartı kabul etmedi: bad"));
    }
}
