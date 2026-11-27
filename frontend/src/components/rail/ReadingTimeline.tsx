import { useMemo, useRef, useState } from 'react';
import { useGraph } from '../../store/graph';
import { useElementSize } from '../../hooks/useElementSize';
import { plural } from '../../lib/format';

const BAR = 4;
const HEIGHT = 64;

const fmt = (t: number, withTime: boolean) =>
  new Date(t).toLocaleString(undefined, withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });

/**
 * When the pages were read, as one quiet bar chart. Hovering a bar lights its pages on the map,
 * clicking flies the camera to them.
 */
export default function ReadingTimeline() {
  const nodes = useGraph(s => s.nodes);
  const highlight = useGraph(s => s.highlight);
  // What was lit before hovering (say, a chat answer's pages), restored when the pointer leaves.
  const before = useRef<string[] | null>(null);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const times = useMemo(
    () =>
      nodes
        .map(n => ({ id: n.id, t: n.visit_timestamp ? Date.parse(n.visit_timestamp) : NaN }))
        .filter(d => Number.isFinite(d.t))
        .sort((a, b) => a.t - b.t),
    [nodes],
  );

  const chart = useMemo(() => {
    if (times.length < 3 || size.width === 0) return null;
    const start = times[0]!.t;
    const end = times[times.length - 1]!.t;
    const span = Math.max(end - start, 1);
    const count = Math.max(12, Math.floor(size.width / (BAR * 2)));
    const bins = Array.from({ length: count }, (_, i) => ({ from: start + (span * i) / count, ids: [] as string[] }));
    for (const d of times) bins[Math.min(count - 1, Math.floor(((d.t - start) / span) * count))]!.ids.push(d.id);
    const peak = Math.max(...bins.map(b => b.ids.length));
    return { bins, peak, start, end, step: size.width / count, binSpan: span / count };
  }, [times, size.width]);

  if (times.length < 3) return null;
  const bin = chart && active !== null ? chart.bins[active] : null;

  return (
    <section className="border-t border-white/[0.06] px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-fg">Reading activity</h3>
        <span className="tnum text-[12px] text-mute">
          {bin ? `${plural(bin.ids.length, 'page')}, ${fmt(bin.from, chart!.binSpan < 864e5)}` : plural(times.length, 'page')}
        </span>
      </div>

      <div ref={ref} style={{ height: HEIGHT }}
        onMouseLeave={() => {
          setActive(null);
          if (before.current) highlight(before.current, false);
          before.current = null;
        }}>
        {chart && (
          <svg width={size.width} height={HEIGHT} role="img"
            aria-label={`${plural(times.length, 'page')} read between ${fmt(chart.start, false)} and ${fmt(chart.end, false)}`}>
            {chart.bins.map((b, i) => {
              const h = b.ids.length ? Math.max(3, (b.ids.length / chart.peak) * (HEIGHT - 2)) : 1;
              const on = active === i;
              return (
                <g key={i} className="cursor-pointer"
                  onMouseEnter={() => {
                    if (!before.current) before.current = [...useGraph.getState().highlightIds];
                    setActive(i);
                    highlight(b.ids, false);
                  }}
                  onClick={() => {
                    if (!b.ids.length) return;
                    before.current = b.ids;
                    highlight(b.ids, true);
                  }}>
                  {/* Full-height hit area, so thin bars are easy to point at. */}
                  <rect x={i * chart.step} y={0} width={chart.step} height={HEIGHT} fill="transparent" />
                  <rect x={i * chart.step + (chart.step - BAR) / 2} y={HEIGHT - h} width={BAR} height={h} rx={1.5}
                    fill={on ? 'var(--color-iris)' : b.ids.length ? 'rgba(238,237,247,0.32)' : 'rgba(238,237,247,0.08)'} />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {chart && (
        <div className="mt-2 flex justify-between text-[11.5px] text-mute">
          <span>{fmt(chart.start, false)}</span>
          <span>{fmt(chart.end, false)}</span>
        </div>
      )}
    </section>
  );
}
