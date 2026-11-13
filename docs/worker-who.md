# Worker: lobi rol sorgusu

Overlay, lobideki oyuncuların rollerini görmek için sunucuya yalnızca **özet (hash)** gönderir.

`POST /api/feed/who`
- İstek: `{ "h": ["<hash>", ...] }` (en fazla ~10 adet)
- Hash: `sha256("celeste:" + puuid)` çıktısının ilk 12 baytı, hex (24 karakter)
- Yanıt: `{ "roles": { "<hash>": [ { "name": "...", "color": "#rrggbb", "icon": "..." } ] } }`
- Sadece rolü olan hash'ler döner; diğerleri yanıttan çıkarılır.
- Sunucu, rol sahiplerinin puuid'lerini aynı yöntemle hash'leyip karşılaştırmalıdır.

Endpoint yoksa uygulama 30 dk sessizce bekler; yalnızca kendi rolün lobide görünür.
