import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Assets } from "./assets";
import { lookup } from "./assets";
import type { MyMatch } from "./types";
import { tierColor } from "./LoadoutPanel";

const inTauri = "__TAURI_INTERNALS__" in window;
const QUEUE: Record<string, string> = { competitive: "Rekabetçi", unrated: "Derecesiz", swiftplay: "Hızlı", premier: "Premier" };
const WIN = "#4ade80", LOSS = "#f87171", FG = "#ededed", FG2 = "#a3a3a3", FG3 = "#7e7e7e";
const FONT = '"Geist Variable", system-ui, sans-serif';

type Format = "wide" | "story";
const SIZE: Record<Format, [number, number]> = { wide: [1600, 900], story: [1080, 1920] };

interface CardData {
  m: MyMatch; name: string | null; mapName: string; agentName: string; tierName?: string; tierColor?: string;
  map?: HTMLImageElement; agent?: HTMLImageElement; tier?: HTMLImageElement;
}

/** Görseli canvas'a çizilebilir biçimde yükler; CORS izin vermezse boş döner (kart görselsiz çizilir). */
function loadImg(src?: string): Promise<HTMLImageElement | undefined> {
  if (!src) return Promise.resolve(undefined);
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => res(undefined);
    i.src = src;
    window.setTimeout(() => res(undefined), 6000);
  });
}

export function score(m: MyMatch): [number, number] | null {
  const r = m.rounds;
  if (!r || r.atkRounds + r.defRounds === 0) return null;
  const won = r.atkWon + r.defWon, total = r.atkRounds + r.defRounds;
  return [won, total - won];
}

export function highlights(m: MyMatch): string[] {
  const r = m.rounds, out: string[] = [];
  if (r) {
    if (r.clutchWon > 0) out.push(`${r.clutchWon} clutch`);
    const fk = r.fkAtk + r.fkDef;
    if (fk >= 3) out.push(`${fk} ilk kan`);
    if (r.multi >= 2) out.push(`${r.multi} round 3+ öldürme`);
    if (r.rounds > 0) out.push(`%${Math.round((100 * r.kast) / r.rounds)} KAST`);
    if (r.plants + r.defuses >= 3) out.push(`${r.plants} kurma · ${r.defuses} imha`);
  }
  return out.slice(0, 3);
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): number {
  ctx.font = `600 ${size}px ${FONT}`;
  const padX = size * 0.75, h = size * 2;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, size * 0.45);
  ctx.fillStyle = "rgba(255,255,255,.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = FG;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

function stat(ctx: CanvasRenderingContext2D, value: string, label: string, x: number, y: number, size: number) {
  ctx.fillStyle = FG;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillText(value, x, y);
  ctx.fillStyle = FG3;
  ctx.font = `500 ${Math.round(size * 0.4)}px ${FONT}`;
  ctx.fillText(label, x, y + size * 0.62);
  ctx.font = `700 ${size}px ${FONT}`;
  return ctx.measureText(value).width;
}

