import type { ReactNode } from "react";
import type { Status } from "./types";
import { fmtDur, fmtRr, type Session } from "./tilt";
import { Icon, type IconName } from "./icons";

/* Lobi boşken (maç beklenirken ya da bağlantı kurulurken) gösterilen karşılama ekranı.
   Solda ne beklendiğini adım adım anlatan kart, sağda beklerken işe yarayan kısayollar. */
type Step = { label: string; state: "done" | "wait" | "todo" | "bad" };

interface Props {
  inApp: boolean;
  status?: Status;
  phase: string;
  assetsOk: boolean;
  assetsFailed: boolean;
  text: ReactNode;
  onRetry?: () => void;
  sess: Session | null;
  feedCount: number;
  feedNote: boolean;
  hasLastMatch: boolean;
  onGo: (v: "store" | "feed" | "report" | "stats") => void;
}

export function Waiting({ inApp, status: st, phase, assetsOk, assetsFailed, text, onRetry, sess, feedCount, feedNote, hasLastMatch, onGo }: Props) {
  const title = assetsFailed ? "Görseller yüklenemedi"
    : !assetsOk ? "Hazırlanıyor"
    : !inApp ? "Maç bekleniyor"
    : !st ? "Bağlanılıyor"
    : !st.riotClient ? "Riot Client kapalı"
    : !st.valorant ? "Valorant'ı başlat"
    : st.fault || !st.data ? "Bağlantıda sorun var"
    : phase === "menu" ? "Kuyruğa gir, gerisi hazır"
    : "Maç bekleniyor";

  const steps: Step[] = [
    { label: "Riot Client açık", state: !inApp || !st ? "wait" : st.riotClient ? "done" : "bad" },
    { label: "Valorant çalışıyor", state: !inApp || !st ? "todo" : st.valorant ? "done" : st.riotClient ? "wait" : "todo" },
    { label: "Ajan seçimi bekleniyor", state: inApp && st?.valorant && st.data ? "wait" : "todo" },
  ];

  const go = (v: Parameters<Props["onGo"]>[0], icon: IconName, label: string, sub: string, badge?: string) => (
    <button type="button" className="wgo" onClick={() => onGo(v)}>
      <span className="wgi"><Icon name={icon} size={18} /></span>
      <span><b>{label}{badge && <em>{badge}</em>}</b><small>{sub}</small></span>
      <Icon name="chevron" size={16} />
    </button>
  );

  return (
    <div className="waitv" role="status">
      <section className="hero">
        <img className="heroimg" src="/celeste-moon.webp" alt="" draggable={false} />
        <div className="herot">
          <h2>{title}</h2>
          <p>{text}</p>
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.label} className={`step ${s.state}`}>
                <span className="sc">{s.state === "done" ? <Icon name="check" size={12} stroke={2.4} /> : s.state === "bad" ? <Icon name="x" size={12} stroke={2.4} /> : null}</span>
                {s.label}
              </li>
            ))}
          </ol>
          {onRetry && <button className="x" type="button" onClick={onRetry}>Tekrar dene</button>}
        </div>
      </section>

      <div className="wside">
        {sess && sess.games > 0 && (
          <section className="wcard">
            <h4>Bugünkü seansın <small>{fmtDur(sess.minutes)}</small></h4>
            <div className="wbig">
              <b>{sess.wins}G {sess.losses}M</b>
              <span className={sess.rr < 0 ? "neg" : sess.rr > 0 ? "pos" : ""}>{fmtRr(sess.rr)}</span>
            </div>
          </section>
        )}
        <section className="wcard wlinks">
          <h4>Beklerken</h4>
          {go("store", "store", "Mağazan", "Günlük teklifler ve cüzdan")}
          {go("feed", "msg", "Akış", "Topluluğun paylaşımları", feedCount > 0 ? `${feedCount > 9 ? "9+" : feedCount} ${feedNote ? "bildirim" : "yeni"}` : undefined)}
          {hasLastMatch ? go("report", "clock", "Son maçın", "Skor tablosu ve round özeti") : go("stats", "user", "İstatistiklerin", "Son maçların ve rankın")}
        </section>
      </div>
    </div>
  );
}
