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
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex min-h-0 flex-1">
        <Rail />
        <GraphStage />
        {(askOpen || hasSelection) && (
          <div className="relative flex shrink-0">
            {askOpen ? <AskPanel /> : <div className="w-[380px]" />}
            <NodeSheet />
          </div>
        )}
      </main>
      <CommandPalette />
    </div>
  );
}
