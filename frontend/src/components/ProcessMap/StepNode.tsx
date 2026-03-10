import { Box, Flex } from '@chakra-ui/react';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { ProcessStep } from '../../types/index.ts';

export interface StepNodeData {
  type: ProcessStep['type'];
  name: string;
  stepMetrics: string[];
  hasDetail: boolean;
  onClick: (data: StepNodeData) => void;
  [key: string]: unknown;
}

type StepNodeType = Node<StepNodeData, 'stepNode'>;

const handleStyle = {
  width: 8, height: 8,
  background: '#e5e7eb',
  border: '1px solid #6b7280',
};

const metricBadgeStyle = {
  position: 'absolute' as const,
  top: '-6px',
  right: '-6px',
  bg: 'accent.500',
  color: 'white',
  borderRadius: '50%',
  w: '20px',
  h: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: '600',
  border: '2px solid white',
};

export default function StepNode({ data, selected }: NodeProps<StepNodeType>) {
  const { type, name, stepMetrics = [], hasDetail, onClick } = data;
  const metricCount = stepMetrics.length;

  const selectionGlow = (() => {
    if (!selected) return undefined;
    if (type === 'decision') return '0 0 0 3px rgba(245, 158, 11, 0.3)';
    if (type === 'start' || type === 'end') return '0 0 0 3px rgba(16, 185, 129, 0.3)';
    return '0 0 0 3px rgba(59, 130, 246, 0.3)';
  })();

  const handleClick = () => {
    if (hasDetail && onClick) {
      onClick(data);
    }
  };

  if (type === 'decision') {
    return (
      <Flex
        data-step-type="decision"
        position="relative"
        fontSize="14px"
        minW="140px"
        minH="140px"
        align="center"
        justify="center"
        textAlign="center"
      >
        <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -4 }} />
        <Box
          data-step-type="decision"
          w="120px"
          h="120px"
          bg="bg.card"
          border="2px solid"
          borderColor="status.yellow"
          boxShadow={selectionGlow}
          transition="box-shadow 0.2s ease"
          transform="rotate(45deg)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
        >
          <Flex
            transform="rotate(-45deg)"
            direction="column"
            align="center"
            gap="1"
            p="2"
            maxW="80px"
            textAlign="center"
          >
            <Box fontSize="13px" fontWeight="600" color="status.yellow">
              {name}
            </Box>
            {metricCount > 0 && (
              <Box
                {...metricBadgeStyle}
                position="absolute"
                top="-10px"
                right="50%"
                transform="translateX(50%) rotate(-45deg)"
              >
                {metricCount}
              </Box>
            )}
          </Flex>
        </Box>
        <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -4 }} />
      </Flex>
    );
  }

  const isTerminal = type === 'start' || type === 'end';

  return (
    <Box position="relative" fontSize="14px" minW={isTerminal ? '100px' : '120px'} textAlign="center">
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -4 }} />
      <Flex
        data-step-type={type}
        position="relative"
        direction="column"
        align="center"
        gap="1.5"
        p={isTerminal ? '10px 20px' : '12px 16px'}
        bg={isTerminal ? 'status.green' : 'bg.card'}
        border={isTerminal ? 'none' : '2px solid'}
        borderColor={isTerminal ? undefined : 'accent.500'}
        borderRadius={isTerminal ? '24px' : '8px'}
        cursor={hasDetail ? 'pointer' : undefined}
        boxShadow={selectionGlow}
        transition="all 0.2s ease"
        _hover={type === 'action' ? { boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)', transform: 'translateY(-2px)' } : undefined}
        _focus={hasDetail ? { outline: '2px solid', outlineColor: 'accent.500', outlineOffset: '2px' } : undefined}
        onClick={handleClick}
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyPress={hasDetail ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
      >
        <Box
          fontWeight={isTerminal ? '600' : '500'}
          color={isTerminal ? 'white' : 'text.primary'}
          lineHeight="1.3"
          textTransform={isTerminal ? 'uppercase' : undefined}
          fontSize={isTerminal ? '12px' : undefined}
          letterSpacing={isTerminal ? '0.5px' : undefined}
        >
          {name}
        </Box>
        {metricCount > 0 && (
          <Box {...metricBadgeStyle}>{metricCount}</Box>
        )}
      </Flex>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -4 }} />
    </Box>
  );
}
