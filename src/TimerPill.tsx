import { Icon } from "./icons";
import { clock, useTimers } from "./timers";

/* Başlıkta çalışan sayaç varsa en yakın biten gösterilir; tıklayınca sayaç sayfası açılır. */
export function TimerPill({ onOpen }: { onOpen: () => void }) {
  const run = useTimers().filter((t) => !t.done).sort((a, b) => a.endsAt - b.endsAt);
  if (run.length === 0) return null;
  const t = run[0];
  return (
    <button type="button" className="tpill" onClick={onOpen} onMouseDown={(e) => e.stopPropagation()} title={`${run.length} sayaç çalışıyor`}>
      <Icon name="clock" size={13} />{t.name} {clock(t.endsAt - Date.now())}{run.length > 1 ? ` +${run.length - 1}` : ""}
    </button>
  );
}
