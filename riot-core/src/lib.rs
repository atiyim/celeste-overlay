//! Riot Client yerel API'si ve Valorant oyun verisi için çekirdek katman.
//! Arayüzden bağımsızdır; Tauri tarafı sadece `Engine::snapshot` çağırır.
mod engine;
mod model;
mod session;

pub use engine::Engine;
pub use model::*;
