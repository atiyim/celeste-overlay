import { useEffect, useState } from "react";

/* Hızlı mesajlar: kısaltmayı yaz, Enter'a bas, karşılığı panoya kopyalanır.
   Oyunda sohbeti aç, Ctrl+V ile yapıştır, Enter ile gönder. Oyuna tuş vuruşu gönderilmez. */
interface Rule { key: string; text: string }
const STORE = "overlay-chat-rules";
const DEFAULTS: Rule[] = [
  { key: "sa", text: "selamün aleyküm" },
  { key: "ggs", text: "naber" },
];

export function loadChatRules(): Rule[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as Rule[] | null;
    return Array.isArray(v) ? v : DEFAULTS;
  } catch { return DEFAULTS; }
}

interface Props { onCopy: (text: string) => void; onMessage: (msg: string) => void; onClose: () => void }

export function QuickChat({ onCopy, onMessage, onClose }: Props) {
  const [rules, setRules] = useState<Rule[]>(loadChatRules);
  const [typed, setTyped] = useState("");
  const [nk, setNk] = useState("");
  const [nt, setNt] = useState("");

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(rules)); } catch { /* depolama dolu */ }
    window.dispatchEvent(new Event("chat-rules-changed")); // oyun içi değiştirme kuralları yenilensin
  }, [rules]);

  const run = () => {
    const q = typed.trim().toLowerCase();
    if (!q) return;
    const r = rules.find((x) => x.key.toLowerCase() === q);
    if (r) { onCopy(r.text); setTyped(""); } else onMessage(`"${typed.trim()}" için kısayol yok`);
  };
  const add = () => {
    const k = nk.trim(), t = nt.trim();
    if (!k || !t) return;
    setRules((rs) => [...rs.filter((x) => x.key.toLowerCase() !== k.toLowerCase()), { key: k, text: t }]);
    setNk(""); setNt("");
  };

  return (
    <div className="panel" role="dialog" aria-label="Hızlı mesajlar">
      <div className="ph">
        <div>
          <h2 className="t">Hızlı mesajlar</h2>
          <p className="m">Kısaltmayı yaz, Enter'a bas: karşılığı panoya kopyalanır. Oyunda sohbeti aç, Ctrl+V ile yapıştır, Enter ile gönder. Oyun içinde kendiliğinden değiştirme için Ayarlar'a bak (deneysel).</p>
        </div>
        <button className="x" type="button" onClick={onClose}>Kapat</button>
      </div>

      <div className="note">
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); e.stopPropagation(); }}
          placeholder="Kısaltma yaz (örn. sa) ve Enter"
          aria-label="Kısaltma"
        />
        <button className="x" type="button" onClick={run}>Kopyala</button>
      </div>

      <h2 className="h">Kısayollar</h2>
      {rules.length === 0 && <p className="d none">Henüz kısayol yok</p>}
      {rules.map((r) => (
        <div className="rule" key={r.key}>
          <code>{r.key}</code>
          <span className="d">→</span>
          <span className="rt">{r.text}</span>
          <button className="x" type="button" onClick={() => onCopy(r.text)}>Kopyala</button>
          <button className="x" type="button" onClick={() => setRules((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`${r.key} kısayolunu sil`}>Sil</button>
        </div>
      ))}

      <h2 className="h">Yeni kısayol</h2>
      <div className="note">
        <input className="short" value={nk} onChange={(e) => setNk(e.target.value)} placeholder="Kısaltma" aria-label="Yeni kısaltma" onKeyDown={(e) => e.stopPropagation()} />
        <input value={nt} onChange={(e) => setNt(e.target.value)} placeholder="Mesaj" aria-label="Yeni mesaj" onKeyDown={(e) => { if (e.key === "Enter") add(); e.stopPropagation(); }} />
        <button className="x" type="button" onClick={add}>Ekle</button>
      </div>
    </div>
  );
}
