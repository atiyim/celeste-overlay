import type { ReactNode } from "react";

/* Birden çok ekranı tek bölümde toplayan alt sekmeler (Profilim, Araçlar).
   İçerideki panelin kendi başlığı ve kapat düğmesi burada gizlenir; başlığı bu sekmeler taşır. */
interface Props<T extends string> {
  title: string;
  tabs: readonly (readonly [T, string])[];
  active: T;
  onPick: (id: T) => void;
  children: ReactNode;
}

export function Hub<T extends string>({ title, tabs, active, onPick, children }: Props<T>) {
  return (
    <div className="hub">
      <div className="hubh">
        <h2>{title}</h2>
        <div className="subt" role="tablist" aria-label={title}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? "on" : ""} onClick={() => onPick(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
