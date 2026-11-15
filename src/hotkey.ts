import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";

/* Overlay'i göster/gizle tuşu. Varsayılan F2; Ayarlar'dan değiştirilir. Kısayolu Rust tarafı kaydeder, burada yalnızca seçim saklanır. */
export const DEFAULT_HOTKEY = "F2";
const KEY = "overlay-hotkey";
let cur = (() => { try { return localStorage.getItem(KEY) || DEFAULT_HOTKEY; } catch { return DEFAULT_HOTKEY; } })();
const subs = new Set<() => void>();

export const hotkey = () => cur;
export const hotkeyLabel = (a: string = cur) => a.replace("Control", "Ctrl");
export function useHotkey(): string {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cur);
}

/** Yeni tuşu kaydeder. Hata verirse (başka program kullanıyor, desteklenmiyor) mesajı döner; eski tuş çalışmaya devam eder. */
export async function applyHotkey(accel: string): Promise<string | null> {
  try { await invoke("set_hotkey", { accel }); } catch (e) { return String(e); }
  cur = accel;
  try { localStorage.setItem(KEY, accel); } catch { /* depolama kapalı */ }
  subs.forEach((f) => f());
  return null;
}
/** Açılışta kayıtlı tuşu Rust tarafına bildirir (varsayılansa bir şey yapmaz). */
export function restoreHotkey() {
  if (cur !== DEFAULT_HOTKEY) void invoke("set_hotkey", { accel: cur }).catch(() => undefined);
}
export const captureHotkey = (on: boolean) => { void invoke("hotkey_capture", { on }).catch(() => undefined); };
