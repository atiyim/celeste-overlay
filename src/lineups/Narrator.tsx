import { useEffect, useRef, useState } from "react";
import type { Assets } from "../assets";
import { Mascot, type Mood } from "../Mascot";
import { kindName, siteName, throwName, type Lineup } from "./api";
import { abilityOf } from "./MapBoard";

/* Celeste anlatıcı: konuşma balonu yazarak dolar, ağzı yazıyla birlikte oynar.
   "Sesli anlat" açıksa ve bilgisayarda Türkçe ses varsa metni okur (Windows: Ayarlar › Saat ve dil › Konuşma). */

export function narration(l: Lineup, assets: Assets | null, slides: { kind: "map" | "step" | "clip"; i?: number }[]): { text: string; mood: Mood }[] {
  const agent = assets?.agents.get(l.agent)?.name ?? "Ajan";
  const ab = abilityOf(assets, l)?.name ?? "yetenek";
  const where = siteName(l.site);
  const tone = l.diff === 1 ? " Kolay bir tane, hemen kaparsın." : l.diff === 3 ? " Biraz zor, ama sende o el var." : "";
  return slides.map((s, idx) => {
    if (s.kind === "map") {
      const head = `${agent} ile ${where ? `${where} ` : ""}${kindName(l.kind).toLocaleLowerCase("tr")} lineup'ı: ${ab}.${tone}`;
      return { text: `${head} Haritada parlayan yere geç; ok, yeteneğin nereye düşeceğini gösteriyor.${l.note ? ` Ne zaman mı? ${l.note}` : ""}`, mood: "happy" };
    }
    if (s.kind === "clip") return { text: "Bir de klipte izle, birkaç saniye sürüyor. Sonra özel oyunda iki üç kez dene, maçta kullanmaya hazırsın!", mood: "wink" };
    const step = l.steps[s.i ?? 0];
    const last = !slides.slice(idx + 1).some((x) => x.kind === "step");
    const base = step?.text || (step?.aim ? "Halkayla gösterdiğim yere tam nişan al." : "Görseldeki gibi dur.");
    const how = last && l.throw !== "stand" ? ` Unutma, ${throwName(l.throw).toLocaleLowerCase("tr")} atıyorsun.` : "";
    return { text: `${base}${how}`, mood: last ? "flirt" : "happy" };
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

interface Props { text: string; mood: Mood; speak: boolean; playing: boolean; onDone?: () => void; small?: boolean }

export function Narrator({ text, mood, speak, playing, onDone, small }: Props) {
  const [n, setN] = useState(0);
  const head = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setN(0);
    let i = 0;
    let spoken = false;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; if (playing) window.setTimeout(() => doneRef.current?.(), 1400); };
    const v = speak ? voice() : null;
    if (v && typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = 1.04; u.pitch = 1.25;
      u.onend = () => { spoken = true; finish(); };
      speechSynthesis.speak(u);
    }
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + 2);
      setN(i);
      const el = head.current?.querySelector(".mascot");
      if (el) el.setAttribute("data-mouth", i >= text.length ? "0" : String((i >> 1) % 3));
      if (i >= text.length) { window.clearInterval(id); if (!v || spoken) window.setTimeout(finish, Math.min(2600, 600 + text.length * 18)); }
    }, 34);
    return () => { window.clearInterval(id); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); };
  }, [text, speak, playing]);

  return (
    <div className={`lnar${small ? " small" : ""}`} aria-live="polite">
      <div className="lnar-head" ref={head}><Mascot mood={mood} /></div>
      <div className="lnar-bub" key={text}>
        <span className="lnar-name" aria-hidden="true"><i />Celeste</span>
        <span className="lnar-txt">{text.slice(0, n)}<i className={n < text.length ? "lnar-caret" : "lnar-caret off"} /></span>
        <span className="lnar-ghost" aria-hidden="true">{text}</span>
        <svg className="lnar-tail" viewBox="0 0 12 18" aria-hidden="true"><path className="f" d="M7 0 Q6 13 0 18 L12 18 L12 0 Z" /><path className="s" d="M7 0 Q6 13 0 18 L12 18" /></svg>
        <span className="lnar-tw a" aria-hidden="true" /><span className="lnar-tw b" aria-hidden="true" />
      </div>
    </div>
  );
}
