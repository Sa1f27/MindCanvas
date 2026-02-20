// src/components/ControlPanel.js - Simplified with only essential controls
import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/knowledgeStore';

const ControlContainer = styled(motion.div)`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  align-items: center;
`;

const ControlButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 1rem;
  transition: all ${props => props.theme.animations.fast};
  position: relative;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  &.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.4);
  }
`;

const DropdownContainer = styled(motion.div)`
  position: relative;
`;

const DropdownButton = styled(ControlButton)`
  padding-right: ${props => props.theme.spacing.lg};
  
  &::after {
    content: '▼';
    position: absolute;
    right: ${props => props.theme.spacing.sm};
    font-size: 0.8rem;
    transition: transform ${props => props.theme.animations.fast};
  }
  
  &.open::after {
    transform: rotate(180deg);
  }
`;

const DropdownMenu = styled(motion.div)`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: rgba(13, 13, 28, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${props => props.theme.borderRadius.md};
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 1000;
  min-width: 210px;
`;

const DropdownItem = styled.div`
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  font-size: 0.9rem;
  transition: all ${props => props.theme.animations.fast};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.active {
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
  }
  
  .icon {
    font-size: 1.1rem;
    width: 20px;
  }
  
  .description {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
    margin-top: 2px;
  }
`;

const DropdownHeader = styled.div`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.lg};
  font-size: 0.8rem;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.05);
`;

const Tooltip = styled(motion.div)`
  position: absolute;
  bottom: calc(100% + ${props => props.theme.spacing.sm});
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.sm};
  font-size: 0.8rem;
  white-space: nowrap;
  box-shadow: ${props => props.theme.shadows.md};
  z-index: 1001;
  pointer-events: none;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }
`;

const KeyboardShortcut = styled.span`
  font-size: 0.7rem;
  color: ${props => props.theme.colors.textSecondary};
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: auto;
`;

const ControlPanel = ({ 
  onSearch, 
  onRefresh, 
  onLayoutChange, 
  currentLayout, 
  isRefreshing 
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  
  const { 
    updateGraphSettings, 
    refreshAllData,
    exportKnowledgeGraph
  } = useKnowledgeStore();

  // Layout options — only include layouts registered in KnowledgeGraphViewer
  const layoutOptions = [
    {
      id: 'fcose',
      name: 'Force-Directed',
      icon: '🌐',
      description: 'Physics-based — related nodes cluster together naturally'
    },
    {
      id: 'dagre',
      name: 'Hierarchical',
      icon: '🏗️',
      description: 'Top-down hierarchy — great for seeing knowledge flow'
    }
  ];

  const handleLayoutSelect = (layoutId) => {
    onLayoutChange(layoutId);
    updateGraphSettings({ layout: layoutId });
    setShowLayoutMenu(false);
  };

  const handleRefresh = async () => {
    try {
      await refreshAllData();
      onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const handleExport = async () => {
    try {
      await exportKnowledgeGraph();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <ControlContainer>
      {/* Search Button */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onSearch}
        onMouseEnter={() => setHoveredButton('search')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        🔍
        <AnimatePresence>
          {hoveredButton === 'search' && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Search Knowledge <KeyboardShortcut>⌘K</KeyboardShortcut>
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>

      {/* Layout Selector */}
      <DropdownContainer>
        <DropdownButton
          className={showLayoutMenu ? 'open' : ''}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          onMouseEnter={() => setHoveredButton('layout')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          🌐
        </DropdownButton>
        
        <AnimatePresence>
          {hoveredButton === 'layout' && !showLayoutMenu && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Change Layout
            </Tooltip>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLayoutMenu && (
            <DropdownMenu
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <DropdownHeader>Graph Layout</DropdownHeader>
              {layoutOptions.map((layout) => (
                <DropdownItem
                  key={layout.id}
                  className={currentLayout === layout.id ? 'active' : ''}
                  onClick={() => handleLayoutSelect(layout.id)}
                >
                  <span className="icon">{layout.icon}</span>
                  <div>
                    <div>{layout.name}</div>
                    <div className="description">{layout.description}</div>
                  </div>
                </DropdownItem>
              ))}
            </DropdownMenu>
          )}
        </AnimatePresence>
      </DropdownContainer>

      {/* Refresh Button */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleRefresh}
        disabled={isRefreshing}
        onMouseEnter={() => setHoveredButton('refresh')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        {isRefreshing ? '⟳' : '🔄'}
        <AnimatePresence>
          {hoveredButton === 'refresh' && !isRefreshing && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Refresh Data <KeyboardShortcut>⌘R</KeyboardShortcut>
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>

      {/* Export Button */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleExport}
        onMouseEnter={() => setHoveredButton('export')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        💾
        <AnimatePresence>
          {hoveredButton === 'export' && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Export Knowledge Graph
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>

      {/* Fullscreen Toggle */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        }}
        onMouseEnter={() => setHoveredButton('fullscreen')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        ⛶
        <AnimatePresence>
          {hoveredButton === 'fullscreen' && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Toggle Fullscreen <KeyboardShortcut>F11</KeyboardShortcut>
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>
    </ControlContainer>
  );
};

export default ControlPanel;