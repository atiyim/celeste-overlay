// Masaüstünde geliştirme için (telefonda giriş noktası lib.rs'teki run()).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    celeste_mobile_lib::run()
}
