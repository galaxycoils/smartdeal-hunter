import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
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
const NON_AMAZON_TAB = { id: 2, url: 'https://example.com/' };

function setActiveTab(tab: { id?: number; url?: string }) {
  (browser.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([tab]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Dashboard', () => {
  it('renders top genome priorities', async () => {
    setActiveTab(AMAZON_TAB);
    const genome = defaultGenome();
    genome.dimensions.price_sensitivity.weight = 0.5;
    genome.dimensions.quality_priority.weight = 0.3;
    genome.dimensions.brand_affinity.weight = 0.2;
    render(<Dashboard genome={genome} />);

    expect(screen.getByText(/top genome priorities/i)).toBeInTheDocument();
    expect(screen.getByText('Price Sensitivity')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Quality Priority')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Brand Affinity')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('disables Quick Scout when active tab is not an Amazon product page', async () => {
    setActiveTab(NON_AMAZON_TAB);
    render(<Dashboard genome={defaultGenome()} />);

    const button = await screen.findByRole('button', { name: /quick scout/i });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText(/open an amazon product page/i)).toBeInTheDocument();
  });

  it('enables Quick Scout on Amazon product page and fires SCRAPE_REQUEST', async () => {
    setActiveTab(AMAZON_TAB);
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      payload: { asin: 'B08N5WRWNW', trueValue: 82, personalFit: 71 },
    });

    render(<Dashboard genome={defaultGenome()} />);
    const button = await screen.findByRole('button', { name: /quick scout/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'SCRAPE_REQUEST' });
  });

  it('shows loading state while scouting', async () => {
    setActiveTab(AMAZON_TAB);
    let resolve: (v: unknown) => void = () => {};
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<Dashboard genome={defaultGenome()} />);
    const button = await screen.findByRole('button', { name: /quick scout/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    expect(await screen.findByRole('button', { name: /scouting/i })).toBeDisabled();
    resolve({ success: true, payload: { asin: 'B0', trueValue: 50, personalFit: 50 } });
  });

  it('renders score result on success', async () => {
    setActiveTab(AMAZON_TAB);
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      payload: { asin: 'B08N5WRWNW', trueValue: 82, personalFit: 71 },
    });

    render(<Dashboard genome={defaultGenome()} />);
    const button = await screen.findByRole('button', { name: /quick scout/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    expect(await screen.findByText(/scout result/i)).toBeInTheDocument();
    expect(screen.getAllByText('82').length).toBeGreaterThan(0);
    expect(screen.getAllByText('71').length).toBeGreaterThan(0);
    expect(screen.getByText('B08N5WRWNW')).toBeInTheDocument();
  });

  it('renders error state when response is failure', async () => {
    setActiveTab(AMAZON_TAB);
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'No active tab found',
    });

    render(<Dashboard genome={defaultGenome()} />);
    const button = await screen.findByRole('button', { name: /quick scout/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    expect(await screen.findByText(/scout failed/i)).toBeInTheDocument();
    expect(screen.getByText('No active tab found')).toBeInTheDocument();
  });

  it('renders error state when sendMessage rejects', async () => {
    setActiveTab(AMAZON_TAB);
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    render(<Dashboard genome={defaultGenome()} />);
    const button = await screen.findByRole('button', { name: /quick scout/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    expect(await screen.findByText(/scout failed/i)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders idle empty state by default', async () => {
    setActiveTab(AMAZON_TAB);
    render(<Dashboard genome={defaultGenome()} />);
    expect(await screen.findByText(/no recent analyses/i)).toBeInTheDocument();
  });
});
