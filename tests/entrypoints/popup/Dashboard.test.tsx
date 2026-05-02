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
  },
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders genome summary with top dimensions', () => {
    const genome = defaultGenome();
    // Modify weights to ensure sorting works
    genome.dimensions.price_sensitivity.weight = 0.5;
    genome.dimensions.quality_priority.weight = 0.3;
    genome.dimensions.brand_affinity.weight = 0.2;

    render(<Dashboard genome={genome} />);

    expect(screen.getByText('Genome Summary')).toBeDefined();
    expect(screen.getByText('Price Sensitivity')).toBeDefined();
    expect(screen.getByText('50.0%')).toBeDefined();
    expect(screen.getByText('Quality Priority')).toBeDefined();
    expect(screen.getByText('30.0%')).toBeDefined();
    expect(screen.getByText('Brand Affinity')).toBeDefined();
    expect(screen.getByText('20.0%')).toBeDefined();
  });

  it('fires SCRAPE_REQUEST message on Quick Scout click', async () => {
    const genome = defaultGenome();
    render(<Dashboard genome={genome} />);

    const button = screen.getByRole('button', { name: /quick scout/i });
    fireEvent.click(button);

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SCRAPE_REQUEST',
    });
  });

  it('renders recent analyses stub', () => {
    const genome = defaultGenome();
    render(<Dashboard genome={genome} />);

    expect(screen.getByText('Recent Analyses')).toBeDefined();
    expect(screen.getByText('No recent analyses found.')).toBeDefined();
  });
});
