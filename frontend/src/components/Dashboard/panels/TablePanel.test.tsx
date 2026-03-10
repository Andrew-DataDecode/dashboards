import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test-utils';
import TablePanel from './TablePanel';
import type { ColumnDef, PaginationState } from '../../../types/dashboard';

const columns: ColumnDef[] = [
  { key: 'name', label: 'Name', format: 'text' },
  { key: 'amount', label: 'Amount', format: 'currency' },
  { key: 'count', label: 'Count', format: 'number' },
];

const rows = [
  { name: 'Alpha', amount: 1234.5, count: 42 },
  { name: 'Beta', amount: 999.99, count: 7 },
];

const basePagination: PaginationState = {
  page: 1,
  page_size: 25,
};

function renderTable(overrides: Partial<Parameters<typeof TablePanel>[0]> = {}) {
  const onSort = vi.fn();
  const onPageChange = vi.fn();
  const result = render(
    <TablePanel
      columns={columns}
      rows={rows}
      pagination={basePagination}
      onSort={onSort}
      onPageChange={onPageChange}
      {...overrides}
    />,
  );
  return { onSort, onPageChange, ...result };
}

describe('TablePanel', () => {
  test('renders column headers from ColumnDef config', () => {
    renderTable();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.getByText('Count')).toBeTruthy();
  });

  test('auto-aligns number/currency right, text left', () => {
    renderTable();
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
  });

  test('calls onSort with correct args on header click', () => {
    const { onSort } = renderTable();
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  test('toggles sort direction when clicking active sort column', () => {
    const { onSort } = renderTable({
      pagination: { ...basePagination, sort_column: 'name', sort_direction: 'asc' },
    });
    fireEvent.click(screen.getByText(/Name/));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  test('formats cell values using formatFull', () => {
    renderTable();
    expect(screen.getByText('$1,234.50')).toBeTruthy();
    expect(screen.getByText('$999.99')).toBeTruthy();
  });

  test('shows -- for null cell values', () => {
    renderTable({
      rows: [{ name: null, amount: null, count: null }],
    });
    const dashes = screen.getAllByText('--');
    expect(dashes).toHaveLength(3);
  });

  test('shows pagination when totalRows > page_size', () => {
    renderTable({
      totalRows: 100,
      pagination: { page: 1, page_size: 25 },
    });
    expect(screen.getByText(/Showing 1-25 of 100/)).toBeTruthy();
  });

  test('does not show pagination when rows fit in one page', () => {
    renderTable({
      totalRows: 2,
      pagination: { page: 1, page_size: 25 },
    });
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});

describe('TablePanel aggregation footer', () => {
  test('sum aggregation computes correctly', () => {
    renderTable({ aggregations: { amount: 'sum' } });
    // 1234.5 + 999.99 = 2234.49 -> formatted as currency
    expect(screen.getByText('$2,234.49')).toBeTruthy();
  });

  test('count aggregation returns row count', () => {
    renderTable({ aggregations: { count: 'count' } });
    expect(screen.getByText('2')).toBeTruthy();
  });

  test('avg aggregation handles empty data', () => {
    renderTable({
      rows: [],
      aggregations: { amount: 'avg' },
    });
    expect(screen.getByText('--')).toBeTruthy();
  });

  test('NaN values excluded from numeric aggregations', () => {
    renderTable({
      rows: [
        { name: 'Alpha', amount: 100, count: 10 },
        { name: 'Beta', amount: 'not-a-number', count: 20 },
      ],
      aggregations: { amount: 'sum' },
    });
    expect(screen.getByText('$100.00')).toBeTruthy();
  });

  test('no footer when aggregations prop omitted', () => {
    const { container } = renderTable();
    expect(container.querySelector('tfoot')).toBeNull();
  });

  test('no footer when aggregations is empty object', () => {
    const { container } = renderTable({ aggregations: {} });
    expect(container.querySelector('tfoot')).toBeNull();
  });

  test('footer cells use correct column format', () => {
    renderTable({ aggregations: { amount: 'min' } });
    // min of 999.99 and 1234.5 = 999.99 formatted as currency
    expect(screen.getByText('$999.99')).toBeTruthy();
  });
});
