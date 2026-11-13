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
  full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  unfull: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  power: <path d="M12 3v8M7 6a7 7 0 1 0 10 0" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  repeat: <><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.4" /><path d="M6.6 6.6A16 16 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4.4-1.1" /></>,
  blur: <><circle cx="12" cy="12" r="2" /><circle cx="6" cy="6" r="1" /><circle cx="18" cy="6" r="1" /><circle cx="6" cy="18" r="1" /><circle cx="18" cy="18" r="1" /><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="19" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  text: <><path d="M4 7V5h12v2" /><path d="M10 5v14" /><path d="M7 19h6" /><path d="M15 13v-1h6v1" /><path d="M18 12v7" /></>,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  check: <path d="M5 12l4 4 10-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  store: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v2a3 3 0 0 1-5.3 2A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1A3 3 0 0 1 4 11z" /><path d="M5.5 13.5V20h13v-6.5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /><circle cx="12" cy="12" r="1" /></>,
  mouse: <><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9.5 2.5h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  crown: <path d="M4 18h16l1.5-10-5 3.5L12 5 7.5 11.5 2.5 8z" />,
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

/** Discord logosu (marka rengi, dolgulu). */
export function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
