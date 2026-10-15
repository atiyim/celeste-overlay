import { useEffect, useState } from "react";

/* Hızlı mesajlar: yazdığın mesajlar listede durur, birine tıklayınca panoya kopyalanır.
   Oyuna tuş vuruşu gönderilmez; yapıştırmayı sen yaparsın. */
const STORE = "overlay-chat-msgs";
const DEFAULTS = ["Instagram: @bneceleste, okeyde dördüncümüz olmak için gel!"];

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as unknown;
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : DEFAULTS;
  } catch { return DEFAULTS; }
}

interface Props { onCopy: (text: string, label?: string) => void; onClose: () => void }

export function QuickChat({ onCopy, onClose }: Props) {
  const [msgs, setMsgs] = useState<string[]>(load);
  const [text, setText] = useState("");

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(msgs)); } catch { /* depolama dolu */ }
  }, [msgs]);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [t, ...m.filter((x) => x !== t)]);
    setText("");
  };

  return (
    <div className="panel" role="dialog" aria-label="Hızlı mesajlar">
      <div className="ph">
        <div>
          <h2 className="t">Hızlı mesajlar</h2>
          <p className="m">Mesajı yaz ve ekle. Listeden birine tıklayınca kopyalanır; oyunda sohbeti açıp Ctrl+V ile yapıştır.</p>
        </div>
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>

      <div className="note">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); e.stopPropagation(); }}
          placeholder="Yeni mesaj"
          aria-label="Yeni mesaj"
        />
        <button className="x" type="button" onClick={add}>Ekle</button>
      </div>

      <h2 className="h">Mesajlarım</h2>
      {msgs.length === 0 && <p className="d none">Henüz mesaj yok.</p>}
      {msgs.map((m) => (
        <div className="msg" key={m}>
          <button className="mt" type="button" onClick={() => onCopy(m, "Mesaj kopyalandı")} title="Tıkla: kopyala">{m}</button>
          <button className="x" type="button" onClick={() => onCopy(m, "Mesaj kopyalandı")}>Kopyala</button>
          <button className="x" type="button" onClick={() => setMsgs((l) => l.filter((x) => x !== m))} aria-label="Mesajı sil">Sil</button>
        </div>
      ))}
    </div>
  );
}
