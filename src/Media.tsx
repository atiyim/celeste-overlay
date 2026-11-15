import { useRef, useState } from "react";
import { feedUploadImage, imgSrc } from "./feed";

/** Taslak görsel: `ref` sunucuya gönderilen değer (yüklenen görselin kimliği ya da GIF/görsel bağlantısı). */
export interface Media { ref: string; preview: string }

/** Paylaşım / yorum yazarken görsel ekleme: dosya seç, yapıştır ya da bağlantı ver (Tenor, Giphy, Imgur…). */
export function useMedia(onToast: (t: string) => void, maxSide = 1280) {
  const [media, setMedia] = useState<Media | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: Blob) => {
    setBusy(true);
    try {
      const id = await feedUploadImage(f, maxSide);
      setMedia({ ref: id, preview: URL.createObjectURL(f) });
      setLink(null);
    } catch (e) { onToast((e as Error).message); }
    setBusy(false);
  };
  const applyLink = () => {
    const v = (link ?? "").trim();
    if (!v) return;
    if (!/^https:\/\/\S+\.(png|jpe?g|webp|gif)(\?\S*)?$/i.test(v)) { onToast("Doğrudan görsel bağlantısı yapıştır (.gif, .png, .jpg, .webp)"); return; }
    setMedia({ ref: v, preview: v }); setLink(null);
  };
  const clear = () => { if (media?.preview.startsWith("blob:")) URL.revokeObjectURL(media.preview); setMedia(null); setLink(null); };
  /** onPaste: panodaki görseli yakalar. */
  const onPaste = (e: React.ClipboardEvent) => {
    const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
    if (f) { e.preventDefault(); upload(f); }
  };

  const buttons = (
    <>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      {!media && <button className="x" type="button" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Yükleniyor" : "Görsel"}</button>}
      {!media && link === null && <button className="x" type="button" onClick={() => setLink("")} title="Tenor, Giphy, Imgur gibi sitelerden doğrudan görsel/GIF bağlantısı">GIF / bağlantı</button>}
    </>
  );
  const extra = (
    <>
      {link !== null && !media && (
        <div className="fcin">
          <input className="inp" autoFocus value={link} placeholder="GIF ya da görsel bağlantısı (Tenor, Giphy, Imgur…)" onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyLink(); }} />
          <button className="x" type="button" onClick={applyLink}>Ekle</button>
          <button className="lnk" type="button" onClick={() => setLink(null)}>Vazgeç</button>
        </div>
      )}
      {media && (
        <div className="fmdraft">
          <img src={media.preview} alt="" />
          <button className="lnk" type="button" onClick={clear}>Kaldır</button>
        </div>
      )}
    </>
  );
  return { media, ref: media?.ref ?? "", clear, onPaste, buttons, extra, busy };
}

/** Akıştaki görsel: tembel yüklenir, tıklayınca büyür; yüklenemezse (süresi dolmuş) yer tutucu gösterir. */
export function FeedImage({ src, small }: { src: string; small?: boolean }) {
  const [big, setBig] = useState(false);
  const [bad, setBad] = useState(false);
  if (bad) return <small className="d fmgone">Görsel artık yok</small>;
  return (
    <button type="button" className={`fmimg${small ? " sm" : ""}${big ? " big" : ""}`} onClick={() => setBig(!big)} aria-label={big ? "Küçült" : "Büyüt"}>
      <img src={imgSrc(src)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} />
    </button>
  );
}