function draw(cv: HTMLCanvasElement, d: CardData, f: Format, withImages: boolean) {
  const [W, H] = SIZE[f];
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const m = d.m, res = m.won ? WIN : LOSS;
  const story = f === "story";
  const M = story ? 80 : 96;

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  // Harita görseli + karartma
  const artH = story ? 1100 : H;
  if (withImages && d.map) {
    ctx.globalAlpha = 0.55;
    cover(ctx, d.map, 0, 0, W, artH);
    ctx.globalAlpha = 1;
  }
  const g = story ? ctx.createLinearGradient(0, 0, 0, artH) : ctx.createLinearGradient(0, 0, W, 0);
  if (story) { g.addColorStop(0, "rgba(5,5,5,.25)"); g.addColorStop(0.75, "rgba(5,5,5,.85)"); g.addColorStop(1, "#050505"); }
  else { g.addColorStop(0, "rgba(5,5,5,.96)"); g.addColorStop(0.5, "rgba(5,5,5,.8)"); g.addColorStop(1, "rgba(5,5,5,.25)"); }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, artH);

  // Ajan
  if (withImages && d.agent) {
    if (story) ctx.drawImage(d.agent, (W - 1000) / 2, 60, 1000, 1000);
    else ctx.drawImage(d.agent, W - 820, -20, 940, 940);
    const fade = story ? ctx.createLinearGradient(0, 800, 0, 1080) : ctx.createLinearGradient(0, H - 260, 0, H);
    fade.addColorStop(0, "rgba(5,5,5,0)");
    fade.addColorStop(1, "#050505");
    ctx.fillStyle = fade;
    if (story) ctx.fillRect(0, 800, W, 280); else ctx.fillRect(W - 820, H - 260, 820, 260);
  }

  // Sonuç rengi: üstte ince çizgi
  ctx.fillStyle = res;
  ctx.fillRect(0, 0, W, 6);

  let y = story ? 1060 : 128;
  ctx.textAlign = "left";
  if (d.name) {
    ctx.fillStyle = FG;
    ctx.font = `700 ${story ? 48 : 40}px ${FONT}`;
    ctx.fillText(d.name, M, y);
    y += story ? 56 : 50;
  }
  ctx.fillStyle = FG2;
  ctx.font = `500 ${story ? 30 : 26}px ${FONT}`;
  const when = new Date(m.started).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  ctx.fillText([QUEUE[m.queue] ?? m.queue, d.mapName, d.agentName, when].filter(Boolean).join("  ·  "), M, y);

  // Sonuç + skor
  y += story ? 110 : 96;
  ctx.fillStyle = res;
  ctx.font = `700 ${story ? 50 : 44}px ${FONT}`;
  ctx.fillText(m.won ? "Galibiyet" : "Mağlubiyet", M, y);
  const sc = score(m);
  y += story ? 170 : 150;
  ctx.fillStyle = FG;
  ctx.font = `800 ${story ? 180 : 156}px ${FONT}`;
  ctx.fillText(sc ? `${sc[0]}–${sc[1]}` : `${m.kills}/${m.deaths}/${m.assists}`, M - 6, y);

  // İstatistikler
  y += story ? 150 : 120;
  const size = story ? 64 : 56, gap = story ? 70 : 72;
  let x = M;
  const kd = m.deaths ? m.kills / m.deaths : m.kills;
  const items: [string, string][] = sc ? [[`${m.kills}/${m.deaths}/${m.assists}`, "K / D / A"], [kd.toFixed(2), "K/D"], [String(m.acs), "ACS"]] : [[kd.toFixed(2), "K/D"], [String(m.acs), "ACS"]];
  for (const [v, l] of items) x += stat(ctx, v, l, x, y, size) + gap;

  // Öne çıkanlar
  const hs = highlights(m);
  if (hs.length) {
    y += story ? 110 : 96;
    x = M;
    for (const h of hs) x += chip(ctx, h, x, y, story ? 28 : 24) + 14;
  }

  // Rank ve RR
  const by = H - (story ? 90 : 70);
  x = M;
  if (withImages && d.tier) { ctx.drawImage(d.tier, x, by - 52, 64, 64); x += 80; }
  if (d.tierName) {
    ctx.fillStyle = d.tierColor ?? FG;
    ctx.font = `700 ${story ? 34 : 30}px ${FONT}`;
    ctx.fillText(d.tierName, x, by);
    x += ctx.measureText(d.tierName).width + 18;
  }
  if (m.rrDelta != null) {
    ctx.fillStyle = m.rrDelta >= 0 ? WIN : LOSS;
    ctx.font = `700 ${story ? 34 : 30}px ${FONT}`;
    ctx.fillText(`${m.rrDelta > 0 ? "+" : m.rrDelta < 0 ? "−" : ""}${Math.abs(m.rrDelta)} RR`, x, by);
  }

  // İmza
  ctx.textAlign = "right";
  ctx.fillStyle = FG3;
  ctx.font = `500 ${story ? 28 : 24}px ${FONT}`;
  ctx.fillText("Celeste Overlay  ·  @bneceleste", W - M, by);
  ctx.textAlign = "left";
}

function toPng(cv: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    try {
      cv.toBlob((b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a)), rej) : rej(new Error("Görsel oluşturulamadı."))), "image/png");
    } catch (e) { rej(e); }
  });
}

