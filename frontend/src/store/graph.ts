import { create } from 'zustand';
import { api } from '../lib/api';
import { colorForIndex } from '../lib/palette';
import type { Cluster, GraphLink, GraphNode } from '../lib/types';

type Status = 'idle' | 'loading' | 'ready' | 'error';
export type ViewMode = '3d' | '2d';

interface GraphState {
  status: Status;
  error: string | null;
  nodes: GraphNode[];
  links: GraphLink[];
  /** Clusters sorted by size, each with its colour. */
  clusters: Cluster[];
  clusterColor: Record<string, string>;
  nodeById: Map<string, GraphNode>;

  view: ViewMode;
  hiddenClusters: ReadonlySet<string>;
  selectedId: string | null;
  hoveredId: string | null;
  /** Nodes the last chat answer drew on. The map lights them up. */
  highlightIds: ReadonlySet<string>;
  /** Bumped to ask the map to fly the camera to the highlighted or selected nodes. */
  focusTick: number;

  load: (force?: boolean) => Promise<void>;
  setView: (view: ViewMode) => void;
  toggleCluster: (name: string) => void;
  showOnlyCluster: (name: string | null) => void;
  select: (id: string | null, focus?: boolean) => void;
  hover: (id: string | null) => void;
  /** Light these nodes. `focus` also flies the camera to them; search lights without moving. */
  highlight: (ids: string[], focus?: boolean) => void;
}

function indexClusters(nodes: GraphNode[]) {
  const sizes = new Map<string, number>();
  for (const n of nodes) sizes.set(n.cluster, (sizes.get(n.cluster) ?? 0) + 1);
  const clusters: Cluster[] = [...sizes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, size], i) => ({ name, size, color: colorForIndex(i) }));
  const clusterColor = Object.fromEntries(clusters.map(c => [c.name, c.color]));
  return { clusters, clusterColor };
}

export const useGraph = create<GraphState>((set, get) => ({
  status: 'idle',
  error: null,
  nodes: [],
  links: [],
  clusters: [],
  clusterColor: {},
  nodeById: new Map(),

  view: '3d',
  hiddenClusters: new Set(),
  selectedId: null,
  hoveredId: null,
  highlightIds: new Set(),
  focusTick: 0,

  load: async (force = false) => {
    set({ status: 'loading', error: null });
    try {
      const data = await api.graph(force);
      const nodes = data.nodes ?? [];
      const ids = new Set(nodes.map(n => n.id));
      // Drop links to nodes that are not in the export, so the force layout never sees a dangling id.
      const links = (data.links ?? []).filter(l => ids.has(String(l.source)) && ids.has(String(l.target)));
      set({
        status: 'ready',
        nodes,
        links,
        nodeById: new Map(nodes.map(n => [n.id, n])),
        ...indexClusters(nodes),
      });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Could not load the map.' });
    }
  },

  setView: view => set({ view }),

  toggleCluster: name =>
    set(s => {
      const next = new Set(s.hiddenClusters);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { hiddenClusters: next };
    }),

  showOnlyCluster: name =>
    set(s => ({
      hiddenClusters: name === null ? new Set() : new Set(s.clusters.map(c => c.name).filter(c => c !== name)),
      focusTick: s.focusTick + 1,
    })),

  select: (id, focus = true) => set(s => ({ selectedId: id, focusTick: focus && id ? s.focusTick + 1 : s.focusTick })),

  hover: id => {
    if (get().hoveredId !== id) set({ hoveredId: id });
  },

  highlight: (ids, focus = true) =>
    set(s => ({ highlightIds: new Set(ids), focusTick: focus && ids.length ? s.focusTick + 1 : s.focusTick })),
}));
