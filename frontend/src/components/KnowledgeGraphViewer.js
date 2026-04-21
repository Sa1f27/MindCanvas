// KnowledgeGraphViewer — fixed layout, no overlap, dual view modes
import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use(fcose);

// ─── Styled ───────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
`;

const CyContainer = styled.div`
  width: 100%;
  height: 100%;
`;

const spin = keyframes`to { transform: rotate(360deg); }`;

const LoadingPill = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(11, 11, 24, 0.88);
  border: 1px solid rgba(99, 102, 241, 0.28);
  border-radius: 20px;
  padding: 7px 16px;
  backdrop-filter: blur(14px);
  pointer-events: none;
  z-index: 10;
`;

const Spinner = styled.div`
  width: 12px;
  height: 12px;
  border: 2px solid rgba(99, 102, 241, 0.25);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;

const LoadingText = styled.span`
  font-size: 11px;
  color: rgba(226, 232, 240, 0.6);
  letter-spacing: 0.4px;
  font-family: 'Inter', sans-serif;
`;

const CountBadge = styled.div`
  position: absolute;
  bottom: 14px;
  left: 14px;
  background: rgba(11, 11, 24, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 11px;
  color: rgba(226, 232, 240, 0.45);
  backdrop-filter: blur(10px);
  pointer-events: none;
  z-index: 5;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.2px;
`;

const LayoutBadge = styled.div`
  position: absolute;
  top: 14px;
  right: 14px;
  background: rgba(11, 11, 24, 0.78);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 10px;
  color: rgba(165, 180, 252, 0.6);
  backdrop-filter: blur(10px);
  pointer-events: none;
  z-index: 5;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  font-weight: 600;
`;

// ─── Palette ──────────────────────────────────────────────────────────────────

const CLUSTER_COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
  '#22c55e', '#3b82f6', '#a855f7', '#ef4444',
];

// ─── Node SVG ─────────────────────────────────────────────────────────────────

function makeNodeSvg(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <defs>
      <radialGradient id="body" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#05050e"/>
        <stop offset="38%"  stop-color="${color}" stop-opacity="0.08"/>
        <stop offset="62%"  stop-color="${color}" stop-opacity="0.42"/>
        <stop offset="82%"  stop-color="${color}" stop-opacity="0.82"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="1"/>
      </radialGradient>
      <radialGradient id="spec" cx="36%" cy="30%" r="32%">
        <stop offset="0%"   stop-color="rgba(255,255,255,0.16)"/>
        <stop offset="55%"  stop-color="rgba(255,255,255,0.04)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="58" fill="url(#body)"/>
    <circle cx="60" cy="60" r="58" fill="url(#spec)"/>
    <circle cx="60" cy="60" r="56" fill="none" stroke="${color}" stroke-width="1.2" stroke-opacity="0.55"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clusterKey(node) {
  if (node.cluster && node.cluster !== 'Unknown') return node.cluster;
  if (node.type && node.type !== 'Unknown') return node.type;
  if (node.content_type && node.content_type !== 'Unknown') return node.content_type;
  const topics = node.topics || node.key_topics || [];
  if (topics.length > 0) return topics[0];
  return 'General';
}

// Layout radius consistent with rendered node size (12px avg) + gap
function safeClusterRadius(nodeCount, avgNodeSize = 12, gap = 10) {
  if (nodeCount <= 1) return 0;
  return Math.max(40, (nodeCount * (avgNodeSize + gap)) / (2 * Math.PI));
}

// Fit all content nodes and enforce a comfortable minimum zoom atomically
function smartFit(cy) {
  if (!cy) return;
  try {
    const content = cy.nodes().not('[?isLabel]');
    if (content.length === 0) return;
    cy.fit(content, 55);
    const MIN_ZOOM = 0.78;
    const z = cy.zoom();
    if (z < MIN_ZOOM) {
      const bb = content.boundingBox();
      cy.viewport({
        zoom: MIN_ZOOM,
        pan: {
          x: cy.width()  / 2 - ((bb.x1 + bb.x2) / 2) * MIN_ZOOM,
          y: cy.height() / 2 - ((bb.y1 + bb.y2) / 2) * MIN_ZOOM,
        },
      });
    }
  } catch (_) {}
}

// ─── Layout: Cluster View ─────────────────────────────────────────────────────
// Organic neural blobs arranged via phyllotaxis.
// Canvas is scaled so clusters fit comfortably at ~80% zoom.

function buildClusterPositions(clusterKeys, clusterNodeMap) {
  // Smaller virtual canvas — nodes stay large relative to viewport
  const VW = 1200, VH = 900;
  const cx = VW / 2, cy = VH / 2;

  // Compute per-cluster radius
  const clusterRadii = {};
  clusterKeys.forEach(k => {
    clusterRadii[k] = safeClusterRadius(clusterNodeMap[k].length);
  });
  const maxR = Math.max(...Object.values(clusterRadii), 40);

  // Spread: allow slight visual overlap between clusters so they stay close
  // (maxR+60)*sqrt(n) ensures breathing room without excessive distance
  const n = clusterKeys.length;
  const spread = Math.max((maxR + 60) * Math.sqrt(n), maxR * 2);
  const goldenAngle = 137.508 * (Math.PI / 180);

  const centers = {};
  clusterKeys.forEach((k, i) => {
    if (n === 1) {
      centers[k] = { x: cx, y: cy };
    } else {
      const r = spread * Math.sqrt((i + 0.5) / n);
      const theta = i * goldenAngle;
      centers[k] = { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
    }
  });

  // Place nodes within each cluster using organic shapes
  const positions = {};
  const jit = (s) => (Math.random() - 0.5) * 2 * s;

  clusterKeys.forEach((k, clusterIdx) => {
    const nodes = clusterNodeMap[k];
    const size = nodes.length;
    const R = clusterRadii[k];
    const { x: ccx, y: ccy } = centers[k];
    const rot = (clusterIdx * 53 + 17) * (Math.PI / 180);

    let pts = [];

    if (size === 1) {
      pts.push({ x: ccx, y: ccy });
    } else if (size === 2) {
      const d = R * 0.7;
      pts.push({ x: ccx - d * Math.cos(rot), y: ccy - d * Math.sin(rot) });
      pts.push({ x: ccx + d * Math.cos(rot), y: ccy + d * Math.sin(rot) });
    } else if (size <= 6) {
      // Simple polygon
      for (let i = 0; i < size; i++) {
        const ang = rot + (i / size) * 2 * Math.PI;
        pts.push({ x: ccx + R * Math.cos(ang) + jit(6), y: ccy + R * Math.sin(ang) + jit(6) });
      }
    } else if (size <= 12) {
      // Neuron: hub + dendrite ring
      pts.push({ x: ccx + jit(4), y: ccy + jit(4) }); // soma
      const outer = size - 1;
      for (let i = 0; i < outer; i++) {
        const ang = rot + (i / outer) * 2 * Math.PI;
        const r = R * (0.9 + Math.random() * 0.2);
        pts.push({ x: ccx + r * Math.cos(ang) + jit(8), y: ccy + r * Math.sin(ang) + jit(8) });
      }
    } else if (size <= 20) {
      // Double ring
      const innerN = Math.round(size * 0.35);
      const outerN = size - innerN;
      const innerR = R * 0.42;
      for (let i = 0; i < innerN; i++) {
        const ang = rot + (i / innerN) * 2 * Math.PI;
        pts.push({ x: ccx + innerR * Math.cos(ang) + jit(6), y: ccy + innerR * Math.sin(ang) + jit(6) });
      }
      for (let i = 0; i < outerN; i++) {
        const ang = rot + (Math.PI / outerN) + (i / outerN) * 2 * Math.PI;
        const r = R * (0.9 + Math.random() * 0.18);
        pts.push({ x: ccx + r * Math.cos(ang) + jit(10), y: ccy + r * Math.sin(ang) + jit(10) });
      }
    } else {
      // Phyllotaxis spiral for very large clusters
      const phi = 137.508 * (Math.PI / 180);
      const scale = R / Math.sqrt(size) * 1.3;
      for (let i = 0; i < size; i++) {
        const r = scale * Math.sqrt(i + 1);
        const ang = i * phi + rot;
        pts.push({ x: ccx + r * Math.cos(ang) + jit(5), y: ccy + r * Math.sin(ang) + jit(5) });
      }
    }

    nodes.forEach((id, i) => {
      positions[id] = pts[i] || { x: ccx, y: ccy };
    });

    // Store center for label
    centers[k]._label = { x: ccx, y: ccy };
  });

  return { positions, centers };
}

// ─── Layout: Topic Map (Hierarchy) ───────────────────────────────────────────
// Clusters arranged in rows by size (largest = top).
// Nodes within each cluster laid out in a clean horizontal band,
// sorted by quality score so best content is always leftmost.
// Shows "how much" of each topic you've covered at a glance.

function buildHierarchyPositions(clusterKeys, clusterNodeMap, nodeDataMap) {
  const VW = 1200, VH = 900;

  // Sort clusters by size descending
  const sorted = [...clusterKeys].sort(
    (a, b) => clusterNodeMap[b].length - clusterNodeMap[a].length
  );

  // Rows of up to 3 clusters
  const MAX_PER_ROW = 3;
  const rows = [];
  for (let i = 0; i < sorted.length; i += MAX_PER_ROW) {
    rows.push(sorted.slice(i, i + MAX_PER_ROW));
  }

  const totalRows = rows.length;
  const rowH = (VH - 200) / totalRows;
  const positions = {};
  const centers = {};

  rows.forEach((row, rowIdx) => {
    const y = 120 + rowH * rowIdx + rowH * 0.5;
    const colW = VW / (row.length + 1);

    row.forEach((k, colIdx) => {
      const ccx = colW * (colIdx + 1);
      centers[k] = { x: ccx, y };

      // Sort nodes in this cluster by quality score (best left)
      const nodes = [...clusterNodeMap[k]].sort((a, b) => {
        const qa = nodeDataMap[a]?.quality_score || nodeDataMap[a]?.quality || 5;
        const qb = nodeDataMap[b]?.quality_score || nodeDataMap[b]?.quality || 5;
        return qb - qa;
      });

      const nodeSpacing = Math.min(70, Math.max(40, (colW * 0.85) / Math.max(nodes.length, 1)));
      const totalW = nodeSpacing * (nodes.length - 1);

      nodes.forEach((id, i) => {
        // Slight vertical stagger so it looks organic, not robotic
        const stagger = (i % 2 === 0 ? -1 : 1) * 14;
        positions[id] = {
          x: ccx - totalW / 2 + nodeSpacing * i,
          y: y + stagger,
        };
      });
    });
  });

  return { positions, centers };
}

// ─── Cytoscape Stylesheet ─────────────────────────────────────────────────────

function buildStylesheet() {
  return [
    {
      selector: 'node',
      style: {
        shape: 'ellipse',
        width: 'data(size)',
        height: 'data(size)',
        'background-color': 'data(color)',
        'background-opacity': 0,
        'background-image': 'data(bgImage)',
        'background-fit': 'cover',
        'background-image-opacity': 1,
        label: 'data(label)',
        'font-size': '9px',
        'font-family': "'Inter', 'Segoe UI', sans-serif",
        'font-weight': '600',
        color: '#e2e8f0',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 4,
        'text-outline-width': 2,
        'text-outline-color': 'rgba(6,6,16,0.92)',
        'text-max-width': '72px',
        'text-wrap': 'ellipsis',
        'shadow-blur': 32,
        'shadow-color': 'data(color)',
        'shadow-opacity': 0.6,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'border-width': 0,
        'transition-property': 'shadow-blur, shadow-opacity, width, height',
        'transition-duration': '0.18s',
      },
    },
    {
      // Cluster label phantom nodes
      selector: 'node[?isLabel]',
      style: {
        'background-opacity': 0,
        'background-image': 'none',
        'border-width': 0,
        'shadow-blur': 0,
        'shadow-opacity': 0,
        width: 1,
        height: 1,
        label: 'data(label)',
        'font-size': '13px',
        'font-family': "'Inter', 'Segoe UI', sans-serif",
        'font-weight': '700',
        color: 'data(color)',
        'text-opacity': 0.45,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-outline-width': 0,
        'text-max-width': '140px',
        'text-wrap': 'ellipsis',
        events: 'no',
        'z-index': 0,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 2,
        'border-color': 'data(color)',
        'border-opacity': 1,
        'shadow-blur': 55,
        'shadow-opacity': 1,
        'z-index': 20,
      },
    },
    {
      selector: 'node.highlighted',
      style: { 'shadow-blur': 48, 'shadow-opacity': 0.9, 'z-index': 15 },
    },
    {
      selector: 'node.dimmed',
      style: { opacity: 0.12, 'shadow-opacity': 0.02 },
    },
    {
      selector: 'edge',
      style: {
        width: 'data(weight)',
        'line-color': 'data(color)',
        'line-opacity': 0.38,
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        'transition-property': 'line-opacity, width',
        'transition-duration': '0.18s',
      },
    },
    {
      selector: 'edge.highlighted',
      style: { 'line-opacity': 0.9, width: 2.6, 'z-index': 10 },
    },
    {
      selector: 'edge.dimmed',
      style: { 'line-opacity': 0.02 },
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

const KnowledgeGraphViewer = ({ data, selectedNode, onNodeSelect, onBackgroundClick, layout = 'fcose', recenterKey = 0 }) => {
  const cyRef        = useRef(null);
  const containerRef = useRef(null);
  const timeoutsRef  = useRef([]);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [nodeCount,  setNodeCount]  = useState(0);
  const [edgeCount,  setEdgeCount]  = useState(0);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  const track = useCallback((id) => { timeoutsRef.current.push(id); return id; }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const rawNodes = data?.nodes || [];
    const rawEdges = data?.edges || data?.links || [];

    if (rawNodes.length === 0) {
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
      setNodeCount(0); setEdgeCount(0); setIsLayoutRunning(false);
      return;
    }

    // ── Cluster metadata ─────────────────────────────────────────────────────
    const clusterSet = new Set(rawNodes.map(n => clusterKey(n)));
    const clusterKeys = Array.from(clusterSet);
    const clusterColorMap = {};
    const svgCache = {};
    clusterKeys.forEach((k, i) => {
      const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
      clusterColorMap[k] = color;
      svgCache[k] = makeNodeSvg(color);
    });

    // ── Group nodes by cluster ────────────────────────────────────────────────
    const clusterNodeMap = {};
    clusterKeys.forEach(k => { clusterNodeMap[k] = []; });
    rawNodes.forEach(n => clusterNodeMap[clusterKey(n)].push(String(n.id)));

    // ── Node data map (for quality-sort in hierarchy) ─────────────────────────
    const nodeDataMap = {};
    rawNodes.forEach(n => { nodeDataMap[String(n.id)] = n; });

    // ── Degree map ────────────────────────────────────────────────────────────
    const degreeMap = {};
    rawNodes.forEach(n => { degreeMap[String(n.id)] = 0; });
    rawEdges.forEach(e => {
      const s = String(e.source || e.from);
      const t = String(e.target || e.to);
      if (s in degreeMap) degreeMap[s]++;
      if (t in degreeMap) degreeMap[t]++;
    });
    const maxDeg = Math.max(...Object.values(degreeMap), 1);

    // ── Compute positions based on layout mode ────────────────────────────────
    const { positions, centers } = layout === 'dagre'
      ? buildHierarchyPositions(clusterKeys, clusterNodeMap, nodeDataMap)
      : buildClusterPositions(clusterKeys, clusterNodeMap);

    // ── Build elements ────────────────────────────────────────────────────────
    const elements = [];

    // Cluster label phantoms
    clusterKeys.forEach(k => {
      const c = centers[k];
      if (!c) return;
      // In cluster view put label above center; in hierarchy put it above the row
      const labelY = layout === 'dagre' ? c.y - 80 : c.y - safeClusterRadius(clusterNodeMap[k].length) - 28;
      elements.push({
        group: 'nodes',
        data: {
          id: `__label__${k}`,
          label: k,
          isLabel: true,
          color: clusterColorMap[k],
          size: 1,
          bgImage: 'none',
        },
        position: { x: c.x, y: labelY },
      });
    });

    // Actual content nodes
    rawNodes.forEach(n => {
      const id      = String(n.id);
      const cluster = clusterKey(n);
      const pos     = positions[id] || { x: 0, y: 0 };
      const quality  = n.quality_score || n.quality || 5;
      const degBonus = (degreeMap[id] / maxDeg) * 5;
      const nodeSize = Math.round(Math.min(34, Math.max(16, 16 + quality * 1.4 + degBonus)));

      elements.push({
        group: 'nodes',
        data: {
          id,
          label:   n.title || n.name || id,
          color:   clusterColorMap[cluster] || '#6366f1',
          bgImage: svgCache[cluster],
          cluster,
          size: nodeSize,
          rawData: n,
        },
        position: pos,
      });
    });

    // Edges — skip any that connect to label phantoms
    const nodeIdSet = new Set(rawNodes.map(n => String(n.id)));
    const nodeClusterMap = {};
    rawNodes.forEach(n => { nodeClusterMap[String(n.id)] = clusterKey(n); });

    rawEdges.forEach((edge, i) => {
      const src = String(edge.source || edge.from);
      const tgt = String(edge.target || edge.to);
      if (!src || !tgt || src === tgt) return;
      if (!nodeIdSet.has(src) || !nodeIdSet.has(tgt)) return;
      const sameCluster = nodeClusterMap[src] === nodeClusterMap[tgt];
      const srcCluster  = nodeClusterMap[src] || 'default';

      elements.push({
        group: 'edges',
        data: {
          id: `e${i}-${src}-${tgt}`,
          source: src,
          target: tgt,
          weight:  sameCluster ? 1.4 : 0.5,
          color:   sameCluster
            ? clusterColorMap[srcCluster]
            : 'rgba(148,163,184,0.25)',
          sameCluster,
        },
      });
    });

    setNodeCount(rawNodes.length);
    setEdgeCount(rawEdges.length);

    // ── Init Cytoscape ────────────────────────────────────────────────────────
    clearAllTimeouts();
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
    setIsLayoutRunning(true);

    // Fit all content nodes, then enforce a comfortable minimum zoom
    // so clusters don't appear as tiny dots on first load
    const smartFit = (cy) => {
      try {
        const content = cy.nodes().not('[?isLabel]');
        if (content.length === 0) return;
        cy.fit(content, 60);
        if (cy.zoom() < 0.55) {
          cy.zoom(0.55);
          cy.center(content);
        }
      } catch (_) {}
    };

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: buildStylesheet(),
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.15,
      maxZoom: 3.5,
      wheelSensitivity: 0.06,
    });

    cyRef.current = cy;

    cy.one('layoutstop', () => {
      clearAllTimeouts();
      setIsLayoutRunning(false);
      smartFit(cy);
    });

    track(setTimeout(() => {
      setIsLayoutRunning(false);
      smartFit(cy);
    }, 8000));

    cy.layout({ name: 'preset', fit: false, padding: 60 }).run();
    smartFit(cy);

    // ── Interactions ──────────────────────────────────────────────────────────
    cy.on('mouseover', 'node', e => {
      const node = e.target;
      if (node.data('isLabel')) return;
      const connEdges = node.connectedEdges();
      const neighbors = connEdges.connectedNodes();
      cy.elements()
        .not(node).not(connEdges).not(neighbors)
        .filter(el => !el.data('isLabel'))
        .addClass('dimmed');
      connEdges.addClass('highlighted');
      node.addClass('highlighted');
    });

    cy.on('mouseout', 'node', () => {
      cy.elements().removeClass('dimmed highlighted');
    });

    cy.on('tap', 'node', e => {
      if (e.target.data('isLabel')) return;
      if (onNodeSelect) onNodeSelect(e.target.data('rawData'));
    });

    cy.on('tap', e => {
      if (e.target === cy) {
        cy.elements().removeClass('dimmed highlighted');
        if (onBackgroundClick) onBackgroundClick();
      }
    });

    return () => {
      clearAllTimeouts();
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layout]);

  // Highlight externally selected node
  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass('dimmed highlighted');
    if (selectedNode?.id) {
      const node = cyRef.current.getElementById(String(selectedNode.id));
      if (node.length) {
        const edges = node.connectedEdges();
        edges.addClass('highlighted');
        cyRef.current.elements()
          .not(node).not(edges).not(edges.connectedNodes())
          .filter(el => !el.data('isLabel'))
          .addClass('dimmed');
        cyRef.current.animate({ center: { eles: node }, zoom: 1.8 }, { duration: 340 });
      }
    }
  }, [selectedNode]);

  const layoutLabel = layout === 'dagre' ? 'Topic Map' : 'Cluster View';

  return (
    <Wrapper>
      <CyContainer ref={containerRef} />
      {nodeCount > 0 && (
        <CountBadge>{nodeCount} nodes · {edgeCount} edges</CountBadge>
      )}
      {nodeCount > 0 && (
        <LayoutBadge>{layoutLabel}</LayoutBadge>
      )}
      {isLayoutRunning && (
        <LoadingPill>
          <Spinner />
          <LoadingText>
            {layout === 'dagre' ? 'Building topic map…' : 'Arranging clusters…'}
          </LoadingText>
        </LoadingPill>
      )}
    </Wrapper>
  );
};

export default KnowledgeGraphViewer;
