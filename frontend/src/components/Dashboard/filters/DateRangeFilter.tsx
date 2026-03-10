import { Box, Input, Flex } from '@chakra-ui/react';

interface DateRangeFilterProps {
  label: string;
  value?: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
}

export default function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const start = value?.start ?? '';
  const end = value?.end ?? '';

  return (
    <Box as="fieldset" border="none" p="0" m="0" aria-label={label}>
      <Box as="legend" fontSize="14px" fontWeight="500" color="text.secondary" mb="1">
        {label}
      </Box>
      <Flex gap="2" alignItems="center">
        <Input
          type="date"
          size="sm"
          aria-label={`${label} start date`}
          value={start}
          onChange={(e) => onChange({ start: e.target.value, end })}
          borderColor="border.subtle"
        />
        <Box as="span" fontSize="14px" color="text.secondary">to</Box>
        <Input
          type="date"
          size="sm"
          aria-label={`${label} end date`}
          value={end}
          onChange={(e) => onChange({ start, end: e.target.value })}
          borderColor="border.subtle"
        />
      </Flex>
    </Box>
  );
}
