import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ScoutPanel } from '../../../components/ui/ScoutPanel';
import { get30DayPriceHistory } from '../../../lib/price-history';

vi.mock('../../../lib/price-history', () => ({
  get30DayPriceHistory: vi.fn(),
}));

// mock ResponsiveContainer to avoid ResizeObserver error in tests
vi.mock('recharts', async () => {
  const OriginalRechartsModule = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...OriginalRechartsModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 800 }}>{children}</div>
    ),
  };
});

describe('ScoutPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    asin: 'B012345678',
    trueValue: 85,
    personalFit: 92,
    onClose: vi.fn(),
  };

  it('renders scores correctly', () => {
    render(<ScoutPanel {...defaultProps} />);

    expect(screen.getByText('True Value')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();

    expect(screen.getByText('Personal Fit')).toBeTruthy();
    expect(screen.getByText('92')).toBeTruthy();
  });

  it('renders feedback buttons', () => {
    render(<ScoutPanel {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Not Interested' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Purchased' })).toBeTruthy();
  });

  it('triggers onClose when close button is clicked', () => {
    render(<ScoutPanel {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onFeedback when feedback buttons are clicked', () => {
    const onFeedback = vi.fn();
    render(<ScoutPanel {...defaultProps} onFeedback={onFeedback} />);

    fireEvent.click(screen.getByRole('button', { name: 'Not Interested' }));
    expect(onFeedback).toHaveBeenCalledWith('not_interested');

    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    expect(onFeedback).toHaveBeenCalledWith('saved');

    fireEvent.click(screen.getByRole('button', { name: 'Purchased' }));
    expect(onFeedback).toHaveBeenCalledWith('purchased');
  });

  it('renders View Price History toggle and handles click', async () => {
    const mockData = [
      { date: Date.now() - 86400000, price: 100 },
      { date: Date.now(), price: 95 },
    ];
    vi.mocked(get30DayPriceHistory).mockResolvedValue(mockData);

    render(<ScoutPanel {...defaultProps} />);

    // Toggle button should be present
    const toggleButton = screen.getByRole('button', { name: /View Price History/i });
    expect(toggleButton).toBeTruthy();

    // Click to show history
    fireEvent.click(toggleButton);

    // Should fetch history
    expect(get30DayPriceHistory).toHaveBeenCalledWith(defaultProps.asin);

    // Wait for the chart to be rendered
    await waitFor(() => {
      expect(screen.getByText('30-Day Price Trend')).toBeTruthy();
    });

    // Toggle again to hide
    fireEvent.click(toggleButton);

    // Chart container should have opacity-0 to be hidden with transition
    const chartTitle = screen.getByText('30-Day Price Trend');
    const container = chartTitle.closest('.overflow-hidden');
    expect(container?.className).toContain('opacity-0');
  });
});
