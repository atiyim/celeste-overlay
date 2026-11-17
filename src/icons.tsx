import type { ReactNode } from "react";

/* Arayüz simgeleri: tek çizgi kalınlığı, 24'lük ızgara. Hepsi currentColor ile boyanır. */
const P: Record<string, ReactNode> = {
  users: <><circle cx="9" cy="8" r="3.6" /><path d="M2.5 19.4c0-3.2 2.9-5.4 6.5-5.4s6.5 2.2 6.5 5.4c0 .6-.5 1.1-1.1 1.1H3.6c-.6 0-1.1-.5-1.1-1.1z" /><path d="M16.2 4.7a3.6 3.6 0 0 1 0 6.6" /><path d="M18.6 14.7c1.8.9 2.9 2.5 2.9 4.5" /></>,
  clock: <><circle cx="12" cy="12.5" r="8.5" /><path d="M12 8v4.8l3 1.8" /><path d="M9.5 2.5h5" /></>,
  user: <><circle cx="12" cy="8" r="4.2" /><path d="M4.5 19.4c0-3.5 3.3-5.9 7.5-5.9s7.5 2.4 7.5 5.9c0 .6-.5 1.1-1.1 1.1H5.600c-.6 0-1.1-.5-1.1-1.1z" /></>,
  msg: <><path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-.9 0-1.800-.1-2.600-.3L5 19.800l.900-3.600C4.400 14.900 3.500 13 3.500 11c0-3.900 3.800-7 8.500-7z" /><path d="M8.500 11h.01M12 11h.01M15.500 11h.01" /></>,
  spark: <><path d="M10.5 3c.5 4 2.300 5.800 6.300 6.300-4 .5-5.800 2.300-6.300 6.300-.5-4-2.300-5.800-6.300-6.300 4-.5 5.800-2.300 6.300-6.300z" /><path d="M18 14.500c.2 1.800 1 2.600 2.800 2.800-1.800.2-2.600 1-2.800 2.800-.2-1.800-1-2.600-2.800-2.800 1.800-.2 2.600-1 2.800-2.800z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.300 9.400a2.800 2.800 0 1 1 4 2.500c-.8.400-1.300 1-1.300 1.900" /><path d="M12 17.200h.01" /></>,
  info: <><rect x="3.500" y="3.500" width="17" height="17" rx="5.500" /><path d="M12 11.200v5" /><path d="M12 7.800h.01" /></>,
  gear: <><path d="M12.220 2h-.440a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.730l-.430.250a2 2 0 0 1-2 0l-.150-.080a2 2 0 0 0-2.730.730l-.220.380a2 2 0 0 0 .730 2.730l.150.100a2 2 0 0 1 1 1.720v.510a2 2 0 0 1-1 1.740l-.150.090a2 2 0 0 0-.730 2.730l.220.380a2 2 0 0 0 2.730.730l.150-.080a2 2 0 0 1 2 0l.430.250a2 2 0 0 1 1 1.730V20a2 2 0 0 0 2 2h.440a2 2 0 0 0 2-2v-.180a2 2 0 0 1 1-1.730l.430-.250a2 2 0 0 1 2 0l.150.080a2 2 0 0 0 2.730-.730l.220-.390a2 2 0 0 0-.730-2.730l-.150-.080a2 2 0 0 1-1-1.740v-.500a2 2 0 0 1 1-1.740l.150-.090a2 2 0 0 0 .730-2.730l-.220-.380a2 2 0 0 0-2.730-.730l-.150.080a2 2 0 0 1-2 0l-.430-.250a2 2 0 0 1-1-1.730V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
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
  eye: <><path d="M2.5 12s3.6-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.6 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
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
  crown: <><path d="M4.300 17.500L2.800 8.600l5 3.400L12 5.800l4.200 6.200 5-3.400-1.500 8.900z" /><path d="M5 20.500h14" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  volume: <><path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z" /><path d="M15.500 9a4 4 0 0 1 0 6" /><path d="M18.200 6.500a7.500 7.500 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z" /><path d="M16 9.500l5 5M21 9.500l-5 5" /></>,
  play: <path d="M8 5.500v13l11-6.500z" />,
  pause: <><rect x="6.500" y="5" width="3.800" height="14" rx="1" /><rect x="13.700" y="5" width="3.800" height="14" rx="1" /></>,
  map: <><path d="M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  heart: <path d="M12 19.5s-7.5-4.400-7.500-9.800A4.200 4.200 0 0 1 12 7.300a4.200 4.200 0 0 1 7.500 2.400c0 5.400-7.500 9.800-7.500 9.800z" />,
  star: <path d="M12 3.500l2.600 5.300 5.900.900-4.300 4.100 1 5.800-5.200-2.800-5.200 2.800 1-5.800-4.300-4.100 5.900-.900z" />,
  image: <><rect x="3.500" y="4.500" width="17" height="15" rx="3.500" /><circle cx="9" cy="10" r="1.800" /><path d="M20.500 15.500l-4.600-4.300-8.900 8.300" /></>,
  trophy: <><path d="M8 4.500h8v5a4 4 0 0 1-8 0z" /><path d="M8 6.500H5a2.500 2.500 0 0 0 3 3.800M16 6.500h3a2.500 2.500 0 0 1-3 3.800" /><path d="M12 13.500v3M8.500 19.500h7l-.8-3h-5.400z" /></>,
  flame: <path d="M12 21c-3.900 0-6.500-2.600-6.500-6.200 0-3.900 3.300-5.900 4-10.300 2.300 1.400 3.600 3.300 3.900 5.500.9-.6 1.500-1.600 1.700-2.800 2 1.700 3.400 4.300 3.400 7.200 0 3.800-2.600 6.600-6.500 6.600z" />,
  upload: <><path d="M12 15.500v-11M7.500 9L12 4.500 16.500 9" /><path d="M4.500 15.500v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" /></>,
  collapse: <path d="M6 15l6-6 6 6" />,
  expand: <path d="M6 9l6 6 6-6" />,
};

export type IconName = keyof typeof P;

/* Yumuşak dolgulu (duotone) simgeler: kapalı şekillerin içi, çizgi renginin açık tonuyla dolar; böylece küçük boyutta
   da seçilir ve daha dolgun, "tatlı" görünür. Düz çizgi kalması gerekenler (oklar, çarpı, eksi…) listede yok. */
const SOFT = new Set<string>(["users", "user", "msg", "chat", "spark", "help", "info", "gear", "clock", "shield", "moon", "bolt", "store", "target", "timer", "layers", "lock", "crown", "mouse", "link", "repeat", "chart", "search", "sliders", "power", "text", "eyeoff", "blur", "check", "play", "pause", "map", "heart", "star", "image", "trophy", "flame"]);
const NOFILL = new Set<string>(["link", "repeat", "chart", "search", "sliders", "power", "text", "eyeoff", "blur", "check"]);

export function Icon({ name, size = 18, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  const soft = SOFT.has(name) && !NOFILL.has(name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={soft ? "currentColor" : "none"} fillOpacity={soft ? 0.24 : undefined} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
