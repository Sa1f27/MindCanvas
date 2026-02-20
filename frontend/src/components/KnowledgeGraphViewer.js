// Enhanced KnowledgeGraphViewer — brain/neuron clustering, glow nodes, fcose layout
import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use(fcose);

// ─── Styled Components ────────────────────────────────────────────────────────

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

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const LoadingPill = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 15, 30, 0.85);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 20px;
  padding: 6px 14px;
  backdrop-filter: blur(12px);
  pointer-events: none;
  z-index: 10;
`;

const Spinner = styled.div`
  width: 12px;
  height: 12px;
  border: 2px solid rgba(99, 102, 241, 0.3);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const LoadingText = styled.span`
  font-size: 11px;
  color: rgba(226, 232, 240, 0.7);
  letter-spacing: 0.5px;
`;

const CountBadge = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(15, 15, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 11px;
  color: rgba(226, 232, 240, 0.55);
  backdrop-filter: blur(8px);
  pointer-events: none;
  z-index: 5;
`;

// ─── Colour Palette ───────────────────────────────────────────────────────────

const CLUSTER_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
  '#f97316', '#a855f7', '#22c55e', '#3b82f6',
];

// ─── Cluster key from node ────────────────────────────────────────────────────
// Use cluster if set, otherwise fall back to type/content_type, then first topic

function clusterKey(node) {
  if (node.cluster) return node.cluster;
  if (node.type && node.type !== 'Unknown') return node.type;
  if (node.content_type && node.content_type !== 'Unknown') return node.content_type;
  const topics = node.topics || node.key_topics || [];
  if (topics.length > 0) return topics[0];
  return 'General';
}

// ─── Phyllotaxis cluster-centre placement ─────────────────────────────────────

function computeClusterCenters(clusterKeys, W, H) {
  const n = clusterKeys.length;
  if (n === 0) return {};
  if (n === 1) return { [clusterKeys[0]]: { x: W / 2, y: H / 2 } };

  const cx = W / 2;
  const cy = H / 2;
  const goldenAngle = 137.508 * (Math.PI / 180);
  const maxR = Math.min(W, H) * 0.32;
  const centers = {};

  clusterKeys.forEach((key, i) => {
    const r = maxR * Math.sqrt((i + 0.5) / n);
    const theta = i * goldenAngle;
    centers[key] = {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
    };
  });

  return centers;
}

// ─── Cytoscape stylesheet ─────────────────────────────────────────────────────

function buildStylesheet() {
  return [
    {
      selector: 'node',
      style: {
        shape: 'ellipse',
        width: 'data(size)',
        height: 'data(size)',
        'background-color': 'data(color)',
        'background-opacity': 0.92,
        label: 'data(label)',
        'font-size': '10px',
        'font-family': "'Inter', 'Segoe UI', sans-serif",
        'font-weight': '500',
        color: '#e2e8f0',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 4,
        'text-outline-width': 2,
        'text-outline-color': 'rgba(10,10,20,0.8)',
        'text-max-width': '90px',
        'text-wrap': 'ellipsis',
        'shadow-blur': 18,
        'shadow-color': 'data(color)',
        'shadow-opacity': 0.55,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'border-width': 1.5,
        'border-color': 'data(color)',
        'border-opacity': 0.7,
        'transition-property': 'background-color, border-color, shadow-blur, width, height',
        'transition-duration': '0.2s',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 2.5,
        'border-color': '#ffffff',
        'shadow-blur': 28,
        'shadow-opacity': 0.85,
        'z-index': 20,
      },
    },
    {
      selector: 'node.dimmed',
      style: {
        opacity: 0.18,
        'shadow-opacity': 0.05,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 'data(weight)',
        'line-color': 'data(color)',
        'line-opacity': 0.3,
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        'transition-property': 'line-opacity, width',
        'transition-duration': '0.2s',
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-opacity': 0.85,
        width: 2.5,
        'z-index': 10,
      },
    },
    {
      selector: 'edge.dimmed',
      style: {
        'line-opacity': 0.03,
      },
    },
  ];
}

// ─── Main Component ───────────────────────────────────────────────────────────
// Accepts: data (from App.js store — { nodes, links })
//          selectedNode, onNodeSelect, onBackgroundClick, layout

const KnowledgeGraphViewer = ({ data, selectedNode, onNodeSelect, onBackgroundClick }) => {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const timeoutsRef = useRef([]);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  const track = useCallback((id) => {
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Normalise — store uses `links`, handle both
    const rawNodes = data?.nodes || [];
    const rawEdges = data?.edges || data?.links || [];

    if (rawNodes.length === 0) {
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
      setNodeCount(0);
      setEdgeCount(0);
      setIsLayoutRunning(false);
      return;
    }

    // ── 1. Assign cluster colour index ──────────────────────────────────────
    const clusterSet = new Set(rawNodes.map(n => clusterKey(n)));
    const clusterKeys = Array.from(clusterSet);
    const clusterColorMap = {};
    clusterKeys.forEach((k, i) => {
      clusterColorMap[k] = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
    });

    // ── 2. Phyllotaxis centres ───────────────────────────────────────────────
    const W = containerRef.current.offsetWidth || 800;
    const H = containerRef.current.offsetHeight || 600;
    const centers = computeClusterCenters(clusterKeys, W, H);

    // ── 3. Track cluster membership ──────────────────────────────────────────
    const clusterMeta = {};
    clusterKeys.forEach(k => { clusterMeta[k] = []; });

    // ── 4. Build elements with pre-positions ─────────────────────────────────
    const elements = [];

    rawNodes.forEach(node => {
      const id = String(node.id);
      const cluster = clusterKey(node);
      const center = centers[cluster] || { x: W / 2, y: H / 2 };
      clusterMeta[cluster].push(id);

      const clusterSize = rawNodes.filter(n => clusterKey(n) === cluster).length;
      const idx = clusterMeta[cluster].length - 1;
      const innerR = Math.min(70, Math.max(22, clusterSize * 8));
      const angle = (idx / Math.max(clusterSize, 1)) * 2 * Math.PI;
      const jx = (Math.random() - 0.5) * 12;
      const jy = (Math.random() - 0.5) * 12;

      const quality = node.quality_score || node.quality || 5;
      const nodeSize = Math.min(54, Math.max(18, 18 + quality * 2));

      elements.push({
        group: 'nodes',
        data: {
          id,
          label: node.title || node.name || id,
          color: clusterColorMap[cluster],
          cluster,
          size: nodeSize,
          rawData: node,
        },
        position: {
          x: center.x + innerR * Math.cos(angle) + jx,
          y: center.y + innerR * Math.sin(angle) + jy,
        },
      });
    });

    // Build a quick id→cluster lookup
    const nodeClusterMap = {};
    elements.forEach(el => {
      if (el.group === 'nodes') nodeClusterMap[el.data.id] = el.data.cluster;
    });

    rawEdges.forEach((edge, i) => {
      const src = String(edge.source || edge.from);
      const tgt = String(edge.target || edge.to);
      if (!src || !tgt || src === tgt) return;
      const sameCluster = nodeClusterMap[src] === nodeClusterMap[tgt];
      const srcCluster = nodeClusterMap[src] || 'default';

      elements.push({
        group: 'edges',
        data: {
          id: `e${i}-${src}-${tgt}`,
          source: src,
          target: tgt,
          weight: sameCluster ? 1.2 : 0.5,
          color: sameCluster
            ? clusterColorMap[srcCluster]
            : 'rgba(148,163,184,0.35)',
          sameCluster,
        },
      });
    });

    setNodeCount(rawNodes.length);
    setEdgeCount(rawEdges.length);

    // ── 5. fixedNodeConstraint — anchor first node of each cluster ───────────
    const fixedNodeConstraint = clusterKeys
      .filter(k => clusterMeta[k].length > 0)
      .map(k => ({ nodeId: clusterMeta[k][0], position: centers[k] }));

    // ── 6. Destroy old instance ──────────────────────────────────────────────
    clearAllTimeouts();
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

    setIsLayoutRunning(true);

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: buildStylesheet(),
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;

    // ── 7. layoutstop attached BEFORE layout runs ─────────────────────────────
    cy.one('layoutstop', () => {
      clearAllTimeouts();
      setIsLayoutRunning(false);
      try { cy.fit(undefined, 60); } catch (_) {}
    });

    // Safety fallback
    track(setTimeout(() => {
      setIsLayoutRunning(false);
      try { cy.fit(undefined, 60); } catch (_) {}
    }, 8000));

    // ── 8. fcose layout ───────────────────────────────────────────────────────
    if (rawNodes.length > 1) {
      cy.layout({
        name: 'fcose',
        quality: 'proof',
        animate: false,
        randomize: false,
        fixedNodeConstraint,
        idealEdgeLength: edge => edge.data('sameCluster') ? 45 : 200,
        edgeElasticity: edge => edge.data('sameCluster') ? 0.08 : 0.45,
        nodeRepulsion: () => 6500,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 30,
        tilingPaddingHorizontal: 30,
        gravity: 0.2,
        gravityRange: 3.8,
      }).run();
    } else {
      cy.fit(undefined, 60);
      setIsLayoutRunning(false);
      clearAllTimeouts();
    }

    // ── 9. Interactions ───────────────────────────────────────────────────────
    cy.on('mouseover', 'node', e => {
      const node = e.target;
      const connectedEdges = node.connectedEdges();
      const neighbors = connectedEdges.connectedNodes();
      cy.elements().not(node).not(connectedEdges).not(neighbors).addClass('dimmed');
      connectedEdges.addClass('highlighted');
    });

    cy.on('mouseout', 'node', () => {
      cy.elements().removeClass('dimmed highlighted');
    });

    cy.on('tap', 'node', e => {
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
  }, [data]);

  // Highlight externally selected node
  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass('dimmed highlighted');
    if (selectedNode?.id) {
      const node = cyRef.current.getElementById(String(selectedNode.id));
      if (node.length) {
        const edges = node.connectedEdges();
        edges.addClass('highlighted');
        cyRef.current.elements().not(node).not(edges).not(edges.connectedNodes()).addClass('dimmed');
        cyRef.current.animate({ center: { eles: node }, zoom: 1.5 }, { duration: 350 });
      }
    }
  }, [selectedNode]);

  return (
    <Wrapper>
      <CyContainer ref={containerRef} />
      {nodeCount > 0 && (
        <CountBadge>{nodeCount} nodes · {edgeCount} edges</CountBadge>
      )}
      {isLayoutRunning && (
        <LoadingPill>
          <Spinner />
          <LoadingText>Arranging neural clusters…</LoadingText>
        </LoadingPill>
      )}
    </Wrapper>
  );
};

export default KnowledgeGraphViewer;
