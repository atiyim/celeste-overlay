import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { Store, StoreOffer } from "./types";

const inTauri = "__TAURI_INTERNALS__" in window;

export function fmtLeft(sec?: number | null): string {
  if (!sec || sec <= 0) return "";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}g ${h}sa` : h > 0 ? `${h}sa ${m}dk` : `${m}dk`;
}

function Offer({ o, a }: { o: StoreOffer; a: Assets }) {
  const s = a.skins.get(lookup(o.itemId));
  const final = o.discounted ?? o.price;
  return (
    <figure className="offer">
      <div className="oi">{s?.icon ? <img src={s.icon} alt="" loading="lazy" /> : <span className="d">?</span>}</div>
      <figcaption>
        <span className="oname">{s?.name ?? "Bilinmeyen ürün"}</span>
        <span className="op">
          {o.discounted != null && o.price != null && <s>{o.price}</s>}
          {final != null ? `${final} VP` : "–"}
          {o.discountPercent ? <em>−%{o.discountPercent}</em> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export function StorePanel({ assets, onClose }: { assets: Assets; onClose: () => void }) {
  const [store, setStore] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!inTauri) { setErr("Mağaza yalnızca masaüstü uygulamasında çalışır."); return; }
    setBusy(true);
    try { setStore(await invoke<Store>("get_store")); setErr(null); }
    catch (e) { setErr(String(e)); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="panel" role="dialog" aria-label="Mağaza">
      <div className="ph">
        <div>
          <h2 className="t">Mağaza</h2>
          <p className="m">Yalnızca kendi hesabın. Valorant açık olmasa da Riot Client'ta giriş yapılmış olması yeter.</p>
        </div>
        <span className="zoom">
          <button type="button" onClick={load} disabled={busy}>{busy ? "Yükleniyor…" : "Yenile"}</button>
          <button type="button" onClick={onClose}>Kapat</button>
        </span>
      </div>
      {err && <p className="empty">{err}</p>}
      {store && (
        <>
          <h2 className="h">Günlük mağaza {store.dailyRemaining ? <span className="d"> · yenilenmesine {fmtLeft(store.dailyRemaining)}</span> : null}</h2>
          {store.daily.length ? (
            <div className="offers">{store.daily.map((o) => <Offer key={o.itemId} o={o} a={assets} />)}</div>
          ) : <p className="d none">Günlük teklif alınamadı.</p>}
          <h2 className="h">Gece pazarı {store.nightRemaining ? <span className="d"> · bitmesine {fmtLeft(store.nightRemaining)}</span> : null}</h2>
          {store.night.length ? (
            <div className="offers">{store.night.map((o) => <Offer key={o.itemId} o={o} a={assets} />)}</div>
          ) : <p className="d none">Şu an gece pazarı yok.</p>}
        </>
      )}
    </div>
  );
}
