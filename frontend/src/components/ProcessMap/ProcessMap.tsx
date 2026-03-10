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
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './ProcessMap.css';
import StepNode from './StepNode.tsx';
import type { StepNodeData } from './StepNode.tsx';
import type { ProcessData, ProcessStep } from '../../types/index.ts';

export interface ProcessMapProps {
  processData: ProcessData;
  onStepClick: (step: ProcessStep) => void;
}

export default function ProcessMap({ processData, onStepClick }: ProcessMapProps) {
  const { fitView } = useReactFlow();

  const nodeTypes = useMemo(() => ({ stepNode: StepNode }), []);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!processData || !processData.steps) {
      return { initialNodes: [] as Node<StepNodeData>[], initialEdges: [] as Edge[] };
    }

    const nodes: Node<StepNodeData>[] = [];
    const edges: Edge[] = [];

    const MAIN_Y = 200;
    const X_SPACING = 280;
    const BRANCH_Y_OFFSET = 150;

    let currentX = 50;
    const stepPositions = new Map<string, { x: number; y: number; branch?: string }>();
    const branchSteps = new Set<string>();
    const processedSteps = new Set<string>();

    const stepMap = new Map<string, ProcessStep>(processData.steps.map(step => [step.id, step]));

    processData.steps.forEach(step => {
      if (step.branch) {
        branchSteps.add(step.id);
      }
    });

    const getNextStepId = (step: ProcessStep): string | null => {
      if (step.nextStep) return step.nextStep;
      if (step.type === 'decision') return null;
      if (step.branch && step.nextStep) return step.nextStep;

      const currentIndex = processData.steps.findIndex(s => s.id === step.id);
      for (let i = currentIndex + 1; i < processData.steps.length; i++) {
        const nextStep = processData.steps[i];
        if (!nextStep.branch || nextStep.branch === step.branch) {
          return nextStep.id;
        }
      }
      return null;
    };

    processData.steps.forEach(step => {
      if (processedSteps.has(step.id)) return;

      let x: number, y: number;

      if (step.branch) {
        let decisionStep: ProcessStep | null = null;
        for (let i = 0; i < processData.steps.length; i++) {
          const s = processData.steps[i];
          if (s.type === 'decision' && s.branches) {
            const hasBranch = s.branches.some(b => b.label === step.branch);
            if (hasBranch) {
              decisionStep = s;
              break;
            }
          }
        }

        if (decisionStep && stepPositions.has(decisionStep.id)) {
          const decisionPos = stepPositions.get(decisionStep.id)!;
          x = decisionPos.x + X_SPACING;

          const branchIndex = decisionStep.branches!.findIndex(b => b.label === step.branch);
          if (branchIndex === 0) {
            y = MAIN_Y - BRANCH_Y_OFFSET;
          } else {
            y = MAIN_Y + BRANCH_Y_OFFSET;
          }
        } else {
          x = currentX;
          y = MAIN_Y + BRANCH_Y_OFFSET;
          currentX += X_SPACING;
        }
      } else {
        x = currentX;
        y = MAIN_Y;
        currentX += X_SPACING;
      }

      stepPositions.set(step.id, { x, y, branch: step.branch });
      processedSteps.add(step.id);

      nodes.push({
        id: step.id,
        type: 'stepNode' as const,
        position: { x, y },
        data: {
          type: step.type,
          name: step.name,
          stepMetrics: step.stepMetrics || [],
          hasDetail: step.hasDetail || false,
          onClick: onStepClick as unknown as (data: StepNodeData) => void,
        },
      });
    });

    processData.steps.forEach(step => {
      if (step.type === 'decision' && step.branches) {
        step.branches.forEach(branch => {
          if (branch.nextStep && stepMap.has(branch.nextStep)) {
            edges.push({
              id: `${step.id}-to-${branch.nextStep}`,
              source: step.id,
              target: branch.nextStep,
              label: branch.label,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#94a3b8', strokeWidth: 2 },
              labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
              labelStyle: { fontSize: 11, fontWeight: 500, fill: '#6b7280' },
            });
          }
        });
      } else {
        const nextStepId = getNextStepId(step);
        if (nextStepId && stepMap.has(nextStepId)) {
          const targetStep = stepMap.get(nextStepId)!;
          const isBranchToMerge = step.branch && !targetStep.branch;

          edges.push({
            id: `${step.id}-to-${nextStepId}`,
            source: step.id,
            target: nextStepId,
            type: 'smoothstep',
            animated: false,
            style: isBranchToMerge
              ? { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5 5' }
              : { stroke: '#94a3b8', strokeWidth: 2 },
          });
        }
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [processData, onStepClick]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 200 });
      }, 10);
    }
  }, [nodes, fitView]);

  return (
    <Box
      className="process-map"
      w="100%"
      h="100%"
      bg="bg.page"
      border="1px solid"
      borderColor="border.default"
      borderRadius="8px"
      overflow="hidden"
      css={{
        "& .react-flow__edge-path": { stroke: "#6b7280", strokeWidth: 2 },
        "& .react-flow__edge.selected .react-flow__edge-path": { stroke: "#3b82f6", strokeWidth: 2.5 },
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
        "& .react-flow__minimap": {
          bg: "white",
          border: "1px solid #e5e7eb",
        },
        "& .react-flow__minimap-mask": {
          fillOpacity: 0.15,
          stroke: "#3b82f6",
        },
        "& .react-flow__background": {
          borderColor: "#e5e7eb",
        },
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.5}
        maxZoom={1.5}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor="#3b82f6"
          maskColor="rgba(0,0,0,0.08)"
          zoomable
          pannable
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </Box>
  );
}
