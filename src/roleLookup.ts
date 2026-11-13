import { useEffect, useState } from "react";
import type { Player } from "./types";
import type { Role } from "./feed";
import { SITE } from "./community";
import { tfetch } from "./net";
import { ROLE_ICON_PATHS } from "./roleIcons";

/* Lobide diğer Celeste kullanıcılarının rol rozeti.
   Sunucuya oyuncu kimliği değil, geri çevrilemeyen kısa bir özet gider; sunucu yalnızca rolü olanlar için cevap verir.
   İsmini gizleyen oyuncular sorulmaz. Her istek S.S.S & Panel'deki canlı kayıtta görünür. */

const inTauri = "__TAURI_INTERNALS__" in window;
const TTL = 10 * 60_000;
const BACKOFF = 30 * 60_000;
const cache = new Map<string, { roles: Role[]; at: number }>();
let downUntil = 0;

async function digest(puuid: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`celeste:${puuid}`));
  return Array.from(new Uint8Array(b).slice(0, 12), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Sunucudan gelen veri güvenilmez sayılır: yalnızca beklenen alanlar ve kısa değerler geçer. */
function clean(list: unknown): Role[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 3).flatMap((r): Role[] => {
    const x = r as Partial<Role>;
    if (typeof x?.name !== "string" || typeof x.color !== "string" || !/^#[0-9a-f]{6}$/i.test(x.color)) return [];
    return [{ ...(Number.isInteger(x.id) && x.id! > 0 ? { id: x.id } : {}), name: x.name.slice(0, 24), color: x.color, admin: x.admin === true, glow: x.glow === true, icon: typeof x.icon === "string" && x.icon in ROLE_ICON_PATHS ? x.icon : undefined }];
  });
}

export function useLobbyRoles(players: Player[], on: boolean): Map<string, Role[]> {
  const [map, setMap] = useState<Map<string, Role[]>>(new Map());
  const key = players.filter((p) => !p.isSelf && !p.hiddenName).map((p) => p.puuid).sort().join(",");
  useEffect(() => {
    if (!on || !inTauri || !key) { setMap(new Map()); return; }
    let live = true;
    (async () => {
      const ids = key.split(",");
      const need = ids.filter((p) => !(cache.get(p) && Date.now() - cache.get(p)!.at < TTL));
      if (need.length && Date.now() >= downUntil) {
        try {
          const hs = await Promise.all(need.map(digest));
          const r = await tfetch(`${SITE}/api/feed/who`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ h: hs }) });
          if (!r.ok) downUntil = Date.now() + BACKOFF; // servis bu özelliği henüz bilmiyor ya da kapalı
          else {
            const j = (await r.json().catch(() => ({}))) as { roles?: Record<string, unknown> };
            need.forEach((p, i) => cache.set(p, { roles: clean(j.roles?.[hs[i]]), at: Date.now() }));
          }
        } catch { downUntil = Date.now() + BACKOFF; }
      }
      if (live) setMap(new Map(ids.map((p) => [p, cache.get(p)?.roles ?? []])));
    })();
    return () => { live = false; };
  }, [key, on]);
  return map;
}
