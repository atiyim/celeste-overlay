import { Icon } from "./icons";
import { useState, type ReactNode } from "react";

/* İlk açılış rehberi: 5 adım. Ayarlar'dan tekrar açılabilir. */
interface Props { onDone: () => void }

const Key = ({ children }: { children: ReactNode }) => <kbd className="gk">{children}</kbd>;

interface Item { sample: ReactNode; title: string; text: string }
const Items = ({ items }: { items: Item[] }) => (
  <div className="gitems">
    {items.map((it, i) => (
      <div className="gxi" key={it.title} style={{ animationDelay: `${i * 60}ms` }}>
        <span className="gxs">{it.sample}</span>
        <span className="gxt"><b>{it.title}</b><small>{it.text}</small></span>
      </div>
    ))}
  </div>
);

const STEPS: { title: string; lead: string; body: ReactNode }[] = [
  {
    title: "Celeste Overlay'e hoş geldin",
    lead: "Maça girerken lobideki herkesin rankını, son rekabet performansını ve kaplamalarını tek bakışta gösterir.",
    body: (
      <Items items={[
        { sample: <span className="gdot ok" />, title: "Giriş yok", text: "Riot hesabına giriş yapmazsın. Açık Riot Client oturumunu okur." },
        { sample: <span className="gdot ok" />, title: "Oyuna dokunmaz", text: "Oyuna tuş göndermez, oyun dosyalarını değiştirmez. Yalnızca okur." },
        { sample: <span className="gdot ok" />, title: "Veriler sende kalır", text: "Etiketler ve notlar yalnızca bu bilgisayarda saklanır." },
        { sample: <span className="gdot ok" />, title: "Gizli isimler gizli kalır", text: "İsmini gizleyen oyuncunun adı gösterilmez." },
        { sample: <span className="gdot ok" />, title: "Kanıtı içinde", text: "Sol menüdeki S.S.S bölümü uygulamanın attığı her isteği canlı gösterir." },
      ]} />
    ),
  },
  {
    title: "Nasıl çalışır",
    lead: "Sen sadece oyunu aç. Oyuncular ajan seçimi başlayınca kendiliğinden listelenir.",
    body: (
      <>
        <div className="gflow">
          {[["Riot Client", "Aç ve giriş yap"], ["Valorant", "Oyunu başlat"], ["Ajan seçimi", "Liste dolar"]].map(([a, b], i) => (
            <div className="gf" key={a} style={{ animationDelay: `${i * 120}ms` }}>
              <span className="gfn">{i + 1}</span>
              <b>{a}</b>
              <small>{b}</small>
            </div>
          ))}
        </div>
        <Items items={[
          { sample: <span className="gdots"><i className="ok" /></span>, title: "Sol alttaki durum", text: "\"Her şey bağlı\" yazıyorsa sorun yok. Tıklarsan neyin çalışmadığını görürsün." },
          { sample: <span className="gsoft">Oyun başlayınca görünür</span>, title: "Kaplamalar", text: "Rakip kaplamaları ancak oyun başlayınca Riot tarafından paylaşılır." },
          { sample: <span className="gsoft">Pencereli Tam Ekran</span>, title: "Overlay görünmüyorsa", text: "Valorant'ta Ayarlar → Video → Ekran Modu'nu Pencereli Tam Ekran yap. Tam ekranda overlay oyunun arkasında kalır." },
        ]} />
      </>
    ),
  },
  {
    title: "Bir satırı okumak",
    lead: "Her satır bir oyuncudur. Satıra tıklarsan silahları, son maçları ve ayrıntıları açılır.",
    body: (
      <Items items={[
        { sample: <span className="grank">Platin 2<small>41 RR</small></span>, title: "Rank ve Peak", text: "Şu anki rank ve gördüğü en yüksek rank." },
        { sample: <span className="gsq"><i className="w" /><i className="w" /><i className="l" /><i className="w alt" /><i className="l" /></span>, title: "Son 5 maç", text: "Yeşil galibiyet, pembe mağlubiyet. Soluk kareler rekabet dışı modlar; üstüne gelince mod, harita ve ajan görünür." },
        { sample: <span className="gpb"><i /><i className="soft" /></span>, title: "Parti", text: "Avatarın solundaki aynı renk çizgi aynı partiyi gösterir. Soluk çizgi: son maçlarda sık birlikte oynadılar." },
        { sample: <span className="rep">3. kez aynı maçta</span>, title: "Tekrar karşılaşma", text: "Bu oyuncuyla daha önce aynı maçtaydın. Satır hafif renkli işaretlenir." },
        { sample: <span className="bd pos">Formda +72 RR</span>, title: "Öne çıkan", text: "Ölçülen verilerden çıkar. Birden fazlaysa \"+1\" üstüne gelince görünür. Eşikler Ayarlar'da." },
      ]} />
    ),
  },
  {
    title: "Pencereyi yönet",
    lead: "Overlay oyunun üstünde durur. İstediğin gibi taşı, küçült, gizle.",
    body: (
      <Items items={[
        { sample: <Key>F2</Key>, title: "Göster / gizle", text: "Overlay'i anında gizler ya da öne getirir." },
        { sample: <span className="gdrag">Haven</span>, title: "Taşı", text: "Başlıktan ya da sol menünün boş yerinden tutup sürükle." },
        { sample: <span className="gico"><Icon name="sliders" size={15} /></span>, title: "Hızlı ayarlar", text: "Sağ üstteki düğme: kayıtta gizle, isimleri bulanıklaştır, FPS modu ve yazı boyutu." },
        { sample: <span className="gico"><Icon name="minus" size={15} /></span>, title: "Küçült", text: "Başlık dışında her şeyi kapatır. Maç başlayınca kendiliğinden de gizlenir." },
      ]} />
    ),
  },
  {
    title: "Diğer bölümler",
    lead: "Soldaki menüyle gezinirsin. Hazırsan başlayalım.",
    body: (
      <div className="gtabs">
        {[
          ["Lobi", "Maçtaki oyuncular"],
          ["Son maç", "Bitmiş maçın raporu"],
          ["Profilim", "İstatistik, mağaza, hesabın"],
          ["Akış", "Topluluğun paylaşımları"],
          ["Araçlar", "Hızlı mesajlar, nişangahlar"],
          ["S.S.S", "Sorular ve canlı ağ kaydı"],
          ["Ayarlar", "Renk, sütunlar, Tilt koruyucu"],
        ].map(([a, b], i) => (
          <div className="gtab" key={a} style={{ animationDelay: `${i * 45}ms` }}><b>{a}</b><small>{b}</small></div>
        ))}
      </div>
    ),
  },
];

export function Guide({ onDone }: Props) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const s = STEPS[i];
  return (
    <div className="panel guide" role="dialog" aria-label="Başlangıç rehberi">
      <div className="gbar" aria-hidden="true"><i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>
      <div className="ph">
        <p className="m">Adım {i + 1} / {STEPS.length}</p>
        <button className="x" type="button" onClick={onDone}>Rehberi kapat</button>
      </div>
      <div className="gstep" key={i}>
        <h2 className="gh">{s.title}</h2>
        <p className="gl">{s.lead}</p>
        {s.body}
      </div>
      <div className="gnav">
        <button className="x" type="button" onClick={() => setI(i - 1)} disabled={i === 0}>Geri</button>
        <span className="gpg" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className={k === i ? "on" : k < i ? "done" : ""} />)}</span>
        <button className="x go" type="button" onClick={() => (last ? onDone() : setI(i + 1))} autoFocus>{last ? "Başla" : "İleri"}</button>
      </div>
    </div>
  );
}
