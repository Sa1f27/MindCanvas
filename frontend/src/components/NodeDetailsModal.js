// src/components/NodeDetailsModal.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink, Network, Search, Copy, Check,
  X, Hash, Clock, Layers, Star, Link2
} from 'lucide-react';
import { useKnowledgeStore } from '../store/knowledgeStore';

/* ── Backdrop ──────────────────────────────────────────────────── */
const Backdrop = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

/* ── Modal shell ───────────────────────────────────────────────── */
const Modal = styled(motion.div)`
  width: 100%;
  max-width: 980px;
  max-height: 92vh;
  background: linear-gradient(160deg, rgba(12,12,26,0.98) 0%, rgba(14,14,28,0.98) 100%);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 18px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const AccentBar = styled.div`
  height: 2px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4);
  flex-shrink: 0;
`;

/* ── Header ────────────────────────────────────────────────────── */
const Header = styled.div`
  padding: 22px 24px 18px;
  background: rgba(99, 102, 241, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
`;

const TitleBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const NodeTitle = styled.h2`
  margin: 0 0 10px;
  font-size: 1.35rem;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.3;
  letter-spacing: -0.3px;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  background: ${p => p.$bg || 'rgba(99,102,241,0.18)'};
  color: ${p => p.$color || '#a5b4fc'};
  border: 1px solid ${p => p.$border || 'rgba(99,102,241,0.25)'};
`;

const CloseBtn = styled(motion.button)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: rgba(226, 232, 240, 0.6);
  width: 36px;
  height: 36px;
  border-radius: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.18s, color 0.18s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }
`;

/* ── Body ──────────────────────────────────────────────────────── */
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 22px;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 16px;

  scrollbar-width: thin;
  scrollbar-color: rgba(99,102,241,0.3) transparent;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
`;

const MainCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`;

const SideCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`;

/* ── Info card ─────────────────────────────────────────────────── */
const Card = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 13px;
  padding: 16px;
  overflow: hidden;
`;

const CardLabel = styled.div`
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(165, 180, 252, 0.5);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    display: block;
    width: 12px;
    height: 2px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 1px;
  }
`;

const DescText = styled.p`
  margin: 0;
  color: rgba(226, 232, 240, 0.65);
  line-height: 1.65;
  font-size: 0.9rem;
`;

const ContentQuote = styled.div`
  margin-top: 12px;
  padding: 12px 14px;
  border-left: 2px solid #6366f1;
  border-radius: 0 8px 8px 0;
  background: rgba(99, 102, 241, 0.05);
  color: rgba(226, 232, 240, 0.55);
  font-size: 0.85rem;
  line-height: 1.55;
  max-height: 180px;
  overflow-y: auto;
`;

/* ── URL strip ─────────────────────────────────────────────────── */
const UrlStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  margin-top: 10px;
`;

const UrlText = styled.div`
  flex: 1;
  font-size: 0.75rem;
  color: rgba(165,180,252,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
`;

const IconBtn = styled(motion.button)`
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  color: rgba(226,232,240,0.55);
  width: 28px;
  height: 28px;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(99,102,241,0.15);
    color: #a5b4fc;
    border-color: rgba(99,102,241,0.25);
  }
`;

/* ── Topics ────────────────────────────────────────────────────── */
const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TopicChip = styled(motion.span)`
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.22);
  color: #a5b4fc;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  gap: 5px;

  &:hover {
    background: rgba(99, 102, 241, 0.22);
    border-color: rgba(99, 102, 241, 0.4);
  }
`;

/* ── Action buttons ────────────────────────────────────────────── */
const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ActBtn = styled(motion.button)`
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: box-shadow 0.18s;

  &.primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    color: #fff;
    box-shadow: 0 2px 12px rgba(99,102,241,0.3);
    &:hover { box-shadow: 0 4px 20px rgba(99,102,241,0.45); }
  }

  &.ghost {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(226,232,240,0.7);
    &:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; border-color: rgba(99,102,241,0.25); }
  }

  &.danger {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    color: rgba(252,165,165,0.8);
    &:hover { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
  }
`;

/* ── Stats grid ────────────────────────────────────────────────── */
const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const StatCard = styled.div`
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 10px;
  padding: 12px;
  text-align: center;

  .val {
    font-size: 1.45rem;
    font-weight: 800;
    background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
    margin-bottom: 4px;
  }

  .lbl {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: rgba(226, 232, 240, 0.38);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    white-space: nowrap;
    overflow: hidden;
  }
`;

/* ── Related nodes ─────────────────────────────────────────────── */
const RelatedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(99,102,241,0.3) transparent;
`;

const RelatedItem = styled(motion.div)`
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-left: 2px solid transparent;
  border-radius: 9px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(99,102,241,0.08);
    border-left-color: #6366f1;
  }

  .rn-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rn-meta {
    font-size: 0.73rem;
    color: rgba(226,232,240,0.4);
  }
`;

/* ── Spinner / Empty ───────────────────────────────────────────── */
const Spinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .ring {
    width: 28px;
    height: 28px;
    border: 2.5px solid rgba(99,102,241,0.15);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Empty = styled.div`
  text-align: center;
  padding: 20px 16px;
  color: rgba(226,232,240,0.35);
  font-size: 0.82rem;
`;

/* ── Quality bar ───────────────────────────────────────────────── */
const QualityBar = styled.div`
  margin-top: 8px;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;

  .fill {
    height: 100%;
    border-radius: 2px;
    background: ${p => p.$color};
    width: ${p => p.$pct}%;
    transition: width 0.5s ease;
  }
`;

/* ════════════════════════════════════════════════════════════════ */
const NodeDetailsModal = ({
  node,
  onClose,
  onFocusNode,
  onSearch,
  onSelectRelatedNode,
  graphData,
}) => {
  const [relatedNodes, setRelatedNodes]     = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [copied, setCopied]                 = useState(false);

  const { findRelatedContent, getNodeNeighbors } = useKnowledgeStore();

  useEffect(() => {
    if (!node) return;
    const load = async () => {
      setLoadingRelated(true);
      try {
        const neighbors  = getNodeNeighbors(node.id);
        let apiRelated   = [];
        if (node.id) apiRelated = await findRelatedContent(node.id, 6);

        const all    = [
          ...neighbors.map(n  => ({ ...n,  source: 'graph' })),
          ...apiRelated.map(n => ({ ...n,  source: 'api'   })),
        ];
        const unique = all.filter((n, i, arr) => i === arr.findIndex(x => x.id === n.id));
        setRelatedNodes(unique.slice(0, 10));
      } catch (e) {
        console.error('Failed to load related content:', e);
      } finally {
        setLoadingRelated(false);
      }
    };
    load();
  }, [node, getNodeNeighbors, findRelatedContent]);

  if (!node) return null;

  /* ── Helpers ─────────────────────────────── */
  const typeColors = {
    Tutorial:      { bg: 'rgba(6,182,212,0.14)',   color: '#67e8f9', border: 'rgba(6,182,212,0.25)'   },
    Documentation: { bg: 'rgba(139,92,246,0.14)',  color: '#c4b5fd', border: 'rgba(139,92,246,0.25)'  },
    Article:       { bg: 'rgba(245,158,11,0.14)',  color: '#fcd34d', border: 'rgba(245,158,11,0.25)'  },
    Blog:          { bg: 'rgba(249,115,22,0.14)',  color: '#fdba74', border: 'rgba(249,115,22,0.25)'  },
    Research:      { bg: 'rgba(239,68,68,0.14)',   color: '#fca5a5', border: 'rgba(239,68,68,0.25)'   },
    News:          { bg: 'rgba(220,38,38,0.14)',   color: '#fca5a5', border: 'rgba(220,38,38,0.25)'   },
  };
  const tc  = (t) => typeColors[t] || { bg: 'rgba(99,102,241,0.14)', color: '#a5b4fc', border: 'rgba(99,102,241,0.25)' };

  const qualBar = (q) => {
    if (q >= 8) return { color: '#10b981', label: 'rgba(16,185,129,0.14)', text: '#6ee7b7', border: 'rgba(16,185,129,0.25)' };
    if (q >= 6) return { color: '#f59e0b', label: 'rgba(245,158,11,0.14)',  text: '#fcd34d', border: 'rgba(245,158,11,0.25)' };
    return               { color: '#ef4444', label: 'rgba(239,68,68,0.14)',   text: '#fca5a5', border: 'rgba(239,68,68,0.25)' };
  };

  const type    = node.type || node.content_type;
  const quality = node.quality || node.quality_score;
  const rawTopics = node.topics || node.key_topics || [];
  const topics = Array.isArray(rawTopics)
    ? rawTopics
    : (() => { try { const p = JSON.parse(rawTopics); return Array.isArray(p) ? p : []; } catch { return []; } })();
  const qc = quality ? qualBar(quality) : null;

  const visitDate = node.visit_timestamp
    ? new Date(node.visit_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const handleCopyUrl = async () => {
    if (!node.url) return;
    try {
      await navigator.clipboard.writeText(node.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = node.url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExploreConnections = () => {
    // Close modal but keep node highlighted in the graph (graph zooms to it)
    if (onFocusNode) onFocusNode(node);
    else onClose();
  };

  const handleFindSimilar = () => {
    const query = node.title || node.name;
    if (onSearch && query) onSearch(query);
    onClose();
  };

  const handleTopicSearch = (topic) => {
    if (onSearch && topic) onSearch(topic);
    onClose();
  };

  const handleRelatedNodeClick = (rn) => {
    if (onSelectRelatedNode) onSelectRelatedNode(rn);
    else onClose();
  };

  return (
    <Backdrop
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <Modal
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      >
        <AccentBar />

        {/* ── Header ─────────────────────────────── */}
        <Header>
          <TitleBlock>
            <NodeTitle>{node.title || node.name}</NodeTitle>
            <BadgeRow>
              {type && (
                <Badge $bg={tc(type).bg} $color={tc(type).color} $border={tc(type).border}>
                  <Layers size={10} style={{ marginRight: 3 }} />{type}
                </Badge>
              )}
              {quality != null && qc && (
                <Badge $bg={qc.label} $color={qc.text} $border={qc.border}>
                  <Star size={10} style={{ marginRight: 3 }} />Quality {quality}/10
                </Badge>
              )}
              {node.cluster && (
                <Badge
                  $bg="rgba(6,182,212,0.12)"
                  $color="#67e8f9"
                  $border="rgba(6,182,212,0.22)"
                >
                  <Hash size={10} style={{ marginRight: 3 }} />{node.cluster}
                </Badge>
              )}
              {node.processing_method && (
                <Badge
                  $bg="rgba(139,92,246,0.14)"
                  $color="#c4b5fd"
                  $border="rgba(139,92,246,0.25)"
                >
                  {node.processing_method}
                </Badge>
              )}
            </BadgeRow>
          </TitleBlock>

          <CloseBtn
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
          >
            <X size={15} />
          </CloseBtn>
        </Header>

        {/* ── Body ───────────────────────────────── */}
        <Body>
          <MainCol>
            {/* Overview */}
            <Card>
              <CardLabel>Overview</CardLabel>
              <DescText>
                {node.summary || node.description || 'No description available for this content.'}
              </DescText>
              {node.content && (
                <ContentQuote>
                  {node.content.substring(0, 500)}{node.content.length > 500 && '…'}
                </ContentQuote>
              )}

              {/* URL strip */}
              {node.url && (
                <UrlStrip>
                  <Link2 size={12} style={{ color: 'rgba(165,180,252,0.4)', flexShrink: 0 }} />
                  <UrlText title={node.url}>{node.url}</UrlText>
                  <IconBtn
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCopyUrl}
                    title={copied ? 'Copied!' : 'Copy URL'}
                  >
                    {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                  </IconBtn>
                  <IconBtn
                    whileTap={{ scale: 0.9 }}
                    onClick={() => window.open(node.url, '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink size={12} />
                  </IconBtn>
                </UrlStrip>
              )}
            </Card>

            {/* Topics */}
            {topics.length > 0 && (
              <Card>
                <CardLabel>Topics & Keywords</CardLabel>
                <TagList>
                  {topics.map((t, i) => (
                    <TopicChip
                      key={i}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleTopicSearch(t)}
                      title={`Search for "${t}" in your knowledge graph`}
                    >
                      <Search size={10} />
                      {t}
                    </TopicChip>
                  ))}
                </TagList>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardLabel>Actions</CardLabel>
              <ActionRow>
                {node.url && (
                  <ActBtn
                    className="primary"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.open(node.url, '_blank')}
                    title="Open the original page in a new tab"
                  >
                    <ExternalLink size={14} />
                    Open Page
                  </ActBtn>
                )}
                <ActBtn
                  className="ghost"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExploreConnections}
                  title="Close this panel and highlight the node with its connections in the graph"
                >
                  <Network size={14} />
                  Explore in Graph
                </ActBtn>
                <ActBtn
                  className="ghost"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFindSimilar}
                  title="Find semantically similar content in your knowledge base"
                >
                  <Search size={14} />
                  Find Similar
                </ActBtn>
              </ActionRow>
            </Card>
          </MainCol>

          <SideCol>
            {/* Stats */}
            <Card>
              <CardLabel>Statistics</CardLabel>
              <StatsGrid>
                <StatCard>
                  <div className="val">{quality || '—'}</div>
                  <div className="lbl"><Star size={9} />Quality</div>
                  {quality && (
                    <QualityBar $pct={(quality / 10) * 100} $color={qc?.color}>
                      <div className="fill" />
                    </QualityBar>
                  )}
                </StatCard>
                <StatCard>
                  <div className="val">{relatedNodes.length}</div>
                  <div className="lbl"><Network size={9} />Links</div>
                </StatCard>
                <StatCard>
                  <div className="val">{topics.length}</div>
                  <div className="lbl"><Hash size={9} />Topics</div>
                </StatCard>
                <StatCard>
                  <div
                    className="val"
                    style={{ fontSize: visitDate ? '0.75rem' : '1.45rem', WebkitTextFillColor: '#a5b4fc' }}
                  >
                    {visitDate || '—'}
                  </div>
                  <div className="lbl"><Clock size={9} />Visited</div>
                </StatCard>
              </StatsGrid>
            </Card>

            {/* Related content */}
            <Card style={{ flex: 1 }}>
              <CardLabel>Related Content ({relatedNodes.length})</CardLabel>

              {loadingRelated ? (
                <Spinner><div className="ring" /></Spinner>
              ) : relatedNodes.length === 0 ? (
                <Empty>No related content found</Empty>
              ) : (
                <RelatedList>
                  {relatedNodes.map((rn, i) => (
                    <RelatedItem
                      key={rn.id || i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleRelatedNodeClick(rn)}
                      title="View details for this item"
                    >
                      <div className="rn-name">{rn.title || rn.name}</div>
                      <div className="rn-meta">
                        {rn.type || rn.content_type}
                        {rn.similarity && ` · ${(rn.similarity * 100).toFixed(0)}% match`}
                        {rn.source === 'graph' && ' · connected'}
                      </div>
                    </RelatedItem>
                  ))}
                </RelatedList>
              )}
            </Card>
          </SideCol>
        </Body>
      </Modal>
    </Backdrop>
  );
};

export default NodeDetailsModal;
