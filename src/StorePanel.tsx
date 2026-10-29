import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { Store, StoreOffer, Wallet } from "./types";
import { PanelHead } from "./ui";

export const nf = (n?: number | null) => (n == null ? "–" : n.toLocaleString("tr-TR"));

export function WalletBar({ w }: { w?: Wallet | null }) {
  if (!w) return null;
  return (
    <div className="wal" aria-label="Cüzdan">
      <span><i className="cur vp" />{nf(w.vp)}<small>VP</small></span>
      <span><i className="cur rp" />{nf(w.rp)}<small>Radianite</small></span>
      <span><i className="cur kc" />{nf(w.kc)}<small>Kingdom</small></span>
    </div>
  );
}

const inTauri = "__TAURI_INTERNALS__" in window;

export function fmtLeft(sec?: number | null): string {
  if (!sec || sec <= 0) return "";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}g ${h}sa` : h > 0 ? `${h}sa ${m}dk` : `${m}dk`;
}

function Offer({ o, a, vp }: { o: StoreOffer; a: Assets; vp?: number | null }) {
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
        {final != null && vp != null && (
          final <= vp ? <span className="afford ok">Yetiyor</span> : <span className="afford no">{nf(final - vp)} VP eksik</span>
        )}
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
      <PanelHead
        title="Mağaza"
        sub="Kendi hesabının mağazası. Valorant kapalıyken de çalışır; Riot Client'ta oturum açık olması yeter."
        actions={<button className="x" type="button" onClick={load} disabled={busy}>{busy ? "Yükleniyor" : "Yenile"}</button>}
        onClose={onClose}
      />
      {err && <p className="empty">{err}</p>}
      {store && (
        <>
          <WalletBar w={store.wallet} />
          <h3 className="h2">Günlük mağaza{store.dailyRemaining ? <span className="hv">{fmtLeft(store.dailyRemaining)} sonra yenilenir</span> : null}</h3>
          {store.daily.length ? (
            <div className="offers">{store.daily.map((o) => <Offer key={o.itemId} o={o} a={assets} vp={store.wallet?.vp} />)}</div>
          ) : <p className="d none">Günlük teklifler alınamadı.</p>}
          <h3 className="h2">Gece pazarı{store.nightRemaining ? <span className="hv">{fmtLeft(store.nightRemaining)} sonra biter</span> : null}</h3>
          {store.night.length ? (
            <div className="offers">{store.night.map((o) => <Offer key={o.itemId} o={o} a={assets} vp={store.wallet?.vp} />)}</div>
          ) : <p className="d none">Şu anda gece pazarı yok.</p>}
        </>
      )}
    </div>
  );
}
