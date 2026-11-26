import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useGraph } from '../../store/graph';
import type { SearchHit } from '../../lib/types';
import PageRow from '../PageRow';

const DEBOUNCE_MS = 300;

/**
 * Two kinds of match, side by side: titles that contain the words (instant, in the browser)
 * and pages that mean the same thing (vector search on the server, debounced).
 */
export default function SearchTab() {
  const nodes = useGraph(s => s.nodes);
  const [query, setQuery] = useState('');
  // Results are stored with the query they answer, so stale results are never shown for a new query.
  const [result, setResult] = useState<{ q: string; hits: SearchHit[]; failed: boolean }>({ q: '', hits: [], failed: false });
  const q = query.trim();

  const titleMatches = useMemo(() => {
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    return nodes.filter(n => n.title.toLowerCase().includes(needle)).slice(0, 8);
  }, [nodes, q]);

  useEffect(() => {
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.semanticSearch(q, 12, controller.signal)
        .then(hits => setResult({ q, hits, failed: false }))
        .catch(() => !controller.signal.aborted && setResult({ q, hits: [], failed: true }));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const current = result.q === q;
  const state = !current ? 'loading' : result.failed ? 'error' : 'idle';
  const titleIds = new Set(titleMatches.map(n => n.id));
  const meaning = current ? result.hits.filter(h => !titleIds.has(String(h.id))) : [];

  // Every match glows on the map as you type. The camera stays put, so typing never makes it lurch.
  const matchKey = [...titleIds, ...meaning.map(h => String(h.id))].join(',');
  const lit = useRef('');
  useEffect(() => {
    const { highlight, highlightIds } = useGraph.getState();
    const mine = lit.current && [...highlightIds].join(',') === lit.current;
    if (matchKey) {
      highlight(matchKey.split(','), false);
      lit.current = [...useGraph.getState().highlightIds].join(',');
    } else if (mine) {
      highlight([], false);
      lit.current = '';
    }
  }, [matchKey]);

  // Leaving the tab clears the glow, unless something else (a chat answer) has lit the map since.
  useEffect(() => () => {
    const { highlight, highlightIds } = useGraph.getState();
    if (lit.current && [...highlightIds].join(',') === lit.current) highlight([], false);
  }, []);

  return (
    <div className="px-2 py-3">
      <label className="relative mx-2 mb-3 block">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title or meaning"
          className="field pl-8" aria-label="Search pages" />
      </label>

      {q.length < 2 && <p className="px-2.5 text-dim">Search finds titles that contain your words and pages that mean the same thing.</p>}

      {titleMatches.length > 0 && (
        <section className="mb-3">
          <h3 className="px-2.5 pb-1 text-[12.5px] font-medium text-mute">In the title</h3>
          {titleMatches.map(n => <PageRow key={n.id} id={n.id} title={n.title} url={n.url} />)}
        </section>
      )}

      {q.length >= 3 && (
        <section>
          <h3 className="px-2.5 pb-1 text-[12.5px] font-medium text-mute">
            Similar in meaning {state === 'loading' && <span className="font-normal">· searching</span>}
          </h3>
          {state === 'error' && <p className="px-2.5 text-dim">Semantic search is unavailable right now.</p>}
          {state !== 'error' && meaning.length === 0 && state !== 'loading' && <p className="px-2.5 text-dim">No close matches.</p>}
          {meaning.map(h => (
            <PageRow key={h.id} id={String(h.id)} title={h.title} url={h.url}
              aside={h.similarity !== undefined ? h.similarity.toFixed(2) : undefined} />
          ))}
        </section>
      )}
    </div>
  );
}
