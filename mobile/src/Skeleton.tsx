/* Yüklenirken gri taslaklar: içerik gelince aynı yerde dolar (ekran zıplamaz). */
export function SkeletonCards({ n = 5 }: { n?: number }) {
  return (
    <div className="sk-list" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pc sk-card">
          <div className="pc-top"><i className="sk sk-sq" /><span className="sk-lines"><i className="sk" style={{ width: "62%" }} /><i className="sk" style={{ width: "40%" }} /></span><i className="sk sk-rank" /></div>
          <div className="pc-skins">{[0, 1, 2, 3].map((j) => <i key={j} className="sk sk-skin" />)}</div>
        </div>
      ))}
    </div>
  );
}
export function SkeletonTiles({ n = 6, big = false }: { n?: number; big?: boolean }) {
  return <div className={big ? "offers" : "grid"} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={big ? "sk sk-tile big" : "sk sk-tile"} />)}</div>;
}
export function SkeletonRows({ n = 6 }: { n?: number }) {
  return <div className="sk-list" aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className="sk sk-row" />)}</div>;
}
