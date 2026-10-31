import { useState } from "react";

/* Güncellemeden sonra bir kez görünen "neler yeni" kartı. Kapatınca bu sürüm için bir daha çıkmaz. */
const KEY = "overlay-whatsnew";
const NOTES: Record<string, string[]> = {
  "0.7.1": [
    "Parti bilgisi artık maç sırasında da görünüyor: arkadaş olmayan oyuncular için önceki maç kayıtlarından çıkarılıyor.",
    "Rekabet, derecesiz, tam gaz, ölüm maçı: bütün modlardaki partiler sayılıyor.",
    "Parti harfinin üstüne gelince nereden bilindiği yazıyor.",
    "MMR göstergesi: kazanınca ve kaybedince alınan RR'dan MMR ↑ / ↓ ve sonraki ranka kaç galibiyet kaldığı.",
    "S.S.S & Panel › Bu kurulumu doğrula: dosyanın GitHub'daki açık koddan derlenenle aynı olduğunu tek tıkla gör.",
  ],
  "0.7.0": [
    "Yeni görünüm: bütün menüler aynı sade düzende, Ayarlar yan menülü.",
    "Lobi özeti: rakipte kaç Operator'cu, kaç kişilik parti ve haritada usta olan var, tek satırda.",
    "Yeni rozetler: Haritada usta / zayıf ve Operator'cu / Sheriff'çi.",
    "Uzun isimlerde Riot etiketi ve kendi etiketlerin artık hep görünüyor.",
    "Öneri / Hata formu uygulamanın içinde; ekip ele alınca burada haber verilir.",
    "FPS modu: oyunda kasma yaşıyorsan Ayarlar › Overlay'den aç.",
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
