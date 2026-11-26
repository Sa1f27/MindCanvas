import type { GraphLink, GraphNode } from './types';

/**
 * Graph analysis behind the Stats panel. Pure functions over the exported graph, so they are
 * easy to test and cheap to memoise. Links are treated as undirected and unweighted.
 */

export interface Adjacency {
  ids: string[];
  index: Map<string, number>;
  neighbours: number[][];
}

export function buildAdjacency(nodes: GraphNode[], links: GraphLink[]): Adjacency {
  const ids = nodes.map(n => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const sets = ids.map(() => new Set<number>());
  for (const l of links) {
    const a = index.get(String(l.source));
    const b = index.get(String(l.target));
    if (a === undefined || b === undefined || a === b) continue;
    sets[a]!.add(b);
    sets[b]!.add(a);
  }
  return { ids, index, neighbours: sets.map(s => [...s]) };
}

/** Number of distinct pages each page links to. */
export function degrees(adj: Adjacency): Map<string, number> {
  return new Map(adj.ids.map((id, i) => [id, adj.neighbours[i]!.length]));
}

/**
 * Betweenness centrality with Brandes' algorithm, O(V·E) for unweighted graphs: how often a page
 * lies on the shortest paths between other pages. High scores are the pages that join areas together.
 * Scores are normalised to [0, 1] for an undirected graph.
 */
export function betweenness(adj: Adjacency): Map<string, number> {
  const n = adj.ids.length;
  const score = new Float64Array(n);
  const sigma = new Float64Array(n);
  const dist = new Int32Array(n);
  const delta = new Float64Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);
  const stack: number[] = [];
  const queue = new Int32Array(n);

  for (let s = 0; s < n; s++) {
    stack.length = 0;
    for (let i = 0; i < n; i++) {
      preds[i]!.length = 0;
      sigma[i] = 0;
      dist[i] = -1;
      delta[i] = 0;
    }
    sigma[s] = 1;
    dist[s] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;

    // Breadth-first search counting shortest paths.
    while (head < tail) {
      const v = queue[head++]!;
      stack.push(v);
      for (const w of adj.neighbours[v]!) {
        if (dist[w]! < 0) {
          dist[w] = dist[v]! + 1;
          queue[tail++] = w;
        }
        if (dist[w] === dist[v]! + 1) {
          sigma[w]! += sigma[v]!;
          preds[w]!.push(v);
        }
      }
    }

    // Accumulate dependencies, farthest nodes first.
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of preds[w]!) delta[v]! += (sigma[v]! / sigma[w]!) * (1 + delta[w]!);
      if (w !== s) score[w]! += delta[w]!;
    }
  }

  // Each undirected path was counted from both ends; normalise by the number of pairs.
  const norm = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0;
  return new Map(adj.ids.map((id, i) => [id, score[i]! * norm]));
}

export interface AreaLink {
  a: string;
  b: string;
  count: number;
}

/** How many links join each pair of clusters, strongest first. */
export function areaLinks(nodes: GraphNode[], links: GraphLink[]): AreaLink[] {
  const clusterOf = new Map(nodes.map(n => [n.id, n.cluster]));
  const counts = new Map<string, AreaLink>();
  for (const l of links) {
    const ca = clusterOf.get(String(l.source));
    const cb = clusterOf.get(String(l.target));
    if (!ca || !cb || ca === cb) continue;
    const [a, b] = ca < cb ? [ca, cb] : [cb, ca];
    const key = `${a}\u0000${b}`;
    const entry = counts.get(key) ?? { a, b, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((x, y) => y.count - x.count || x.a.localeCompare(y.a));
}

/** The k highest-scoring ids, ties broken by id for a stable order. */
export function topK(scores: Map<string, number>, k: number, min = 0): [string, number][] {
  return [...scores.entries()]
    .filter(([, v]) => v > min)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, k);
}
