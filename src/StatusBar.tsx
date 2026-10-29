import { useCallback, useState } from "react";
import { DISCORD_URL } from "./community";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Status } from "./types";

interface Props { active?: number | null; status?: Status; inApp: boolean; assetsOk: boolean; assetsFailed: boolean; version: string; onToast: (t: string) => void; onOpen: (url: string) => void }
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

/* Alt şerit: dört bağlantı noktası. Tıklayınca özelliklerin son durumu ve tanı kopyalama düğmesi açılır. */
export function StatusBar({ active, status, inApp, assetsOk, assetsFailed, version, onToast, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health[] | null>(null);

  const items: { label: string; ok: Dot; hint: string }[] = [
    { label: "Riot Client", ok: inApp ? (status ? status.riotClient : null) : null, hint: "Riot Client açık ve giriş yapılmış mı" },
    { label: "Valorant", ok: inApp ? (status ? status.valorant : null) : null, hint: "Valorant çalışıyor mu" },
    { label: "Oyun verisi", ok: inApp ? (status ? status.data : null) : null, hint: "Riot sunucularından veri alınabiliyor mu" },
    { label: "Görseller", ok: assetsOk ? true : assetsFailed ? false : null, hint: "valorant-api.com görselleri" },
  ];
  const dot = (ok: Dot) => (ok === null ? "dot wait" : ok ? "dot ok" : "dot bad");

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && !inApp) setHealth([]);
    if (next && inApp) { try { setHealth(await invoke<Health[]>("get_health")); } catch { setHealth([]); } }
  }, [open, inApp]);

  return (
    <>
      {open && (
        <div className="hp" role="region" aria-label="Bağlantı ve özellik durumu">
          <h4>Bağlantı</h4>
          {items.map((i) => (
            <div className="hr2" key={i.label}>
              <i className={dot(i.ok)} />
              <span><b>{i.label}</b><small>{i.hint}</small></span>
            </div>
          ))}
          <h4 style={{ marginTop: 6 }}>Özellikler</h4>
          {health === null ? <div className="hr2"><i className="dot wait" /><span><small>Yükleniyor…</small></span></div>
            : health.length === 0 ? <div className="hr2"><i className="dot wait" /><span><small>Durum alınamadı</small></span></div>
            : health.map((h) => (
              <div className="hr2" key={h.id}>
                <i className={cls(h.state)} />
                <span><b>{h.label}</b><small>{h.detail}</small></span>
              </div>
            ))}
          <div className="cp">
            <span>Bir şey çalışmıyorsa kopyalayıp gönder. İsim ve kimlik içermez.</span>
            <button className="x" type="button" onClick={() => copyDiagnostics(version, items.map((i) => [i.label, i.ok]), onToast)}>Tanı bilgisini kopyala</button>
          </div>
        </div>
      )}
      <div className="sb" aria-label="Bağlantı durumu">
        <span className="credit">
          Made by Claude &amp;{" "}
          <button type="button" className="ig" title="Instagram: @bneceleste" onClick={() => onOpen("https://www.instagram.com/bneceleste")}>bneceleste</button>
          {" · "}
          <button type="button" className="ig" title="Topluluk: soru, hata bildirimi, öneri ve yeni sürümler" onClick={() => onOpen(DISCORD_URL)}>Discord</button>
        </span>
        {active != null && active > 0 && (
          <span className="usersnow" title="Son 15 dakikada uygulamayı açık tutanların sayısı (anonim sayım)">
            <i className="dot ok" />{active.toLocaleString("tr-TR")} kişi şu an kullanıyor
          </span>
        )}
        <button type="button" className="sbtn" aria-expanded={open} title="Ayrıntı için tıkla" onClick={toggle}>
          {items.map((i) => (
            <span key={i.label} className="si" title={i.hint}>
              <i className={dot(i.ok)} />
              {i.label}
            </span>
          ))}
        </button>
      </div>
    </>
  );
}
