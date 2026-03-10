import { Box, Flex } from '@chakra-ui/react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { calculateWoW, getRAGStatus, formatMetricValue } from '../../utils/dataHelpers.ts';
import type { MetricData } from '../../types/index.ts';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);

export interface MetricCardProps {
  metric: string;
  metricData: MetricData;
  onClick?: (metric: string) => void;
  compact?: boolean;
}

const ragColors: Record<string, string> = {
  green: 'var(--chakra-colors-status-green, #10b981)',
  yellow: 'var(--chakra-colors-status-yellow, #f59e0b)',
  red: 'var(--chakra-colors-status-red, #ef4444)',
};

export default function MetricCard({ metric, metricData, onClick, compact = false }: MetricCardProps) {
  if (!metricData) {
    return (
      <Box
        bg="bg.card"
        border="1px solid"
        borderColor="border.default"
        borderRadius="8px"
        p={compact ? '12px' : '16px'}
        fontSize={compact ? '0.9em' : undefined}
      >
        <Box fontSize="0.875rem" color="status.red" textAlign="center" p="2">
          Metric data not found
        </Box>
      </Box>
    );
  }

  const wowChange = calculateWoW(metricData.current, metricData.previous);
  const ragStatus = getRAGStatus(wowChange, metricData.thresholds);
  const formattedValue = formatMetricValue(metricData.current, metricData.unit);

  let arrow = '\u2192';
  if (wowChange > 0) {
    arrow = '\u2191';
  } else if (wowChange < 0) {
    arrow = '\u2193';
  }

  let trendColor = 'var(--chakra-colors-text-secondary, #6b7280)';
  if (wowChange > 0) {
    trendColor = 'var(--chakra-colors-status-green, #10b981)';
  } else if (wowChange < 0) {
    trendColor = 'var(--chakra-colors-status-red, #ef4444)';
  }

  const sparklineData: ChartData<'line'> = {
    labels: metricData.weeklyData.map((_, i) => `W${i + 1}`),
    datasets: [
      {
        data: metricData.weeklyData,
        borderColor: trendColor,
        backgroundColor: 'transparent',
        borderWidth: compact ? 1.5 : 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  };

  const sparklineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };

  const handleClick = () => {
    if (onClick) {
      onClick(metric);
    }
  };

  return (
    <Box
      bg="bg.card"
      border="1px solid"
      borderColor="border.default"
      borderRadius="8px"
      p={compact ? '12px' : '16px'}
      fontSize={compact ? '0.9em' : undefined}
      cursor="pointer"
      boxShadow="0 1px 4px rgba(0,0,0,0.1)"
      transition="box-shadow 0.2s ease, transform 0.15s ease"
      _hover={{ boxShadow: '0 4px 16px rgba(59,130,246,0.2)', transform: 'translateY(-2px)' }}
      _focus={{ outline: '2px solid', outlineColor: 'accent.500', outlineOffset: '2px' }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <Flex align="center" gap="2" mb="2">
        <Box
          w={compact ? '8px' : '10px'}
          h={compact ? '8px' : '10px'}
          borderRadius="50%"
          flexShrink={0}
          bg={ragColors[ragStatus] || ragColors.green}
        />
        <Box
          fontSize={compact ? '0.75rem' : '0.875rem'}
          color="text.secondary"
          fontWeight="500"
          lineHeight="1.2"
        >
          {metricData.name}
        </Box>
      </Flex>

      <Box
        fontSize={compact ? '1.5rem' : '2rem'}
        fontWeight="700"
        color="text.primary"
        mb={compact ? '2px' : '4px'}
        lineHeight="1.1"
      >
        {formattedValue}
      </Box>

      <Box
        fontSize={compact ? '0.75rem' : '0.875rem'}
        fontWeight="500"
        mb={compact ? '8px' : '12px'}
        lineHeight="1.2"
        style={{ color: trendColor }}
      >
        {arrow} {Math.abs(wowChange).toFixed(1)}% WoW
      </Box>

      <Box h={compact ? '30px' : '40px'} w="100%">
        <Line data={sparklineData} options={sparklineOptions} />
      </Box>
    </Box>
  );
}
