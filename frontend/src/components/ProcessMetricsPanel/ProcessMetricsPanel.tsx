import { Box, Grid } from '@chakra-ui/react';
import MetricCard from '../MetricCard/MetricCard.tsx';
import { getMetricValue } from '../../utils/dataHelpers.ts';
import type { MetricData } from '../../types/index.ts';

export interface ProcessMetricsPanelProps {
  processMetrics: Array<{ dataSource: string }>;
  metricData: Record<string, MetricData>;
  onClick: (metricKey: string) => void;
}

export default function ProcessMetricsPanel({ processMetrics, metricData, onClick }: ProcessMetricsPanelProps) {
  if (!processMetrics || processMetrics.length === 0) {
    return null;
  }

  return (
    <Box mb="0" px="8" py="5" bg="bg.page">
      <Grid
        templateColumns="repeat(auto-fill, minmax(200px, 1fr))"
        gap="4"
        w="100%"
      >
        {processMetrics.map((processMetric, index) => {
          const resolvedMetricData = getMetricValue(metricData as unknown as Record<string, unknown>, processMetric.dataSource);

          return (
            <MetricCard
              key={processMetric.dataSource || index}
              metric={processMetric.dataSource}
              metricData={resolvedMetricData as MetricData}
              onClick={onClick}
              compact={false}
            />
          );
        })}
      </Grid>
    </Box>
  );
}
