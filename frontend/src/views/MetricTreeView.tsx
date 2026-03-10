import { useState, useEffect } from 'react';
import { Box, Flex, Heading } from '@chakra-ui/react';
import MetricTree from '../components/MetricTree/MetricTree.tsx';
import MetricDetail from '../components/MetricDetail/MetricDetail.tsx';
import { loadMetricTree, loadMetrics } from '../utils/dataHelpers.ts';
import type { MetricTreeConfig, MetricData } from '../types/index.ts';

export default function MetricTreeView() {
  const [treeData, setTreeData] = useState<MetricTreeConfig | null>(null);
  const [metricData, setMetricData] = useState<Record<string, MetricData> | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [tree, metrics] = await Promise.all([
          loadMetricTree('ltv-decomposition'),
          loadMetrics(),
        ]);

        setTreeData(tree);
        setMetricData(metrics);
      } catch (err) {
        console.error('Failed to load metric tree data:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleMetricClick = (metricKey: string) => {
    const metricName = metricKey.split('.').pop()!;
    setSelectedMetric(metricName);
  };

  const handleCloseModal = () => {
    setSelectedMetric(null);
  };

  if (loading) {
    return (
      <Flex direction="column" h="100%" bg="bg.page">
        <Flex align="center" justify="center" h="100%" fontSize="lg" color="text.secondary">
          Loading metric tree...
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" h="100%" bg="bg.page">
        <Flex align="center" justify="center" h="100%" fontSize="lg" color="status.red">
          Error loading metric tree: {error}
        </Flex>
      </Flex>
    );
  }

  if (!treeData || !metricData) {
    return (
      <Flex direction="column" h="100%" bg="bg.page">
        <Flex align="center" justify="center" h="100%" fontSize="lg" color="status.red">
          No metric tree data available
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" h="100%" bg="bg.page">
      <Box p="8" bg="bg.card" borderBottom="1px solid" borderColor="border.default">
        <Heading size="xl" color="text.primary" fontWeight="600" fontSize="1.75rem" mb="2">
          {treeData.name}
        </Heading>
        {treeData.description && (
          <Box fontSize="1rem" color="text.secondary" lineHeight="1.5">
            {treeData.description}
          </Box>
        )}
      </Box>

      <Box flex="1" position="relative" overflow="hidden">
        <MetricTree
          treeConfig={treeData}
          metricData={metricData}
          onMetricClick={handleMetricClick}
        />
      </Box>

      {selectedMetric && (
        <MetricDetail
          metric={selectedMetric}
          metricData={(metricData as unknown as Record<string, Record<string, MetricData>>).metrics[selectedMetric]}
          onClose={handleCloseModal}
        />
      )}
    </Flex>
  );
}
