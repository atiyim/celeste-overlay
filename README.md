# Celeste Overlay

Valorant lobisinde herkesin rankını, son rekabet performansını ve kaplamalarını tek bakışta gösteren, sade ve karanlık temalı bir overlay.

![Celeste Overlay](docs/ekran-1.png)

## Güvenlik

- **Giriş yok.** Riot hesabına giriş yapmazsın. Uygulama, açık Riot Client oturumunu okur.
- **Yalnızca okur.** Oyuna tuş göndermez, oyun dosyalarını değiştirmez, hile değildir.
- **Veriler sende kalır.** Etiketler, notlar ve ayarlar yalnızca bu bilgisayarda saklanır.
- **Gizli isimler gizli kalır.** İsmini gizleyen oyuncunun adı gösterilmez.
- Kaynak kodu bu depoda açıktır.

Celeste Overlay, Riot Games ile bağlantılı değildir ve Riot Games tarafından onaylanmamıştır.

## Kurulum

1. [Releases](../../releases/latest) sayfasından `…-setup.exe` dosyasını indir.
2. Dosyayı çalıştır. Windows bir uyarı gösterebilir, aşağıya bak.
3. Riot Client'ı aç ve giriş yap, sonra Valorant'ı başlat.
4. Ajan seçimi başlayınca oyuncular overlay'de kendiliğinden listelenir.

İlk açılışta uygulama kısa bir rehber gösterir. Rehberi Ayarlar → Hakkında bölümünden tekrar açabilirsin.

### Windows "SmartScreen" uyarısı

İlk kurulumda **"Windows bilgisayarınızı korudu"** uyarısı çıkabilir. Sebep virüs değil, kurulum dosyasının ücretli bir kod imzalama sertifikasıyla imzalanmamış olmasıdır. Windows imzasız ve yeni dosyaların hepsinde bu uyarıyı gösterir.

Kurmak için:

1. Uyarıda **Daha fazla bilgi**'ye tıkla.
2. **Yine de çalıştır** düğmesine bas.

![SmartScreen adımları](docs/smartscreen.png)

Uyarı yalnızca ilk kurulumda çıkar. Uygulama içi güncellemelerde çıkmaz.

Kurulum dosyasını kontrol etmek istersen: dosya yalnızca bu deponun [Releases](../../releases) sayfasından indirilmelidir. Başka bir yerden gelen kopyaya güvenme. Kodu kendin derlemek istersen aşağıdaki "Geliştirme" bölümüne bak.

## Özellikler

| Bölüm | Ne işe yarar |
|---|---|
| Oyuncular | Lobi listesi: rank, peak, kazanma oranı, son 5 rekabet maçı, kaplamalar, parti, rozetler |
| Son maç | Biten maçın raporu |
| Mağaza | Günlük ve gece mağazası |
| Hesabım | Bakiye, görevler, battle pass, envanter |
| İstatistik | Kendi rekabet verilerin |
| Sohbet | Hızlı mesaj kısayolları |
| Nişangah | Hazır nişangah kodları |
| Ayarlar | Renk, yazı boyutu, sütunlar, rozet eşikleri |

- **Tekrar karşılaşma:** Daha önce aynı maçta olduğun oyuncular işaretlenir ("3. kez").
- **Kayıtta gizle:** Overlay ekran kaydında ve yayında görünmez, sen oyunda görmeye devam edersin.
- **F2:** Overlay'i gösterir veya gizler.

Rekabet verileri (son 5 maç, kafa isabeti, K/D, rozetler) yalnızca **rekabet** maçlarından hesaplanır.

## Sorun giderme

Alt köşedeki noktalara tıklayınca neyin çalışmadığını görürsün. Sorun bildirirken Ayarlar → Hakkında → **Tanı bilgisini kopyala** düğmesinin çıktısını ekle. Kişisel kimlikler bu çıktıdan temizlenir.

## Geliştirme

Gereksinimler: Node.js, Rust, [Tauri 2 ön koşulları](https://tauri.app/start/prerequisites/).

```
npm install
npm run tauri dev
```

Sürüm çıkarmak için `package.json`, `src-tauri/Cargo.toml` ve `src-tauri/tauri.conf.json` içindeki sürüm aynı olmalı, sonra `vX.Y.Z` etiketi gönderilir. GitHub Actions kurulum dosyasını ve `latest.json` güncelleme dosyasını yayınlar.
