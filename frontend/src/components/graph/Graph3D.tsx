import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-3d';
import { Vector2 } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import SpriteText from 'three-spritetext';
import { useGraph } from '../../store/graph';
import { dim } from '../../lib/palette';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { clusterAnchors, clusterForce, endpointId, focusSet, litSet, tooltipHtml, type SimLink, type SimNode } from './model';

type Methods = ForceGraphMethods<NodeObject<SimNode>, LinkObject<SimNode, SimLink>>;

interface Props {
  width: number;
  height: number;
  graph: { nodes: SimNode[]; links: SimLink[] };
}

/** The 3D map: clusters as fluorescent groups of neurons, links as faint fibres, a bloom pass for the glow. */
export default function Graph3D({ width, height, graph }: Props) {
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

  // Glow: one bloom pass, added once. Bright cluster colours on black read as fluorescence.
  useEffect(() => {
    const api = fg.current;
    if (!api) return;
    const bloom = new UnrealBloomPass(new Vector2(width, height), 1.15, 0.6, 0.08);
    api.postProcessingComposer().addPass(bloom);
    return () => {
      api.postProcessingComposer().removePass(bloom);
      bloom.dispose();
    };
    // The pass resizes with the renderer; it only needs adding once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cluster names float above their groups, like regions labelled on a brain atlas.
  const labels = useRef(new Map<string, SpriteText>());
  useEffect(() => {
    const api = fg.current;
    if (!api) return;
    const scene = api.scene();
    const visible = new Set(graph.nodes.map(n => n.cluster));
    for (const c of clusters) {
      if (!visible.has(c.name)) continue;
      // Constant size on screen (no perspective), like labels on a map: near ones never balloon, far ones stay legible.
      const sprite = new SpriteText(c.name, 0.0125, c.color);
      sprite.fontFace = 'IBM Plex Sans';
      sprite.fontWeight = '500';
      sprite.material.depthWrite = false;
      sprite.material.sizeAttenuation = false;
      sprite.material.opacity = 0.9;
      scene.add(sprite);
      labels.current.set(c.name, sprite);
    }
    const current = labels.current;
    return () => {
      for (const sprite of current.values()) {
        scene.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
      current.clear();
    };
  }, [clusters, graph]);

  const placeLabels = useCallback(() => {
    const sums = new Map<string, { x: number; y: number; z: number; maxY: number; n: number }>();
    for (const n of graph.nodes) {
      if (n.x === undefined || n.y === undefined) continue;
      const s = sums.get(n.cluster) ?? { x: 0, y: 0, z: 0, maxY: -Infinity, n: 0 };
      s.x += n.x;
      s.y += n.y;
      s.z += n.z ?? 0;
      s.maxY = Math.max(s.maxY, n.y);
      s.n += 1;
      sums.set(n.cluster, s);
    }
    for (const [name, sprite] of labels.current) {
      const s = sums.get(name);
      if (!s) continue;
      // Centred over the group, just above its highest node.
      sprite.position.set(s.x / s.n, s.maxY + 14, s.z / s.n);
    }
  }, [graph]);

  // Layout forces: pull each cluster toward its own anchor, keep link lengths tied to similarity.
  useEffect(() => {
    const api = fg.current;
    if (!api) return;
    const anchors = clusterAnchors(clusters.map(c => c.name), 240, 3);
    api.d3Force('cluster', clusterForce(anchors, 0.12));
    api.d3Force('charge')?.strength?.(-45);
    api.d3Force('link')?.distance?.((l: SimLink) => 22 + (1 - (l.similarity ?? 0.5)) * 70);
    api.d3ReheatSimulation();
  }, [clusters]);

  // The camera flies to whatever the user is asking about: an answer's sources or a selected node.
  useEffect(() => {
    const api = fg.current;
    if (!api || focusTick === 0) return;
    const targets = focusSet(graph.nodes, highlightIds, selectedId).filter(n => n.x !== undefined);
    const ms = reduced ? 0 : 1100;
    if (!targets.length) {
      api.zoomToFit(ms, 60);
      return;
    }
    const centre = (ns: SimNode[]) => {
      const sum = ns.reduce((a, n) => ({ x: a.x + n.x!, y: a.y + n.y!, z: a.z + (n.z ?? 0) }), { x: 0, y: 0, z: 0 });
      return { x: sum.x / ns.length, y: sum.y / ns.length, z: sum.z / ns.length };
    };
    const radius = (ns: SimNode[], c: { x: number; y: number; z: number }) =>
      Math.max(0, ...ns.map(n => Math.hypot(n.x! - c.x, n.y! - c.y, (n.z ?? 0) - c.z)));

    const c = centre(targets);
    // One page gets a close look. Several stay at close to overview distance and the camera turns toward them:
    // flying into the middle of a 3D cloud would put dimmed pages between the camera and what is lit.
    const placed = graph.nodes.filter(n => n.x !== undefined);
    const mapRadius = radius(placed, centre(placed));
    const distance = targets.length === 1 ? 120 : Math.max(radius(targets, c) * 3, mapRadius * 1.7);
    // Keep the current viewing direction, so the flight feels continuous.
    const cam = api.camera().position;
    const dir = { x: cam.x - c.x, y: cam.y - c.y, z: cam.z - c.z };
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    api.cameraPosition({ x: c.x + (dir.x / len) * distance, y: c.y + (dir.y / len) * distance, z: c.z + (dir.z / len) * distance }, c, ms);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const lit = useMemo(() => litSet(highlightIds, selectedId), [highlightIds, selectedId]);

  // While something is lit, labels of clusters with nothing lit fade back with their nodes.
  useEffect(() => {
    const litClusters = lit ? new Set(graph.nodes.filter(n => lit.has(n.id)).map(n => n.cluster)) : null;
    for (const [name, sprite] of labels.current) {
      // three.js scene objects are external mutable state; syncing them from React state is what this effect is for.
      // eslint-disable-next-line react-hooks/immutability
      sprite.material.opacity = !litClusters || litClusters.has(name) ? 0.9 : 0.18;
    }
  }, [lit, graph, clusters]);

  const nodeColor = useCallback(
    (n: SimNode) => (lit && !lit.has(n.id) && n.id !== hoveredId ? dim(n.color, 0.16) : n.color),
    [lit, hoveredId],
  );
  const nodeVal = useCallback((n: SimNode) => (lit?.has(n.id) || n.id === hoveredId ? n.val * 2.4 : n.val), [lit, hoveredId]);

  const touchesLit = useCallback(
    (l: SimLink) => Boolean(lit && (lit.has(endpointId(l.source)) || lit.has(endpointId(l.target)))),
    [lit],
  );
  const linkColor = useCallback((l: SimLink) => (lit && !touchesLit(l) ? '#15171c' : l.color), [lit, touchesLit]);
  const linkWidth = useCallback((l: SimLink) => (touchesLit(l) ? 0.7 : 0), [touchesLit]);
  const particles = useCallback((l: SimLink) => (touchesLit(l) && !reduced ? 3 : 0), [touchesLit, reduced]);

  return (
    <ForceGraph3D<SimNode, SimLink>
      ref={fg}
      width={width}
      height={height}
      graphData={graph}
      backgroundColor="#000000"
      showNavInfo={false}
      nodeRelSize={3.2}
      nodeResolution={18}
      nodeOpacity={0.95}
      nodeVal={nodeVal}
      nodeColor={nodeColor}
      nodeLabel={n => tooltipHtml(n, n.color)}
      linkColor={linkColor}
      linkOpacity={0.28}
      linkWidth={linkWidth}
      linkDirectionalParticles={particles}
      linkDirectionalParticleWidth={1.4}
      linkDirectionalParticleSpeed={0.006}
      linkDirectionalParticleColor={() => '#ffffff'}
      cooldownTicks={160}
      onEngineTick={placeLabels}
      onEngineStop={() => {
        placeLabels();
        if (fitted.current) return;
        fitted.current = true;
        fg.current?.zoomToFit(reduced ? 0 : 800, 80);
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
