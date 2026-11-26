import { useMemo } from 'react';
import { useGraph } from '../../store/graph';
import { domainOf } from '../../lib/format';

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="px-4 py-3">
      <dd className="tnum font-mono text-[20px] text-fg">{value}</dd>
      <dt className="text-[12.5px] text-mute">{label}</dt>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return (
    <section className="px-4 py-3">
      <h3 className="mb-2 text-[12.5px] font-medium text-mute">{title}</h3>
      <ul className="space-y-1.5">
        {rows.map(([name, n]) => (
          <li key={name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="truncate text-[13px] text-dim">{name}</span>
            <span className="tnum font-mono text-[12px] text-mute">{n}</span>
            <span className="col-span-2 h-px bg-line">
              <span className="block h-px bg-dim" style={{ width: `${(n / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const top = (counts: Map<string, number>, k: number) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);

/** Figures computed from the map itself, so they always agree with what is on screen. */
export default function StatsTab() {
  const nodes = useGraph(s => s.nodes);
  const links = useGraph(s => s.links);
  const clusters = useGraph(s => s.clusters);

  const { types, sites, quality } = useMemo(() => {
    const types = new Map<string, number>();
    const sites = new Map<string, number>();
    let q = 0;
    for (const n of nodes) {
      types.set(n.content_type || 'Other', (types.get(n.content_type || 'Other') ?? 0) + 1);
      const d = domainOf(n.url);
      if (d) sites.set(d, (sites.get(d) ?? 0) + 1);
      q += n.quality_score || 0;
    }
    return { types: top(types, 6), sites: top(sites, 6), quality: nodes.length ? q / nodes.length : 0 };
  }, [nodes]);

  return (
    <div className="py-1">
      <dl className="grid grid-cols-2 divide-x divide-y divide-line border-b border-line">
        <Figure value={nodes.length} label="Pages" />
        <Figure value={clusters.length} label="Clusters" />
        <Figure value={links.length} label="Links" />
        <Figure value={quality.toFixed(1)} label="Average quality" />
      </dl>
      <Breakdown title="Content type" rows={types} />
      <Breakdown title="Most read sites" rows={sites} />
    </div>
  );
}
