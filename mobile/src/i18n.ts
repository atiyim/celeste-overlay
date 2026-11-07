/* Arayüz dili. Kaplama, silah, ajan ve harita adları Riot'un görsel veritabanından seçilen dilde gelir.
   Dil değişince uygulama yeniden yüklenir (her metin baştan doğru dilde çizilsin diye). */

export type Lang = "tr" | "en";
const KEY = "celeste-lang";

export const lang: Lang = (() => {
  try { const v = localStorage.getItem(KEY); if (v === "tr" || v === "en") return v; } catch { /* */ }
  return (navigator.language || "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
})();
export const assetLang = lang === "tr" ? "tr-TR" : "en-US";
export const locale = lang === "tr" ? "tr-TR" : "en-US";

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* */ }
  location.reload();
}

const tr = {
  tagline: "Valorant lobini telefonundan takip et. Oyuncuların rankları, kaplamaların ve mağazan tek yerde.",
  login: "Riot hesabınla giriş yap",
  loggingIn: "Riot'a bağlanılıyor…",
  loginHint: "Riot Games'in resmî giriş sayfası açılır.",
  howTitle: "Hesabın nasıl korunur?",
  note1t: "Şifren yalnızca Riot'a gider",
  note1: "Giriş, Riot'un kendi sayfasında (auth.riotgames.com) yapılır. Celeste şifreni hiçbir zaman görmez ve saklamaz.",
  note2t: "Oturumun bu telefonda kalır",
  note2: "Riot'un verdiği oturum yalnızca bu cihazda tutulur, Celeste'nin sunucularına gönderilmez. Çıkış yaptığında silinir.",
  note3t: "Yalnızca görüntüler",
  note3: "Lobi, rank, kaplama ve mağaza bilgilerini okur. Oyunda senin adına hiçbir işlem yapmaz.",
  privacyLink: "Gizlilik ayrıntıları",
  notAffiliated: "Celeste, Riot Games tarafından desteklenmemektedir ve Riot Games'in ya da Riot Games mülklerinin yapımında veya yönetiminde resmî olarak yer alan kimsenin görüşlerini yansıtmaz. Riot Games ve ilgili tüm mülkler, Riot Games, Inc.'in ticari markaları veya tescilli ticari markalarıdır.",

  tabLobby: "Lobi", tabStore: "Mağaza", tabCollection: "Koleksiyon", tabProfile: "Profil", sections: "Bölümler", settings: "Ayarlar",

  phaseMenu: "Menüde ya da oyun kapalı", phasePregame: "Ajan seçimi", phaseIngame: "Maç sürüyor", phaseOffline: "Valorant kapalı", waiting: "Bekleniyor",
  menuHelp: "Telefon, bilgisayarındaki oyunun açık olup olmadığını göremez. Ajan seçimine ya da maça girince lobidekiler burada görünür.",
  lobbyHelp: "Ajan seçimine ya da maça girince lobidekiler burada görünür.",
  renewing: "Riot oturumu yenileniyor…",
  sessionExpired: "Riot oturumu sona erdi. Ayarlar'dan çıkış yapıp yeniden giriş yapabilirsin.",
  yourTeam: "Takımın", enemies: "Rakipler",
  tapHint: "Kaplamalarını ve maçlarını görmek için oyuncunun kartına dokun.",
  player: "Oyuncu {n}", lvl: "Sv {n}", games: "{n} maç", unranked: "Derecesiz", sameParty: "Aynı parti",
  picking: "Seçiyor", locked: "Kilitledi",

  pullRefresh: "Yenilemek için çek", releaseRefresh: "Bırak, yenilensin", refreshing: "Yenileniyor…",

  daily: "Günlük mağaza", night: "Gece pazarı", renewsIn: "{t} sonra yenilenir", leftT: "{t} kaldı",
  unknownSkin: "Bilinmeyen", inWishlist: "İstek listende",
  wishToday: "İstek listendeki {n} kaplama bugün mağazanda", wishTodayOne: "İstek listendeki {name} bugün mağazanda",
  days: "{d} gün {h} sa",

  skins: "Kaplamalar", matches: "Maçlar", customOn: "{n} silahta özel kaplama", close: "Kapat",
  allWeapons: "Bütün silahlar", level: "Seviye", variant: "Varyant", skin: "Kaplama", standard: "Standart",
  addWish: "İstek listesine ekle", removeWish: "İstek listesinden çıkar",
  noForm: "Bu oyuncunun son maç bilgisi henüz yüklenmedi ya da gizli.",
  lastN: "Son {n} maç", winRate: "Kazanma", kd: "K/D", hs: "Kafa", adr: "Hasar/round", played24: "Son 24 saatte {n} maç",
  rrLast: "Son RR değişimleri", won: "G", lost: "M", noLoadout: "Kaplama bilgisi henüz gelmedi.",

  collection: "Koleksiyonum", wishlist: "İstek listesi", searchSkins: "Kaplama ara", allCat: "Tümü",
  catSidearm: "Tabancalar", catSMG: "Hafif makineli", catShotgun: "Pompalı", catRifle: "Tüfekler", catSniper: "Keskin nişancı", catHeavy: "Ağır", catMelee: "Bıçak",
  ownedCount: "{n} kaplama", wishEmpty: "İstek listen boş. Bir kaplamaya dokunup yıldıza basarak ekleyebilirsin.",
  ownedEmpty: "Sahip olduğun kaplama bulunamadı.", noResults: "Sonuç yok.", owned: "Sende var",

  yourAccount: "Hesabın", peak: "Peak", lastMatches: "Son maçlar", battlepass: "Savaş bileti", bpLevel: "Seviye {a} / {b}",
  bpXp: "Sonraki seviyeye {a} / {b} XP", bpDone: "Savaş biletini bitirdin", missions: "Görevler", weekly: "Haftalık", dailyM: "Günlük", otherM: "Diğer",
  refillIn: "Yeni görevler: {t}", xp: "{n} XP", done: "Tamamlandı", noMissions: "Şu an aktif görev yok.", map: "Harita",

  qCompetitive: "Rekabetçi", qUnrated: "Derecesiz", qSwiftplay: "Tam gaz", qPremier: "Premier", qDeathmatch: "Ölüm maçı", qTdm: "Takım ölüm maçı", qSpikerush: "Spike Rush",

  sLobby: "Lobi", interval: "Yenileme sıklığı", intervalHelp: "Ajan seçimi ve maçta geçerli. Menüdeyken 15 sn'de bir bakılır.", sec: "{n} sn",
  enemySkins: "Rakiplerin kaplamaları", enemySkinsHelp: "Kapalıyken rakip kartlarında yalnızca rank görünür.",
  keepAwake: "Maçta ekranı açık tut", keepAwakeHelp: "Ajan seçimi ve maç sırasında telefon kararmaz.", keepAwakeNo: "Bu telefon bu özelliği desteklemiyor.",
  sAccount: "Hesap", loggedHere: "Bu telefonda giriş yapılı.", switchAccount: "Hesap değiştir", switchHelp: "Çıkış yapar, Riot sayfasını diğer hesap için açar.",
  logout: "Çıkış yap", logoutHelp: "Bu telefondaki Riot oturumu da silinir.",
  sGeneral: "Genel", language: "Dil", privacy: "Gizlilik", privacyHelp: "Hangi veri nerede durur?",
  sAbout: "Hakkında", version: "Sürüm {v}", checkUpdate: "Güncellemeleri denetle", upToDate: "En son sürümü kullanıyorsun.", checking: "Denetleniyor…", updateErr: "Denetlenemedi. İnternetini kontrol et.",
  aboutText: "Giriş bilgin ve ayarların yalnızca bu telefonda durur, Celeste'nin sunucusuna gitmez. Uygulama yalnızca okur, oyunda hiçbir işlem yapmaz.",
  doneBtn: "Bitti", back: "Geri",

  updTitle: "Yeni sürüm var: {v}", updText: "İndirip kurman yeterli; ayarların ve istek listen kalır.", download: "İndir", later: "Sonra",

  oops: "Bir şey ters gitti", oopsText: "Uygulamayı yeniden başlatabilirsin. Aşağıdaki raporu kopyalayıp gönderirsen sorunu bulabiliriz.", restart: "Yeniden başlat",
  crashTitle: "Uygulama son açılışta bir hatayla karşılaştı", crashText: "Bu raporu kopyalayıp gönderirsen sorunu bulabiliriz.",
};

