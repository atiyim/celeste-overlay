/* Valorant nişangah profil kodunu çözüp canvas'a çizer. Kod biçimi (anahtar harfleri ve varsayılanlar)
   açık kaynak @valapi/crosshair çözümleyicisinin tanımlarına göre. Yalnızca birincil (P) nişangah çizilir;
   hareket ve ateş hatası (firing/movement error) çizimi hareketsiz durum gösterildiği için dikkate alınmaz. */

type Cat = Record<string, string>;
export interface ParsedCrosshair { P: Cat; A: Cat; S: Cat }

export function parseCrosshair(code: string): ParsedCrosshair {
  const out: ParsedCrosshair = { P: {}, A: {}, S: {} };
  const t = code.trim().split(";");
  let cat: "P" | "A" | "S" | null = null;
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === "P" || k === "A" || k === "S") { cat = k; continue; }
    if (i + 1 >= t.length) break;
    if (cat) out[cat][k] = t[i + 1];
    i++; // anahtarın değeri
  }
  return out;
}

const PRESETS = ["FFFFFF", "00FF00", "7FFF00", "DFFF00", "FFFF00", "00FFFF", "FF00FF", "FF0000"];

export function drawCrosshair(canvas: HTMLCanvasElement, code: string, size: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const p = parseCrosshair(code).P;
  const num = (k: string, d: number) => { const v = Number(p[k]); return Number.isFinite(v) && p[k] !== undefined ? v : d; };
  const on = (k: string, d: number) => num(k, d) === 1;

  // Renk: b=1 ise özel hex, değilse hazır renk (c=8 de özel hex demektir).
  const cid = num("c", 0);
  const hex = (p.u ?? "FFFFFF").slice(0, 6);
  const rgb = on("b", 0) || cid === 8 ? hex : PRESETS[cid] ?? "FFFFFF";
  const color = `#${rgb}`;

  const outline = on("h", 1), ot = num("t", 1), oo = num("o", 0.5);
  const dot = on("d", 0), dz = num("z", 2), da = num("a", 1);

  type Line = { on: boolean; t: number; l: number; v: number; o: number; a: number };
  const line = (n: "0" | "1"): Line => {
    const defs = n === "0" ? { t: 2, l: 6, o: 3, a: 0.8, on: 1 } : { t: 2, l: 2, o: 10, a: 0.35, on: 1 };
    const l = num(`${n}l`, defs.l);
    return {
      on: on(`${n}b`, defs.on), t: num(`${n}t`, defs.t), l,
      v: on(`${n}g`, 0) ? num(`${n}v`, l) : l, o: num(`${n}o`, defs.o), a: num(`${n}a`, defs.a),
    };
  };
  const lines = [line("0"), line("1")].filter((x) => x.on && x.t > 0 && x.l > 0 && x.a > 0);

  // Sığdırma: büyük nişangahlar küçülür, küçükler en çok 4 kat büyür.
  const ext = Math.max(
    dot ? dz / 2 + ot : 0,
    ...lines.map((x) => x.o + Math.max(x.l, x.v) + (outline ? ot : 0)),
    4,
  );
  const s = Math.min(4, (size * 0.42) / ext);
  const cx = size / 2, cy = size / 2;

  const rect = (x: number, y: number, w: number, h: number, c: string, a: number) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect(cx + x * s, cy + y * s, w * s, h * s);
  };
  // Önce tüm dış çizgiler (siyah), sonra renkli parçalar: komşu çizgilerin çerçevesi birbirini örtmesin.
  const parts: { x: number; y: number; w: number; h: number; a: number }[] = [];
  for (const L of lines) {
    const th = L.t, h = th / 2;
    parts.push({ x: -h, y: -(L.o + L.v), w: th, h: L.v, a: L.a });       // yukarı
    parts.push({ x: -h, y: L.o, w: th, h: L.v, a: L.a });                 // aşağı
    parts.push({ x: -(L.o + L.l), y: -h, w: L.l, h: th, a: L.a });        // sol
    parts.push({ x: L.o, y: -h, w: L.l, h: th, a: L.a });                 // sağ
  }
  if (dot) parts.push({ x: -dz / 2, y: -dz / 2, w: dz, h: dz, a: da });
  if (outline && oo > 0) for (const q of parts) rect(q.x - ot, q.y - ot, q.w + 2 * ot, q.h + 2 * ot, "#000", oo);
  for (const q of parts) rect(q.x, q.y, q.w, q.h, color, q.a);
  ctx.globalAlpha = 1;
}
