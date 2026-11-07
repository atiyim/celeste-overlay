import { useState } from "react";
import { Privacy } from "./Settings";
import { t } from "./i18n";

/* Giriş ekranı: tek bir an hareket var, takımyıldızın çizilmesi. Gerisi sakin. */

const STARS: [number, number, number][] = [[68.3, 27.1, 6.5], [37.9, 28.4, 6.5], [25, 50, 10], [37.9, 71.6, 6.5], [68.3, 72.9, 6.5]];
const diamond = ([x, y, s]: [number, number, number]) => `M${x} ${y - s} L${x + s * 0.62} ${y} L${x} ${y + s} L${x - s * 0.62} ${y} Z`;

function Mark() {
  return (
    <div className="lg-mark" aria-hidden="true">
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id="lm-star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c9e9ff" /><stop offset="1" stopColor="#3a9ae0" /></linearGradient>
        </defs>
        <g transform="translate(4.5 0)">
          <polyline className="lm-line" pathLength={1} points="68.3,27.1 37.9,28.4 25,50 37.9,71.6 68.3,72.9" fill="none" stroke="#5ab9f2" strokeOpacity=".6" strokeWidth="1.1" strokeLinejoin="round" />
          {STARS.map((s, i) => <path key={i} className="lm-star" style={{ animationDelay: `${0.12 + i * 0.11}s` }} d={diamond(s)} fill="url(#lm-star)" />)}
        </g>
      </svg>
    </div>
  );
}

const IcLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></svg>
);
const IcPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.4" /><path d="M11 17.5h2" /></svg>
);
const IcEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.8 12s3.4-6.2 9.2-6.2 9.2 6.2 9.2 6.2-3.4 6.2-9.2 6.2S2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.6" /></svg>
);

export function Login({ busy, error, onLogin }: { busy: boolean; error?: string | null; onLogin: () => void }) {
  const [privacy, setPrivacy] = useState(false);
  if (privacy) return <Privacy onClose={() => setPrivacy(false)} />;
  const notes: [() => React.ReactElement, string, string][] = [
    [IcLock, t("note1t"), t("note1")],
    [IcPhone, t("note2t"), t("note2")],
    [IcEye, t("note3t"), t("note3")],
  ];
  return (
    <main className="login">
      <div className="lg-inner">
        <header className="lg-hero">
          <Mark />
          <h1>Celeste</h1>
          <p>{t("tagline")}</p>
        </header>

        <div className="lg-cta">
          <button className="btn pri big" type="button" onClick={onLogin} disabled={busy} aria-busy={busy}>
            {busy && <span className="spin" aria-hidden="true" />}
            {busy ? t("loggingIn") : t("login")}
          </button>
          <small>{t("loginHint")}</small>
          {error && <p className="err" role="alert">{error}</p>}
        </div>

        <section className="lg-how" aria-labelledby="lg-how-t">
          <h2 id="lg-how-t">{t("howTitle")}</h2>
          <ul>
            {notes.map(([Icon, title, text]) => (
              <li key={title}>
                <span className="lg-ic"><Icon /></span>
                <span><b>{title}</b><span>{text}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="lg-foot">
          <button type="button" className="link" onClick={() => setPrivacy(true)}>{t("privacyLink")}</button>
          <small>{t("notAffiliated")}</small>
        </footer>
      </div>
    </main>
  );
}
