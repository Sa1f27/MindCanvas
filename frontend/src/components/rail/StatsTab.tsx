import { useMemo, type ReactNode } from 'react';
import { useGraph } from '../../store/graph';
import { domainOf } from '../../lib/format';
import { areaLinks, betweenness, buildAdjacency, degrees, topK } from '../../lib/graphStats';
import PageRow from '../PageRow';

function Section({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[12.5px] font-medium text-fg">{title}</h3>
        {action}
      </div>
      {note && <p className="-mt-1 mb-2.5 text-[12px] leading-snug text-mute">{note}</p>}
      {children}
    </section>
  );
}

function LightButton({ ids }: { ids: string[] }) {
  const highlight = useGraph(s => s.highlight);
  if (!ids.length) return null;
  return (
    <button onClick={() => highlight(ids)} className="shrink-0 text-[12px] text-dim underline decoration-line-hi underline-offset-4 hover:text-fg hover:decoration-fg">
      Show on map
    </button>
  );
}

/** One bar, split into the cluster colours: what share of everything read each area takes. */
function AreaShare() {
  const clusters = useGraph(s => s.clusters);
  const total = useGraph(s => s.nodes.length);
  const only = useGraph(s => s.showOnlyCluster);
  const top = clusters[0];
  if (!top || !total) return null;
  return (
    <Section title="Your reading by area">
      <div className="flex h-2.5 gap-px overflow-hidden rounded-full" role="img"
        aria-label={clusters.map(c => `${c.name} ${Math.round((c.size / total) * 100)}%`).join(', ')}>
        {clusters.map(c => (
          <button key={c.name} onClick={() => only(c.name)} title={`${c.name}: ${c.size} of ${total} pages`}
            aria-label={`Show only ${c.name}`}
            className="h-full transition-[filter] hover:brightness-125"
            style={{ flexGrow: c.size, background: c.color, boxShadow: `0 0 10px ${c.color}66` }} />
        ))}
      </div>
      <p className="mt-2.5 text-[12.5px] text-dim">
        <span className="text-fg">{top.name}</span> is the largest area, {Math.round((top.size / total) * 100)}% of what you read.
      </p>
    </Section>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Analysis computed from the map itself, so every number agrees with what is on screen. */
export default function StatsTab() {
  const nodes = useGraph(s => s.nodes);
  const links = useGraph(s => s.links);
  const clusters = useGraph(s => s.clusters);
  const clusterColor = useGraph(s => s.clusterColor);
  const nodeById = useGraph(s => s.nodeById);
  const highlight = useGraph(s => s.highlight);

  const analysis = useMemo(() => {
    const adj = buildAdjacency(nodes, links);
    const sites = new Map<string, number>();
    for (const n of nodes) {
      const d = domainOf(n.url);
      if (d) sites.set(d, (sites.get(d) ?? 0) + 1);
    }
    return {
      hubs: topK(degrees(adj), 5),
      bridges: topK(betweenness(adj), 4, 0.005),
      areas: areaLinks(nodes, links).slice(0, 4),
      sites: [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      quality: nodes.length ? nodes.reduce((q, n) => q + (n.quality_score || 0), 0) / nodes.length : 0,
    };
  }, [nodes, links]);

  // The pages on the links between two areas: what "these areas connect" actually means.
  const lightAreaLink = (a: string, b: string) => {
    const ids = new Set<string>();
    for (const l of links) {
      const s = nodeById.get(String(l.source));
      const t = nodeById.get(String(l.target));
      if (s && t && ((s.cluster === a && t.cluster === b) || (s.cluster === b && t.cluster === a))) {
        ids.add(s.id);
        ids.add(t.id);
      }
    }
    highlight([...ids]);
  };

  if (!nodes.length) return <p className="px-4 py-3 text-dim">Stats appear once pages are mapped.</p>;
  const maxSite = analysis.sites[0]?.[1] ?? 1;

  return (
    <div>
      <dl className="grid grid-cols-4 border-b border-line">
        {[
          [nodes.length, 'Pages'],
          [clusters.length, 'Areas'],
          [links.length, 'Links'],
          [analysis.quality.toFixed(1), 'Quality'],
        ].map(([value, label], i) => (
          <div key={label} className={`px-3 py-3.5 ${i ? 'border-l border-line' : ''}`}>
            <dd className="tnum font-mono text-[17px] leading-none text-fg">{value}</dd>
            <dt className="mt-1.5 text-[11.5px] text-mute">{label}</dt>
          </div>
        ))}
      </dl>

      <AreaShare />

      <Section title="Hub pages" note="Linked to the most other pages. Much of your reading builds on these."
        action={<LightButton ids={analysis.hubs.map(([id]) => id)} />}>
        <div className="-mx-2.5">
          {analysis.hubs.map(([id, n]) => {
            const node = nodeById.get(id);
            return node && <PageRow key={id} id={id} title={node.title} url={node.url} aside={plural(n, 'link')} />;
          })}
        </div>
      </Section>

      {analysis.bridges.length > 0 && (
        <Section title="Bridge pages" note="On the most shortest paths between other pages (betweenness centrality). They tie separate areas together."
          action={<LightButton ids={analysis.bridges.map(([id]) => id)} />}>
          <div className="-mx-2.5">
            {analysis.bridges.map(([id, score]) => {
              const node = nodeById.get(id);
              return node && <PageRow key={id} id={id} title={node.title} url={node.url} aside={score.toFixed(2)} />;
            })}
          </div>
        </Section>
      )}

      {analysis.areas.length > 0 && (
        <Section title="Areas that connect" note="Pairs of areas with the most links between them.">
          <ul className="-mx-2.5">
            {analysis.areas.map(({ a, b, count }) => (
              <li key={`${a}|${b}`}>
                <button onClick={() => lightAreaLink(a, b)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-panel-2">
                  <span className="flex shrink-0 items-center">
                    <span className="size-2 rounded-full" style={{ background: clusterColor[a] }} />
                    <span className="h-px w-3 bg-line-hi" />
                    <span className="size-2 rounded-full" style={{ background: clusterColor[b] }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{a} <span className="text-mute">and</span> {b}</span>
                  <span className="tnum shrink-0 font-mono text-[11.5px] text-mute">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Most read sites">
        <ul className="space-y-2">
          {analysis.sites.map(([site, n]) => (
            <li key={site} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <span className="truncate text-[13px] text-dim">{site}</span>
              <span className="tnum font-mono text-[11.5px] text-mute">{n}</span>
              <span className="col-span-2 h-px bg-line">
                <span className="block h-px bg-dim" style={{ width: `${(n / maxSite) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
