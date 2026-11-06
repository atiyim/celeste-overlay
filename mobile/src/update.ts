/* Uygulama içi güncelleme: GitHub'daki "android-v…" sürümlerinin en yenisine bakar.
   Yalnızca herkese açık (taslak ve ön sürüm olmayan) sürümler sayılır; yoksa hiçbir şey gösterilmez.
   Günde en fazla 4 kez sorulur. Celeste'nin sunucusuna istek gitmez. */

const REPO = "atiyim/celeste-overlay";
const SEEN = "celeste-update-check";
const SKIP = "celeste-update-skip";

export interface Update { version: string; url: string }

function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0), pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** `force`: Ayarlar'daki düğme; aralık sınırını ve "Sonra" seçimini yok sayar. */
export async function checkUpdate(current: string, force = false): Promise<Update | null> {
  if (!force) {
    try { if (Date.now() - (Number(localStorage.getItem(SEEN)) || 0) < 6 * 3600_000) return null; } catch { /* */ }
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, { headers: { accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  try { localStorage.setItem(SEEN, String(Date.now())); } catch { /* */ }
  const list = (await r.json()) as { tag_name: string; draft: boolean; prerelease: boolean; html_url: string }[];
  const rel = list.find((x) => x.tag_name.startsWith("android-v") && !x.draft && !x.prerelease);
  if (!rel) return null;
  const version = rel.tag_name.slice("android-v".length);
  if (!newer(version, current)) return null;
  if (!force) { try { if (localStorage.getItem(SKIP) === version) return null; } catch { /* */ } }
  return { version, url: rel.html_url };
}

export function skipUpdate(version: string) { try { localStorage.setItem(SKIP, version); } catch { /* */ } }
