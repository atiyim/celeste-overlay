import { Icon } from "./icons";
import { clock, SPIKE_NAME, spikePhase, useTimers } from "./timerStore";

/* Başlıkta çalışan sayaç varsa en yakın biten gösterilir; tıklayınca sayaç sayfası açılır. */
export function TimerPill({ onOpen }: { onOpen: () => void }) {
  const run = useTimers().filter((t) => !t.done).sort((a, b) => a.endsAt - b.endsAt);
  if (run.length === 0) return null;
  const t = run.find((x) => x.name === SPIKE_NAME) ?? run[0];
  const left = t.endsAt - Date.now();
  const ph = t.name === SPIKE_NAME ? spikePhase(left) : null;
  return (
    <button type="button" className={ph ? `tpill ph-${ph.id}` : "tpill"} onClick={onOpen} onMouseDown={(e) => e.stopPropagation()} title={`${run.length} sayaç çalışıyor`}>
      <Icon name="clock" size={13} />{t.name} {ph ? `${Math.ceil(left / 1000)} sn · ${ph.label}` : clock(left)}{run.length > 1 ? ` +${run.length - 1}` : ""}
    </button>
  );
}
