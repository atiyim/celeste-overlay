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
          { sample: <span className="gdots"><i className="ok" /><i className="ok" /><i className="ok" /></span>, title: "Sağ alttaki noktalar", text: "Bağlantı durumunu gösterir. Birine tıklarsan neyin çalışmadığını görürsün." },
          { sample: <span className="gsoft">Oyun başlayınca görünür</span>, title: "Kaplamalar", text: "Rakip kaplamaları ancak oyun başlayınca Riot tarafından paylaşılır." },
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
        { sample: <span className="gwl"><i className="w">W</i><i className="w">W</i><i className="l">L</i><i className="w">W</i><i className="l">L</i></span>, title: "Son 5 rekabet", text: "Yeşil galibiyet, kırmızı mağlubiyet. Yalnızca rekabet maçları sayılır." },
        { sample: <span className="gpair"><i className="p">A</i><i className="p soft">B</i></span>, title: "Parti", text: "Düz çerçeve: Riot'a göre aynı partide. Kesik çerçeve: son maçlarda sık birlikte oynadılar." },
        { sample: <span className="rep">3. kez</span>, title: "Tekrar karşılaşma", text: "Bu oyuncuyla daha önce aynı maçtaydın. Satır renkli işaretlenir." },
        { sample: <span className="bd pos">Formda +72 RR</span>, title: "Rozetler", text: "Ölçülen verilerden çıkar. Eşikleri Ayarlar'dan değiştirebilirsin." },
      ]} />
    ),
  },
  {
    title: "Pencereyi yönet",
    lead: "Overlay oyunun üstünde durur. İstediğin gibi taşı, küçült, gizle.",
    body: (
      <Items items={[
        { sample: <Key>F2</Key>, title: "Göster / gizle", text: "Overlay'i anında gizler ya da öne getirir." },
        { sample: <span className="gdrag">Haven</span>, title: "Taşı", text: "Üstteki başlık şeridinden sürükle." },
        { sample: <span className="gbtns"><i>A−</i><i>A+</i></span>, title: "Yazı boyutu", text: "Küçültür veya büyütür. Ayarlar'da yüzde olarak da seçebilirsin." },
        { sample: <span className="gbtns"><i>Kayıtta gizle</i></span>, title: "Kayıt ve yayın", text: "Açıkken overlay kayıtta görünmez, sen oyunda görmeye devam edersin." },
        { sample: <span className="gbtns"><i>Gizle</i></span>, title: "Şeride küçült", text: "Başlık dışında her şeyi kapatır. Maç başlayınca kendiliğinden de gizlenir." },
      ]} />
    ),
  },
  {
    title: "Diğer bölümler",
    lead: "Üstteki sekmelerle gezinirsin. Hazırsan başlayalım.",
    body: (
      <div className="gtabs">
        {[
          ["Oyuncular", "Lobi listesi"],
          ["Son maç", "Bitmiş maçın raporu"],
          ["Mağaza", "Günlük ve gece mağazası"],
          ["Hesabım", "Bakiye, görevler, envanter"],
          ["İstatistik", "Kendi rekabet verilerin"],
          ["Sohbet", "Hızlı mesaj kısayolları"],
          ["Nişangah", "Hazır nişangah kodları"],
          ["Ayarlar", "Renk, sütunlar, eşikler"],
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
