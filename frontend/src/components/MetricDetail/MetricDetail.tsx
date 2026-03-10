import { useEffect } from 'react';
import { Box, Flex, Grid, Heading } from '@chakra-ui/react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { calculateWoW, calculateMoM, calculateYoY, getRAGStatus, formatMetricValue } from '../../utils/dataHelpers.ts';
import type { MetricData } from '../../types/index.ts';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export interface MetricDetailProps {
  metric: string;
  metricData: MetricData;
  onClose: () => void;
}

const ragColors: Record<string, string> = {
  green: 'var(--chakra-colors-status-green, #10b981)',
  yellow: 'var(--chakra-colors-status-yellow, #f59e0b)',
  red: 'var(--chakra-colors-status-red, #ef4444)',
};

export default function MetricDetail({ metric: _metric, metricData, onClose }: MetricDetailProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!metricData) {
    return null;
  }

  const wowChange = calculateWoW(metricData.current, metricData.previous);
  const momChange = calculateMoM(metricData.monthlyData ?? []);
  const yoyChange = calculateYoY(metricData.yoyData ?? []);

  const ragStatus = getRAGStatus(wowChange, metricData.thresholds);
  const formattedValue = formatMetricValue(metricData.current, metricData.unit);

  const chartData: ChartData<'line'> = {
    labels: metricData.weeklyData.map((_, i) => `Week ${i + 1}`),
    datasets: [
      {
        label: metricData.name,
        data: metricData.weeklyData,
        borderColor: 'var(--chakra-colors-accent-500, #3b82f6)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'var(--chakra-colors-accent-500, #3b82f6)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        callbacks: {
          label: (context) => {
            return `${metricData.name}: ${formatMetricValue(context.parsed.y, metricData.unit)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { font: { size: 12 }, color: '#6b7280' },
      },
      y: {
        display: true,
        grid: { color: '#e5e7eb' },
        ticks: {
          font: { size: 12 },
          color: '#6b7280',
          callback: (value) => formatMetricValue(value as number, metricData.unit),
        },
      },
    },
  };

  const formatComparison = (change: number) => {
    const arrow = change > 0 ? '\u2191' : change < 0 ? '\u2193' : '\u2192';
    const color = change > 0 ? ragColors.green : change < 0 ? ragColors.red : '#6b7280';
    return { arrow, color, value: Math.abs(change).toFixed(1) };
  };

  const wowFormatted = formatComparison(wowChange);
  const momFormatted = formatComparison(momChange);
  const yoyFormatted = formatComparison(yoyChange);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const sectionProps = {
    mb: '7',
    pb: '7',
    borderBottom: '1px solid',
    borderColor: 'border.default',
    _last: { mb: 0, pb: 0, borderBottom: 'none' },
  };

  return (
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
      p="5"
      onClick={handleOverlayClick}
    >
      <Box
        bg="bg.card"
        borderRadius="12px"
        boxShadow="0 20px 60px rgba(0, 0, 0, 0.3)"
        maxW="800px"
        w="100%"
        maxH="90vh"
        overflowY="auto"
        p="8"
        onClick={(e) => e.stopPropagation()}
      >
        <Box mb="6">
          <Flex justify="space-between" alignItems="flex-start" mb="3">
            <Flex align="center" gap="3">
              <Box
                w="16px"
                h="16px"
                borderRadius="50%"
                flexShrink={0}
                bg={ragColors[ragStatus] || ragColors.green}
              />
              <Heading
                as="h2"
                fontSize="1.75rem"
                fontWeight="700"
                color="text.primary"
                lineHeight="1.2"
                m="0"
              >
                {metricData.name}
              </Heading>
            </Flex>
            <Box
              as="button"
              bg="none"
              border="none"
              fontSize="1.5rem"
              color="text.secondary"
              cursor="pointer"
              p="1"
              lineHeight="1"
              _hover={{ color: 'text.primary' }}
              _focus={{ outline: '2px solid', outlineColor: 'accent.500', outlineOffset: '2px', borderRadius: '4px' }}
              onClick={onClose}
              aria-label="Close"
            >
              {'\u2715'}
            </Box>
          </Flex>
          {metricData.description && (
            <Box fontSize="1rem" color="text.secondary" lineHeight="1.5">
              {metricData.description}
            </Box>
          )}
        </Box>

        {metricData.formula && (
          <Box {...sectionProps}>
            <Heading as="h3" fontSize="0.875rem" fontWeight="600" color="text.secondary" textTransform="uppercase" letterSpacing="0.05em" mb="3">
              Formula
            </Heading>
            <Box
              fontFamily="'Monaco', 'Courier New', monospace"
              fontSize="1rem"
              color="text.primary"
              bg="bg.page"
              p="3"
              borderRadius="6px"
              border="1px solid"
              borderColor="border.default"
              lineHeight="1.5"
            >
              {metricData.formula}
            </Box>
          </Box>
        )}

        <Box {...sectionProps}>
          <Heading as="h3" fontSize="0.875rem" fontWeight="600" color="text.secondary" textTransform="uppercase" letterSpacing="0.05em" mb="3">
            Current Value
          </Heading>
          <Box fontSize="3rem" fontWeight="700" color="text.primary" lineHeight="1.1">
            {formattedValue}
          </Box>
        </Box>

        <Box {...sectionProps}>
          <Heading as="h3" fontSize="0.875rem" fontWeight="600" color="text.secondary" textTransform="uppercase" letterSpacing="0.05em" mb="3">
            Period Comparisons
          </Heading>
          <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="4">
            {[
              { label: 'Week over Week', fmt: wowFormatted },
              { label: 'Month over Month', fmt: momFormatted },
              { label: 'Year over Year', fmt: yoyFormatted },
            ].map(({ label, fmt }) => (
              <Box key={label} bg="bg.page" p="4" borderRadius="8px" border="1px solid" borderColor="border.default">
                <Box fontSize="0.875rem" color="text.secondary" fontWeight="500" mb="2">
                  {label}
                </Box>
                <Box fontSize="1.5rem" fontWeight="700" lineHeight="1.2" style={{ color: fmt.color }}>
                  {fmt.arrow} {fmt.value}%
                </Box>
              </Box>
            ))}
          </Grid>
        </Box>

        <Box {...sectionProps}>
          <Heading as="h3" fontSize="0.875rem" fontWeight="600" color="text.secondary" textTransform="uppercase" letterSpacing="0.05em" mb="3">
            Trend
          </Heading>
          <Box h="300px" w="100%">
            <Line data={chartData} options={chartOptions} />
          </Box>
        </Box>

        <Box {...sectionProps}>
          <Heading as="h3" fontSize="0.875rem" fontWeight="600" color="text.secondary" textTransform="uppercase" letterSpacing="0.05em" mb="3">
            Additional Breakdowns
          </Heading>
          <Box
            fontSize="0.875rem"
            color="text.secondary"
            fontStyle="italic"
            p="4"
            bg="bg.page"
            borderRadius="6px"
            textAlign="center"
          >
            Dimensional breakdowns and drill-down analysis will be available in a future release.
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}
