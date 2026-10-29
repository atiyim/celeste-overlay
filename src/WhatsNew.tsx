import { useState } from "react";

/* Güncellemeden sonra bir kez görünen "neler yeni" kartı. Kapatınca bu sürüm için bir daha çıkmaz. */
const KEY = "overlay-whatsnew";
const NOTES: Record<string, string[]> = {
  "0.7.0": [
    "Yeni görünüm: bütün menüler aynı sade düzende, Ayarlar yan menülü.",
    "Lobi özeti: rakipte kaç Operator'cu, kaç kişilik parti ve haritada usta olan var, tek satırda.",
    "Yeni rozetler: Haritada usta / zayıf ve Operator'cu / Sheriff'çi.",
    "Uzun isimlerde Riot etiketi ve kendi etiketlerin artık hep görünüyor.",
  ],
};

export function WhatsNew({ version }: { version: string }) {
  const [seen, setSeen] = useState<string>(() => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } });
  const notes = NOTES[version];
  if (!notes || seen === version) return null;
  const close = () => { setSeen(version); try { localStorage.setItem(KEY, version); } catch { /* depolama kapalı */ } };
  return (
    <div className="wnew" role="status">
      <div className="wnewh">
        <b><i />{version} sürümünde yeni</b>
        <button className="x" type="button" onClick={close}>Tamam</button>
      </div>
      <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}
