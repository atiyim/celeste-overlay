import { useState } from "react";

/* Güncellemeden sonra bir kez görünen "neler yeni" kartı. Kapatınca bu sürüm için bir daha çıkmaz. */
const KEY = "overlay-whatsnew";
const NOTES: Record<string, string[]> = {
  "0.8.3": [
    "Yeni: Lineup! Sol menüdeki harita simgesi. Haritada her yeteneğin düştüğü yer işaretli; tıklayınca nerede duracağın, nereye nişan alacağın ve nasıl atacağın adım adım. İstersen Celeste anlatır, istersen kendin bakarsın.",
    "Öğren: her gün 3 lineup, kart kart tekrar, \"Nereye düşer?\" sınavı ve özel oyun planı. Seri yap, XP topla, seviye atla.",
    "Setim ve paylaşım kodu: sevdiğin lineup'ları kaydet, kodla arkadaşına ver. Topluluk: kendi lineup'ını gönder; onaylanınca adınla yayınlanır.",
    "Spike sayacı ve oyun üstü şerit kaldırıldı: Riot canlı maçta spike sayaçlarını uygun görmüyor. Özel sayaçlar yerinde duruyor.",
  ],
  "0.8.2": [
    "Güvenlik: Akış, roller, Premium ve diğer Celeste servisleri artık yalnızca resmi sürümle çalışır. Her istek imzalanır; değiştirilmiş kopyalar bağlanamaz.",
    "Kaynak koddan derlenen kopyalar açılışta lisans şartlarını gösterir ve \"Resmi olmayan derleme\" olarak işaretlenir. Resmi sürümde bir değişiklik yok.",
  ],
  "0.8.1": [
    "Celeste ile tanış: yeni sesli rehberi o anlatıyor, asasıyla ekranı gösteriyor. Sağ altta durur, maçına göre arada bir şey söyler; tıklarsan rehber yeniden açılır (Ayarlar'dan kapatılabilir).",
    "Spike sayacı yenilendi: çizgiler ve renkler çözmeye yetişip yetişmediğini gösterir (son 7 sn: yalnızca yarım çözülmüşse, son 3,5 sn: çözülmez). Sayaç çalışırken oyunun üstünde küçük bir şerit çıkar.",
    "Göster / gizle tuşu artık değiştirilebilir: Ayarlar > Overlay > Kısayol.",
    "Yeni ana tema: Obsidyen Altın. Siyah zemin, ince altın çizgiler, altın ay. Eski görünümü seviyorsan Ayarlar > Görünüm > Tema'dan Sade'ye dönebilirsin.",
    "Lobi küçüldü: üç düzen de ekranda çok daha az yer kaplıyor, bilgiler aynı.",
    "Peak rank geri geldi: listede kendi sütununda, kartlarda ve Karşı karşıya'da rankın hemen altında.",
    "Oyundayken efektler durur: overlay arka plandayken hiçbir şey hareket etmez, öne gelince kaldığı yerden devam eder.",
    "Maç sırasında Riot Client çok daha seyrek sorgulanır; ajan seçiminde ve maç başında sunucuya yalnızca 1-2 istek gider.",
    "Akış: paylaşım ve yorumlara görsel ekleyebilirsin (dosya, yapıştırma ya da Tenor/Giphy/Imgur GIF bağlantısı).",
    "Hakkında bölümü sol panele taşındı; simgeler yenilendi.",
    "Lobide üç silahın kaplaması geri geldi (Vandal, Phantom, Operator); istemezsen Ayarlar > Oyuncu tablosu'ndan kapatabilirsin.",
    "Oyuncu paneli alttan açılır. Kaplamalar oyundaki alım menüsü (B) gibi sıralanır: yan silahlar, hafif makineli ve pompalı, tüfek ve yakın dövüş, keskin nişancı ve makineli. Her silahta tam ad, seviye, takılı renk ve uğurluk; tıklayınca ayrıntısı büyük görünür.",
  ],

  "0.8.0": [
    "Yeni görünüm: yumuşak mor gece teması, yeni ay ikonu, sol menü ve hızlı ayarlar.",
    "Lobi üç düzende: sade liste, ajan seçimi gibi kartlar ya da takımını rakiple yan yana karşılaştıran Karşı karşıya (Ayarlar › Oyuncu tablosu).",
    "Lobide Celeste kullananların yanında küçük bir ay işareti çıkar. İstemezsen Ayarlar'dan kapatabilirsin.",
    "Araçlar: DPI/eDPI hesabı, spike ve özel sayaçlar, karşılaştığın oyuncular arasında arama, etiketlediğin oyuncular lobiye girince uyaran İzleme listesi.",
    "Meta: son yamaya göre haritalarda hangi ajanların öne çıktığı.",
    "Premium sekmesi: rollere özel temalar, lobi plakası ve Akış'ta isim stili; Discord hesabını bağlayabilirsin.",
    "Discord'da \"Celeste Overlay oynuyor\": modun, haritan, skorun ve maç sonu anların (Ayarlar › Overlay › Discord).",
    "Pencereyi üst kenara sürükleyip bırakınca tam ekran olur.",
  ],

  "0.7.2": [
    "Akış'ta yorum yapmak tek adım: her paylaşımın altında yorum kutusu, hızlı yorumlar (GG WP, Efsane 🔥…) ve son yorumlar tıklamadan görünür.",
    "Maç sırasında çok daha az internet: maç bilgisi ve kaplamalar maç başına bir kez çekilir, oyuncu geçmişi azar azar yüklenir; overlay gizliyken denetim seyrekleşir.",
    "Ajanlar sütunu daha hızlı doluyor, yüklenirken kaybolmuyor; ölüm maçı sayılmıyor.",
  ],

  "0.7.1": [
    "Parti artık maç sırasında da görünüyor; bütün modlardaki önceki maç kayıtlarından çıkarılıyor.",
    "MMR göstergesi: MMR ↑ / ↓ rozeti ve sonraki ranka kaç galibiyet kaldığı.",
    "İstatistik › Round analizi: saldırı/savunma, ilk kan, takas, clutch, KAST ve alım türüne göre round.",
    "İstatistik › Haritalar: haritalarındaki galibiyet ve saldırı/savunma oranların.",
    "OBS kaynağı: yayında rankın ve seansın görünsün (Ayarlar › Overlay › Yayın).",
    "S.S.S & Panel sekmeli ve ekrana sığıyor; Bu kurulumu doğrula düğmesi.",
    "Öneri / Hata gönderdiysen ekibin durum ve mesajları uygulamada görünür.",
    "Ajanlar sütunu: herkesin son maçlarda oynadığı 3 ajan; Main / Alışık değil rozeti.",
    "İstatistik › Act hedefi: hedef ranka kalan RR ve tahmini galibiyet.",
    "Maç kartı: maçını Discord'a ya da hikâyeye atmak için görsel (Kopyala / Kaydet).",
    "Maçta gizlenmeden önce geri sayım; uygulama ikinci kez açılmaz, açık olan öne gelir; üstte Kapat düğmesi.",
    "Akış: maçlarını ve düşüncelerini paylaş, GG ver, yorum yap. Maç kartında iki takımın skor tablosu da görünür.",
    "Akış'ta 🔥 💀 😂 👏 tepkileri, @isim#etiket ile etiketleme, profil sayfası, klip bağlantıları ve bildirimler.",
  ],

  "0.7.0": [
    "Yeni görünüm: bütün menüler aynı sade düzende, Ayarlar yan menülü.",
    "Lobi özeti: rakipte kaç Operator'cu, kaç kişilik parti ve haritada usta olan var, tek satırda.",
    "Yeni rozetler: Haritada usta / zayıf ve Operator'cu / Sheriff'çi.",
    "Uzun isimlerde Riot etiketi ve kendi etiketlerin artık hep görünüyor.",
    "Öneri / Hata formu uygulamanın içinde; ekip ele alınca burada haber verilir.",
    "FPS modu: oyunda kasma yaşıyorsan Ayarlar › Overlay'den aç.",
  ],
};

export function WhatsNew({ version }: { version: string }) {
  const [seen, setSeen] = useState<string>(() => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } });
  const notes = NOTES[version];
  if (!notes || seen === version) return null;
  const close = () => { setSeen(version); try { localStorage.setItem(KEY, version); } catch { /* depolama kapalı */ } };
  return (
    <div className="wnew" role="status">
      <div className="wnewh">
        <b><i />{version} sürümünde yeni</b>
        <button className="x" type="button" onClick={close}>Tamam</button>
      </div>
      <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}
