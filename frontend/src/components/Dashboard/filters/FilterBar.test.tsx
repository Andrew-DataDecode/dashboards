import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '../../../test-utils';
import FilterBar from './FilterBar';
import type { FilterConfig } from '../../../types/dashboard';

describe('FilterBar', () => {
  test('renders nothing when filters empty', () => {
    const { container } = render(
      <FilterBar
        filters={{}}
        filterValues={{}}
        filterOptions={{}}
        onChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  test('renders DateRangeFilter for date_range type', () => {
    const filters: Record<string, FilterConfig> = {
      date: { type: 'date_range', label: 'Order Date' },
    };
    const { container } = render(
      <FilterBar
        filters={filters}
        filterValues={{}}
        filterOptions={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Order Date')).toBeTruthy();
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
  });

  test('renders MultiselectFilter for multiselect type', () => {
    const filters: Record<string, FilterConfig> = {
      status: { type: 'multiselect', label: 'Status' },
    };
    render(
      <FilterBar
        filters={filters}
        filterValues={{}}
        filterOptions={{ status: ['Active', 'Inactive'] }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
  });

  test('renders TextFilter for text type', () => {
    const filters: Record<string, FilterConfig> = {
      search: { type: 'text', label: 'Search' },
    };
    render(
      <FilterBar
        filters={filters}
        filterValues={{}}
        filterOptions={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search')).toBeTruthy();
  });
});
