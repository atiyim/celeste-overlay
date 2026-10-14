import type { Status } from "./types";

interface Props { status?: Status; inApp: boolean; assetsOk: boolean; assetsFailed: boolean }

/* Alt şerit: dört bağlantının durumunu tek bakışta gösterir. */
export function StatusBar({ status, inApp, assetsOk, assetsFailed }: Props) {
  const items: { label: string; ok: boolean | null; hint: string }[] = [
    { label: "Riot Client", ok: inApp ? (status ? status.riotClient : null) : null, hint: "Riot Client açık ve giriş yapılmış mı" },
    { label: "Valorant", ok: inApp ? (status ? status.valorant : null) : null, hint: "Valorant çalışıyor mu" },
    { label: "Oyun verisi", ok: inApp ? (status ? status.data : null) : null, hint: "Riot sunucularından veri alınabiliyor mu" },
    { label: "Görseller", ok: assetsOk ? true : assetsFailed ? false : null, hint: "valorant-api.com görselleri" },
  ];
  return (
    <div className="sb" aria-label="Bağlantı durumu">
      {items.map((i) => (
        <span key={i.label} className="si" title={i.hint}>
          <i className={i.ok === null ? "dot wait" : i.ok ? "dot ok" : "dot bad"} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
