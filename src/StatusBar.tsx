import { useCallback, useEffect, useState } from "react";
import { DISCORD_URL } from "./community";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Status } from "./types";
import { Socials } from "./Socials";
import { Icon } from "./icons";
import { verifyInstall, verifyText, type InstallCheck } from "./verify";

interface Props { status?: Status; inApp: boolean; assetsOk: boolean; assetsFailed: boolean; version: string; onToast: (t: string) => void; onOpen: (url: string) => void; onFeedback: () => void; onTrust: () => void }
interface Health { id: string; label: string; state: "ok" | "warn" | "fail" | "idle"; detail: string }
type Dot = boolean | null;

const cls = (s: Health["state"]) => (s === "ok" ? "dot ok" : s === "fail" ? "dot bad" : s === "warn" ? "dot warn" : "dot wait");

/* Tanı metni: sürüm, bağlantı durumu, özellik durumları ve yapı dosyaları. İsim, kimlik ve token içermez. */
export async function copyDiagnostics(version: string, conn: [string, Dot][], onToast: (t: string) => void) {
  try {
    const mark = (d: Dot) => (d === null ? "?" : d ? "OK" : "YOK");
    const head = `Celeste Overlay ${version || "?"}\n${conn.length ? `Bağlantı: ${conn.map(([l, d]) => `${l} ${mark(d)}`).join(" · ")}\n` : ""}\n`;
    const body = await invoke<string>("get_diagnostics");
    await writeText(head + body);
    onToast("Tanı bilgisi kopyalandı");
  } catch { onToast("Kopyalanamadı"); }
}

/* Alt şerit: tek bağlantı özeti, emeği geçenler ve öneri düğmesi. Özete tıklayınca özelliklerin son durumu ve tanı kopyalama düğmesi açılır. */
export function StatusBar({ status, inApp, assetsOk, assetsFailed, version, onToast, onOpen, onFeedback, onTrust }: Props) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health[] | null>(null);

  const items: { label: string; ok: Dot; hint: string }[] = [
    { label: "Riot Client", ok: inApp ? (status ? status.riotClient : null) : null, hint: "Riot Client açık ve giriş yapılmış mı" },
    { label: "Valorant", ok: inApp ? (status ? status.valorant : null) : null, hint: "Valorant çalışıyor mu" },
    { label: "Oyun verisi", ok: inApp ? (status ? status.data : null) : null, hint: "Riot sunucularından veri alınabiliyor mu" },
    { label: "Görseller", ok: assetsOk ? true : assetsFailed ? false : null, hint: "valorant-api.com görselleri" },
  ];
  const dot = (ok: Dot) => (ok === null ? "dot wait" : ok ? "dot ok" : "dot bad");
  // Tek özet: hepsi tamamsa yeşil, biri yoksa kırmızı, beklenen varsa sarı.
  const sum: "ok" | "bad" | "wait" = items.some((i) => i.ok === false) ? "bad" : items.every((i) => i.ok === true) ? "ok" : "wait";

  // Doğrula rozeti: tıklayınca parmak izi kontrol edilir; sonuç görününce tıklamak ayrıntıyı açar.
  const [vr, setVr] = useState<InstallCheck | null>(null);
  const [vbusy, setVbusy] = useState(false);
  const verify = async () => {
    if (vr) { onTrust(); return; }
    setVbusy(true);
    try { setVr(await verifyInstall()); } catch { onToast("Doğrulanamadı. İnternet bağlantını kontrol et."); }
    setVbusy(false);
  };
  const vt = vr ? verifyText(vr) : null;

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && !inApp) setHealth([]);
    if (next && inApp) { try { setHealth(await invoke<Health[]>("get_health")); } catch { setHealth([]); } }
  }, [open, inApp]);

  // Esc ile kapanır.
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <>
      {open && (
        <div className="hp" role="region" aria-label="Bağlantı ve özellik durumu">
          <div className="col">
            <h4>Bağlantı</h4>
            {items.map((i) => (
              <div className="hr2" key={i.label}>
                <i className={dot(i.ok)} />
                <span><b>{i.label}</b><small>{i.hint}</small></span>
              </div>
            ))}
          </div>
          <div className="col">
            <h4>Özellikler</h4>
            {health === null ? <div className="hr2"><i className="dot wait" /><span><small>Yükleniyor…</small></span></div>
              : health.length === 0 ? <div className="hr2"><i className="dot wait" /><span><small>Durum alınamadı</small></span></div>
              : health.map((h) => (
                <div className="hr2" key={h.id}>
                  <i className={cls(h.state)} />
                  <span><b>{h.label}</b><small>{h.detail}</small></span>
                </div>
              ))}
          </div>
          <div className="cp">
            <span>Bir şey çalışmıyorsa kopyalayıp gönder. İsim ve kimlik içermez.</span>
            <button className="x" type="button" onClick={() => copyDiagnostics(version, items.map((i) => [i.label, i.ok]), onToast)}>Tanı bilgisini kopyala</button>
          </div>
        </div>
      )}
      <div className="sb" aria-label="Bağlantı durumu">
        <button type="button" className={`sok ${sum}`} aria-expanded={open} title="Bağlantı ayrıntıları" onClick={toggle}>
          <i className={sum === "ok" ? "dot ok" : sum === "bad" ? "dot bad" : "dot wait"} />
          {sum === "ok" ? "Her şey bağlı" : sum === "bad" ? `${items.find((i) => i.ok === false)?.label ?? "Bağlantı"} sorunlu` : "Bağlanılıyor"}
        </button>
        {inApp && (
          <button type="button" className={`vbadge ${vt?.tone ?? ""}`} disabled={vbusy} onClick={verify} title={vt ? `${vt.title}. Ayrıntı için tıkla.` : "Kurulum dosyanın parmak izini GitHub'daki yayınla karşılaştır"}>
            <Icon name="shield" size={14} />{vbusy ? "Kontrol…" : vt ? vt.short : "Doğrula"}
          </button>
        )}
        <span className="credit">
          <Socials onOpen={onOpen} />
          <span className="made">Made by Claude &amp; <button type="button" className="ig" title="Instagram: @bneceleste" onClick={() => onOpen("https://www.instagram.com/bneceleste")}>bneceleste</button></span>
        </span>
        <span className="fbg">
          <button type="button" className="fbk dsc" title="Topluluk: soru, hata bildirimi, öneri ve yeni sürümler" onClick={() => onOpen(DISCORD_URL)}>
            <Icon name="users" size={14} />Discord'a Katıl!
          </button>
          <button type="button" className="fbk" title="Bir fikrini yaz ya da çalışmayan bir şeyi bildir; doğrudan yetkililere ulaşır" onClick={onFeedback}>
            <Icon name="msg" size={14} />Öneri / Hata
          </button>
        </span>
      </div>
    </>
  );
}
