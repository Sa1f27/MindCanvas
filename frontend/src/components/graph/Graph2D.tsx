import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d';
import { useGraph } from '../../store/graph';
import { withAlpha } from '../../lib/palette';
import { cleanTitle } from '../../lib/format';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { clusterAnchors, clusterForce, endpointId, focusSet, litSet, tooltipHtml, type SimLink, type SimNode } from './model';

type Methods = ForceGraphMethods<NodeObject<SimNode>, LinkObject<SimNode, SimLink>>;

interface Props {
  width: number;
  height: number;
  graph: { nodes: SimNode[]; links: SimLink[] };
}

// Titles appear once zoomed in far enough to read them without overlapping; lit nodes always show theirs.
const LABEL_ZOOM = 3;

/** The flat map: easier to read titles in. Same data, same highlight rules as the 3D view. */
export default function Graph2D({ width, height, graph }: Props) {
  const fg = useRef<Methods | undefined>(undefined);
  const fitted = useRef(false);
  const reduced = useReducedMotion();

  const clusters = useGraph(s => s.clusters);
  const selectedId = useGraph(s => s.selectedId);
  const hoveredId = useGraph(s => s.hoveredId);
  const highlightIds = useGraph(s => s.highlightIds);
  const focusTick = useGraph(s => s.focusTick);
  const select = useGraph(s => s.select);
  const hover = useGraph(s => s.hover);

  useEffect(() => {
    const api = fg.current;
    if (!api) return;
    api.d3Force('cluster', clusterForce(clusterAnchors(clusters.map(c => c.name), 220, 2), 0.08));
    api.d3Force('charge')?.strength?.(-40);
    api.d3Force('link')?.distance?.((l: SimLink) => 20 + (1 - (l.similarity ?? 0.5)) * 60);
    api.d3ReheatSimulation();
  }, [clusters]);

  useEffect(() => {
    const api = fg.current;
    if (!api || focusTick === 0) return;
    const targets = focusSet(graph.nodes, highlightIds, selectedId);
    const ms = reduced ? 0 : 900;
    if (!targets.length) {
      api.zoomToFit(ms, 60);
      return;
    }
    const ids = new Set(targets.map(n => n.id));
    api.zoomToFit(ms, 120, n => ids.has(n.id));
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const lit = useMemo(() => litSet(highlightIds, selectedId), [highlightIds, selectedId]);

  const drawNode = useCallback(
    (n: SimNode, ctx: CanvasRenderingContext2D, scale: number) => {
      if (n.x === undefined || n.y === undefined) return;
      const on = !lit || lit.has(n.id) || n.id === hoveredId;
      const strong = Boolean(lit?.has(n.id)) || n.id === hoveredId;
      const r = (strong ? 4.5 : 3) * Math.sqrt(n.val);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? n.color : withAlpha(n.color, 0.14);
      if (on) {
        ctx.shadowColor = n.color;
        ctx.shadowBlur = strong ? 18 : 8;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      if (strong || scale >= LABEL_ZOOM) {
        const fontSize = 11 / scale;
        ctx.font = `${fontSize}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = on ? 'rgba(232,234,238,0.92)' : 'rgba(232,234,238,0.25)';
        const clean = cleanTitle(n.title);
        const title = clean.length > 34 ? `${clean.slice(0, 32)}…` : clean;
        ctx.fillText(title, n.x, n.y + r + 2 / scale);
      }
    },
    [lit, hoveredId],
  );

  const touchesLit = useCallback(
    (l: SimLink) => Boolean(lit && (lit.has(endpointId(l.source)) || lit.has(endpointId(l.target)))),
    [lit],
  );

  return (
    <ForceGraph2D<SimNode, SimLink>
      ref={fg}
      width={width}
      height={height}
      graphData={graph}
      backgroundColor="#000000"
      nodeRelSize={3}
      nodeVal={n => n.val}
      nodeLabel={n => tooltipHtml(n, n.color)}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={(n, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }}
      linkColor={l => (lit && !touchesLit(l) ? 'rgba(255,255,255,0.03)' : withAlpha(l.color.startsWith('#') ? l.color : '#8b93a3', 0.35))}
      linkWidth={l => (touchesLit(l) ? 1.2 : 0.5)}
      linkDirectionalParticles={l => (touchesLit(l) && !reduced ? 2 : 0)}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleColor={() => '#ffffff'}
      cooldownTicks={160}
      onEngineStop={() => {
        if (fitted.current) return;
        fitted.current = true;
        fg.current?.zoomToFit(reduced ? 0 : 700, 50);
      }}
      onNodeClick={n => select(n.id)}
      onNodeHover={n => {
        hover(n?.id ?? null);
        document.body.style.cursor = n ? 'pointer' : '';
      }}
      onBackgroundClick={() => select(null, false)}
    />
  );
}
