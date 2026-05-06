import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Dashboard } from '../../../entrypoints/popup/Dashboard';
import { defaultGenome } from '../../../lib/genome';
import { browser } from 'wxt/browser';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
    tabs: {
      query: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const AMAZON_TAB = { id: 1, url: 'https://www.amazon.com/dp/B08N5WRWNW' };

function setActiveTab(tab: { id?: number; url?: string }) {
  (browser.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([tab]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Dashboard International', () => {
  it('renders currency formatting for success result', async () => {
    setActiveTab(AMAZON_TAB);
    const mockPayload = {
      asin: 'B08N5WRWNW',
      trueValue: 82,
      personalFit: 71,
      price: 99.99,
      currency: 'USD',
      region: 'US',
    };
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      payload: mockPayload,
    });

    render(<Dashboard genome={defaultGenome()} />);
    const button = await screen.findByRole('button', { name: /quick scout/i });
    fireEvent.click(button);

    // Verify badge
    expect(await screen.findByText('US')).toBeInTheDocument();
    // Verify formatted price
    expect(screen.getByText((content) => content.includes('99.99'))).toBeInTheDocument();
  });
});
