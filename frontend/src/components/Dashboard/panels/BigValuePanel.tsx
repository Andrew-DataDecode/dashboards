import { Box, Flex, SkeletonText } from '@chakra-ui/react';
import { formatBigValue } from '../../../utils/formatters';

interface BigValuePanelProps {
  title: string;
  value: string | number | null;
  format?: 'number' | 'currency' | 'percent';
  display?: 'compact' | 'full';
  decimals?: number;
  loading?: boolean;
}

export default function BigValuePanel({ title, value, format, display: displayMode, decimals, loading }: BigValuePanelProps) {
  const display = value === null || value === undefined
    ? '--'
    : typeof value === 'string'
      ? value
      : formatBigValue(value, format, displayMode, decimals);

  return (
    <Box
      bg="bg.card"
      borderRadius="12px"
      border="1px solid"
      borderColor="border.subtle"
      boxShadow="shadow.card"
      transition="box-shadow 0.2s"
      _hover={{ boxShadow: "shadow.cardHover" }}
      px="5"
      py="4"
      borderLeft="3px solid"
      borderLeftColor="accent.500"
    >
      <Box color="text.secondary" fontSize="13px" fontWeight="500" mb="1" letterSpacing="0.01em">
        {title}
      </Box>
      {loading ? (
        <SkeletonText noOfLines={1} />
      ) : (
        <Flex align="baseline" gap="2">
          <Box color="text.primary" fontSize="32px" fontWeight="700" lineHeight="1.2">
            {display}
          </Box>
        </Flex>
      )}
    </Box>
  );
}
