import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../../../entrypoints/options/App';
import * as storage from '../../../lib/storage';
import * as genome from '../../../lib/genome';
import { browser } from 'wxt/browser';

const { makeGenome } = vi.hoisted(() => ({
  makeGenome: (revision: number) => ({
    constDimensions: [
      'price_sensitivity',
      'brand_affinity',
      'quality_priority',
      'sustainability',
      'novelty_seeking',
      'review_weight',
      'discount_sensitivity',
      'category_diversity',
    ],
    version: 1 as const,
    revision,
    isOnboarded: true,
    dimensions: [
      'price_sensitivity',
      'brand_affinity',
      'quality_priority',
      'sustainability',
      'novelty_seeking',
      'review_weight',
      'discount_sensitivity',
      'category_diversity',
    ].reduce(
      (acc, dim) => {
        acc[dim] = { value: 0.5, weight: 1 / 8 };
        return acc;
      },
      {} as Record<string, { value: number; weight: number }>,
    ),
    bandit: {
      pulls: [
        'price_sensitivity',
        'brand_affinity',
        'quality_priority',
        'sustainability',
        'novelty_seeking',
        'review_weight',
        'discount_sensitivity',
        'category_diversity',
      ].reduce(
        (acc, dim) => {
          acc[dim] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
      rewards: [
        'price_sensitivity',
        'brand_affinity',
        'quality_priority',
        'sustainability',
        'novelty_seeking',
        'review_weight',
        'discount_sensitivity',
        'category_diversity',
      ].reduce(
        (acc, dim) => {
          acc[dim] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
    createdAt: 0,
    updatedAt: 0,
  }),
}));

// Mock dependencies
vi.mock('../../../lib/storage', () => ({
  wipeAllData: vi.fn(),
}));

vi.mock('../../../lib/crypto', () => ({
  deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
}));

vi.mock('../../../lib/genome', () => ({
  defaultGenome: vi.fn(() => makeGenome(1)),
  loadGenome: vi.fn().mockResolvedValueOnce(makeGenome(1)).mockResolvedValueOnce(makeGenome(2)),
  saveGenome: vi.fn().mockResolvedValue(undefined),
  onGenomeChange: vi.fn((callback: (revision: number) => void) => {
    chrome.storage.onChanged.addListener(
      (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local' && typeof changes['sdh:genome-revision']?.newValue === 'number') {
          callback(changes['sdh:genome-revision']?.newValue as number);
        }
      },
    );
    return vi.fn();
  }),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
      sendMessage: vi.fn(),
    },
  },
}));

describe('Options App', () => {
  let originalConfirm: typeof window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
    originalConfirm = window.confirm;
  });

  afterEach(() => {
    cleanup();
    window.confirm = originalConfirm;
  });

  it('renders tabs and defaults to privacy tab', () => {
    render(<App />);
    expect(screen.getByText('SmartDeal Hunter Settings')).toBeDefined();

    // Privacy tab should be visible
    expect(screen.getByText('Privacy & Compliance')).toBeDefined();
    expect(screen.getByText('Export Your Data')).toBeDefined();
  });

  it('switches tabs when clicked', () => {
    render(<App />);

    // Switch to Settings
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Settings coming soon...')).toBeDefined();

    // Switch to DeepCheck
    fireEvent.click(screen.getByText('DeepCheck'));
    expect(screen.getByText('Amazon Creators API')).toBeDefined();
  });

  it('handles data wipe', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(storage.wipeAllData).mockResolvedValue();
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);

    render(<App />);

    const wipeBtn = screen.getByText('Wipe All Data');
    await fireEvent.click(wipeBtn);

    expect(storage.wipeAllData).toHaveBeenCalled();
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'DATA_WIPED' });

    // Check success message
    expect(await screen.findByText('All data has been successfully wiped.')).toBeDefined();
  });

  it('cancels data wipe if user clicks cancel on confirm', async () => {
    window.confirm = vi.fn().mockReturnValue(false);

    render(<App />);

    const wipeBtn = screen.getByText('Wipe All Data');
    await fireEvent.click(wipeBtn);

    expect(storage.wipeAllData).not.toHaveBeenCalled();
  });

  it('reloads genome state when the revision sentinel changes', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Genome'));
    const initialCalls = vi.mocked(genome.loadGenome).mock.calls.length;
    await chrome.storage.local.set({ 'sdh:genome-revision': 2 });

    expect(vi.mocked(genome.loadGenome).mock.calls.length).toBeGreaterThan(initialCalls);
  });
});
