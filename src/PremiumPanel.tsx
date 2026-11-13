import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { DISCORD_URL } from "./community";
import { feedAdmin, feedLink, login, type Role } from "./feed";
import { Icon } from "./icons";
import { Roles } from "./RoleBadge";
import type { Theme } from "./theme";
import { PanelHead, Toggle } from "./ui";
import {
  EFFECTS, SAMPLE, SKINS, fxColor, isPremium, loadPremiumCfg, reqRole, startPreview, stopPreview, unlocked, useMe, usePremiumCfg, usePreview,
  type Item, type ItemId,
} from "./vip";

/* Premium vitrini: her özellik canlı bir önizlemeyle anlatılır.
   Kilitliyse hangi rolün gerektiği yazar; yönetici "Düzenle" ile gerekli rolü ve Discord eşlemesini buradan seçer. */

const inTauri = "__TAURI_INTERNALS__" in window;
const ALL: ItemId[] = [...SKINS.map((s) => `skin:${s.id}` as ItemId), ...EFFECTS.map((e) => e.id)];
/** Canlı denenebilenler (bu bilgisayarda görünür). */
const LIVE = new Set<ItemId>(["fx:accent", "fx:glow", "fx:plate"]);

interface AdminCfg { req: Record<string, number>; discord: Record<string, string>; guildRoles: { id: string; name: string; color: string }[]; roles: { id: number; name: string; color: string; icon?: string }[] }

interface Props { theme: Theme; onChange: (t: Theme) => void; onOpen: (url: string) => void; onToast: (t: string) => void; onClose: () => void }

