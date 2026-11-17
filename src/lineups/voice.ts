/* Celeste'nin kayıtlı sesleri (public/lineup-voice/<anahtar>.mp3). Balondaki yazı, kayıttaki cümleyle aynıdır:
   yazıyı değiştirirsen kaydı da yenile. */

export const CLIPS = {
  acilis: "Burası benim lineup köşem tatlım. Haritadan bir yetenek seç, adım adım göstereyim. Öğren sekmesinde her gün 3 lineup çalışırız. Seri yaparsan XP de kazanırsın.",
  ajan: "Yeni bir lineup, bayılıyorum! Önce ajanını seç.",
  "ajan-secilince": "Güzel seçim. Hangi yeteneğini atıyorsun?",
  harita: "Bu lineup'ı hangi haritada kullanıyorsun?",
  "harita-secilince": "Tamam, anladım. Şimdi tarafı, bölgeyi ve ne zaman kullanılacağını seç.",
  "isaretle-once-dokunma": "Önce haritada duracağın yere dokun.",
  "isaretle-yetenegin-dusecegi-yer": "Oldu! Şimdi yeteneğin düşeceği yere dokun.",
  "isaretle-tam-isabet": "Tam isabet, ok yerini buldu.",
  "son-dokunus": "Son dokunuş. Kısa bir başlık yaz. Gerisi isteğe bağlı.",
  "son-dokunus2": "Her şey hazır, gönder. Yetkililer bakıp yayınlasın.",
  "admin-her-sey-hazir": "Her şey hazır, yayınlayalım mı?",
  "duzenlemede-hazir-kaydedlim-mi": "Hazır, kaydedelim mi?",
  hata: "Bir sorun var galiba. Birlikte düzeltelim.",
  "adim-gecisleri": "Süper! Devam edelim!",
  "adim-gecisleri2": "Harika gidiyorsun.",
  "adim-gecisleri3": "Tam isabet.",
  "adim-gecisleri4": "Bayıldım, devam!",
  "adim-gecisleri5": "Çok iyi, sıradaki.",
  "adim-gecisleri6": "Sen bu işi biliyorsun Şapşik. Devam!",
  "adim-metni-yoksa": "Halkayla gösterdiğim yere tam nişan al.",
  "adim-metni-yoksa2": "Görseldeki gibi dur, kıpırdama!",
  "son-adim": "Unutma, bu atışı özel bir hareketle yapıyorsun. Zamanlamaya dikkat et.",
  "harita-ekrani": "Haritada parlayan yere geç. Ok yönü, yeteneğin nereye düşeceğini gösteriyor. Ne zaman kullanılacağını da hemen göreceksin.",
  kolay: "Bu çok kolay, hemen kaparsın.",
  zor: "Biraz zor ama sende o el var.",
  "filtre-bos": "Bu filtrelerle hiçbir şey bulamadım. Biraz gevşeteyim mi, yoksa fazla titiz mi davrandık?",
  "lineup-haritada-yok": "Bu harita için henüz lineup yok. İlkini sen eklersen adın burada parlar.",
  "set-bossa": "Setin bomboş. Beğendiğin lineup'ı Setime ekle'ye bas. Hepsi burada toplanır.",
  "gonder-sekmesi": "Bildiğin bir lineup mı var? Gönder, yetkililer bakıp yayınlasın. Adın kütüphanede ve Discord'da görünür. Biraz da ünlü olursun.",
  "onay-bekleyen-yok": "Onay bekleyen gönderi yok. Her yer tertemiz.",
  "flash-kart": "Duracağın yere bak! Nişan noktasını hatırlıyor musun?",
  "cevabi-goster": "Hatırladığınla aynı mı? Dürüst ol, bakıyorum.",
  "sinav-sorusu": "Bu görsele göre yetenek haritada nereye düşer? Tıkla bakalım.",
  "sonraki-soru": "Sıradaki, sence nereye düşer?",
  dogru1: "İşte bu! Ezberlemişsin bile!",
  dogru2: "Tam isabet. Sen bu işi biliyorsun.",
  dogru3: "Mükemmel! Bir sonrakine geçelim mi?",
  dogru4: "Vay be, gözlerim kamaştı.",
  yakin: "Çok yaklaştın, biraz daha.",
  yakin2: "Neredeyse! Bir daha bak.",
  yakin3: "Az kaldı. Ucu ucuna kaçtı.",
  yanlis1: "Olsun, şimdi gördün. Bir dahaki sefere bilirsin.",
  yanlis2: "Bu zor olanlardandı. Merak etme, sana tekrar soracağım. Bir dahaki sefere bilirsin.",
  yanlis3: "Hımm, burası değilmiş. Birlikte öğreniriz.",
  "gunluk-tekrar-sonu": "Bitti. Bugünkü kartları çalıştın. Yarın yine soracağım. Hazırlıklı gel.",
  "kart-yoksa": "Şimdilik tekrar edilecek kart yok. Kütüphaneden yeni bir lineup aç, sonra buraya gel.",
  "sinav-sonu": "Sınav bitti. Harita artık senin evin.",
  "dusuk-puanda": "Biraz daha çalışırsak tam olacak.",
  "plan-tamam": "Plan tamam. Artık maçta kullanma zamanı. Ben hep buradayım.",
} as const;

export type ClipId = keyof typeof CLIPS;
export const clipText = (c: ClipId | ClipId[]) => (Array.isArray(c) ? c : [c]).map((k) => CLIPS[k]).join(" ");
export const clipUrl = (c: ClipId) => `/lineup-voice/${c}.mp3`;

export const CHEER_STEP: ClipId[] = ["adim-gecisleri", "adim-gecisleri2", "adim-gecisleri3", "adim-gecisleri4", "adim-gecisleri5", "adim-gecisleri6"];
export const CHEER_OK: ClipId[] = ["dogru1", "dogru2", "dogru3", "dogru4"];
export const CHEER_NEAR: ClipId[] = ["yakin", "yakin2", "yakin3"];
export const CHEER_BAD: ClipId[] = ["yanlis1", "yanlis2", "yanlis3"];
export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
