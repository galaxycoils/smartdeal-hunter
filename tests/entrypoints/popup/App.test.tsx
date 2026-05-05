import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../../entrypoints/popup/App';

vi.mock('../../../entrypoints/popup/Onboarding', () => ({
  Onboarding: () => <div>Onboarding Mock</div>,
}));

vi.mock('../../../entrypoints/popup/Dashboard', () => ({
  Dashboard: ({ genome }: { genome: { revision?: number } }) => (
    <div>Dashboard revision {genome.revision}</div>
  ),
}));

vi.mock('../../../lib/crypto', () => ({
  deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
}));

vi.mock('../../../lib/genome', () => ({
  loadGenome: vi
    .fn()
    .mockResolvedValueOnce({ isOnboarded: true, revision: 1 })
    .mockResolvedValueOnce({ isOnboarded: true, revision: 2 }),
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

describe('Popup App genome sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads the genome when the revision sentinel changes', async () => {
    render(<App />);

    expect(await screen.findByText('Dashboard revision 1')).toBeInTheDocument();

    await chrome.storage.local.set({ 'sdh:genome-revision': 2 });

    await waitFor(() => {
      expect(screen.getByText('Dashboard revision 2')).toBeInTheDocument();
    });
  });
});
