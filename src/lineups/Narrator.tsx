import { useEffect, useMemo, useRef, useState } from "react";
import type { Assets } from "../assets";
import { Mascot, type Mood } from "../Mascot";
import { throwName, type Lineup } from "./api";
import { playClips } from "./clipPlayer";
import { clipSecs, clipText, joinClip, type ClipId } from "./voice";

/* Celeste anlatıcı: konuşma balonu yazarak dolar, ağzı yazıyla birlikte oynar.
   "Sesli anlat" açıksa ve bilgisayarda Türkçe ses varsa metni okur (Windows: Ayarlar › Saat ve dil › Konuşma). */

export function narration(l: Lineup, _assets: Assets | null, slides: { kind: "map" | "step" | "clip"; i?: number }[]): { text: string; mood: Mood; clip?: ClipId[] }[] {
  return slides.map((s, idx) => {
    if (s.kind === "map") {
      const tone = l.diff === 1 ? "kolay" : l.diff === 3 ? "zor" : null;
      const clip: ClipId[] = [tone ? joinClip(tone, "harita-ekrani") : "harita-ekrani"];
      return { text: clipText(clip), mood: "happy", clip };
    }
    if (s.kind === "clip") return { text: "Bir de klipte izle, birkaç saniye sürüyor. Sonra özel oyunda iki üç kez dene, maçta kullanmaya hazırsın!", mood: "wink" };
    const step = l.steps[s.i ?? 0];
    const last = !slides.slice(idx + 1).some((x) => x.kind === "step");
    const special = last && l.throw !== "stand";
    const mood: Mood = last ? "flirt" : "happy";
    if (step?.text) return { text: `${step.text}${special ? ` Unutma, ${throwName(l.throw).toLocaleLowerCase("tr")} atıyorsun.` : ""}`, mood };
    const first = step?.aim ? "adim-metni-yoksa" : "adim-metni-yoksa2";
    const clip: ClipId[] = [special ? joinClip(first, "son-adim") : first];
    return { text: clipText(clip), mood, clip };
  });
}

let trVoice: SpeechSynthesisVoice | null | undefined;
function voice(): SpeechSynthesisVoice | null {
  if (trVoice !== undefined) return trVoice;
  const all = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
  if (!all.length) return null;
  trVoice = all.find((v) => /^tr/i.test(v.lang) && /female|kadın|emel|seda|filiz/i.test(v.name)) ?? all.find((v) => /^tr/i.test(v.lang)) ?? null;
  return trVoice;
}
export const hasTurkishVoice = () => Boolean(voice());

interface Props {
  text: string;
  mood: Mood;
  /** Kayıtlı ses(ler). Verilirse balondaki yazı bunlardan gelir; yoksa metin Türkçe bilgisayar sesiyle okunur. */
  clip?: ClipId | ClipId[];
  /** Sesli oku (kayıt ya da Türkçe ses). Yalnızca playing açıkken konuşur. */
  speak: boolean;
  /** Anlatım akıyor mu: kapalıyken ses susar ve sonraki adıma geçilmez. */
  playing: boolean;
  onDone?: () => void;
  small?: boolean;
}

/** Kelimelerin balonda belirme zamanı (0..1): uzun kelime ve noktalama biraz daha geç yer açar. */
function wordStarts(words: string[]): number[] {
  const w = words.map((x) => x.length + (/[.!?]$/.test(x) ? 4 : /[,:;]$/.test(x) ? 2 : 0) + 1);
  const total = w.reduce((t, x) => t + x, 0) || 1;
  let acc = 0;
  return w.map((x) => { const at = acc / total; acc += x; return at; });
}

