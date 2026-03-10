import { useEffect, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './MetricTree.css';
import MetricTreeNode from './MetricTreeNode.tsx';
import type { MetricTreeNodeData } from './MetricTreeNode.tsx';
import type { MetricData, MetricTreeConfig, TreeNode } from '../../types/index.ts';

export interface MetricTreeProps {
  treeConfig: MetricTreeConfig;
  metricData: Record<string, MetricData>;
  onMetricClick: (metricKey: string) => void;
}

export default function MetricTree({ treeConfig, metricData, onMetricClick }: MetricTreeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MetricTreeNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(() => ({ metricTreeNode: MetricTreeNode }), []);

  useEffect(() => {
    if (!treeConfig || !treeConfig.nodes || !metricData) {
      return;
    }

    const layoutNodes = calculateTreeLayout(treeConfig.nodes);
    const layoutEdges = buildEdges(treeConfig.nodes);

    const flowNodes: Node<MetricTreeNodeData>[] = layoutNodes.map((node) => ({
      id: node.id,
      type: 'metricTreeNode' as const,
      position: { x: node.x, y: node.y },
      data: {
        metric: node.metricKey,
        metricData: getMetricData(node.metricKey, metricData),
        onClick: onMetricClick,
      },
    }));

    const flowEdges: Edge[] = layoutEdges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.operator || '',
      animated: false,
      style: { stroke: '#e5e7eb', strokeWidth: 2 },
      labelStyle: {
        fontSize: '16px',
        fontWeight: 'bold',
        fill: '#6b7280'
      },
      labelBgStyle: { fill: '#f9fafb' },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [treeConfig, metricData, onMetricClick, setNodes, setEdges]);

  return (
    <Box
      className="metric-tree"
      w="100%"
      h="100%"
      bg="bg.page"
      position="relative"
      css={{
        "& .react-flow__controls": {
          bg: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        },
        "& .react-flow__controls-button": {
          width: "28px",
          height: "28px",
          _hover: { bg: "#f9fafb" },
          "& svg": { fill: "#374151" },
        },
        "& .react-flow__edge-path": { stroke: "#e5e7eb", strokeWidth: 2 },
        "& .react-flow__edge-text": {
          fontSize: "16px",
          fontWeight: "bold",
          fill: "#6b7280",
        },
        "& .react-flow__node:focus-visible": {
          outline: "2px solid #3b82f6",
          outlineOffset: "4px",
          borderRadius: "8px",
        },
        "& .react-flow__background": {
          backgroundColor: "#f9fafb",
        },
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor="#3b82f6"
          maskColor="rgba(0,0,0,0.08)"
          zoomable
          pannable
        />
      </ReactFlow>
    </Box>
  );
}

interface LayoutNode {
  id: string;
  metricKey: string;
  x: number;
  y: number;
}

interface LayoutEdge {
  source: string;
  target: string;
  operator: string;
}

function calculateTreeLayout(treeNodes: TreeNode[]): LayoutNode[] {
  if (!treeNodes || treeNodes.length === 0) return [];

  const nodeMap: Record<string, TreeNode> = {};
  treeNodes.forEach((node) => {
    nodeMap[node.id] = node;
  });

  const childIds = new Set<string>();
  treeNodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      node.children.forEach((childId) => childIds.add(childId));
    }
  });

  const rootNode = treeNodes.find((node) => !childIds.has(node.id));
  if (!rootNode) {
    console.error('No root node found in tree');
    return [];
  }

  const VERTICAL_SPACING = 150;
  const HORIZONTAL_SPACING = 280;
  const NODE_WIDTH = 250;

  const levels: Array<Array<{ id: string; metricKey: string }>> = [];
  const queue: Array<{ nodeId: string; level: number }> = [{ nodeId: rootNode.id, level: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { nodeId, level } = item;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap[nodeId];
    if (!node) continue;

    if (!levels[level]) {
      levels[level] = [];
    }
    levels[level].push({
      id: nodeId,
      metricKey: node.metric,
    });

    if (node.children && node.children.length > 0) {
      node.children.forEach((childId) => {
        queue.push({ nodeId: childId, level: level + 1 });
      });
    }
  }

  const layoutNodes: LayoutNode[] = [];
  levels.forEach((levelNodes, levelIndex) => {
    const y = levelIndex * VERTICAL_SPACING;
    const totalWidth = levelNodes.length * NODE_WIDTH + (levelNodes.length - 1) * HORIZONTAL_SPACING;
    const startX = -totalWidth / 2 + NODE_WIDTH / 2;

    levelNodes.forEach((node, nodeIndex) => {
      const x = startX + nodeIndex * (NODE_WIDTH + HORIZONTAL_SPACING);
      layoutNodes.push({
        id: node.id,
        metricKey: node.metricKey,
        x,
        y,
      });
    });
  });

  return layoutNodes;
}

function buildEdges(treeNodes: TreeNode[]): LayoutEdge[] {
  const edges: LayoutEdge[] = [];

  treeNodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      node.children.forEach((childId) => {
        edges.push({
          source: node.id,
          target: childId,
          operator: node.operator || '',
        });
      });
    }
  });

  return edges;
}

function getMetricData(metricKey: string, metricData: Record<string, MetricData>): MetricData {
  if (!metricKey || !metricData) return null as unknown as MetricData;

  const keys = metricKey.split('.');
  let current: unknown = metricData;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null as unknown as MetricData;
    }
  }

  return current as MetricData;
}
