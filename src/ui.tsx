import type { ReactNode } from "react";

/* Ortak arayüz parçaları: bütün paneller aynı başlığı, düğmeleri ve anahtarları kullanır. */

/** "İsim#ETİKET" → ["İsim", "#ETİKET"]. Etiket yoksa ikinci parça boş. */
export function splitName(name?: string | null): [string, string] {
  if (!name) return ["", ""];
  const i = name.lastIndexOf("#");
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""];
}

/** Uzun isimde yalnızca isim kısalır; Riot etiketi ve yanındaki rozetler her zaman görünür kalır. */
export function NameLine({ name, children, className }: { name: string; children?: ReactNode; className?: string }) {
  const [game, tag] = splitName(name);
  return (
    <span className={className ? `nl ${className}` : "nl"}>
      <span className="nm pn" title={name}>{game}</span>
      {tag && <span className="ntag pn">{tag}</span>}
      {children}
    </span>
  );
}

export function CloseButton({ onClick, label = "Kapat" }: { onClick: () => void; label?: string }) {
  return (
    <button className="xclose" type="button" onClick={onClick} aria-label={label} title={label}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  );
}

/** Panel başlığı: solda başlık ve kısa açıklama, sağda işlemler ve kapat. */
export function PanelHead({ title, sub, actions, onClose }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; onClose?: () => void }) {
  return (
    <div className="ph">
      <div className="phl">
        <h2 className="t">{title}</h2>
        {sub && <p className="m">{sub}</p>}
      </div>
      <div className="phr">
        {actions}
        {onClose && <CloseButton onClick={onClose} />}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" className={on ? "tgl on" : "tgl"} aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
    ><i /></button>
  );
}

/** Ayar satırı: solda başlık ve açıklama, sağda denetim. */
export function Row({ title, desc, children, dim }: { title: ReactNode; desc?: ReactNode; children?: ReactNode; dim?: boolean }) {
  return (
    <div className={dim ? "srow dim" : "srow"}>
      <div className="slbl"><b>{title}</b>{desc && <span>{desc}</span>}</div>
      {children != null && <div className="sctl">{children}</div>}
    </div>
  );
}
