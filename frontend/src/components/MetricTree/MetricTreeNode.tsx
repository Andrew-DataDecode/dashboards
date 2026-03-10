import { Box } from '@chakra-ui/react';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import MetricCard from '../MetricCard/MetricCard.tsx';
import type { MetricData } from '../../types/index.ts';

export interface MetricTreeNodeData {
  metric: string;
  metricData: MetricData;
  onClick: (metric: string) => void;
  [key: string]: unknown;
}

type MetricTreeNodeType = Node<MetricTreeNodeData, 'metricTreeNode'>;

export default function MetricTreeNode({ data }: NodeProps<MetricTreeNodeType>) {
  const { metric, metricData, onClick } = data;

  return (
    <Box
      position="relative"
      w="220px"
      boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
      borderRadius="8px"
      transition="box-shadow 0.2s ease, transform 0.15s ease"
      _hover={{ boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)', transform: 'translateY(-2px)' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8, height: 8,
          background: '#e5e7eb',
          border: '1px solid #6b7280',
          top: -4,
        }}
      />

      <MetricCard
        metric={metric}
        metricData={metricData}
        onClick={onClick}
        compact={true}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8, height: 8,
          background: '#e5e7eb',
          border: '1px solid #6b7280',
          bottom: -4,
        }}
      />
    </Box>
  );
}
