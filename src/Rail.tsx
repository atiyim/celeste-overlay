import type { MouseEvent } from "react";
import { Icon, type IconName } from "./icons";

/* Sol menü: bölümler gruplanmış simgeler. Üstüne gelince adı görünür.
   Boş alanından tutup pencere sürüklenebilir. */
export type Group = "roster" | "report" | "profile" | "feed" | "tools" | "trust" | "settings";

interface Item { id: Group; label: string; icon: IconName }
const TOP: Item[] = [
  { id: "roster", label: "Lobi", icon: "users" },
  { id: "report", label: "Son maç", icon: "clock" },
  { id: "profile", label: "Profilim", icon: "user" },
  { id: "feed", label: "Akış", icon: "msg" },
  { id: "tools", label: "Araçlar", icon: "spark" },
];
const BOTTOM: Item[] = [
  { id: "trust", label: "S.S.S ve güven", icon: "help" },
  { id: "settings", label: "Ayarlar", icon: "gear" },
];

interface Props {
  active: Group;
  onPick: (g: Group) => void;
  /** Akış: okunmamış bildirim ya da yeni paylaşım sayısı. */
  feedCount: number;
  feedNote: boolean;
  onDrag: (e: MouseEvent) => void;
}

export function Rail({ active, onPick, feedCount, feedNote, onDrag }: Props) {
  const btn = (it: Item) => {
    const badge = it.id === "feed" && feedCount > 0;
    const label = badge ? `${it.label}, ${feedCount} ${feedNote ? "bildirim" : "yeni paylaşım"}` : it.label;
    return (
      <button
        key={it.id}
        type="button"
        className={active === it.id ? "ri on" : "ri"}
        aria-current={active === it.id ? "page" : undefined}
        aria-label={label}
        onClick={() => onPick(it.id)}
      >
        <Icon name={it.icon} size={20} />
        {badge && <i className={feedNote ? "rdot note" : "rdot"} aria-hidden="true" />}
        <span className="rtip" aria-hidden="true">{label}</span>
      </button>
    );
  };
  // Düğme dışında bir yere basılınca pencere sürüklenir.
  const drag = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("button")) onDrag(e); };

  return (
    <nav className="rail" aria-label="Bölümler" onMouseDown={drag}>
      <img className="rlogo" src="/celeste-mark.png" alt="Celeste Overlay" draggable={false} />
      {TOP.map(btn)}
      <span className="rsp" />
      {BOTTOM.map(btn)}
    </nav>
  );
}
