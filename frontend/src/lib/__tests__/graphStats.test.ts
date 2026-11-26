import { describe, expect, it } from 'vitest';
import { areaLinks, betweenness, buildAdjacency, degrees, topK } from '../graphStats';
import type { GraphLink, GraphNode } from '../types';

const node = (id: string, cluster = 'A'): GraphNode => ({
  id, title: id, url: '', summary: '', content_type: '', quality_score: 5, key_topics: [], cluster, cluster_id: 0,
});
const link = (source: string, target: string): GraphLink => ({ id: `${source}-${target}`, source, target, similarity: 1, same_cluster: true });

describe('degrees', () => {
  it('counts distinct neighbours and ignores duplicates, self-links and unknown ids', () => {
    const adj = buildAdjacency([node('a'), node('b'), node('c')], [link('a', 'b'), link('b', 'a'), link('a', 'a'), link('a', 'zzz'), link('b', 'c')]);
    expect(Object.fromEntries(degrees(adj))).toEqual({ a: 1, b: 2, c: 1 });
  });
});

describe('betweenness', () => {
  it('scores the middle of a path highest', () => {
    // a - b - c - d - e: b, c and d lie on shortest paths; c lies on the most.
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const adj = buildAdjacency(ids.map(i => node(i)), [link('a', 'b'), link('b', 'c'), link('c', 'd'), link('d', 'e')]);
    const s = betweenness(adj);
    expect(s.get('a')).toBe(0);
    expect(s.get('e')).toBe(0);
    expect(s.get('c')!).toBeGreaterThan(s.get('b')!);
    // Unnormalised, c is on 4 of the 6 pairs that need an intermediate; normalised over (n-1)(n-2) = 12 ordered pairs, 8/12.
    expect(s.get('c')).toBeCloseTo(8 / 12);
  });

  it('gives the centre of a star a score of 1', () => {
    const leaves = ['b', 'c', 'd', 'e'];
    const adj = buildAdjacency(['hub', ...leaves].map(i => node(i)), leaves.map(l => link('hub', l)));
    expect(betweenness(adj).get('hub')).toBeCloseTo(1);
  });

  it('finds the bridge between two dense groups', () => {
    const left = [link('a1', 'a2'), link('a2', 'a3'), link('a1', 'a3')];
    const right = [link('b1', 'b2'), link('b2', 'b3'), link('b1', 'b3')];
    const ids = ['a1', 'a2', 'a3', 'x', 'b1', 'b2', 'b3'];
    const adj = buildAdjacency(ids.map(i => node(i)), [...left, ...right, link('a1', 'x'), link('x', 'b1')]);
    expect(topK(betweenness(adj), 1)[0]?.[0]).toBe('x');
  });
});

describe('areaLinks', () => {
  it('counts links between different clusters only, as unordered pairs', () => {
    const nodes = [node('p1', 'Python'), node('p2', 'Python'), node('d1', 'Data'), node('w1', 'Web')];
    const links = [link('p1', 'd1'), link('d1', 'p2'), link('p1', 'p2'), link('w1', 'p1')];
    expect(areaLinks(nodes, links)).toEqual([
      { a: 'Data', b: 'Python', count: 2 },
      { a: 'Python', b: 'Web', count: 1 },
    ]);
  });
});