export function PremiumPanel({ theme, onChange, onOpen, onToast, onClose }: Props) {
  const me = useMe();
  const cfg = usePremiumCfg();
  const pv = usePreview();
  const prem = isPremium(me);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [adm, setAdm] = useState<AdminCfg | null>(null);
  const set = (p: Partial<Theme>) => onChange({ ...theme, ...p });
  const open = ALL.filter((id) => unlocked(me, id, cfg)).length;

  useEffect(() => { void loadPremiumCfg(true); }, []);
  useEffect(() => {
    if (!edit || !me?.admin) return;
    feedAdmin<AdminCfg>("premium_get").then(setAdm).catch((e: Error) => { onToast(e.message); setEdit(false); });
  }, [edit, me?.admin]);
  // Discord onayı tarayıcıda yapılır; pencereye dönünce bağlantı durumu tazelenir.
  useEffect(() => {
    if (!prem || !inTauri) return;
    const check = () => { feedLink().catch(() => undefined); };
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [prem]);

  const refresh = async () => {
    if (!inTauri) { onToast("Rol denetimi yalnızca masaüstü uygulamasında çalışır."); return; }
    setBusy(true);
    try { const m = await login(); await loadPremiumCfg(true); onToast(isPremium(m) ? "Rolün doğrulandı" : "Bu hesapta rol bulunamadı"); }
    catch (e) { onToast(String((e as Error).message ?? e).slice(0, 90)); }
    setBusy(false);
  };
  const setReq = async (item: ItemId, role: number) => {
    try {
      const r = await feedAdmin<{ req: Record<string, number>; discord: Record<string, string> }>("premium_req", { item, role });
      setAdm((a) => (a ? { ...a, req: r.req } : a));
      await loadPremiumCfg(true);
      onToast(role ? "Gerekli rol kaydedildi" : "Artık herhangi bir rol yeter");
    } catch (e) { onToast((e as Error).message); }
  };
  const setDiscord = async (role: number, discord: string) => {
    try {
      const r = await feedAdmin<{ req: Record<string, number>; discord: Record<string, string> }>("premium_discord", { role, discord });
      setAdm((a) => (a ? { ...a, discord: r.discord } : a));
      onToast(discord ? "Discord rolü eşlendi; birkaç dakika içinde dağıtılır" : "Eşleme kaldırıldı");
    } catch (e) { onToast((e as Error).message); }
  };
  const link = async (action: "start" | "unlink") => {
    try {
      const r = await feedLink(action);
      if (action === "start" && r.url) { onOpen(r.url); onToast("Tarayıcıda Discord'u onayla, sonra buraya dön"); }
      if (action === "unlink") onToast("Discord bağlantısı kaldırıldı");
    } catch (e) { onToast((e as Error).message); }
  };

  /** Kartın altındaki durum: kullanımda / aç-kapa / kilit. */
  const lockLine = (id: ItemId) => {
    const r = reqRole(cfg, id);
    return <span className="plk"><Icon name="lock" size={12} />{r ? <><Roles roles={[{ name: r.name, color: r.color, icon: r.icon }]} compact /> gerekli</> : "Celeste rolü gerekli"}</span>;
  };
  const reqSelect = (id: ItemId) => edit && adm && (
    <label className="preq">
      <span>Gerekli rol</span>
      <select value={adm.req[id] ?? 0} onChange={(e) => setReq(id, Number(e.target.value))}>
        <option value={0}>Herhangi bir rol</option>
        {adm.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </label>
  );
  const tryBtn = (id: ItemId) => <button className="x" type="button" onClick={() => startPreview(id)} disabled={!!pv}>{pv?.id === id ? "Önizleniyor…" : "Önizle"}</button>;

  const color = (id: ItemId) => (unlocked(me, id, cfg) ? fxColor(me?.roles, id, cfg) : reqRole(cfg, id)?.color) ?? SAMPLE;

  const effectAction = (it: Item): ReactNode => {
    const on = unlocked(me, it.id, cfg);
    if (it.id === "discord") {
      // Bağlama herkese açık: yönetici yetkisi de Discord hesabına bağlanabilir. Rol dağıtımı yine yetkiye bağlı.
      return me?.discord
        ? <><span className="pon"><Icon name="check" size={13} />Bağlı</span><button className="x" type="button" onClick={() => link("unlink")}>Kaldır</button></>
        : <>{!on && lockLine(it.id)}<button className={on ? "x go" : "x"} type="button" onClick={() => link("start")}>Discord'u bağla</button></>;
    }
    if (it.id === "fx:accent") return on ? <><span className="pst">{theme.roleAccent ? "Açık" : "Kapalı"}</span><Toggle on={theme.roleAccent} label={it.name} onChange={(v) => set({ roleAccent: v })} /></> : <>{lockLine(it.id)}{tryBtn(it.id)}</>;
    if (it.id === "fx:glow") return on ? <><span className="pst">{theme.vipFx ? "Açık" : "Kapalı"}</span><Toggle on={theme.vipFx} label={it.name} onChange={(v) => set({ vipFx: v })} /></> : <>{lockLine(it.id)}{tryBtn(it.id)}</>;
    if (on) return <span className="pon"><Icon name="check" size={13} />Açık</span>;
    return <>{lockLine(it.id)}{LIVE.has(it.id) && tryBtn(it.id)}</>;
  };

  return (
    <div className="panel prm" role="dialog" aria-label="Premium">
      <PanelHead
        title="Premium"
        sub="Celeste rol sahiplerine özel görünüm ve efektler"
        actions={me?.admin ? <button className={edit ? "x go" : "x"} type="button" onClick={() => setEdit((v) => !v)}><Icon name="sliders" size={14} />{edit ? "Bitti" : "Düzenle"}</button> : undefined}
        onClose={onClose}
      />

      <section className="prh">
        <span className="prc" aria-hidden="true"><Icon name="crown" size={26} stroke={1.6} /></span>
        <div className="prt">
          <small>CELESTE</small>
          <b>Premium</b>
          <span>{prem ? <>Rolün aktif · <em>{open}/{ALL.length}</em> özellik açık</> : "Temalar, lobi plakası, Akış isim stili ve Discord rolü. Hepsini önizleyebilirsin."}</span>
        </div>
        <div className="prs">
          {prem && me ? <Roles roles={me.roles} /> : <span className="prno">{me ? "Bu hesapta rol yok" : "Rolün henüz denetlenmedi"}</span>}
          <span className="prb">
            <button className="x" type="button" disabled={busy} onClick={refresh}>{busy ? "Denetleniyor…" : prem ? "Rolümü yenile" : "Rolümü denetle"}</button>
            {!prem && <button className="x go" type="button" onClick={() => onOpen(DISCORD_URL)}>Rol nasıl alınır?</button>}
          </span>
        </div>
      </section>

      <h3 className="h2">Temalar<span className="hv">Uygulamanın tamamını değiştirir · 15 sn önizleme</span></h3>
      <div className="skgrid">
        {SKINS.map((s) => {
          const id = `skin:${s.id}` as ItemId;
          const ok = unlocked(me, id, cfg);
          const on = ok && theme.skin === s.id;
          return (
            <div key={s.id} className={`skc${on ? " on" : ""}${ok ? "" : " lock"}`}>
              <div className="skp" data-s={s.id} aria-hidden="true">
                <span className="skm-bar"><i /><i /><i /></span>
                <span className="skm-hero"><small>CELESTE OVERLAY</small><b>CELESTE</b><em><i /><i /><i /></em></span>
                <span className="skm-row"><i /><span /><em>+19</em></span>
                {!ok && <span className="skm-lock"><Icon name="lock" size={14} /></span>}
              </div>
              <div className="skt"><b>{s.name}</b><small>{s.tag}</small></div>
              {reqSelect(id)}
              <div className="ska">
                {on ? <><span className="skon">Kullanımda</span><button className="x" type="button" onClick={() => set({ skin: "" })}>Kapat</button></>
                  : ok ? <><button className="x go" type="button" onClick={() => { set({ skin: s.id }); stopPreview(); }}>Uygula</button>{tryBtn(id)}</>
                  : <>{lockLine(id)}{tryBtn(id)}</>}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="h2">Efektler<span className="hv">Bazılarını lobide ve Akış'ta başkaları da görür</span></h3>
      <div className="pfgrid">
        {EFFECTS.map((it) => (
          <div key={it.id} className={`pfc${unlocked(me, it.id, cfg) ? " on" : ""}`} style={{ "--fx": color(it.id) } as CSSProperties}>
            <div className="pfv" aria-hidden="true">{preview(it.id)}{!unlocked(me, it.id, cfg) && <span className="skm-lock"><Icon name="lock" size={14} /></span>}</div>
            <div className="skt">
              <b>{it.name}</b>
              <small>{it.text}</small>
              {it.seen && <span className="pseen"><Icon name="users" size={12} />{it.seen}</span>}
            </div>
            {reqSelect(it.id)}
            <div className="ska">{effectAction(it)}</div>
          </div>
        ))}
      </div>

      {edit && adm && <DiscordMap adm={adm} onSet={setDiscord} />}
    </div>
  );
}

/** Her efektin küçük, canlı önizlemesi (yalnızca CSS). Renk kartın --fx değişkeninden gelir. */
function preview(id: ItemId): ReactNode {
  const row = (name: string, fx: boolean) => (
    <span className={fx ? "pvr fx" : "pvr"}>
      <i className="pva" /><span className="pvn"><b>{name}</b>{fx && <em>VIP</em>}</span><span className="pvk" />
    </span>
  );
  switch (id) {
    case "fx:plate":
      return <span className="pvl">{row("Celeste", true)}{row("Oyuncu", false)}</span>;
    case "fx:name":
      return <span className="pvp"><span className="pvh"><i className="pva" /><b className="pvnm">Celeste#TR1</b><small>2 dk</small></span><span className="pvtx" /><span className="pvtx s" /></span>;
    case "fx:post":
      return <span className="pvp framed"><span className="pvh"><i className="pva" /><b>Celeste#TR1</b><small>2 dk</small></span><span className="pvtx" /><span className="pvtx s" /></span>;
    case "fx:glow":
      return <span className="pvg"><small>EN ÇOK OYNADIĞIN</small><b>CELESTE</b><span className="pvtx" /></span>;
    case "fx:accent":
      return <span className="pvc"><span className="pvtabs"><i className="on" /><i /><i /></span><span className="pvring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" /><circle className="a" cx="18" cy="18" r="14" /></svg></span><span className="pvbtn">Paylaş</span></span>;
    case "discord":
      return <span className="pvd"><small>OVERLAY VIP — 2</small><span className="pvdm"><i className="pva" /><b>Celeste</b></span><span className="pvdm"><i className="pva" /><b>Res</b></span><small>ÇEVRİMİÇİ — 14</small><span className="pvdm off"><i className="pva" /><b>Oyuncu</b></span></span>;
    default:
      return null;
  }
}

/** Yönetici: her overlay rolüne bir Discord rolü. */
function DiscordMap({ adm, onSet }: { adm: AdminCfg; onSet: (role: number, discord: string) => void }) {
  return (
    <>
      <h3 className="h2">Discord rol eşleme<span className="hv">Bağlı hesaplara Celeste botu dağıtır</span></h3>
      <div className="box pdm">
        {adm.guildRoles.length === 0 && <p className="pdn">Bot sunucu rollerini henüz bildirmedi. Bot açıksa birkaç dakika içinde gelir.</p>}
        {adm.roles.length === 0 && <p className="pdn">Önce Akış › Yönetim'den bir rol oluştur.</p>}
        {adm.roles.map((r) => {
          const roles: Role[] = [{ id: r.id, name: r.name, color: r.color, icon: r.icon }];
          return (
            <div className="pdr" key={r.id}>
              <Roles roles={roles} />
              <Icon name="chevron" size={14} />
              <select value={adm.discord[r.id] ?? ""} onChange={(e) => onSet(r.id, e.target.value)} disabled={!adm.guildRoles.length}>
                <option value="">Eşleme yok</option>
                {adm.guildRoles.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          );
        })}
        <p className="pdn">Eşlenen Discord rolünü yalnızca bu eşleme yönetir: elle verilen de geri alınır. Rol, Celeste'nin rolünün altında olmalı ve yönetici izni taşımamalı.</p>
      </div>
    </>
  );
}

