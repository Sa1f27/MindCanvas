import { Eye, EyeOff } from 'lucide-react';
import { useGraph } from '../../store/graph';

/** Every cluster with its size. Click to isolate it on the map, the eye to hide it. */
export default function ClustersTab() {
  const clusters = useGraph(s => s.clusters);
  const hidden = useGraph(s => s.hiddenClusters);
  const largest = useGraph(s => s.clusters[0]?.size ?? 1);
  const toggle = useGraph(s => s.toggleCluster);
  const only = useGraph(s => s.showOnlyCluster);
  const isolated = clusters.length > 1 && hidden.size === clusters.length - 1 ? clusters.find(c => !hidden.has(c.name))?.name : null;

  if (!clusters.length) return <p className="px-4 py-3 text-dim">Clusters appear once pages are mapped.</p>;

  return (
    <ul className="px-2 py-2">
      {clusters.map(c => {
        const off = hidden.has(c.name);
        return (
          <li key={c.name} className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-panel-2">
            <button
              onClick={() => only(isolated === c.name ? null : c.name)}
              aria-pressed={isolated === c.name}
              title={c.name}
              className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: off ? 'transparent' : c.color, boxShadow: off ? `inset 0 0 0 1px ${c.color}` : `0 0 8px ${c.color}` }} />
              <span className={`min-w-0 flex-1 truncate text-[13.5px] ${off ? 'text-mute' : 'text-fg'}`}>{c.name}</span>
              <span className="relative h-1 w-8 shrink-0 overflow-hidden rounded-full bg-line">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.size / largest) * 100}%`, background: c.color, opacity: off ? 0.3 : 0.8 }} />
              </span>
              <span className="tnum w-6 shrink-0 text-right font-mono text-[12px] text-mute">{c.size}</span>
            </button>
            <button onClick={() => toggle(c.name)} className="icon-btn size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={off ? `Show ${c.name}` : `Hide ${c.name}`}>
              {off ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
