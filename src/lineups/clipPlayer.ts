import { audioCtx } from "../sfx";
import { CLIPS, clipUrl, type ClipId } from "./voice";

/* Celeste'nin kayıtlı sesleri için tek kanallı oynatıcı.
   - Kayıtlar önceden indirilip çözülür: çalarken ağ beklenmez, ses gecikmeden başlar.
   - Aynı anda yalnızca bir cümle çalar: yenisi başlarken eskisi kesilir, sesler üst üste binmez. */

const bufs = new Map<ClipId, Promise<AudioBuffer | null>>();

export function loadClip(id: ClipId): Promise<AudioBuffer | null> {
  let p = bufs.get(id);
  if (!p) {
    p = (async () => {
      const c = audioCtx();
      if (!c) return null;
      try {
        const r = await fetch(clipUrl(id));
        if (!r.ok) return null;
        return await c.decodeAudioData(await r.arrayBuffer());
      } catch { return null; }
    })().then((b) => { if (!b) bufs.delete(id); return b; });
    bufs.set(id, p);
  }
  return p;
}

/** Bütün kayıtları arka planda, birkaç tanesi birden indirir. */
export async function preloadClips(): Promise<void> {
  const ids = Object.keys(CLIPS) as ClipId[];
  let next = 0;
  const worker = async () => { while (next < ids.length) await loadClip(ids[next++]!); };
  await Promise.all([worker(), worker(), worker()]);
}

let an: AnalyserNode | null = null;
let abuf: Uint8Array<ArrayBuffer> | null = null;
function analyser(c: AudioContext): AudioNode {
  if (!an || an.context !== c) { an = c.createAnalyser(); an.fftSize = 512; an.connect(c.destination); abuf = new Uint8Array(an.fftSize); }
  return an;
}
/** Çalan sesin o anki yüksekliği (0..1): Celeste'nin ağzı buna göre oynar. */
export function clipLevel(): number {
  if (!an || !abuf) return 0;
  an.getByteTimeDomainData(abuf);
  let sum = 0;
  for (let i = 0; i < abuf.length; i++) { const v = (abuf[i]! - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / abuf.length);
}

let current: { cancel: () => void } | null = null;

/** Çalan sesi hemen susturur. */
export function stopClips() { current?.cancel(); current = null; }

/** Kayıtları art arda, boşluksuz çalar. Bitince `onEnd(true)`; çalınamazsa `onEnd(false)`. `onStart` ses başladığı anda çağrılır (yazı animasyonunu sese bağlamak için). Dönen işlev sesi keser (geri çağrı çalışmaz). */
export function playClips(ids: ClipId[], onEnd: (ok: boolean) => void, onStart?: () => void): () => void {
  stopClips();
  let dead = false;
  const sources: AudioBufferSourceNode[] = [];
  const me = {
    cancel: () => {
      if (dead) return;
      dead = true;
      for (const s of sources) { s.onended = null; try { s.stop(); } catch { /* başlamamış olabilir */ } s.disconnect(); }
      if (current === me) current = null;
    },
  };
  current = me;
  void (async () => {
    const list = await Promise.all(ids.map(loadClip));
    const c = audioCtx();
    if (dead) return;
    if (!c || list.some((b) => !b)) { dead = true; if (current === me) current = null; onEnd(false); return; }
    if (c.state !== "running") await Promise.race([c.resume().catch(() => undefined), new Promise((r) => window.setTimeout(r, 400))]);
    if (dead) return;
    if (c.state !== "running") { dead = true; if (current === me) current = null; onEnd(false); return; }
    let at = c.currentTime + 0.02;
    list.forEach((buf, k) => {
      const s = c.createBufferSource();
      s.buffer = buf!;
      s.connect(analyser(c));
      s.start(at);
      at += buf!.duration;
      sources.push(s);
      if (k === list.length - 1) s.onended = () => { if (dead) return; dead = true; if (current === me) current = null; onEnd(true); };
    });
    onStart?.();
  })();
  return me.cancel;
}
