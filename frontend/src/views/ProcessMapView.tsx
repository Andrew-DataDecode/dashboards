import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Box, Flex, Heading } from '@chakra-ui/react';
import ProcessMap from '../components/ProcessMap/ProcessMap.tsx';
import ProcessMetricsPanel from '../components/ProcessMetricsPanel/ProcessMetricsPanel.tsx';
import MetricDetail from '../components/MetricDetail/MetricDetail.tsx';
import { loadProcess, loadMetrics } from '../utils/dataHelpers.ts';
import type { ProcessData, ProcessStep, MetricData } from '../types/index.ts';

interface StepDetail {
  name: string;
  description?: string;
  hasDetail?: boolean;
}

export default function ProcessMapView() {
  const [selectedProcess, setSelectedProcess] = useState('uti-treatment');
  const [processData, setProcessData] = useState<ProcessData | null>(null);
  const [metricData, setMetricData] = useState<Record<string, MetricData> | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<StepDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const processOptions = [
    { id: 'uti-treatment', name: 'UTI Treatment Process' },
  ];

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await loadMetrics();
        setMetricData(data);
      } catch (err) {
        console.error('Error loading metrics:', err);
        setError('Failed to load metrics data');
      }
    };

    fetchMetrics();
  }, []);

  useEffect(() => {
    const fetchProcess = async () => {
      if (!selectedProcess) return;

      setLoading(true);
      setError(null);

      try {
        const data = await loadProcess(selectedProcess);
        setProcessData(data);
      } catch (err) {
        console.error('Error loading process:', err);
        setError(`Failed to load process: ${selectedProcess}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProcess();
  }, [selectedProcess]);

  const handleProcessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProcess(e.target.value);
    setSelectedMetric(null);
    setSelectedStep(null);
  };

  const handleMetricClick = (metricKey: string) => {
    setSelectedMetric(metricKey);
  };

  const handleStepClick = (step: ProcessStep) => {
    if (step.hasDetail) {
      setSelectedStep(step);
      console.log('Step with detail clicked:', step);
    }
  };

  const closeMetricDetail = () => {
    setSelectedMetric(null);
  };

  const closeStepDetail = () => {
    setSelectedStep(null);
  };

  if (loading && !processData) {
    return (
      <Flex direction="column" h="100%" bg="bg.page" overflow="hidden">
        <Flex align="center" justify="center" h="100%" fontSize="md" color="text.secondary">
          Loading process map...
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" h="100%" bg="bg.page" overflow="hidden">
        <Flex align="center" justify="center" h="100%" fontSize="md" color="status.red">
          {error}
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" h="100%" bg="bg.page" overflow="hidden">
      <Flex
        justify="space-between"
        alignItems="flex-start"
        px="8"
        py="6"
        bg="bg.card"
        borderBottom="1px solid"
        borderColor="border.default"
      >
        <Box flex="1">
          <Heading size="lg" color="text.primary" fontWeight="600" fontSize="1.5rem" mb="2">
            Process Maps
          </Heading>
          {processData && (
            <Box fontSize="0.875rem" color="text.secondary" lineHeight="1.5">
              {processData.description}
            </Box>
          )}
        </Box>
        <Flex align="center" gap="3">
          <label htmlFor="process-selector" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--chakra-colors-text-secondary, #6b7280)' }}>
            Process:
          </label>
          <select
            id="process-selector"
            value={selectedProcess}
            onChange={handleProcessChange}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              color: 'var(--chakra-colors-text-primary, #1f2937)',
              backgroundColor: 'var(--chakra-colors-bg-card, #ffffff)',
              border: '1px solid var(--chakra-colors-border-default, #e5e7eb)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {processOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </Flex>
      </Flex>

      {processData && metricData && (
        <ProcessMetricsPanel
          processMetrics={processData.processMetrics}
          metricData={metricData}
          onClick={handleMetricClick}
        />
      )}

      {processData && (
        <Box flex="1" minH="0" position="relative">
          <ReactFlowProvider>
            <ProcessMap
              processData={processData}
              onStepClick={handleStepClick}
            />
          </ReactFlowProvider>
        </Box>
      )}

      {selectedMetric && metricData && (
        <MetricDetail
          metric={selectedMetric}
          metricData={(metricData as unknown as Record<string, Record<string, MetricData>>).metrics[selectedMetric.replace('metrics.', '')]}
          onClose={closeMetricDetail}
        />
      )}

      {selectedStep && (
        <Flex
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="rgba(0, 0, 0, 0.5)"
          align="center"
          justify="center"
          zIndex="1000"
          onClick={closeStepDetail}
        >
          <Box
            bg="bg.card"
            borderRadius="12px"
            p="8"
            maxW="600px"
            w="90%"
            maxH="80vh"
            overflowY="auto"
            boxShadow="0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            onClick={(e) => e.stopPropagation()}
          >
            <Flex justify="space-between" alignItems="flex-start" mb="4">
              <Heading size="md" color="text.primary" fontWeight="600" fontSize="1.25rem">
                {selectedStep.name}
              </Heading>
              <Box
                as="button"
                bg="none"
                border="none"
                fontSize="1.5rem"
                color="text.secondary"
                cursor="pointer"
                p="0"
                w="24px"
                h="24px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="4px"
                _hover={{ bg: "border.default", color: "text.primary" }}
                onClick={closeStepDetail}
              >
                {'\u2715'}
              </Box>
            </Flex>
            <Box fontSize="0.875rem" color="text.secondary" lineHeight="1.6" mb="6">
              {selectedStep.description}
            </Box>
            <Box
              p="4"
              bg="bg.page"
              borderRadius="6px"
              fontSize="0.875rem"
              color="text.secondary"
              textAlign="center"
              fontStyle="italic"
            >
              Sub-process drill-down will be available in a future release.
            </Box>
          </Box>
        </Flex>
      )}
    </Flex>
  );
}
