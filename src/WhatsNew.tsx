import { useState } from "react";

/* Güncellemeden sonra bir kez görünen "neler yeni" kartı. Kapatınca bu sürüm için bir daha çıkmaz. */
const KEY = "overlay-whatsnew";
const NOTES: Record<string, string[]> = {
  "0.7.1": [
    "Parti artık maç sırasında da görünüyor; bütün modlardaki önceki maç kayıtlarından çıkarılıyor.",
    "MMR göstergesi: MMR ↑ / ↓ rozeti ve sonraki ranka kaç galibiyet kaldığı.",
    "İstatistik › Round analizi: saldırı/savunma, ilk kan, takas, clutch, KAST ve alım türüne göre round.",
    "İstatistik › Haritalar: haritalarındaki galibiyet ve saldırı/savunma oranların.",
    "OBS kaynağı: yayında rankın ve seansın görünsün (Ayarlar › Overlay › Yayın).",
    "S.S.S & Panel sekmeli ve ekrana sığıyor; Bu kurulumu doğrula düğmesi.",
    "Öneri / Hata gönderdiysen ekibin durum ve mesajları uygulamada görünür.",
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
