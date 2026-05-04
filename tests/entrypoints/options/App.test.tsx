import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../../../entrypoints/options/App';
import * as storage from '../../../lib/storage';
import { browser } from 'wxt/browser';

// Mock dependencies
vi.mock('../../../lib/storage', () => ({
  wipeAllData: vi.fn(),
}));

vi.mock('../../../lib/crypto', () => ({
  deriveKey: vi.fn(),
}));

vi.mock('../../../lib/genome', () => ({
  loadGenome: vi.fn(),
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
});
