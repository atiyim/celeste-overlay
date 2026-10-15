import { CROSSHAIRS } from "./crosshairs";

/* Nişangah kütüphanesi: kodu panoya kopyalar. Oyunun ayar dosyasına yazılmaz, oyuna tuş vuruşu gönderilmez. */
interface Props { onCopy: (text: string, label?: string) => void; onClose: () => void }

export function Crosshairs({ onCopy, onClose }: Props) {
  return (
    <div className="panel" role="dialog" aria-label="Nişangah">
      <div className="ph">
        <div>
          <h2 className="t">Nişangah</h2>
          <p className="m">Kodu kopyala, oyunda Ayarlar → Nişangah → Profil kodunu içe aktar'a yapıştır.</p>
        </div>
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>
      {CROSSHAIRS.map((c) => (
        <div className="xh" key={c.name}>
          <span className="xn">{c.name}</span>
          <code title={c.code}>{c.code}</code>
          <button className="x" type="button" onClick={() => onCopy(c.code, `${c.name} kopyalandı`)}>Kopyala</button>
        </div>
      ))}
    </div>
  );
}
