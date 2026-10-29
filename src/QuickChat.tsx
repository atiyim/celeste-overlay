import { useEffect, useState } from "react";
import { PanelHead } from "./ui";

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
      <PanelHead title="Hızlı mesajlar" sub="Mesajı yaz ve ekle. Listeden birine tıklayınca kopyalanır; oyunda sohbeti açıp Ctrl+V ile yapıştır." onClose={onClose} />

      <div className="note">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); e.stopPropagation(); }}
          placeholder="Yeni mesaj"
          aria-label="Yeni mesaj"
        />
        <button className="x go" type="button" onClick={add} disabled={!text.trim()}>Ekle</button>
      </div>

      <h2 className="h">Mesajlarım<span className="hv">{msgs.length} mesaj</span></h2>
      <div className="box pad">
      {msgs.length === 0 && <p className="d none">Henüz mesaj yok. Yukarıya yazıp Ekle'ye bas.</p>}
      {msgs.map((m) => (
        <div className="msg" key={m}>
          <button className="mt" type="button" onClick={() => onCopy(m, "Mesaj kopyalandı")} title="Tıkla: kopyala">{m}</button>
          <button className="x" type="button" onClick={() => onCopy(m, "Mesaj kopyalandı")}>Kopyala</button>
          <button className="x" type="button" onClick={() => setMsgs((l) => l.filter((x) => x !== m))} aria-label="Mesajı sil">Sil</button>
        </div>
      ))}
      </div>
    </div>
  );
}
