import { useMemo, useState } from 'react';
import { useGraph } from '../../store/graph';
import type { GraphLink, GraphNode } from '../../lib/types';

/** A node as the force simulation sees it. The simulation writes x, y, z and velocities onto it. */
export type SimNode = GraphNode & { color: string; val: number; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number };
export type SimLink = Omit<GraphLink, 'source' | 'target'> & { source: string | SimNode; target: string | SimNode; color: string };

export const endpointId = (end: string | SimNode) => (typeof end === 'string' ? end : end.id);

/**
 * The visible part of the graph, ready for the renderer.
 * Node objects are cached by id, so hiding and showing clusters keeps every node where it was
 * instead of re-running the whole layout. Links are rebuilt each time with plain ids, because
 * the simulation replaces their ends with node objects.
 */
export function useSimGraph() {
  const nodes = useGraph(s => s.nodes);
  const links = useGraph(s => s.links);
  const hidden = useGraph(s => s.hiddenClusters);
  const clusterColor = useGraph(s => s.clusterColor);
  // One cache per mounted map. useState gives a stable object without reading a ref during render.
  const [cache] = useState(() => new Map<string, SimNode>());

  return useMemo(() => {
    const visible: SimNode[] = [];
    for (const n of nodes) {
      if (hidden.has(n.cluster)) continue;
      let sim = cache.get(n.id);
      if (!sim) {
        sim = { ...n, color: '#e6e9ef', val: 1 };
        cache.set(n.id, sim);
      }
      sim.color = clusterColor[n.cluster] ?? '#e6e9ef';
      // Higher-quality pages are slightly larger. Kept in a narrow range so nothing dominates.
      sim.val = 1 + Math.max(0, Math.min(10, n.quality_score)) / 5;
      visible.push(sim);
    }
    const ids = new Set(visible.map(n => n.id));
    const simLinks: SimLink[] = links
      .filter(l => ids.has(String(l.source)) && ids.has(String(l.target)))
      .map(l => ({
        ...l,
        source: String(l.source),
        target: String(l.target),
        color: (l.same_cluster && clusterColor[cache.get(String(l.source))?.cluster ?? '']) || '#8b93a3',
      }));
    return { nodes: visible, links: simLinks };
  }, [nodes, links, hidden, clusterColor, cache]);
}

/** Evenly spread points on a sphere (3D) or a circle (2D): one anchor per cluster. */
export function clusterAnchors(names: string[], radius: number, dims: 2 | 3) {
  const anchors = new Map<string, { x: number; y: number; z: number }>();
  const n = names.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  names.forEach((name, i) => {
    if (dims === 2 || n === 1) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      anchors.set(name, { x: Math.cos(a) * radius * (n === 1 ? 0 : 1), y: Math.sin(a) * radius * (n === 1 ? 0 : 1), z: 0 });
      return;
    }
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    anchors.set(name, { x: Math.cos(theta) * r * radius, y: y * radius, z: Math.sin(theta) * r * radius });
  });
  return anchors;
}

/** A d3 force that pulls every node toward its cluster's anchor, so clusters read as separate groups. */
export function clusterForce(anchors: Map<string, { x: number; y: number; z: number }>, strength = 0.08) {
  let simNodes: SimNode[] = [];
  const force = (alpha: number) => {
    const k = strength * alpha;
    for (const node of simNodes) {
      const a = anchors.get(node.cluster);
      if (!a || node.x === undefined || node.y === undefined) continue;
      node.vx = (node.vx ?? 0) + (a.x - node.x) * k;
      node.vy = (node.vy ?? 0) + (a.y - node.y) * k;
      if (node.z !== undefined) node.vz = (node.vz ?? 0) + (a.z - node.z) * k;
    }
  };
  force.initialize = (nodes: SimNode[]) => {
    simNodes = nodes;
  };
  return force;
}

/** Nodes the camera should frame: the selected page first (a click is the most recent intent), else the highlight. */
export function focusSet(nodes: SimNode[], highlight: ReadonlySet<string>, selectedId: string | null): SimNode[] {
  if (selectedId) return nodes.filter(n => n.id === selectedId);
  if (highlight.size) return nodes.filter(n => highlight.has(n.id));
  return [];
}

/** Nodes drawn at full strength: the highlight plus the selection. Null means nothing is lit, so everything is. */
export function litSet(highlight: ReadonlySet<string>, selectedId: string | null): ReadonlySet<string> | null {
  if (!highlight.size && !selectedId) return null;
  if (!selectedId) return highlight;
  return new Set([...highlight, selectedId]);
}

export function tooltipHtml(n: GraphNode, color: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  return `<div style="font:13px 'Instrument Sans',sans-serif;background:rgba(12,11,25,.92);border:1px solid #34315a;border-radius:10px;padding:8px 10px;max-width:280px;color:#e8eaee">
    <div style="display:flex;gap:6px;align-items:center;color:#a0a6b2;font-size:12px"><span style="width:7px;height:7px;border-radius:9px;background:${color}"></span>${esc(n.cluster)}</div>
    <div style="margin-top:4px;line-height:1.35">${esc(n.title)}</div></div>`;
}
