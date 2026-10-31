//! Riot Client yerel API'si ve Valorant oyun verisi için çekirdek katman.
//! Arayüzden bağımsızdır; Tauri tarafı sadece `Engine::snapshot` çağırır.
mod engine;
mod model;
pub mod netlog;
mod session;
pub mod verify;

pub use engine::Engine;
pub use model::*;
