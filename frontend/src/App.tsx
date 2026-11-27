import { useEffect } from 'react';
import { useGraph } from './store/graph';
import { useUi } from './store/ui';
import TopBar from './components/TopBar';
import Rail from './components/rail/Rail';
import GraphStage from './components/graph/GraphStage';
import AskPanel from './components/ask/AskPanel';
import NodeSheet from './components/NodeSheet';
import CommandPalette from './components/CommandPalette';

export default function App() {
  const load = useGraph(s => s.load);
  const askOpen = useUi(s => s.askOpen);
  const hasSelection = useGraph(s => s.selectedId !== null);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    // The map is the page; the bar and panels float over it, so the clusters glow behind the glass.
    <div className="relative h-full overflow-hidden">
      <GraphStage />
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
        <TopBar />
        <main className="flex min-h-0 flex-1 justify-between gap-3">
          <Rail />
          {(askOpen || hasSelection) && (
            <div className="pointer-events-auto relative flex shrink-0">
              {askOpen ? <AskPanel /> : <div className="w-[380px]" />}
              <NodeSheet />
            </div>
          )}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
