import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

/**
 * High performance virtualized tree component
 * Handles thousands of nodes efficiently with windowing
 */
const VirtualizedTree = ({
  data,
  renderNode,
  initialCollapsed = {},
  nodeHeight = 48,
  indentSize = 24,
  onNodeClick,
  onNodeExpand,
  onNodeCollapse,
  getNodeKey = (node) => node.id,
  getNodeChildren = (node) => node.children || [],
  isNodeCollapsible = () => true,
}) => {
  const listRef = useRef(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const sizeMap = useRef({});

  // Flatten tree for virtual list
  const flattenedNodes = useMemo(() => {
    const result = [];
    
    const traverse = (nodes, level = 0, parentPath = []) => {
      nodes.forEach((node, index) => {
        const nodeKey = getNodeKey(node);
        const isCollapsed = collapsed[nodeKey];
        const children = getNodeChildren(node);
        const hasChildren = children.length > 0;
        
        result.push({
          node,
          level,
          index,
          path: [...parentPath, index],
          isCollapsed,
          hasChildren,
          isCollapsible: isNodeCollapsible(node),
        });

        if (!isCollapsed && hasChildren) {
          traverse(children, level + 1, [...parentPath, index]);
        }
      });
    };

    traverse(data);
    return result;
  }, [data, collapsed, getNodeKey, getNodeChildren, isNodeCollapsible]);

  const getItemSize = useCallback((index) => {
    return sizeMap.current[index] || nodeHeight;
  }, [nodeHeight]);

  const setItemSize = useCallback((index, size) => {
    if (sizeMap.current[index] !== size) {
      sizeMap.current[index] = size;
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const toggleNode = useCallback((nodeKey) => {
    setCollapsed(prev => {
      const newState = { ...prev, [nodeKey]: !prev[nodeKey] };
      
      if (newState[nodeKey]) {
        onNodeCollapse?.(nodeKey, newState);
      } else {
        onNodeExpand?.(nodeKey, newState);
      }
      
      return newState;
    });
  }, [onNodeExpand, onNodeCollapse]);

  const Row = useCallback(({ index, style }) => {
    const item = flattenedNodes[index];
    if (!item) return null;

    return (
      <div 
        style={{
          ...style,
          paddingLeft: item.level * indentSize,
          display: 'flex',
          alignItems: 'center',
        }}
        ref={(el) => el && setItemSize(index, el.offsetHeight)}
      >
        {renderNode(item.node, {
          level: item.level,
          isCollapsed: item.isCollapsed,
          hasChildren: item.hasChildren,
          isCollapsible: item.isCollapsible,
          toggle: () => toggleNode(getNodeKey(item.node)),
          onClick: () => onNodeClick?.(item.node, item),
          path: item.path,
        })}
      </div>
    );
  }, [flattenedNodes, indentSize, renderNode, setItemSize, toggleNode, getNodeKey, onNodeClick]);

  // Keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (flattenedNodes.length === 0) return;
      
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, flattenedNodes.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedIndex >= 0 && flattenedNodes[selectedIndex]) {
            const nodeKey = getNodeKey(flattenedNodes[selectedIndex].node);
            if (collapsed[nodeKey]) toggleNode(nodeKey);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedIndex >= 0 && flattenedNodes[selectedIndex]) {
            const nodeKey = getNodeKey(flattenedNodes[selectedIndex].node);
            if (!collapsed[nodeKey]) toggleNode(nodeKey);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (selectedIndex >= 0 && flattenedNodes[selectedIndex]) {
            onNodeClick?.(flattenedNodes[selectedIndex].node, flattenedNodes[selectedIndex]);
          }
          break;
      }
      
      if (selectedIndex >= 0) {
        listRef.current?.scrollToItem(selectedIndex, 'smart');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flattenedNodes, selectedIndex, collapsed, toggleNode, getNodeKey, onNodeClick]);

  return (
    <div tabIndex={0} style={{ height: '100%', outline: 'none' }}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            height={height}
            width={width}
            itemCount={flattenedNodes.length}
            itemSize={getItemSize}
            overscanCount={5}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedTree;