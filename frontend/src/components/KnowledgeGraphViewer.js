// Enhanced KnowledgeGraphViewer with semantic clustering and intelligent layout
import React, { useEffect, useRef, useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre'; // 1. Import dagre

// Register layouts
cytoscape.use(fcose);
cytoscape.use(dagre); // 2. Register dagre

const GraphContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: ${props => props.theme.borderRadius.lg};
  overflow: hidden;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
`;

const GraphCanvas = styled.div`
  width: 100%;
  height: 100%;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
`;

const LoadingSpinner = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  color: white;
  text-align: center;
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LegendContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(15px);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 0.85rem;
  max-width: 280px;
  z-index: 100;
  
  .legend-title {
    font-weight: 600;
    margin-bottom: 12px;
    color: #667eea;
    font-size: 0.9rem;
  }
  
  .legend-section {
    margin-bottom: 12px;
    
    .section-title {
      font-weight: 500;
      margin-bottom: 6px;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.7);
    }
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 0.75rem;
    
    .color-box {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
  }
  
  .edge-legend {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 8px;
    margin-top: 8px;
    
    .edge-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 0.75rem;
      
      .edge-line {
        width: 24px;
        height: 2px;
        background: currentColor;
      }
    }
  }
`;

// Semantic color mapping based on content analysis
const getSemanticColor = (node) => {
  const title = (node.name || node.title || '').toLowerCase();
  const topics = (node.topics || node.key_topics || []).join(' ').toLowerCase();
  const type = (node.type || node.content_type || '').toLowerCase();
  const allText = `${title} ${topics} ${type}`;
  
  // Machine Learning / AI
  if (/\b(ai|machine learning|neural|deep learning|ml|tensorflow|pytorch|model|algorithm|data science)\b/.test(allText)) {
    return '#ff4757'; // Bright red
  }
  
  // Programming Languages - JavaScript
  if (/\b(javascript|js|node\.?js|react|vue|angular|typescript|npm)\b/.test(allText)) {
    return '#f7df1e'; // JavaScript yellow
  }
  
  // Programming Languages - Python
  if (/\b(python|django|flask|numpy|pandas|jupyter|pip)\b/.test(allText)) {
    return '#3776ab'; // Python blue
  }
  
  // Web Development
  if (/\b(web dev|html|css|frontend|backend|api|http|rest)\b/.test(allText)) {
    return '#00d2d3'; // Cyan
  }
  
  // Database
  if (/\b(database|sql|mongodb|postgres|mysql|nosql|query)\b/.test(allText)) {
    return '#00a085'; // Teal
  }
  
  // DevOps / Cloud
  if (/\b(devops|docker|kubernetes|aws|cloud|deployment|ci\/cd)\b/.test(allText)) {
    return '#2ed573'; // Green
  }
  
  // Design / UI/UX
  if (/\b(design|ui|ux|figma|photoshop|graphics|typography)\b/.test(allText)) {
    return '#ff6348'; // Orange-red
  }
  
  // Mobile Development
  if (/\b(mobile|android|ios|react native|flutter|swift|kotlin)\b/.test(allText)) {
    return '#ff6b9d'; // Pink
  }
  
  // Data Science / Analytics
  if (/\b(data science|analytics|visualization|statistics|big data)\b/.test(allText)) {
    return '#a55eea'; // Light purple
  }
  
  // Security
  if (/\b(security|cybersecurity|encryption|authentication)\b/.test(allText)) {
    return '#ff3838'; // Red
  }
  
  // Education / Tutorial
  if (/\b(tutorial|course|learning|education|beginner|guide)\b/.test(allText)) {
    return '#3742fa'; // Blue
  }
  
  // Content type fallback
  const typeColors = {
    'Tutorial': '#4ecdc4',
    'Documentation': '#9b59b6',
    'Article': '#f39c12',
    'Blog': '#e67e22',
    'Research': '#e74c3c',
    'News': '#c0392b'
  };
  
  return typeColors[node.content_type || node.type] || '#667eea';
};

const KnowledgeGraphViewer = ({
  data,
  selectedNode,
  onNodeSelect,
  onBackgroundClick,
  layout = 'dagre', // <--- SWITCHED DEFAULT LAYOUT TO DAGRE
  className,
  ...props
}) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clusterInfo, setClusterInfo] = useState({});

  // Process graph data with enhanced clustering awareness
  const graphData = useMemo(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
        return { nodes: [], edges: [] };
    }

    const clusters = {};
    
    const nodes = data.nodes.map((node, index) => {
      const nodeId = node.id?.toString() || `node-${index}`;
      const label = node.title || node.name || `Node ${index + 1}`;
      const quality = node.quality || node.quality_score || 5;
      const color = getSemanticColor(node);
      
      const topics = node.topics || node.key_topics || [];
      const primaryTopic = topics[0] || 'General';
      
      if (!clusters[primaryTopic]) {
        clusters[primaryTopic] = [];
      }
      clusters[primaryTopic].push(nodeId);
      
      const nodeSize = Math.max(20, Math.min(40, quality * 3 + 14));
      
      return {
        data: {
          id: nodeId,
          label: label.length > 18 ? label.substring(0, 18) + '...' : label, 
          color: color,
          size: nodeSize,
          quality: quality,
          topics: topics,
          cluster: primaryTopic,
          originalData: node
        }
      };
    });

    setClusterInfo(clusters);

    const edges = [];
    if (data.links && Array.isArray(data.links)) {
      data.links.forEach((link, index) => {
        const source = link.source?.toString();
        const target = link.target?.toString();
        
        if (source && target && source !== target) {
          const sourceExists = nodes.some(n => n.data.id === source);
          const targetExists = nodes.some(n => n.data.id === target);
          
          if (sourceExists && targetExists) {
            const edgeType = link.type || 'default';
            const similarity = link.similarity || 0.5;
            
            let edgeColor = 'rgba(255, 255, 255, 0.2)';
            let edgeWidth = 1;
            
            if (edgeType === 'topic' || similarity > 0.7) {
              edgeColor = 'rgba(102, 126, 234, 0.7)';
              edgeWidth = 2.5;
            } else if (edgeType === 'semantic' || similarity > 0.5) {
              edgeColor = 'rgba(255, 255, 255, 0.45)';
              edgeWidth = 1.8;
            }
            
            edges.push({
              data: {
                id: `edge-${index}`,
                source: source,
                target: target,
                weight: link.weight || 1,
                similarity: similarity,
                type: edgeType,
                color: edgeColor,
                width: edgeWidth
              }
            });
          }
        }
      });
    }

    return { nodes, edges };
  }, [data]);
  
  // Initialize Cytoscape with enhanced layout
  useEffect(() => {
    if (!containerRef.current || graphData.nodes.length === 0) {
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);

    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (error) {
        console.warn('Error destroying cytoscape:', error);
      }
      cyRef.current = null;
    }

    const initTimeout = setTimeout(() => {
      if (!containerRef.current) {
        setIsLoading(false);
        return;
      }

      try {
        const cy = cytoscape({
          container: containerRef.current,
          elements: [...graphData.nodes, ...graphData.edges],
          
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'width': 'data(size)',
                'height': 'data(size)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '10px', 
                'font-weight': '600',
                'color': '#ffffff',
                'text-outline-width': 3, 
                'text-outline-color': '#000000',
                'border-width': 2,
                'border-color': 'rgba(255,255,255,0.5)',
                'border-opacity': 0.7,
                'transition-property': 'border-width, border-color',
                'transition-duration': '0.2s'
              }
            },
            {
              selector: 'node:hover',
              style: {
                'border-width': 4,
                'border-color': '#ffffff',
                'border-opacity': 1,
                'cursor': 'pointer'
              }
            },
            {
              selector: 'node:selected',
              style: {
                'border-width': 5, 
                'border-color': '#667eea',
                'border-opacity': 1,
                'z-index': 999
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 'data(width)',
                'line-color': 'data(color)',
                'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle',
                'target-arrow-size': '10px', 
                'curve-style': 'bezier',
                'opacity': 0.8
              }
            },
            {
              selector: 'edge:selected',
              style: {
                'line-color': '#667eea',
                'target-arrow-color': '#667eea',
                'width': 3.5,
                'opacity': 1
              }
            }
          ],
          
          layout: layout === 'dagre' ? {
            name: 'dagre',
            rankDir: 'TB', // Top-to-Bottom flow
            spacingFactor: 1.5,
            nodeSep: 60,
            edgeSep: 10,
            rankSep: 80,
            padding: 50,
            fit: true,
            animate: false,
            stop: function() {
              console.log('Dagre layout completed');
            }
          } : {
            name: 'fcose',
            quality: 'proof',
            animate: false,
            fit: true,
            padding: 50,
            
            nodeSeparation: 80, 
            idealEdgeLength: 70, 
            edgeElasticity: 0.2,
            nestingFactor: 1.5,
            gravity: 1.2, 
            numIter: 3000, 
            
            tile: true,
            tilingPaddingVertical: 40,
            tilingPaddingHorizontal: 40,
            
            randomize: true, 
            initialEnergyOnIncremental: 0.5,
            
            stop: function() {
              console.log('FCoSE layout completed');
            }
          },
          
          minZoom: 0.3,
          maxZoom: 3,
          wheelSensitivity: 0.2
        });

        cyRef.current = cy;

        // Event listeners
        cy.on('tap', 'node', (event) => {
          const node = event.target;
          const nodeData = node.data('originalData');
          if (onNodeSelect && nodeData) {
            onNodeSelect(nodeData);
          }
        });

        cy.on('tap', (event) => {
          if (event.target === cy && onBackgroundClick) {
            onBackgroundClick();
          }
        });

        // Single layout completion
        cy.one('layoutstop', () => {
          setIsLoading(false);
          cy.stop();
          
          setTimeout(() => {
            try {
              cy.fit(cy.nodes(), 40);
            } catch (error) {
              console.warn('Error fitting:', error);
            }
          }, 100);
        });

        // Emergency stop
        setTimeout(() => {
          if (cyRef.current) {
            setIsLoading(false);
            cyRef.current.stop();
          }
        }, 5000);

      } catch (error) {
        console.error('Error creating Cytoscape:', error);
        setIsLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(initTimeout);
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch (error) {
          console.warn('Error in cleanup:', error);
        }
        cyRef.current = null;
      }
    };
  }, [graphData.nodes.length, graphData.edges.length, layout]);

  // Empty state
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <GraphContainer className={className} {...props}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'rgba(255, 255, 255, 0.6)',
          textAlign: 'center',
          padding: '40px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>🕸️</div>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
            No Graph Data
          </div>
          <div style={{ lineHeight: 1.5, maxWidth: '400px' }}>
            Start by importing your browsing history to build your knowledge graph
          </div>
        </div>
      </GraphContainer>
    );
  }

  // Get unique clusters for legend
  const uniqueClusters = Object.keys(clusterInfo).slice(0, 8);
  const clusterColors = uniqueClusters.map(cluster => {
    const nodeInCluster = graphData.nodes.find(n => n.data.cluster === cluster);
    return {
      name: cluster,
      color: nodeInCluster?.data.color || '#667eea',
      count: clusterInfo[cluster]?.length || 0
    };
  });

  return (
    <GraphContainer className={className} {...props}>
      <GraphCanvas ref={containerRef} />
      
      <LegendContainer>
        <div className="legend-title">🧠 Knowledge Clusters</div>
        
        <div className="legend-section">
          <div className="section-title">Semantic Topics</div>
          {clusterColors.map((cluster, idx) => (
            <div key={idx} className="legend-item">
              <div className="color-box" style={{ background: cluster.color }} />
              <span>{cluster.name} ({cluster.count})</span>
            </div>
          ))}
        </div>
        
        <div className="edge-legend">
          <div className="section-title">Connection Strength</div>
          <div className="edge-item">
            <div className="edge-line" style={{ 
              background: 'rgba(102, 126, 234, 0.8)',
              height: '3px'
            }} />
            <span>Strong (Shared Topics)</span>
          </div>
          <div className="edge-item">
            <div className="edge-line" style={{ 
              background: 'rgba(255, 255, 255, 0.5)',
              height: '2px'
            }} />
            <span>Medium (Semantic)</span>
          </div>
          <div className="edge-item">
            <div className="edge-line" style={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              height: '1px'
            }} />
            <span>Weak (Same Type)</span>
          </div>
        </div>
      </LegendContainer>
      
      <AnimatePresence>
        {isLoading && (
          <LoadingSpinner
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="spinner" />
            <div>Building semantic graph...</div>
          </LoadingSpinner>
        )}
      </AnimatePresence>
    </GraphContainer>
  );
};

export default KnowledgeGraphViewer;