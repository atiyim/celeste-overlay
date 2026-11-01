/* Akış rollerinin simgeleri (16×16, dolgu). Site aynı anahtarları kabul eder. */
export const ROLE_ICON_PATHS: Record<string, string> = {
  crown: "M2 12.5h12l1-7.5-4 3.2L8 3 5 8.2 1 5z",
  code: "M5.6 4.2 1.8 8l3.8 3.8 1.1-1.1L3.9 8l2.8-2.7zm4.8 0L9.3 5.3 12.1 8l-2.8 2.7 1.1 1.1L14.2 8z",
  star: "M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3l-4 2.2 1-4.4-3.4-3 4.5-.5z",
  shield: "M8 1.5 2.5 3.5v4.2c0 3.2 2.3 5.9 5.5 6.8 3.2-.9 5.5-3.6 5.5-6.8V3.5z",
  heart: "M8 14s-5.5-3.4-5.5-7.4A3 3 0 0 1 8 4.3a3 3 0 0 1 5.5 2.3C13.5 10.6 8 14 8 14z",
  bolt: "M9 1.5 3 9h4l-1 5.5L12 7H8z",
  flame: "M8 1.5s4.5 3.3 4.5 7.3A4.5 4.5 0 0 1 8 13.5a4.5 4.5 0 0 1-4.5-4.7c0-2 1.3-3.3 1.3-3.3S5 7.5 6.5 8c0-3.2 1.5-6.5 1.5-6.5z",
  gem: "M4 2h8l3 4-7 8.5L1 6zm-.6 4h9.2L8 12z",
  bug: "M5.5 4a2.5 2.5 0 0 1 5 0zM3 6.5h10v3a5 5 0 0 1-10 0zM1 8h2m10 0h2M2 12l1.5-1M14 12l-1.5-1",
  bulb: "M8 1.5a4.5 4.5 0 0 0-2.7 8.1V11h5.4V9.6A4.5 4.5 0 0 0 8 1.5zM5.8 12.3h4.4v1.2H5.8zm1 1.7h2.4v.8H6.8z",
  mic: "M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V4A2.5 2.5 0 0 0 8 1.5zM3.5 7.5h1.2a3.3 3.3 0 0 0 6.6 0h1.2a4.5 4.5 0 0 1-3.9 4.4v1.6h2v1.2H5.4v-1.2h2v-1.6a4.5 4.5 0 0 1-3.9-4.4z",
  trophy: "M4 1.5h8v1.5h2.5v1.5A3 3 0 0 1 11.7 7.5 4 4 0 0 1 8.8 10v2h2.7v2h-7v-2h2.7v-2a4 4 0 0 1-2.9-2.5A3 3 0 0 1 1.5 4.5V3H4zM2.9 4.4a1.6 1.6 0 0 0 1.1 1.5V4.4zm9.1 0v1.5a1.6 1.6 0 0 0 1.1-1.5z",
  sword: "M13.5 1.5h1v1L8 9l1.5 1.5-1 1-1.3-1.3-2.6 2.6.9.9-1 1-3-3 1-1 .9.9 2.6-2.6L4.7 7.7l1-1L7 8z",
  check: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm-1.1 9.6L3.8 8l1.1-1.1 2 2 4.2-4.2 1.1 1.1z",
};
export const ROLE_ICON_NAMES: Record<string, string> = {
  crown: "Taç", code: "Kod", star: "Yıldız", shield: "Kalkan", heart: "Kalp", bolt: "Şimşek", flame: "Alev", gem: "Elmas",
  bug: "Böcek", bulb: "Fikir", mic: "Mikrofon", trophy: "Kupa", sword: "Kılıç", check: "Onay",
};
const STROKE = new Set(["bug"]);

export function RoleIcon({ name, size = 10 }: { name?: string; size?: number }) {
  const d = name ? ROLE_ICON_PATHS[name] : undefined;
  if (!d) return null;
  return STROKE.has(name!)
    ? <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d={d} /></svg>
    : <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d={d} /></svg>;
}
