import { memo } from 'react';
import { useGraph } from '../store/graph';
import { cleanTitle, domainOf } from '../lib/format';

interface Props {
  id: string;
  title: string;
  url?: string;
  /** Shown on the right, e.g. a similarity score. */
  aside?: string;
  index?: number;
}

/** One page in any list. Hovering it lights the node on the map; clicking selects it. */
function PageRow({ id, title, url, aside, index }: Props) {
  const node = useGraph(s => s.nodeById.get(id));
  const color = useGraph(s => (node ? s.clusterColor[node.cluster] : undefined));
  const select = useGraph(s => s.select);
  const hover = useGraph(s => s.hover);
  const site = domainOf(url ?? node?.url ?? '');

  return (
    <button
      onClick={() => node && select(id)}
      onMouseEnter={() => hover(id)}
      onMouseLeave={() => hover(null)}
      onFocus={() => hover(id)}
      onBlur={() => hover(null)}
      disabled={!node}
      className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-panel-2 disabled:cursor-default"
    >
      {index !== undefined
        ? <span className="tnum mt-px w-4 shrink-0 font-mono text-[11.5px] text-mute">{index}</span>
        : <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: color ?? '#676d7a' }} />}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13.5px] leading-snug text-fg">{cleanTitle(title)}</span>
        {site && <span className="mt-0.5 block truncate text-[12px] text-mute">{site}</span>}
      </span>
      {aside && <span className="tnum shrink-0 font-mono text-[11.5px] text-mute">{aside}</span>}
    </button>
  );
}

export default memo(PageRow);
