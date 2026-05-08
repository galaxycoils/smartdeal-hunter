import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ScoutPanel } from '../../../components/ui/ScoutPanel';
import { get30DayPriceHistory } from '../../../lib/price-history';
import type { ReviewSample } from '../../../lib/types';

vi.mock('../../../lib/price-history', () => ({
  get30DayPriceHistory: vi.fn(),
}));

vi.mock('../../../lib/review-extractor', () => ({
  extractReviews: vi.fn(() => []),
}));

import { extractReviews } from '../../../lib/review-extractor';

declare const __chromeTestHarness: {
  setNotificationPermissionLevel: (level: 'granted' | 'denied') => void;
};

const sendMessageMock = vi.fn();
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { sendMessage: (...args: unknown[]) => sendMessageMock(...args) },
  },
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
  beforeEach(() => {
    sendMessageMock.mockReset();
    sendMessageMock.mockResolvedValue({ type: 'ENROLLED_ALERTS', payload: { asins: [] } });
    __chromeTestHarness.setNotificationPermissionLevel('granted');
  });
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

  describe('Watch toggle (price alert)', () => {
    it('renders Watch button and queries enrollment on mount', async () => {
      render(<ScoutPanel {...defaultProps} />);
      await waitFor(() =>
        expect(sendMessageMock).toHaveBeenCalledWith({ type: 'LIST_ENROLLED_ALERTS' }),
      );
      expect(screen.getByRole('button', { name: /watch/i })).toBeTruthy();
    });

    it('shows "Stop watching" when ASIN already enrolled', async () => {
      sendMessageMock.mockResolvedValue({
        type: 'ENROLLED_ALERTS',
        payload: { asins: [defaultProps.asin] },
      });
      render(<ScoutPanel {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop watching/i })).toBeTruthy();
      });
    });

    it('dispatches ENROLL_ALERT on click when not enrolled', async () => {
      render(<ScoutPanel {...defaultProps} />);
      await waitFor(() => screen.getByRole('button', { name: /watch/i }));
      sendMessageMock.mockClear();
      sendMessageMock.mockResolvedValue({ success: true });

      fireEvent.click(screen.getByRole('button', { name: /watch/i }));

      await waitFor(() =>
        expect(sendMessageMock).toHaveBeenCalledWith({
          type: 'ENROLL_ALERT',
          payload: { asin: defaultProps.asin },
        }),
      );
    });

    it('dispatches DISENROLL_ALERT on click when enrolled', async () => {
      sendMessageMock.mockResolvedValue({
        type: 'ENROLLED_ALERTS',
        payload: { asins: [defaultProps.asin] },
      });
      render(<ScoutPanel {...defaultProps} />);
      await waitFor(() => screen.getByRole('button', { name: /stop watching/i }));
      sendMessageMock.mockClear();
      sendMessageMock.mockResolvedValue({ success: true });

      fireEvent.click(screen.getByRole('button', { name: /stop watching/i }));

      await waitFor(() =>
        expect(sendMessageMock).toHaveBeenCalledWith({
          type: 'DISENROLL_ALERT',
          payload: { asin: defaultProps.asin },
        }),
      );
    });

    it('disables toggle when notification permission is denied', async () => {
      __chromeTestHarness.setNotificationPermissionLevel('denied');
      render(<ScoutPanel {...defaultProps} />);
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /watch/i }) as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
      });
    });
  });

  describe('Review authenticity row', () => {
    const makeReviewSamples = (count: number): ReviewSample[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `r${i}`,
        title: `Review ${i}`,
        body: `Body content for review ${i}`.padEnd(50, '.'),
        rating: 4,
        date: '2024-01-01',
        helpful: 0,
        verified: true,
      }));

    beforeEach(() => {
      vi.mocked(extractReviews).mockReturnValue([]);
    });

    it('row hidden when sampleCount < 5', async () => {
      vi.mocked(extractReviews).mockReturnValue(makeReviewSamples(3));
      render(<ScoutPanel {...defaultProps} />);
      // Let any async effects settle
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(/authentic/i)).toBeNull();
    });

    it('row visible with score and exact sample-size text', async () => {
      vi.mocked(extractReviews).mockReturnValue(makeReviewSamples(12));
      const chromeSendMessage = vi.fn().mockResolvedValue({
        type: 'AUTHENTICITY_RESULT',
        payload: {
          score: 78,
          sampleCount: 12,
          suspiciousIndices: [],
          reasons: {},
        },
      });
      (
        globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }
      ).chrome.runtime.sendMessage = chromeSendMessage;

      render(<ScoutPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/78/)).toBeTruthy();
        expect(screen.getByText('based on 12 visible reviews')).toBeTruthy();
      });

      // Must NOT claim totals
      expect(screen.queryByText(/12 reviews total/i)).toBeNull();
    });

    it('"Why?" disclosure renders top 3 reasons and no more', async () => {
      vi.mocked(extractReviews).mockReturnValue(makeReviewSamples(10));
      const chromeSendMessage = vi.fn().mockResolvedValue({
        type: 'AUTHENTICITY_RESULT',
        payload: {
          score: 45,
          sampleCount: 10,
          suspiciousIndices: [0, 2, 5],
          reasons: {
            0: ['duplicate body content'],
            2: ['5-star with very short body'],
            5: ['posted in 24h cluster'],
          },
        },
      });
      (
        globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }
      ).chrome.runtime.sendMessage = chromeSendMessage;

      render(<ScoutPanel {...defaultProps} />);

      await waitFor(() => expect(screen.getByText(/Why\?/i)).toBeTruthy());

      fireEvent.click(screen.getByText(/Why\?/i));

      expect(screen.getByText('duplicate body content')).toBeTruthy();
      expect(screen.getByText('5-star with very short body')).toBeTruthy();
      expect(screen.getByText('posted in 24h cluster')).toBeTruthy();
    });

    it('component cache: same ASIN triggers sendMessage once, new ASIN triggers again', async () => {
      vi.mocked(extractReviews).mockReturnValue(makeReviewSamples(8));
      const chromeSendMessage = vi.fn().mockResolvedValue({
        type: 'AUTHENTICITY_RESULT',
        payload: { score: 70, sampleCount: 8, suspiciousIndices: [], reasons: {} },
      });
      (
        globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }
      ).chrome.runtime.sendMessage = chromeSendMessage;

      const { rerender } = render(<ScoutPanel {...defaultProps} asin="B012345678" />);

      await waitFor(() =>
        expect(chromeSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'COMPUTE_AUTHENTICITY' }),
        ),
      );

      // Force re-render with same ASIN — should NOT trigger another sendMessage
      rerender(<ScoutPanel {...defaultProps} asin="B012345678" />);
      await new Promise((r) => setTimeout(r, 20));

      const callsAfterSameAsin = chromeSendMessage.mock.calls.filter(
        (c: unknown[]) =>
          (c[0] as { type: string }).type === 'COMPUTE_AUTHENTICITY' &&
          (c[0] as { payload: { asin: string } }).payload.asin === 'B012345678',
      );
      expect(callsAfterSameAsin).toHaveLength(1);

      // Change ASIN — must trigger a new sendMessage
      rerender(<ScoutPanel {...defaultProps} asin="B999999999" />);

      await waitFor(() => {
        const newAsinCalls = chromeSendMessage.mock.calls.filter(
          (c: unknown[]) =>
            (c[0] as { type: string }).type === 'COMPUTE_AUTHENTICITY' &&
            (c[0] as { payload: { asin: string } }).payload.asin === 'B999999999',
        );
        expect(newAsinCalls).toHaveLength(1);
      });
    });
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
