/* Uygulamanın ikonları: hepsi kodun içinde çizilir (ek indirme yok). */

/** Celeste logosu: beş yıldızlı takımyıldız (1B). `tile`: koyu zeminli uygulama ikonu hali. */
export function Logo({ size = 40, tile = false }: { size?: number; tile?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="lg-star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a9dcff" /><stop offset="1" stopColor="#2f8fd6" /></linearGradient>
        <radialGradient id="lg-bg" cx=".5" cy=".35" r=".8"><stop offset="0" stopColor="#0f1a26" /><stop offset="1" stopColor="#06080d" /></radialGradient>
      </defs>
      {tile && <rect width="100" height="100" rx="22" fill="url(#lg-bg)" />}
      <g transform={tile ? "translate(4.5 0)" : "translate(50 50) scale(1.3) translate(-45.5 -50)"}>
        <polyline points="68.3,27.1 37.9,28.4 25,50 37.9,71.6 68.3,72.9" fill="none" stroke="#5ab9f2" strokeOpacity=".55" strokeWidth={size < 32 ? 3 : 1.6} strokeLinejoin="round" />
        <path d="M68.3 20.6 L72.34 27.1 L68.3 33.6 L64.28 27.1 Z M37.9 21.9 L41.94 28.4 L37.9 34.9 L33.88 28.4 Z M25 40 L31.2 50 L25 60 L18.8 50 Z M37.9 65.1 L41.94 71.6 L37.9 78.1 L33.88 71.6 Z M68.3 66.4 L72.34 72.9 L68.3 79.4 L64.28 72.9 Z" fill="url(#lg-star)" />
      </g>
    </svg>
  );
}

const S = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconLobby = () => (
  <svg {...S}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.4-.3 4.1 1.3 4.6 4" /></svg>
);
export const IconStore = () => (
  <svg {...S}><path d="M4.5 8h15l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5" /></svg>
);
export const IconCollection = () => (
  <svg {...S}><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></svg>
);
export const IconProfile = () => (
  <svg {...S}><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" /></svg>
);
export const IconGear = () => (
  <svg {...S} width={20} height={20}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
export const IconStar = ({ on }: { on: boolean }) => (
  <svg {...S} width={18} height={18} fill={on ? "currentColor" : "none"}><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" /></svg>
);
export const IconSearch = () => (
  <svg {...S} width={18} height={18}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.3-4.3" /></svg>
);
