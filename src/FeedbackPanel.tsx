import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DISCORD_URL, FEEDBACK_API, installId } from "./community";
import { tfetch } from "./net";
import { PanelHead, Toggle } from "./ui";

/* Öneri / Hata formu. Gönder'e basınca yazı, Riot ID, (yazıldıysa) Discord adı, sürüm ve cihaz kimliği
   Celeste'ye gider; Celeste bunu yetkililerin gördüğü kanala koyar. Formda ne gönderileceği açıkça yazar. */

const inTauri = "__TAURI_INTERNALS__" in window;
const CONTACT_KEY = "overlay-feedback-contact";
const MIN = 10;
const MAX = 1500;

type Kind = "oneri" | "hata";
type State = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; msg: string };

const KINDS: { id: Kind; label: string; hint: string; placeholder: string }[] = [
  { id: "oneri", label: "Öneri", hint: "Bir fikrin ya da istediğin bir özellik", placeholder: "Ajan seçiminde şunu görmek isterdim, çünkü…" },
  { id: "hata", label: "Hata", hint: "Çalışmayan ya da yanlış görünen bir şey", placeholder: "Ne yaparken oldu? Ne bekliyordun, ne oldu?" },
];

interface Props { version: string; onOpen: (url: string) => void; onClose: () => void }

export function FeedbackPanel({ version, onOpen, onClose }: Props) {
  const [kind, setKind] = useState<Kind>("oneri");
  const [text, setText] = useState("");
  const [contact, setContact] = useState(() => { try { return localStorage.getItem(CONTACT_KEY) ?? ""; } catch { return ""; } });
  const [diag, setDiag] = useState(true);
  const [riot, setRiot] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!inTauri) { setRiot("Celeste#TR1"); return; }
    invoke<string>("get_riot_id").then(setRiot).catch(() => setRiot(""));
  }, []);

  const length = text.trim().length;
  const ready = length >= MIN && state.kind !== "sending";

  const send = async () => {
    if (!ready) return;
    setState({ kind: "sending" });
    try { localStorage.setItem(CONTACT_KEY, contact.trim()); } catch { /* depolama kapalı */ }
    let diagText = "";
    if (kind === "hata" && diag && inTauri) diagText = await invoke<string>("get_diagnostics").catch(() => "");
    const body = { kind, text: text.trim(), contact: contact.trim(), riot: riot ?? "", v: version, id: installId(), diag: diagText };
    try {
      // text/plain: tarayıcı ön isteği (OPTIONS) gerekmez.
      const r = await tfetch(FEEDBACK_API, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) });
      if (r.ok) { setState({ kind: "done" }); setText(""); return; }
      // 404: sunucuda form adresi yok (site güncellenmemiş). Ham "bulunamadı" yerine ne yapılacağını söyle.
      if (r.status === 404) { setState({ kind: "error", msg: "Bildirim servisi şu an kapalı. Biraz sonra tekrar dene ya da Discord'da destek talebi aç." }); return; }
      const msg = r.status < 500 ? await r.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
      setState({ kind: "error", msg: msg ?? "Gönderilemedi. Biraz sonra tekrar dene." });
    } catch {
      setState({ kind: "error", msg: "İnternete bağlanılamadı. Bağlantını kontrol edip tekrar dene." });
    }
  };

  const current = KINDS.find((k) => k.id === kind)!;

  return (
    <div className="panel fb" role="dialog" aria-label="Öneri / Hata bildir">
      <PanelHead title="Öneri / Hata bildir" sub="Yazdığın doğrudan Celeste yetkililerine ulaşır. Discord'a geçmen gerekmez." onClose={onClose} />

      {state.kind === "done" ? (
        <div className="fbdone" role="status">
          <b>Gönderildi, teşekkürler!</b>
          <p className="m">Yetkililer okuyacak. Cevap vermemiz gerekirse {contact.trim() ? <>Discord'da <b>{contact.trim()}</b> adına yazarız.</> : "Discord adını yazmadığın için sana ulaşamayabiliriz."}</p>
          <p className="m"><button className="x" type="button" onClick={() => setState({ kind: "idle" })}>Yeni bildirim yaz</button> <button className="x" type="button" onClick={onClose}>Kapat</button></p>
        </div>
      ) : (
        <>
          <div className="fbkinds" role="radiogroup" aria-label="Tür">
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`fbkind ${k.id}${kind === k.id ? " on" : ""}`} onClick={() => setKind(k.id)}>
                <b>{k.label}</b>
                <small>{k.hint}</small>
              </button>
            ))}
          </div>

          <label className="fbfield">
            <span>{kind === "hata" ? "Ne oldu?" : "Önerin"}<em className={length > 0 && length < MIN ? "warn" : ""}>{length}/{MAX}</em></span>
            <textarea value={text} maxLength={MAX} rows={5} placeholder={current.placeholder} onChange={(e) => setText(e.target.value)} />
          </label>

          <div className="fbrow">
            <label className="fbfield">
              <span>Discord kullanıcı adın <em>isteğe bağlı</em></span>
              <input type="text" value={contact} maxLength={40} placeholder="ör. celeste" onChange={(e) => setContact(e.target.value)} />
            </label>
            {kind === "hata" && (
              <div className="fbdiag">
                <Toggle on={diag} onChange={setDiag} label="Tanı bilgisini ekle" />
                <span><b>Tanı bilgisini ekle</b><small>Sürüm ve hangi bağlantının çalışmadığı; isim ve kimlik içermez.</small></span>
              </div>
            )}
          </div>

          <p className="fbnote">
            Gönderirken <b>Riot ID'n{riot ? ` (${riot})` : ""}</b>, sürüm ve cihazın rastgele kimliği de eklenir; yetkililer kimin yazdığını görür. Küfür ve spam gönderen cihazdan bildirim kapatılır.
          </p>

          {state.kind === "error" && <p className="m err" role="alert">{state.msg}</p>}

          <div className="fbactions">
            <button className="x go" type="button" disabled={!ready} onClick={send}>{state.kind === "sending" ? "Gönderiliyor…" : "Gönder"}</button>
            <span className="m">Hemen yardım mı lazım? <button className="lnk" type="button" onClick={() => onOpen(DISCORD_URL)}>Discord'da destek talebi aç</button></span>
          </div>
        </>
      )}
    </div>
  );
}
