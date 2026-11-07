import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { setPrefs, usePrefs, useBackClose, wakeLockSupported, type Prefs } from "./prefs";
import { lang, setLang, t } from "./i18n";
import { checkUpdate } from "./update";
import { Logo } from "./icons";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? "sw-t on" : "sw-t"} onClick={() => onChange(!on)}><i /></button>;
}

/* Gizlilik: hangi veri nereden gelir, nerede durur. Uygulamanın gerçekte yaptığıyla birebir. */
const PRIVACY = {
  tr: [
    ["Giriş", "Riot ile giriş, Riot'un kendi sayfasında (auth.riotgames.com) yapılır. Şifren uygulamaya hiç gelmez."],
    ["Riot oturumu", "Riot'un verdiği oturum, telefonun bu uygulamaya ait tarayıcı bölümünde durur. Uygulamanın kullandığı erişim belgesi yalnızca uygulama açıkken bellekte tutulur. \"Çıkış yap\" ikisini de siler."],
    ["Okunan veriler", "Lobideki oyuncular, ranklar, kaplamalar, mağazan, maç geçmişin, görevlerin ve sahip olduğun kaplamalar. Hepsi doğrudan Riot'un sunucularından okunur. Uygulama oyunda hiçbir işlem yapmaz."],
    ["Bağlandığı yerler", "Riot'un sunucuları (oyun verisi), valorant-api.com (ajan, harita ve kaplama görselleri) ve GitHub (yeni sürüm denetimi). Celeste'nin sunucusuna hiçbir veri gitmez."],
    ["Telefonda kalanlar", "Ayarların, istek listen ve görsel önbelleği. Uygulamayı silince hepsi silinir."],
    ["Yok", "Reklam, analiz, takip ya da hesabını başkasıyla paylaşma yok."],
  ],
  en: [
    ["Sign-in", "You sign in on Riot's own page (auth.riotgames.com). Your password never reaches the app."],
    ["Riot session", "The session Riot gives you stays in this app's own browser storage on your phone. The access token the app uses is only kept in memory while the app is open. \"Sign out\" removes both."],
    ["What it reads", "Players in your lobby, ranks, skins, your store, match history, missions and owned skins. All read straight from Riot's servers. The app never does anything in the game."],
    ["Where it connects", "Riot's servers (game data), valorant-api.com (agent, map and skin images) and GitHub (update check). No data goes to Celeste's server."],
    ["Stored on your phone", "Your settings, wishlist and image cache. Uninstalling the app removes all of it."],
    ["Never", "No ads, analytics, tracking or sharing your account with anyone."],
  ],
} as const;

export function Privacy({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose);
  return (
    <div className="page">
      <header className="top"><button type="button" className="link" onClick={onClose}>‹ {t("back")}</button><b>{t("privacy")}</b><span /></header>
      <main className="body set">
        {PRIVACY[lang].map(([h, p]) => <section key={h} className="pv"><b>{h}</b><p>{p}</p></section>)}
        <p className="fine">{t("notAffiliated")}</p>
      </main>
    </div>
  );
}

