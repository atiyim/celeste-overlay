import type { Notice } from "./community";

/* Öneri / hata gönderene gelen haberler: durum değişikliği ya da ekibin yazdığı mesaj. */
const TITLE: Record<NonNullable<Notice["status"]>, (k: Notice["kind"]) => string> = {
  ele: (k) => (k === "hata" ? "Bildirdiğin hata inceleniyor" : "Önerin inceleniyor"),
  plan: (k) => (k === "hata" ? "Bildirdiğin hatanın düzeltmesi planlandı" : "Önerin planlandı"),
  ekl: (k) => (k === "hata" ? "Bildirdiğin hata düzeltildi" : "Önerin uygulamaya eklendi"),
  yok: (k) => (k === "hata" ? "Bildirdiğin hata incelendi" : "Önerin incelendi"),
};
const SUB: Record<NonNullable<Notice["status"]>, string> = {
  ele: "Celeste ekibi bildirimine bakıyor.",
  plan: "İlerideki bir sürümde gelecek.",
  ekl: "Teşekkürler! Bir sonraki güncellemeyle elinde.",
  yok: "Şimdilik eklenmeyecek. Yine de teşekkürler!",
};

export function NoticeCard({ list, onClose }: { list: Notice[]; onClose: () => void }) {
  const shown = list.slice(-3);
  return (
    <div className="notice" role="status">
      <span className="ni" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg></span>
      <span className="nt">
        {shown.map((n, i) => {
          const st = n.status ?? "ele";
          return (
            <span className="nrow" key={`${n.at}-${i}`}>
              <b>{n.message ? "Celeste ekibinden mesaj" : TITLE[st](n.kind)}</b>
              <small>{n.message ? `“${n.message}”` : SUB[st]}</small>
            </span>
          );
        })}
      </span>
      <button className="x" type="button" onClick={onClose}>Tamam</button>
    </div>
  );
}
