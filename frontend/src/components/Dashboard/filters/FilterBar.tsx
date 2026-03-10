import { CardRoot, CardBody, Flex } from '@chakra-ui/react';
import type { FilterConfig } from '../../../types/dashboard';
import DateRangeFilter from './DateRangeFilter';
import MultiselectFilter from './MultiselectFilter';
import TextFilter from './TextFilter';

interface FilterBarProps {
  filters: Record<string, FilterConfig>;
  filterValues: Record<string, unknown>;
  filterOptions: Record<string, string[]>;
  onChange: (filterId: string, value: unknown) => void;
}

export default function FilterBar({ filters, filterValues, filterOptions, onChange }: FilterBarProps) {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;

  return (
    <CardRoot mx="6" mt="4" mb="0" bg="bg.card" borderColor="border.subtle" borderWidth="1px" borderRadius="12px" boxShadow="shadow.card">
      <CardBody p="4">
        <Flex wrap="wrap" gap="4" alignItems="flex-end">
          {entries.map(([id, config]) => {
            switch (config.type) {
              case 'date_range':
                return (
                  <DateRangeFilter
                    key={id}
                    label={config.label}
                    value={filterValues[id] as { start: string; end: string } | undefined}
                    onChange={(val) => onChange(id, val)}
                  />
                );
              case 'multiselect':
                return (
                  <MultiselectFilter
                    key={id}
                    label={config.label}
                    options={filterOptions[id] ?? []}
                    value={(filterValues[id] as string[]) ?? []}
                    onChange={(val) => onChange(id, val)}
                  />
                );
              case 'text':
                return (
                  <TextFilter
                    key={id}
                    label={config.label}
                    value={(filterValues[id] as string) ?? ''}
                    onChange={(val) => onChange(id, val)}
                  />
                );
              default:
                return null;
            }
          })}
        </Flex>
      </CardBody>
    </CardRoot>
  );
}
