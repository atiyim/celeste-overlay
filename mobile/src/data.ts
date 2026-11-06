import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cachedJson } from "../../src/assets";
import type { MyStats, Store } from "../../src/types";

/* Sekmeler arasında saklanan veriler: sekme her açıldığında Riot'a yeniden sorulmaz.
   Aşağı çekip yenileyince ilgili kayıt silinir ve yeniden istenir. */

interface Entry<T> { data?: T; at: number; until: number; job?: Promise<T> }
const cache = new Map<string, Entry<unknown>>();
const subs = new Map<string, Set<() => void>>();
const ping = (k: string) => subs.get(k)?.forEach((f) => f());

export function drop(key: string) { cache.delete(key); ping(key); }
export function dropAll() { const ks = [...cache.keys()]; cache.clear(); ks.forEach(ping); }

function load<T>(key: string, fetcher: () => Promise<T>, ttl: (d: T) => number): Promise<T> {
  const e = cache.get(key) as Entry<T> | undefined;
  if (e?.data !== undefined && Date.now() < e.until) return Promise.resolve(e.data);
  if (e?.job) return e.job;
  const job = fetcher().then((d) => { cache.set(key, { data: d, at: Date.now(), until: Date.now() + ttl(d) }); ping(key); return d; });
  cache.set(key, { ...(e ?? { at: 0, until: 0 }), job } as Entry<unknown>);
  job.catch(() => { const c = cache.get(key); if (c) delete c.job; });
  return job;
}

/** Bir kaydı okuyan kanca: veri, hata, alındığı an. Kayıt silinince kendiliğinden yeniden ister. */
export function useData<T>(key: string, fetcher: () => Promise<T>, ttl: (d: T) => number, on = true): { data?: T; error?: string; at: number } {
  const [, force] = useState(0);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!on) return;
    const run = () => { setError(undefined); load(key, fetcher, ttl).then(() => force((n) => n + 1)).catch((e) => setError(String(e))); };
    const set = subs.get(key) ?? new Set();
    const f = () => { force((n) => n + 1); if (!cache.has(key)) run(); };
    set.add(f); subs.set(key, set);
    run();
    return () => { set.delete(f); };
  }, [key, on]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = cache.get(key) as Entry<T> | undefined;
  return { data: e?.data, error, at: e?.at ?? 0 };
}

const HOUR = 3600_000;
export const getStore = () => invoke<Store>("get_store");
export const storeTtl = (d: Store) => Math.min((d.dailyRemaining ?? 3600) * 1000, 6 * HOUR);
export const useStore = (on = true) => useData("store", getStore, storeTtl, on);
export const useStats = () => useData("stats", () => invoke<MyStats>("get_my_stats"), () => 3 * 60_000);

/* Sahip olunan kaplamalar: Riot yalnızca eşya kimliklerini verir (kaplama seviyeleri). */
const SKIN_LEVELS = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
interface Ent { ItemID: string }
interface OwnedResp { Entitlements?: Ent[]; EntitlementsByTypes?: { ItemTypeID: string; Entitlements: Ent[] }[] }
export const useOwned = () => useData("owned", async () => {
  const r = await invoke<OwnedResp>("get_owned", { kind: SKIN_LEVELS });
  const list = r.Entitlements ?? r.EntitlementsByTypes?.flatMap((x) => x.Entitlements) ?? [];
  return new Set(list.map((e) => e.ItemID.toLowerCase()));
}, () => 10 * 60_000);

/* Görevler ve savaş bileti. Riot ilerlemeyi verir; görev adları ve seviye XP'leri görsel veritabanından gelir. */
export interface ContractsResp {
  Contracts?: { ContractDefinitionID: string; ProgressionLevelReached: number; ProgressionTowardsNextLevel: number }[];
  Missions?: { ID: string; Objectives?: Record<string, number>; Complete: boolean; ExpirationTime?: string }[];
  MissionMetadata?: { WeeklyRefillTime?: string };
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export const useContracts = () => useData("contracts", async () => {
  const [c, missions, contracts, seasons] = await Promise.all([
    invoke<ContractsResp>("get_contracts"),
    cachedJson<any[]>("/missions").catch(() => [] as any[]),
    cachedJson<any[]>("/contracts").catch(() => [] as any[]),
    cachedJson<any[]>("/seasons").catch(() => [] as any[]),
  ]);
  return { c, missions, contracts, seasons };
}, () => 5 * 60_000);

/* İstek listesi: yalnızca bu telefonda (ana kaplama kimlikleri). */
const WISH = "celeste-wishlist";
let wish: Set<string> = (() => { try { return new Set(JSON.parse(localStorage.getItem(WISH) ?? "[]") as string[]); } catch { return new Set<string>(); } })();
const wishSubs = new Set<() => void>();
export function toggleWish(id: string) {
  wish = new Set(wish);
  if (wish.has(id)) wish.delete(id); else wish.add(id);
  try { localStorage.setItem(WISH, JSON.stringify([...wish])); } catch { /* */ }
  wishSubs.forEach((f) => f());
}
export function useWish(): Set<string> {
  const [w, setW] = useState(wish);
  useEffect(() => { const f = () => setW(wish); wishSubs.add(f); return () => { wishSubs.delete(f); }; }, []);
  return w;
}

/** Her saniye (ya da verilen aralıkla) yeniden çizer; geri sayımlar için. Ekran kapalıyken durur. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
