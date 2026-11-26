import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { useGraph } from '../store/graph';
import { useUi } from '../store/ui';
import { cleanTitle, domainOf } from '../lib/format';

const LIMIT = 8;

/** The dialog itself. It mounts fresh each time the palette opens, so the query always starts empty. */
function PaletteDialog({ onClose }: { onClose: () => void }) {
  const nodes = useGraph(s => s.nodes);
  const clusterColor = useGraph(s => s.clusterColor);
  const select = useGraph(s => s.select);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes.slice(0, LIMIT);
    // Title starts with the query, then contains it, then the site or cluster matches.
    const rank = (title: string, extra: string) => {
      const t = title.toLowerCase();
      if (t.startsWith(q)) return 0;
      if (t.includes(q)) return 1;
      return extra.toLowerCase().includes(q) ? 2 : -1;
    };
    return nodes
      .map(n => ({ n, r: rank(n.title, `${domainOf(n.url)} ${n.cluster}`) }))
      .filter(x => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .slice(0, LIMIT)
      .map(x => x.n);
  }, [nodes, query]);

  const choose = (id: string | undefined) => {
    if (!id) return;
    select(id);
    onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <motion.div role="dialog" aria-modal="true" aria-label="Jump to a page"
        initial={{ y: -8, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8, scale: 0.98 }} transition={{ duration: 0.14 }}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line-hi bg-panel shadow-2xl shadow-black">
        <label className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="text-mute" />
          <input autoFocus value={query} placeholder="Jump to a page"
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') choose(results[active]?.id);
              if (e.key === 'Escape') onClose();
            }}
            role="combobox" aria-expanded="true" aria-controls="palette-results"
            className="h-12 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-mute" />
          <kbd className="kbd">Esc</kbd>
        </label>
        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-dim">No page matches “{query}”.</li>}
          {results.map((n, i) => (
            <li key={n.id} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={() => choose(n.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-panel-2' : ''}`}>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: clusterColor[n.cluster] }} />
                <span className="min-w-0 flex-1 truncate text-fg">{cleanTitle(n.title)}</span>
                <span className="shrink-0 text-[12px] text-mute">{domainOf(n.url)}</span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/** Ctrl/Cmd+K: jump to any page by name. Arrow keys move, Enter opens it on the map. */
export default function CommandPalette() {
  const open = useUi(s => s.paletteOpen);
  const setOpen = useUi(s => s.setPaletteOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  return <AnimatePresence>{open && <PaletteDialog onClose={() => setOpen(false)} />}</AnimatePresence>;
}
