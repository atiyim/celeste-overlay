/* Büyük harf: Türkçe kelimelerde İ/I kuralı, oyun terimlerinde ve özel adlarda (Main, Site, Bind, Killjoy) İngilizce kural.
   CSS'teki text-transform sayfanın diline göre "MAİN" yazdığı için başlıklar burada çevrilir (Discord kartlarıyla aynı kural). */
const LATIN = new Set(["main", "lineup", "lineups", "celeste", "site", "smoke", "flash", "molly", "spike", "heaven", "hell", "mid", "link", "garden", "market", "tree", "window", "top", "short", "long", "catwalk", "pizza", "elbow", "stairs", "hookah", "showers", "lobby", "pit", "rafters", "tile", "wine", "bridge", "post-plant", "retake", "default", "execute", "info", "tiny", "valorant", "one-way", "oneway", "wall", "dart", "drone", "nanoswarm", "recon", "shock"]);
const TR = /[çğıöşüÇĞİÖŞÜ]/;
export const valUpper = (s: string) => s.split(/(\s+)/).map((w) => (!TR.test(w) && LATIN.has(w.toLowerCase().replace(/[^a-z-]/g, "")) ? w.toUpperCase() : w.toLocaleUpperCase("tr-TR"))).join("");
/** Ajan ve harita adları: Türkçe harf yoksa İngilizce kural (Split → SPLIT). */
export const nameUpper = (s: string) => (TR.test(s) ? s.toLocaleUpperCase("tr-TR") : s.toUpperCase());
