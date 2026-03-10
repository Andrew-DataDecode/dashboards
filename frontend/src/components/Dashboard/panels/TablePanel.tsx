import { useMemo } from 'react';
import {
  Box, Flex, Button,
  TableRoot, TableScrollArea, TableHeader, TableBody, TableFooter,
  TableRow, TableColumnHeader, TableCell,
} from '@chakra-ui/react';
import { formatFull } from '../../../utils/formatters';
import type { ColumnDef, PaginationState } from '../../../types/dashboard';

interface TablePanelProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  totalRows?: number;
  pagination: PaginationState;
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  onSort: (column: string, direction: 'asc' | 'desc') => void;
  onPageChange: (page: number) => void;
  aggregations?: Record<string, 'sum' | 'count' | 'avg' | 'min' | 'max'>;
}

function getAlign(col: ColumnDef): 'left' | 'right' {
  if (col.align) return col.align;
  return col.format === 'number' || col.format === 'currency' ? 'right' : 'left';
}

function nextSortDirection(
  col: string,
  currentCol?: string,
  currentDir?: 'asc' | 'desc',
): 'asc' | 'desc' {
  if (col !== currentCol) return 'asc';
  return currentDir === 'asc' ? 'desc' : 'asc';
}

export default function TablePanel({
  columns,
  rows,
  totalRows,
  pagination,
  onSort,
  onPageChange,
  aggregations,
  title,
}: TablePanelProps & { title?: string }) {
  const total = totalRows ?? rows.length;
  const pageSize = pagination.page_size;
  const currentPage = pagination.page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, total);

  const aggregateValues = useMemo(() => {
    if (!aggregations || Object.keys(aggregations).length === 0) return {};
    const result: Record<string, number | '--'> = {};
    for (const [key, op] of Object.entries(aggregations)) {
      const nums = rows
        .map((r) => Number(r[key]))
        .filter((n) => !isNaN(n));
      if (op === 'count') {
        result[key] = rows.length;
      } else if (nums.length === 0) {
        result[key] = '--';
      } else if (op === 'sum') {
        result[key] = nums.reduce((a, b) => a + b, 0);
      } else if (op === 'avg') {
        result[key] = nums.reduce((a, b) => a + b, 0) / nums.length;
      } else if (op === 'min') {
        result[key] = Math.min(...nums);
      } else if (op === 'max') {
        result[key] = Math.max(...nums);
      }
    }
    return result;
  }, [rows, aggregations]);

  const hasAggregations = aggregations && Object.keys(aggregations).length > 0;

  return (
    <Box>
      <TableScrollArea maxH="600px" overflowY="auto">
        <TableRoot size="sm" striped aria-label={title ?? 'Data table'} role="grid">
          <TableHeader position="sticky" top="0" zIndex="1" bg="bg.card">
            <TableRow>
              {columns.map((col) => {
                const isActive = pagination.sort_column === col.key;
                const ariaSortValue: 'ascending' | 'descending' | 'none' = isActive
                  ? pagination.sort_direction === 'asc' ? 'ascending' : 'descending'
                  : 'none';
                const indicator = isActive
                  ? pagination.sort_direction === 'asc' ? ' \u25B4' : ' \u25BE'
                  : '';
                return (
                  <TableColumnHeader
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSortValue}
                    tabIndex={0}
                    textAlign={getAlign(col)}
                    width={col.width ? `${col.width}px` : undefined}
                    color={isActive ? "text.primary" : "text.secondary"}
                    fontWeight={isActive ? "700" : "600"}
                    fontSize="12px"
                    textTransform="uppercase"
                    letterSpacing="0.05em"
                    cursor="pointer"
                    userSelect="none"
                    whiteSpace="nowrap"
                    onClick={() =>
                      onSort(
                        col.key,
                        nextSortDirection(col.key, pagination.sort_column, pagination.sort_direction),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSort(
                          col.key,
                          nextSortDirection(col.key, pagination.sort_column, pagination.sort_direction),
                        );
                      }
                    }}
                    borderBottom="2px solid"
                    borderColor="border.default"
                    bg="bg.card"
                  >
                    {col.label}<span aria-hidden="true">{indicator}</span>
                  </TableColumnHeader>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} h="36px" _hover={{ bg: "table.hover" }}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    textAlign={getAlign(col)}
                    title={String(row[col.key] ?? '')}
                    whiteSpace="nowrap"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    maxW="300px"
                    px="3"
                    py="1.5"
                  >
                    {formatFull(row[col.key], col.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {hasAggregations && (
            <TableFooter>
              <TableRow fontWeight="700" aria-label="Column totals">
                {columns.map((col) => {
                  const val = aggregateValues[col.key];
                  return (
                    <TableCell
                      key={col.key}
                      textAlign={getAlign(col)}
                      borderTop="2px solid"
                      borderColor="border.default"
                      bg="bg.card"
                      px="3"
                      py="2"
                    >
                      {val === undefined
                        ? ''
                        : val === '--'
                        ? '--'
                        : formatFull(val, col.format)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          )}
        </TableRoot>
      </TableScrollArea>
      {totalPages > 1 && (
        <Flex align="center" justify="space-between" pt="3" fontSize="13px" color="text.secondary">
          <Box>
            Showing {startRow}-{endRow} of {total.toLocaleString()}
          </Box>
          <Flex align="center" gap="0.5">
            <Button
              variant="outline"
              size="xs"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              borderColor="border.default"
            >
              &lt;
            </Button>
            {paginationRange(currentPage, totalPages).map((p, i) =>
              p === '...' ? (
                <Box key={`ellipsis-${i}`} px="1">...</Box>
              ) : (
                <Button
                  key={p}
                  variant={p === currentPage ? "solid" : "outline"}
                  size="xs"
                  onClick={() => onPageChange(p as number)}
                  borderColor="border.default"
                  {...(p === currentPage ? { bg: "accent.500", color: "white" } : {})}
                >
                  {p}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="xs"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              borderColor="border.default"
            >
              &gt;
            </Button>
          </Flex>
        </Flex>
      )}
    </Box>
  );
}

function paginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  pages.push(total);

  return pages;
}
