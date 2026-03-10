import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test-utils';
import PanelWrapper from './PanelWrapper';

describe('PanelWrapper', () => {
  test('renders title and children when not loading or error', () => {
    render(
      <PanelWrapper title="Test Panel" loading={false}>
        <p>Panel content</p>
      </PanelWrapper>,
    );
    expect(screen.getByText('Test Panel')).toBeTruthy();
    expect(screen.getByText('Panel content')).toBeTruthy();
  });

  test('shows loading state when loading', () => {
    render(
      <PanelWrapper title="Loading Panel" loading={true}>
        <p>Should not appear</p>
      </PanelWrapper>,
    );
    expect(screen.queryByText('Should not appear')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  test('shows error message and retry button when error prop set', () => {
    const onRetry = vi.fn();
    render(
      <PanelWrapper
        title="Error Panel"
        loading={false}
        error={{ error: 'Something broke', error_type: 'query_error' }}
        onRetry={onRetry}
      >
        <p>Should not appear</p>
      </PanelWrapper>,
    );
    expect(screen.queryByText('Should not appear')).toBeNull();
    expect(screen.getByText('Something broke')).toBeTruthy();
    expect(screen.getByText('query_error')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  test('retry button calls onRetry', () => {
    const onRetry = vi.fn();
    render(
      <PanelWrapper
        title="Error Panel"
        loading={false}
        error={{ error: 'fail', error_type: 'timeout' }}
        onRetry={onRetry}
      >
        <p>child</p>
      </PanelWrapper>,
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('does not show retry button when onRetry not provided', () => {
    render(
      <PanelWrapper
        title="Error Panel"
        loading={false}
        error={{ error: 'fail', error_type: 'timeout' }}
      >
        <p>child</p>
      </PanelWrapper>,
    );
    expect(screen.queryByText('Retry')).toBeNull();
  });
});
