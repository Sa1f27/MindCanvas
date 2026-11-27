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

function ViewControls() {
  const view = useGraph(s => s.view);
  const setView = useGraph(s => s.setView);
  const showOnlyCluster = useGraph(s => s.showOnlyCluster);
  // Sits just left of the right-hand panel when one is open, so the glass never covers it.
  const askOpen = useUi(s => s.askOpen);
  const selecting = useGraph(s => s.selectedId !== null);
  const panelOpen = askOpen || selecting;
  return (
    <div className={`absolute bottom-6 flex items-center gap-2 ${panelOpen ? 'right-[408px]' : 'right-6'}`}>
      <button onClick={() => showOnlyCluster(null)} className="icon-btn border border-white/[0.08] bg-panel/70 backdrop-blur" aria-label="Show everything" title="Show everything">
        <Maximize size={15} />
      </button>
      <div role="radiogroup" aria-label="View" className="flex rounded-full border border-white/[0.08] bg-panel/70 p-0.5 backdrop-blur">
        {(['3d', '2d'] as const).map(v => (
          <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold uppercase transition-colors ${view === v ? 'bg-iris text-white' : 'text-mute hover:text-fg'}`}>
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
    <section ref={ref} aria-label="Knowledge map" className="absolute inset-0 overflow-hidden bg-ink">
      {ready && size.width > 0 && (
        <Suspense fallback={null}>
          {view === '3d'
            ? <Graph3D width={size.width} height={size.height} graph={graph} />
            : <Graph2D width={size.width} height={size.height} graph={graph} />}
        </Suspense>
      )}
      <StatusLayer />
      {ready && <ViewControls />}
    </section>
  );
}