export function Settings({ riot, onClose, onLogout, onSwitch, onFeedback }: { riot?: string | null; onClose: () => void; onLogout: () => void; onSwitch: () => void; onFeedback: () => void }) {
  const p = usePrefs();
  const [ver, setVer] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [upd, setUpd] = useState<{ state: "idle" | "busy" | "none" | "err" } | { state: "found"; v: string; url: string }>({ state: "idle" });
  useBackClose(true, onClose);
  useEffect(() => { getVersion().then(setVer).catch(() => undefined); }, []);

  const check = async () => {
    setUpd({ state: "busy" });
    try {
      const u = await checkUpdate(ver || "0", true);
      setUpd(u ? { state: "found", v: u.version, url: u.url } : { state: "none" });
    } catch { setUpd({ state: "err" }); }
  };

  if (privacy) return <Privacy onClose={() => setPrivacy(false)} />;

  return (
    <div className="page">
      <header className="top">
        <b>{t("settings")}</b>
        <button type="button" className="link" onClick={onClose}>{t("doneBtn")}</button>
      </header>
      <main className="body set">
        <h2 className="grp">{t("sLobby")}</h2>
        <div className="set-box">
          <div className="set-row col">
            <span><b>{t("interval")}</b><small>{t("intervalHelp")}</small></span>
            <div className="seg" role="radiogroup" aria-label={t("interval")}>
              {([3, 5, 10] as Prefs["interval"][]).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={p.interval === n} className={p.interval === n ? "on" : ""} onClick={() => setPrefs({ interval: n })}>{t("sec", { n })}</button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <span><b>{t("enemySkins")}</b><small>{t("enemySkinsHelp")}</small></span>
            <Toggle label={t("enemySkins")} on={p.enemySkins} onChange={(v) => setPrefs({ enemySkins: v })} />
          </div>
          <div className="set-row">
            <span><b>{t("keepAwake")}</b><small>{wakeLockSupported ? t("keepAwakeHelp") : t("keepAwakeNo")}</small></span>
            <Toggle label={t("keepAwake")} on={p.keepAwake && wakeLockSupported} onChange={(v) => setPrefs({ keepAwake: v })} />
          </div>
        </div>

        <h2 className="grp">{t("sAccount")}</h2>
        <div className="set-box">
          <div className="set-row"><span><b>{riot ?? "Riot"}</b><small>{t("loggedHere")}</small></span></div>
          <button type="button" className="set-row" onClick={onSwitch}><span><b>{t("switchAccount")}</b><small>{t("switchHelp")}</small></span><i className="chev">›</i></button>
          <button type="button" className="set-row danger" onClick={onLogout}><span><b>{t("logout")}</b><small>{t("logoutHelp")}</small></span></button>
        </div>

        <h2 className="grp">{t("sGeneral")}</h2>
        <div className="set-box">
          <div className="set-row col">
            <span><b>{t("language")}</b></span>
            <div className="seg" role="radiogroup" aria-label={t("language")}>
              <button type="button" role="radio" aria-checked={lang === "tr"} className={lang === "tr" ? "on" : ""} onClick={() => lang !== "tr" && setLang("tr")}>Türkçe</button>
              <button type="button" role="radio" aria-checked={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => lang !== "en" && setLang("en")}>English</button>
            </div>
          </div>
          <button type="button" className="set-row" onClick={onFeedback}><span><b>{t("fbRow")}</b><small>{t("fbRowHelp")}</small></span><i className="chev">›</i></button>
          <button type="button" className="set-row" onClick={() => setPrivacy(true)}><span><b>{t("privacy")}</b><small>{t("privacyHelp")}</small></span><i className="chev">›</i></button>
        </div>

        <h2 className="grp">{t("sAbout")}</h2>
        <div className="set-box">
          <div className="set-row about-row"><Logo size={36} tile /><span><b>Celeste</b><small>{ver ? t("version", { v: ver }) : ""}</small></span></div>
          {upd.state === "found" ? (
            <button type="button" className="set-row accent" onClick={() => openUrl(upd.url).catch(() => undefined)}><span><b>{t("updTitle", { v: upd.v })}</b><small>{t("updText")}</small></span><i className="chev">›</i></button>
          ) : (
            <button type="button" className="set-row" onClick={check} disabled={upd.state === "busy"}>
              <span><b>{t("checkUpdate")}</b><small>{upd.state === "busy" ? t("checking") : upd.state === "none" ? t("upToDate") : upd.state === "err" ? t("updateErr") : ""}</small></span>
            </button>
          )}
          <div className="set-row"><p className="about-text">{t("aboutText")}</p></div>
        </div>
        <p className="fine">{t("notAffiliated")}</p>
      </main>
    </div>
  );
}
