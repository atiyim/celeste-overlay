# Celeste Overlay

> **Bu proje Riot Games ile bağlantılı değildir, onlar tarafından onaylanmamış ya da desteklenmemiştir.** VALORANT ve Riot Games, Riot Games, Inc.'in ticari markalarıdır. Uygulama oyunun belleğine dokunmaz, oyuna girdi göndermez; yalnızca açık Riot Client oturumunun yerel API'sini ve senin hesabınla Riot'un veri sunucularını okur. Belgelenmemiş uç noktalar kullandığı için Riot bir gün bunları değiştirebilir ve uygulama bozulabilir. Kullanım senin sorumluluğundadır; yazılım "olduğu gibi" sunulur (bkz. LICENSE).

Tauri 2 + React + TypeScript. Valorant açıkken oyuncuların rank, peak, parti tahmini, smurf olasılığı ve tüm silah/sprey/charm donatısını gösteren yarı saydam overlay.

## Kurulum (Windows)

1. Node.js 20+, pnpm, Rust (rustup) ve Microsoft C++ Build Tools kurulu olmalı. WebView2 Windows 10/11'de hazır gelir.
2. Proje klasöründe:

```
pnpm install
pnpm tauri dev      # overlay'i geliştirme modunda çalıştırır
pnpm tauri build    # kurulum dosyasını (NSIS) üretir
pnpm dev            # sadece arayüz: tarayıcıda gerçek görsellerle örnek maç gösterir
```

3. Valorant'ı "Pencereli Tam Ekran" (Windowed Fullscreen) modunda aç. Gerçek tam ekranda overlay görünmez.

## Kullanım

- Kısayol yok. İmleç overlay'in üstündeyken tıklamalar overlay'e gider, dışındayken oyuna geçer.
- Başlığı tutup sürükleyerek taşı (konum hatırlanır). A−/A+ ile boyutu ayarla.
- "Gizle" overlay'i başlık çubuğuna küçültür, "Göster" geri açar.
- **F2**: overlay öne gelir, odağı alır (oyun fare ve klavyeni görmez) ve tıklanabilir olur. F2'ye tekrar basınca tamamen gizlenip sistem tepsisine gider. F2 sistem genelinde çalışır.
- Sistem tepsisi simgesi: sol tık F2 ile aynı, sağ tık menüsünde "Konumu sıfırla" ve "Çıkış".
- "Sohbet" düğmesi: kısaltma yaz (örn. sa), Enter'a bas, karşılığı panoya kopyalanır. Oyunda Enter, Ctrl+V, Enter. Oyuna tuş vuruşu gönderilmez.
- "Tracker" düğmesi oyuncunun tracker.gg profilini tarayıcıda açar.
- İsme veya ajan ikonuna tıkla: kullanıcı adı kopyalanır. Satıra tıkla: tüm donatı.

## Yapı

- `riot-core/`: Rust çekirdek. lockfile, yerel API, oyun/maç verisi, rank, parti ve smurf hesapları. Arayüzden bağımsız.
- `src-tauri/`: Tauri kabuğu (şeffaf, üstte, odak çalmayan pencere).
- `src/`: React arayüzü. `assets.ts` görsel ve isimleri valorant-api.com'dan çeker, önbelleğe alır.

## Bilinmesi gerekenler

- Riot hesabına giriş yok: açık olan Riot Client oturumu kullanılır. Bu API'ler Riot tarafından resmi desteklenmez, yöntem değişirse güncelleme gerekebilir.
- İsmi gizli oyuncular "Oyuncu N" olarak gösterilir, isimleri sorgulanmaz. Seviyesini gizleyenlerin seviyesi de gösterilmez.
- Parti bilgisi tahminidir: aynı takımdaki oyuncuların son 10 maçında en az 2 ortak maç varsa aynı harfle işaretlenir.
- Smurf yüzdesi sezgiseldir (düşük seviye, yüksek rank, yüksek kazanma oranı), kanıt değildir.
- Kazanma oranı mevcut act'e aittir. K/D için maç detayları gerekir, sonraki adımda eklenecek.
- Düşman bilgisi yalnızca maç başladıktan sonra gelir; ajan seçiminde sadece kendi takımın gösterilir.

## Kurulum dosyası (installer) oluşturma

Proje klasöründeki `yukleyici-olustur.bat` dosyasına çift tıkla. Bağımlılıkları kurar, uygulamayı derler ve
`src-tauri\target\release\bundle\nsis` klasörünü açar. İçindeki `Celeste Overlay_..._x64-setup.exe` dosyası
kurulum dosyasıdır: çift tıklayınca yönetici izni istemeden kurulur, Başlat menüsüne eklenir. Bu dosyayı bir kere
oluşturduktan sonra uygulamayı çalıştırmak için `pnpm` gerekmez.


## Otomatik güncelleme

Uygulama açılışta ve 6 saatte bir GitHub Releases'teki `latest.json` dosyasına bakar. Yeni sürüm varsa üstte
"Yeni sürüm hazır" şeridi çıkar; "Güncelle ve yeniden başlat"a basınca indirir, kurar, yeniden açar. Maç sırasında
kendiliğinden kurulmaz. Ayarlar > Güncelleme bölümünden elle de denetlenebilir.

Kurulum (bir kerelik):
1. `pnpm tauri signer generate -w "$env:USERPROFILE\.tauri\overlay.key"` (parola sorulursa Enter). Çıkan **genel anahtarı** `src-tauri/tauri.conf.json` içindeki `pubkey` alanına yapıştır.
2. Aynı dosyada `endpoints` içindeki `KULLANICI_ADIN/REPO_ADIN` kısmını kendi (herkese açık) GitHub deposunla değiştir.
3. GitHub deposu > Settings > Secrets and variables > Actions: `TAURI_SIGNING_PRIVATE_KEY` adıyla `overlay.key` dosyasının **içeriğini** ekle.
4. Yeni sürüm: `tauri.conf.json`, `package.json` ve `src-tauri/Cargo.toml` içindeki sürüm numarasını artır, commit'le ve `git tag v0.3.0 && git push --tags` yap. GitHub Actions kurulum dosyasını derleyip yayınlar.

`overlay.key` özel anahtardır: kimseyle paylaşma, depoya koyma. Kaybedersen mevcut kurulumlar güncellenemez.