export function MatchCard({ m, assets, onClose, onToast, onShare }: { m: MyMatch; assets: Assets; onClose: () => void; onToast: (t: string) => void; onShare?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fmt, setFmt] = useState<Format>(() => { try { return localStorage.getItem("overlay-card-fmt") === "story" ? "story" : "wide"; } catch { return "wide"; } });
  const [showName, setShowName] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [imgs, setImgs] = useState<Pick<CardData, "map" | "agent" | "tier"> | null>(null);
  const [plain, setPlain] = useState(false); // görseller CORS yüzünden kullanılamazsa
  const [busy, setBusy] = useState(false);

  const agent = assets.agents.get(lookup(m.agentId));
  const tierNo = m.tierAfter ?? 0;
  const tier = tierNo > 0 ? assets.tiers.get(tierNo) : undefined;

  useEffect(() => {
    if (inTauri) invoke<string>("get_riot_id").then((v) => setName(v || null)).catch(() => setName(null));
    Promise.all([loadImg(assets.mapArt.get(lookup(m.mapId))), loadImg(agent?.portrait ?? agent?.icon), loadImg(tier?.icon)])
      .then(([map, ag, t]) => setImgs({ map, agent: ag, tier: t }));
  }, [m.matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ref.current || !imgs) return;
    const d: CardData = {
      m, name: showName ? name : null, mapName: assets.maps.get(lookup(m.mapId)) ?? "", agentName: agent?.name ?? "",
      tierName: tier?.name, tierColor: tier ? tierColor(tier.color) : undefined, ...imgs,
    };
    draw(ref.current, d, fmt, !plain);
    // Görsel canvas'ı "kirletti" ise dışa aktarılamaz: görselsiz yeniden çiz.
    try { ref.current.getContext("2d")!.getImageData(0, 0, 1, 1); } catch { setPlain(true); }
  }, [imgs, fmt, showName, name, plain]); // eslint-disable-line react-hooks/exhaustive-deps

  const setF = (f: Format) => { setFmt(f); try { localStorage.setItem("overlay-card-fmt", f); } catch { /* depolama kapalı */ } };
  const fileName = () => `celeste-${(assets.maps.get(lookup(m.mapId)) ?? "mac").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date(m.started).toISOString().slice(0, 16).replace(/[^0-9]/g, "")}`;

  const copy = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const png = await toPng(ref.current);
      if (inTauri) await invoke("card_copy", png);
      else await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([png as BlobPart], { type: "image/png" }) })]);
      onToast("Kart kopyalandı. Discord'a ya da hikâyeye yapıştırabilirsin.");
    } catch (e) { onToast(`Kopyalanamadı: ${String(e).slice(0, 80)}`); }
    setBusy(false);
  };
  const save = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const png = await toPng(ref.current);
      if (inTauri) { await invoke<string>("card_save", png, { headers: { "x-name": fileName() } }); onToast("Kart Resimler › Celeste Overlay klasörüne kaydedildi."); }
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" })); a.download = `${fileName()}.png`; a.click(); }
    } catch (e) { onToast(`Kaydedilemedi: ${String(e).slice(0, 80)}`); }
    setBusy(false);
  };

  return (
    <div className="mcard" role="dialog" aria-label="Maç kartı">
      <div className="mcbar">
        <b>Maç kartı</b>
        <div className="seg" role="group" aria-label="Biçim">
          <button type="button" className={fmt === "wide" ? "on" : ""} onClick={() => setF("wide")}>Yatay</button>
          <button type="button" className={fmt === "story" ? "on" : ""} onClick={() => setF("story")}>Hikâye</button>
        </div>
        {name && <label className="mcname"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Riot ID görünsün</label>}
        <span className="sp" />
        <button className="x" type="button" onClick={copy} disabled={busy || !imgs}>Kopyala</button>
        <button className="x" type="button" onClick={save} disabled={busy || !imgs}>Kaydet</button>
        {onShare && <button className="x pri" type="button" onClick={onShare}>Akışta paylaş</button>}
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>
      <div className={fmt === "story" ? "mcview story" : "mcview"}>
        {!imgs && <span className="d">Kart hazırlanıyor…</span>}
        <canvas ref={ref} style={{ display: imgs ? "block" : "none" }} />
      </div>
      {plain && <small className="d">Ajan ve harita görselleri bu sefer karta eklenemedi; kart görselsiz hazırlandı.</small>}
    </div>
  );
}
