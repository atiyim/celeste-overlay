import { invoke } from "@tauri-apps/api/core";

/* "Bu kurulumu doğrula": hem alt şerit rozeti hem S.S.S sayfası bunu kullanır. */
export interface InstallCheck { status: "ok" | "mismatch" | "unavailable" | "unofficial"; channel: "release" | "dev" | "deneme"; own: string; matched?: string | null; url: string }

export const verifyInstall = () => invoke<InstallCheck>("verify_install");

/** Kısa durum metni (rozet) ve açıklaması (ipucu / panel). */
export function verifyText(r: InstallCheck): { short: string; title: string; desc: string; tone: "ok" | "warn" | "info" } {
  if (r.status === "ok") return { short: "Doğrulandı", tone: "ok", title: "Bu kurulum doğrulandı", desc: "Bilgisayarındaki uygulama dosyası, GitHub'ın açık koddan derleyip yayınladığı dosyayla birebir aynı." };
  if (r.status === "unofficial") {
    const dev = r.channel === "dev";
    return {
      short: dev ? "Geliştirme" : "Deneme", tone: "info",
      title: dev ? "Bu bir geliştirme derlemesi" : "Bu bir deneme derlemesi",
      desc: `${dev ? "Kendi bilgisayarında derlenmiş" : "GitHub Actions'ta deneme için derlenmiş"} bir sürüm çalışıyor. Yayınlanmış sürüm olmadığı için GitHub'daki parmak iziyle eşleşmemesi normaldir; doğrulama yalnızca indirdiğin yayın sürümü içindir.`,
    };
  }
  if (r.status === "unavailable") return { short: "Liste yok", tone: "info", title: "Bu sürüm için parmak izi listesi yok", desc: "Bu sürüm, parmak izi yayınlanmaya başlamadan önce çıktı. Bir sonraki güncellemeden sonra doğrulayabilirsin." };
  return { short: "Eşleşmedi", tone: "warn", title: "Bu kurulum GitHub'daki dosyayla eşleşmedi", desc: "Yayın sürümü olduğu halde parmak izi listede yok. Başka bir yerden indirdiysen uygulamayı GitHub'daki sürüm sayfasından yeniden kur ve tekrar dene. Yine eşleşmezse Öneri / Hata'dan yaz." };
}