type Dict = typeof tr;

const en: Dict = {
  tagline: "Follow your Valorant lobby from your phone. Players' ranks, skins and your store in one place.",
  login: "Sign in with your Riot account",
  loggingIn: "Connecting to Riot…",
  loginHint: "Riot Games' official sign-in page will open.",
  howTitle: "How your account stays safe",
  note1t: "Your password only goes to Riot",
  note1: "You sign in on Riot's own page (auth.riotgames.com). Celeste never sees or stores your password.",
  note2t: "Your session stays on this phone",
  note2: "The session Riot gives you is kept only on this device and never sent to Celeste's servers. Signing out removes it.",
  note3t: "View only",
  note3: "It reads lobby, rank, skin and store info. It never does anything in the game on your behalf.",
  privacyLink: "Privacy details",
  notAffiliated: "Celeste isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.",

  tabLobby: "Lobby", tabStore: "Store", tabCollection: "Collection", tabProfile: "Profile", sections: "Sections", settings: "Settings",

  phaseMenu: "In menus or game closed", phasePregame: "Agent select", phaseIngame: "Match in progress", phaseOffline: "Valorant closed", waiting: "Waiting",
  menuHelp: "Your phone can't tell whether the game is open on your PC. Players show up here once you're in agent select or a match.",
  lobbyHelp: "Players show up here once you're in agent select or a match.",
  renewing: "Refreshing your Riot session…",
  sessionExpired: "Your Riot session ended. Sign out and back in from Settings.",
  yourTeam: "Your team", enemies: "Enemies",
  tapHint: "Tap a player's card to see their skins and matches.",
  player: "Player {n}", lvl: "Lv {n}", games: "{n} games", unranked: "Unranked", sameParty: "Same party",
  picking: "Picking", locked: "Locked",

  pullRefresh: "Pull to refresh", releaseRefresh: "Release to refresh", refreshing: "Refreshing…",

  daily: "Daily store", night: "Night market", renewsIn: "Resets in {t}", leftT: "{t} left",
  unknownSkin: "Unknown", inWishlist: "On your wishlist",
  wishToday: "{n} skins from your wishlist are in your store today", wishTodayOne: "{name} from your wishlist is in your store today",
  days: "{d}d {h}h",

  skins: "Skins", matches: "Matches", customOn: "Custom skins on {n} weapons", close: "Close",
  allWeapons: "All weapons", level: "Level", variant: "Variant", skin: "Skin", standard: "Standard",
  addWish: "Add to wishlist", removeWish: "Remove from wishlist",
  noForm: "This player's recent matches haven't loaded yet or are private.",
  lastN: "Last {n} matches", winRate: "Win rate", kd: "K/D", hs: "Headshot", adr: "Damage/round", played24: "{n} games in the last 24h",
  rrLast: "Recent RR changes", won: "W", lost: "L", noLoadout: "Skin info hasn't arrived yet.",

  collection: "My collection", wishlist: "Wishlist", searchSkins: "Search skins", allCat: "All",
  catSidearm: "Sidearms", catSMG: "SMGs", catShotgun: "Shotguns", catRifle: "Rifles", catSniper: "Snipers", catHeavy: "Heavy", catMelee: "Melee",
  ownedCount: "{n} skins", wishEmpty: "Your wishlist is empty. Tap a skin and press the star to add it.",
  ownedEmpty: "No owned skins found.", noResults: "No results.", owned: "Owned",

  yourAccount: "Your account", peak: "Peak", lastMatches: "Recent matches", battlepass: "Battle pass", bpLevel: "Level {a} / {b}",
  bpXp: "{a} / {b} XP to next level", bpDone: "Battle pass complete", missions: "Missions", weekly: "Weekly", dailyM: "Daily", otherM: "Other",
  refillIn: "New missions: {t}", xp: "{n} XP", done: "Done", noMissions: "No active missions right now.", map: "Map",

  qCompetitive: "Competitive", qUnrated: "Unrated", qSwiftplay: "Swiftplay", qPremier: "Premier", qDeathmatch: "Deathmatch", qTdm: "Team Deathmatch", qSpikerush: "Spike Rush",

  sLobby: "Lobby", interval: "Refresh rate", intervalHelp: "Used in agent select and matches. In menus it checks every 15 s.", sec: "{n} s",
  enemySkins: "Enemy skins", enemySkinsHelp: "When off, enemy cards only show rank.",
  keepAwake: "Keep screen on in matches", keepAwakeHelp: "Your screen won't dim during agent select and matches.", keepAwakeNo: "This phone doesn't support this.",
  sAccount: "Account", loggedHere: "Signed in on this phone.", switchAccount: "Switch account", switchHelp: "Signs out and opens Riot's page for another account.",
  logout: "Sign out", logoutHelp: "Also removes the Riot session on this phone.",
  sGeneral: "General", language: "Language", privacy: "Privacy", privacyHelp: "What data stays where?",
  sAbout: "About", version: "Version {v}", checkUpdate: "Check for updates", upToDate: "You're on the latest version.", checking: "Checking…", updateErr: "Couldn't check. Check your connection.",
  aboutText: "Your sign-in and settings stay on this phone and never go to Celeste's server. The app only reads; it never does anything in the game.",
  doneBtn: "Done", back: "Back",

  updTitle: "New version available: {v}", updText: "Just download and install it; your settings and wishlist stay.", download: "Download", later: "Later",

  oops: "Something went wrong", oopsText: "You can restart the app. Copy the report below and send it so we can find the problem.", restart: "Restart",
  crashTitle: "The app hit an error last time it ran", crashText: "Copy this report and send it so we can find the problem.",
};

const D: Record<Lang, Dict> = { tr, en };
export type Key = keyof Dict;

export function t(k: Key, v?: Record<string, string | number>): string {
  let s = D[lang][k] ?? tr[k];
  if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, String(b));
  return s;
}

export const PHASE = (p: string) => ({ menu: t("phaseMenu"), pregame: t("phasePregame"), ingame: t("phaseIngame"), offline: t("phaseOffline") } as Record<string, string>)[p] ?? t("waiting");
export const QUEUE = (q?: string | null) =>
  q ? (({ competitive: t("qCompetitive"), unrated: t("qUnrated"), swiftplay: t("qSwiftplay"), premier: t("qPremier"), deathmatch: t("qDeathmatch"), hurm: t("qTdm"), spikerush: t("qSpikerush") } as Record<string, string>)[q] ?? q) : "";

/** Kalan süre: "2 gün 4 sa" ya da "09:20:05". */
export function left(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  if (d > 0) return t("days", { d, h });
  return [h, m, x].map((n) => String(n).padStart(2, "0")).join(":");
}