export function Narrator({ text: textProp, clip, mood, speak, playing, onDone, small }: Props) {
  const text = clip ? (textProp || clipText(clip)) : textProp;
  const clipKey = clip ? (Array.isArray(clip) ? clip.join("+") : clip) : "";
  const words = useMemo(() => text.split(" "), [text]);
  const starts = useMemo(() => wordStarts(words), [words]);
  const [shown, setShown] = useState(0);
  const [spoken, setSpoken] = useState(false);
  const head = useRef<HTMLDivElement>(null);
  const beginRef = useRef<() => void>(() => {});
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const typed = shown >= words.length;
  const audible = Boolean(clipKey && speak && playing);

  // Yazı sesle birlikte akar: kayıtlı ses varsa süresine yayılır ve ses başlayınca başlar; yoksa okuma hızında kendi akar.
  useEffect(() => {
    setShown(0);
    const ms = clipKey ? Math.max(700, clipSecs(clipKey.split("+") as ClipId[]) * 1000 * 0.94) : Math.max(900, text.length * 46);
    let raf = 0, t0 = 0, started = false, last = 0;
    const tick = (now: number) => {
      const p = (now - t0) / ms;
      let n = 0;
      while (n < starts.length && starts[n]! <= p) n++;
      if (n !== last) {
        last = n;
        setShown(n);
        head.current?.querySelector(".mascot")?.setAttribute("data-mouth", n >= words.length ? "0" : String(n % 3));
      }
      if (n < words.length) raf = requestAnimationFrame(tick);
    };
    beginRef.current = () => { if (started) return; started = true; t0 = performance.now(); raf = requestAnimationFrame(tick); };
    if (!audible) beginRef.current();
    const guard = audible ? window.setTimeout(() => beginRef.current(), 1200) : 0; // ses hiç başlamazsa yazı yine akar
    return () => { cancelAnimationFrame(raf); window.clearTimeout(guard); head.current?.querySelector(".mascot")?.setAttribute("data-mouth", "0"); };
  }, [text, clipKey, audible, starts, words.length]);

  // Kayıtlı ses: yalnızca oynatılırken. Duraklatınca hemen susar, devam edince cümleyi baştan çalar.
  useEffect(() => {
    setSpoken(false);
    if (!audible) return;
    return playClips(clipKey.split("+") as ClipId[], (ok) => { if (!ok) beginRef.current(); setSpoken(true); }, () => beginRef.current());
  }, [clipKey, audible]);

  // Bilgisayar sesi (kaydı olmayan metinler için): yalnızca oynatılırken.
  const v = speak && !clipKey ? voice() : null;
  useEffect(() => {
    if (clipKey) return;
    setSpoken(false);
    if (!v || !playing || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v; u.lang = v.lang; u.rate = 1.04; u.pitch = 1.25;
    u.onend = () => setSpoken(true);
    speechSynthesis.speak(u);
    return () => speechSynthesis.cancel();
  }, [text, v, playing, clipKey]);

  // Sonraki adıma geçiş: oynatılıyorsa, yazı bittiyse ve (ses varsa) okuma bittiyse kısa bir nefesten sonra.
  const talks = clipKey ? speak : Boolean(v);
  useEffect(() => {
    if (!playing || !typed || (talks && !spoken)) return;
    const id = window.setTimeout(() => doneRef.current?.(), talks ? 350 : Math.min(2600, 600 + text.length * 18));
    return () => window.clearTimeout(id);
  }, [playing, typed, spoken, talks, text]);

  return (
    <div className={`lnar${small ? " small" : ""}`} aria-live="polite">
      <div className="lnar-head" ref={head}><Mascot mood={mood} /></div>
      <div className="lnar-bub" key={text}>
        <span className="lnar-name" aria-hidden="true"><i />Celeste</span>
        <span className="lnar-txt" aria-label={text}>
          {words.map((w, i) => <span key={i} className={i < shown ? "lnar-w on" : "lnar-w"} aria-hidden="true">{w}{i < words.length - 1 ? " " : ""}</span>)}
        </span>
        <svg className="lnar-tail" viewBox="0 0 12 18" aria-hidden="true"><path className="f" d="M7 0 Q6 13 0 18 L12 18 L12 0 Z" /><path className="s" d="M7 0 Q6 13 0 18 L12 18" /></svg>
        <span className="lnar-tw a" aria-hidden="true" /><span className="lnar-tw b" aria-hidden="true" />
      </div>
    </div>
  );
}
