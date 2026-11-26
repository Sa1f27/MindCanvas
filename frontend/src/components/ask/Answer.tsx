import { memo, useMemo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import { useGraph } from '../../store/graph';
import type { ChatSource, ChatTurn } from '../../lib/types';
import PageRow from '../PageRow';

const CITE = /\[(\d{1,2})\](?!\()/g;

/** An inline [n] citation. Hovering it lights that page on the map; clicking selects it. */
function Cite({ n, source }: { n: number; source?: ChatSource }) {
  const hover = useGraph(s => s.hover);
  const select = useGraph(s => s.select);
  if (!source) return <sup className="text-mute">[{n}]</sup>;
  return (
    <button
      onMouseEnter={() => hover(source.id)}
      onMouseLeave={() => hover(null)}
      onClick={() => select(source.id)}
      title={source.title}
      className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-px items-center justify-center rounded border border-line-hi px-1 align-middle font-mono text-[10.5px] text-fg transition-colors hover:bg-fg hover:text-ink"
    >
      {n}
    </button>
  );
}

/** One assistant turn: the answer with live citations, then the pages it was retrieved from. */
function Answer({ turn }: { turn: ChatTurn }) {
  const sources = useMemo(() => turn.sources ?? [], [turn.sources]);

  // [n] becomes a link the renderer below turns into a citation chip.
  const markdown = useMemo(() => turn.content.replace(CITE, '[$1](#cite-$1)'), [turn.content]);
  const components = useMemo<Components>(() => ({
    a: ({ node: _node, href, children, ...props }) => {
      if (href?.startsWith('#cite-')) {
        const n = Number(href.slice(6));
        return <Cite n={n} source={sources[n - 1]} />;
      }
      return <a href={href} {...props} target="_blank" rel="noreferrer">{children}</a>;
    },
  }), [sources]);

  if (turn.failed) {
    return <p className="rounded-lg border border-line px-3 py-2 text-dim">{turn.content}</p>;
  }

  return (
    <div>
      <div className="prose-answer text-[14px] leading-relaxed text-dim">
        <Markdown components={components}>{markdown}</Markdown>
      </div>
      {sources.length > 0 && (
        <section className="mt-3 border-t border-line pt-2">
          <h4 className="px-2.5 pb-1 text-[12px] font-medium text-mute">From {sources.length} {sources.length === 1 ? 'page' : 'pages'}, lit on the map</h4>
          {sources.map((s, i) => (
            <PageRow key={`${s.id}-${i}`} id={s.id} title={s.title} url={s.url} index={i + 1} aside={s.similarity ? s.similarity.toFixed(2) : undefined} />
          ))}
        </section>
      )}
    </div>
  );
}

export default memo(Answer);
