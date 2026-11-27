import { useEffect, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useGraph } from '../store/graph';
import { useUi } from '../store/ui';
import { plural } from '../lib/format';

/** A small mark: three linked cells, the map in miniature. */
function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M5 14 10 5l5 9z" fill="none" stroke="#34315a" strokeWidth="1.2" />
      <circle cx="10" cy="5" r="2.6" fill="#7a6bff" />
      <circle cx="5" cy="14" r="2.6" fill="#8cf06e" />
      <circle cx="15" cy="14" r="2.6" fill="#ff73c6" />
    </svg>
  );
}

function useServerStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const check = () => api.health().then(() => live && setOnline(true)).catch(() => live && setOnline(false));
    check();
    const id = setInterval(check, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return online;
}

export default function TopBar() {
  const pages = useGraph(s => s.nodes.length);
  const clusters = useGraph(s => s.clusters.length);
  const askOpen = useUi(s => s.askOpen);
  const toggleAsk = useUi(s => s.toggleAsk);
  const openPalette = useUi(s => s.setPaletteOpen);
  const online = useServerStatus();
  const mac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  return (
    <header className="glass pointer-events-auto flex h-14 shrink-0 items-center gap-4 px-4">
      <div className="flex items-center gap-2.5 pr-2">
        <Mark />
        <span className="text-[16px] font-semibold tracking-[-0.02em]">MindCanvas</span>
      </div>

      <button onClick={() => openPalette(true)}
        className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-left text-mute transition-colors hover:border-white/15 hover:bg-white/[0.07]">
        <Search size={14} />
        <span className="flex-1 text-[13px]">Jump to a page</span>
        <kbd className="kbd">{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-4">
        {pages > 0 && <span className="hidden text-[12.5px] text-mute md:inline">{plural(pages, 'page')} in {plural(clusters, 'cluster')}</span>}
        <span className="flex items-center gap-1.5 text-[12.5px] text-mute" title={online === false ? 'The backend on port 8090 is not answering' : undefined}>
          <span className={`size-1.5 rounded-full ${online ? 'bg-live shadow-[0_0_6px_var(--color-live)]' : online === false ? 'bg-[#ff6b6b]' : 'bg-mute'}`} />
          {online === null ? 'Connecting' : online ? 'Online' : 'Offline'}
        </span>
        <button onClick={toggleAsk} aria-pressed={askOpen} className={`icon-btn size-9 rounded-full ${askOpen ? 'bg-iris text-white hover:bg-iris hover:text-white' : ''}`} aria-label={askOpen ? 'Hide Ask panel' : 'Show Ask panel'} title="Ask">
          <MessageSquare size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
