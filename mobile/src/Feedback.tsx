import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useBackClose } from "./prefs";
import { t } from "./i18n";

/* Öneri / Hata formu: masaüstü uygulamasıyla aynı adrese gider; Celeste botu yetkililerin kanalına koyar.
   Gönderilen: tür, yazı, isteğe bağlı Discord adı, Riot ID, sürüm, bu telefonun rastgele kimliği, isteğe bağlı tanı bilgisi. */

export const SITE = "https://celeste-feed.celestimbenim.workers.dev";
const API = `${SITE}/api/overlay/feedback`;
const ID_KEY = "overlay-install-id";
const CONTACT_KEY = "overlay-feedback-contact";
export const SENT_KEY = "overlay-feedback-sent";
const MIN = 10, MAX = 1500;

export function installId(): string {
  try {
    const known = localStorage.getItem(ID_KEY);
    if (known && /^[0-9a-f]{32}$/.test(known)) return known;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(ID_KEY, id);
    return id;
  } catch { return ""; }
}

type Kind = "oneri" | "hata";
type State = { s: "idle" } | { s: "sending" } | { s: "done" } | { s: "error"; msg: string };

export function Feedback({ riot, report, onClose }: { riot?: string | null; report?: string; onClose: () => void }) {
  useBackClose(true, onClose);
  const [kind, setKind] = useState<Kind>(report ? "hata" : "oneri");
  const [text, setText] = useState("");
  const [contact, setContact] = useState(() => { try { return localStorage.getItem(CONTACT_KEY) ?? ""; } catch { return ""; } });
  const [diag, setDiag] = useState(true);
  const [ver, setVer] = useState("0.1.0");
  const [state, setState] = useState<State>({ s: "idle" });
  useEffect(() => { getVersion().then(setVer).catch(() => undefined); }, []);

  const len = text.trim().length;
  const ready = len >= MIN && !!riot && state.s !== "sending";

  const send = async () => {
    if (!ready) return;
    setState({ s: "sending" });
    try { localStorage.setItem(CONTACT_KEY, contact.trim()); } catch { /* */ }
    // İlk satır "Android": kanalda masaüstünden gelenlerden ayrılsın.
    const info = ["Android", `Celeste ${ver}`, navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? ""].filter(Boolean).join(" · ");
    const body = { kind, text: text.trim(), contact: contact.trim(), riot: riot ?? "", v: ver, id: installId(), diag: diag ? [info, report].filter(Boolean).join("\n\n").slice(0, 4000) : "Android" };
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) });
      if (r.ok) { try { localStorage.setItem(SENT_KEY, String(Date.now())); } catch { /* */ } setState({ s: "done" }); setText(""); return; }
      if (r.status === 404) { setState({ s: "error", msg: t("fbOffline") }); return; }
      const msg = r.status < 500 ? await r.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
      setState({ s: "error", msg: msg ?? t("fbFail") });
    } catch { setState({ s: "error", msg: t("fbNet") }); }
  };

  return (
    <div className="page">
      <header className="top"><button type="button" className="link" onClick={onClose}>‹ {t("back")}</button><b>{t("fbTitle")}</b><span /></header>
      <main className="body set fb">
        {state.s === "done" ? (
          <div className="fb-done" role="status">
            <b>{t("fbDone")}</b>
            <p>{t("fbDoneText")}</p>
            <p>{contact.trim() ? t("fbDoneContact", { c: contact.trim() }) : t("fbDoneNoContact")}</p>
            <span className="note-act"><button type="button" className="btn" onClick={() => setState({ s: "idle" })}>{t("fbNew")}</button><button type="button" className="link" onClick={onClose}>{t("close")}</button></span>
          </div>
        ) : (
          <>
            <p className="fb-sub">{t("fbSub")}</p>
            <div className="fb-kinds" role="radiogroup">
              {([["oneri", t("fbIdea"), t("fbIdeaHint")], ["hata", t("fbBug"), t("fbBugHint")]] as [Kind, string, string][]).map(([id, label, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={kind === id} className={`fb-kind ${id}${kind === id ? " on" : ""}`} onClick={() => setKind(id)}><b>{label}</b><small>{hint}</small></button>
              ))}
            </div>
            <label className="fb-field">
              <span>{kind === "hata" ? t("fbTextBug") : t("fbText")}<em className={len > 0 && len < MIN ? "warn" : ""}>{len}/{MAX}</em></span>
              <textarea value={text} maxLength={MAX} rows={6} placeholder={kind === "hata" ? t("fbBugPh") : t("fbIdeaPh")} onChange={(e) => setText(e.target.value)} />
              {len > 0 && len < MIN && <small className="warn">{t("fbMin", { n: MIN })}</small>}
            </label>
            <label className="fb-field">
              <span>{t("fbContact")} <em>{t("fbOptional")}</em></span>
              <input type="text" value={contact} maxLength={40} placeholder={t("fbContactPh")} autoCapitalize="off" autoCorrect="off" onChange={(e) => setContact(e.target.value)} />
            </label>
            <div className="set-box">
              <div className="set-row">
                <span><b>{t("fbDiag")}</b><small>{t("fbDiagHelp")}</small></span>
                <button type="button" role="switch" aria-checked={diag} aria-label={t("fbDiag")} className={diag ? "sw-t on" : "sw-t"} onClick={() => setDiag(!diag)}><i /></button>
              </div>
            </div>
            <p className="fine">{t("fbNote", { riot: riot ?? "—" })}</p>
            {state.s === "error" && <p className="err" role="alert">{state.msg}</p>}
            <button type="button" className="btn pri big" disabled={!ready} onClick={send}>{state.s === "sending" ? t("fbSending") : t("fbSend")}</button>
          </>
        )}
      </main>
    </div>
  );
}

/* "Ele alındı" haberleri: yalnızca bu telefondan son 30 günde bildirim gönderildiyse, uygulama açılınca
   (en fazla 5 dakikada bir) sorulur. Gelen haber bir kez gösterilir ve sunucudan silinir. */
export interface Notice { kind: "oneri" | "hata"; status?: "ele" | "plan" | "ekl" | "yok"; message?: string; at: number }
export function useNotices(): [Notice[], () => void] {
  const [list, setList] = useState<Notice[]>([]);
  useEffect(() => {
    let last = 0;
    const ask = async () => {
      if (document.hidden || Date.now() - last < 5 * 60_000) return;
      last = Date.now();
      let sent = 0;
      try { sent = Number(localStorage.getItem(SENT_KEY)) || 0; } catch { /* */ }
      if (!sent || Date.now() - sent > 30 * 24 * 3600_000) return;
      const id = installId();
      if (!id) return;
      try {
        const r = await fetch(`${SITE}/api/overlay/notices?id=${id}`);
        if (!r.ok) return;
        const got = (await r.json()) as Notice[];
        if (Array.isArray(got) && got.length) setList((l) => [...l, ...got.filter((n) => n.kind === "oneri" || n.kind === "hata").map((n) => ({ ...n, message: typeof n.message === "string" ? n.message.slice(0, 300) : "" }))]);
      } catch { /* sonra */ }
    };
    const t0 = window.setTimeout(ask, 3000);
    document.addEventListener("visibilitychange", ask);
    return () => { window.clearTimeout(t0); document.removeEventListener("visibilitychange", ask); };
  }, []);
  return [list, () => setList([])];
}
