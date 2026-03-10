import { describe, test, expect } from 'vitest';
import { render, screen } from '../../../test-utils';
import BigValuePanel from './BigValuePanel';

describe('BigValuePanel', () => {
  test('renders label and formatted value', () => {
    render(<BigValuePanel title="Total Orders" value={1500} format="number" />);
    expect(screen.getByText('Total Orders')).toBeTruthy();
    expect(screen.getByText('1.5K')).toBeTruthy();
  });

  test('shows -- for null value', () => {
    render(<BigValuePanel title="Revenue" value={null} format="currency" />);
    expect(screen.getByText('--')).toBeTruthy();
  });

  test('formats currency values compactly', () => {
    render(<BigValuePanel title="Revenue" value={2_300_000} format="currency" />);
    expect(screen.getByText('$2.3M')).toBeTruthy();
  });

  test('renders string values as-is', () => {
    render(<BigValuePanel title="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });
});
