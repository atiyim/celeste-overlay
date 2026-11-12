import type { ReactNode } from "react";

/* Arayüz simgeleri: tek çizgi kalınlığı, 24'lük ızgara. Hepsi currentColor ile boyanır. */
const P: Record<string, ReactNode> = {
  users: <><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><path d="M2 21v-1a6 6 0 0 1 12 0v1" /><path d="M16 3.5a4 4 0 0 1 0 7.5" /><path d="M22 21v-1a6 6 0 0 0-4-5.6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  msg: <path d="M4 5h16v11H9l-5 4z" />,
  spark: <><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" /><path d="M19 16.5l.6 1.8 1.9.7-1.9.7-.6 1.8-.6-1.8-1.9-.7 1.9-.7z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6" /><path d="M12 17h.01" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /><circle cx="12" cy="12" r="6.5" /></>,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  power: <path d="M12 3v8M7 6a7 7 0 1 0 10 0" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  repeat: <><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.4" /><path d="M6.6 6.6A16 16 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4.4-1.1" /></>,
  blur: <><circle cx="12" cy="12" r="2" /><circle cx="6" cy="6" r="1" /><circle cx="18" cy="6" r="1" /><circle cx="6" cy="18" r="1" /><circle cx="18" cy="18" r="1" /><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="19" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  text: <><path d="M4 7V5h12v2" /><path d="M10 5v14" /><path d="M7 19h6" /><path d="M15 13v-1h6v1" /><path d="M18 12v7" /></>,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  check: <path d="M5 12l4 4 10-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  store: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v2a3 3 0 0 1-5.3 2A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1A3 3 0 0 1 4 11z" /><path d="M5.5 13.5V20h13v-6.5" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  collapse: <path d="M6 15l6-6 6 6" />,
  expand: <path d="M6 9l6 6 6-6" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, stroke = 1.7 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
