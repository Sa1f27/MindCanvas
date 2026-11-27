import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, X } from 'lucide-react';
import { api } from '../lib/api';
import { useGraph } from '../store/graph';
import { cleanTitle, domainOf } from '../lib/format';
import type { SearchHit } from '../lib/types';
import PageRow from './PageRow';

/** Pages closest in meaning. Keyed by page id, so each page starts with a fresh request. */
function Related({ id }: { id: string }) {
  const [related, setRelated] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    let live = true;
    api.related(id).then(r => live && setRelated(r)).catch(() => live && setRelated([]));
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <section className="mt-6">
      <h3 className="pb-1 text-[12.5px] font-medium text-mute">Closest in meaning</h3>
      {related === null && <p className="text-dim">Finding related pages…</p>}
      {related?.length === 0 && <p className="text-dim">Nothing close yet.</p>}
      <div className="-mx-2.5">
        {related?.map(r => <PageRow key={r.id} id={String(r.id)} title={r.title} url={r.url} aside={r.similarity?.toFixed(2)} />)}
      </div>
    </section>
  );
}

/** Details for the selected page, sliding over the Ask panel. Escape or the close button dismisses it. */
export default function NodeSheet() {
  const node = useGraph(s => (s.selectedId ? s.nodeById.get(s.selectedId) : undefined));
  const color = useGraph(s => (node ? s.clusterColor[node.cluster] : undefined));
  const select = useGraph(s => s.select);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null, false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  if (!node) return null;

  return (
    <motion.aside
      key={node.id}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      aria-label="Page details"
      className="glass absolute inset-y-0 right-0 z-10 flex w-[380px] flex-col overflow-hidden !bg-panel/90"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-dim">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="truncate">{node.cluster}</span>
        </span>
        <button onClick={() => select(null, false)} className="icon-btn size-7" aria-label="Close details"><X size={15} /></button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-[18px] leading-snug font-medium text-fg">{cleanTitle(node.title)}</h2>
        <a href={node.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-dim underline-offset-4 hover:text-fg hover:underline">
          {domainOf(node.url)} <ExternalLink size={12} />
        </a>

        <dl className="mt-4 grid grid-cols-3 border-y border-line py-3 text-[12.5px]">
          <div><dt className="text-mute">Type</dt><dd className="mt-0.5 text-fg">{node.content_type}</dd></div>
          <div><dt className="text-mute">Quality</dt><dd className="tnum mt-0.5 font-mono text-fg">{node.quality_score.toFixed(1)}</dd></div>
          <div><dt className="text-mute">Read</dt><dd className="tnum mt-0.5 text-fg">{node.visit_timestamp ? new Date(node.visit_timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '-'}</dd></div>
        </dl>

        {node.summary && <p className="mt-4 text-[14px] leading-relaxed text-dim">{node.summary}</p>}

        {node.key_topics.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {node.key_topics.map(t => <li key={t} className="rounded-md border border-line px-2 py-0.5 text-[12.5px] text-dim">{t}</li>)}
          </ul>
        )}

        <Related key={node.id} id={node.id} />
      </div>
    </motion.aside>
  );
}
