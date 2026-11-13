import type { Role } from "./feed";
import { RoleIcon } from "./roleIcons";

/* Rol rozetleri: Akış, lobi satırları ve üst çubuk aynı bileşeni kullanır. */
/** Zemin rengine göre okunur yazı rengi. */
export function ink(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#140d00" : "#ffffff";
}
export const adminOf = (roles: Role[]) => roles.find((r) => r.admin);

/** `compact`: lobi satırı gibi kalabalık yerlerde; parıltı animasyonu olmaz. */
export function Roles({ roles, compact }: { roles: Role[]; compact?: boolean }) {
  if (!roles.length) return null;
  return (
    <span className={compact ? "froles cp" : "froles"}>
      {roles.map((r) => (
        <span key={r.name} className={r.admin || r.glow ? "frole adm" : "frole"} style={{ "--rc": r.color, "--rt": ink(r.color) } as React.CSSProperties} title={r.admin ? "Celeste Overlay yöneticisi" : `Rol: ${r.name}`}><RoleIcon name={r.icon ?? (r.admin ? "crown" : undefined)} />{r.name}</span>
      ))}
    </span>
  );
}
