import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { setPrefs, usePrefs, useBackClose, wakeLockSupported, type Prefs } from "./prefs";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? "sw-t on" : "sw-t"} onClick={() => onChange(!on)}><i /></button>;
}

export function Settings({ riot, onClose, onLogout }: { riot?: string | null; onClose: () => void; onLogout: () => void }) {
  const p = usePrefs();
  const [ver, setVer] = useState("");
  useBackClose(true, onClose);
  useEffect(() => { getVersion().then(setVer).catch(() => undefined); }, []);

  return (
    <div className="page">
      <header className="top">
        <b>Ayarlar</b>
        <button type="button" className="link" onClick={onClose}>Bitti</button>
      </header>
      <main className="body set">
        <h2 className="grp">Lobi</h2>
        <div className="set-box">
          <div className="set-row col">
            <span><b>Yenileme sıklığı</b><small>Uzun aralık daha az internet ve pil harcar.</small></span>
            <div className="seg" role="radiogroup" aria-label="Yenileme sıklığı">
              {([3, 5, 10] as Prefs["interval"][]).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={p.interval === n} className={p.interval === n ? "on" : ""} onClick={() => setPrefs({ interval: n })}>{n} sn</button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <span><b>Rakiplerin kaplamaları</b><small>Kapalıyken rakip kartlarında yalnızca rank görünür.</small></span>
            <Toggle label="Rakiplerin kaplamaları" on={p.enemySkins} onChange={(v) => setPrefs({ enemySkins: v })} />
          </div>
          <div className="set-row">
            <span><b>Maçta ekranı açık tut</b><small>{wakeLockSupported ? "Ajan seçimi ve maç sırasında telefon kararmaz." : "Bu telefon bu özelliği desteklemiyor."}</small></span>
            <Toggle label="Maçta ekranı açık tut" on={p.keepAwake && wakeLockSupported} onChange={(v) => setPrefs({ keepAwake: v })} />
          </div>
        </div>

        <h2 className="grp">Hesap</h2>
        <div className="set-box">
          <div className="set-row"><span><b>{riot ?? "Riot hesabı"}</b><small>Bu telefonda giriş yapılı.</small></span></div>
          <button type="button" className="set-row danger" onClick={onLogout}><span><b>Çıkış yap</b><small>Bu telefondaki Riot oturumu da silinir.</small></span></button>
        </div>

        <h2 className="grp">Hakkında</h2>
        <div className="set-box about">
          <p>Giriş bilgin ve ayarların yalnızca bu telefonda durur, Celeste'nin sunucusuna gitmez. Uygulama yalnızca okur, oyunda hiçbir işlem yapmaz.</p>
          <p className="fine">Celeste{ver ? ` ${ver}` : ""} · Celeste Overlay, Riot Games ile bağlantılı değildir ve Riot Games tarafından onaylanmamıştır.</p>
        </div>
      </main>
    </div>
  );
}
