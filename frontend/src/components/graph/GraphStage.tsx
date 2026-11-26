import { lazy, Suspense } from 'react';
import { Maximize, RefreshCw } from 'lucide-react';
import { useGraph } from '../../store/graph';
import { useUi } from '../../store/ui';
import { useElementSize } from '../../hooks/useElementSize';
import { useSimGraph } from './model';

// Each renderer is its own chunk; three.js only downloads when the 3D view is shown.
const Graph3D = lazy(() => import('./Graph3D'));
const Graph2D = lazy(() => import('./Graph2D'));

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center p-6 text-center">{children}</div>;
}

function StatusLayer() {
  const status = useGraph(s => s.status);
  const error = useGraph(s => s.error);
  const count = useGraph(s => s.nodes.length);
  const load = useGraph(s => s.load);

  if (status === 'loading' || status === 'idle') {
    return (
      <Centered>
        <p className="text-dim">Mapping your reading…</p>
      </Centered>
    );
  }
  if (status === 'error') {
    return (
      <Centered>
        <div className="max-w-sm">
          <p className="text-fg">The map did not load</p>
          <p className="mt-1 text-dim">{error}</p>
          <button onClick={() => load()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-fg hover:border-line-hi">
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </Centered>
    );
  }
  if (count === 0) {
    return (
      <Centered>
        <div className="max-w-sm">
          <p className="text-fg">Nothing mapped yet</p>
          <p className="mt-1 text-dim">
            Send your browsing history from the MindCanvas extension, or load the sample set with
            <code className="mx-1 font-mono text-[12.5px] text-fg">sample/load_sample_data.ps1</code>.
          </p>
        </div>
      </Centered>
    );
  }
  return null;
}

/** Cluster colours at a glance. Hidden while the Clusters panel is open, since that panel lists them. */
function Legend() {
  const clusters = useGraph(s => s.clusters);
  const hidden = useGraph(s => s.hiddenClusters);
  const panelShowsClusters = useUi(s => s.railOpen && s.railTab === 'clusters');
  if (!clusters.length || panelShowsClusters) return null;
  const shown = clusters.slice(0, 8);
  return (
    <ul className="pointer-events-none absolute bottom-4 left-4 flex max-w-[60%] flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
      {shown.map(c => (
        <li key={c.name} className={`flex items-center gap-1.5 ${hidden.has(c.name) ? 'text-mute line-through' : 'text-dim'}`}>
          <span className="size-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
          {c.name}
        </li>
      ))}
      {clusters.length > shown.length && <li className="text-mute">+{clusters.length - shown.length} more</li>}
    </ul>
  );
}

function ViewControls() {
  const view = useGraph(s => s.view);
  const setView = useGraph(s => s.setView);
  const showOnlyCluster = useGraph(s => s.showOnlyCluster);
  return (
    <div className="absolute right-4 bottom-4 flex items-center gap-2">
      <button onClick={() => showOnlyCluster(null)} className="icon-btn border border-line bg-panel/80 backdrop-blur" aria-label="Show everything" title="Show everything">
        <Maximize size={15} />
      </button>
      <div role="radiogroup" aria-label="View" className="flex rounded-lg border border-line bg-panel/80 p-0.5 backdrop-blur">
        {(['3d', '2d'] as const).map(v => (
          <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}
            className={`rounded-md px-2.5 py-1 font-mono text-[12px] uppercase transition-colors ${view === v ? 'bg-panel-2 text-fg' : 'text-mute hover:text-fg'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GraphStage() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const view = useGraph(s => s.view);
  const ready = useGraph(s => s.status === 'ready' && s.nodes.length > 0);
  const graph = useSimGraph();

  return (
    <section ref={ref} aria-label="Knowledge map" className="relative min-w-0 flex-1 overflow-hidden bg-ink">
      {ready && size.width > 0 && (
        <Suspense fallback={null}>
          {view === '3d'
            ? <Graph3D width={size.width} height={size.height} graph={graph} />
            : <Graph2D width={size.width} height={size.height} graph={graph} />}
        </Suspense>
      )}
      <StatusLayer />
      {ready && <Legend />}
      {ready && <ViewControls />}
    </section>
  );
}
