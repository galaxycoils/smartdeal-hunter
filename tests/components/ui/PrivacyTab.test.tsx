import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrivacyTab } from '../../../components/ui/PrivacyTab';
import * as storage from '../../../lib/storage';
import * as genome from '../../../lib/genome';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('../../../lib/storage', () => ({
  wipeAllData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/crypto', () => ({
  deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
}));

vi.mock('../../../lib/genome', () => ({
  loadGenome: vi.fn().mockResolvedValue({ version: 1, revision: 1 }),
}));

describe('PrivacyTab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await chrome.storage.local.clear();
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('loads toggles defaulted to false and persists changes', async () => {
    render(<PrivacyTab />);

    const deepCheckToggle = await screen.findByLabelText('Enable Deep Check');
    const auditLogToggle = await screen.findByLabelText('Enable Audit Log');
    const genomeSyncToggle = await screen.findByLabelText('Enable Genome Sync');

    expect(deepCheckToggle).not.toBeChecked();
    expect(auditLogToggle).not.toBeChecked();
    expect(genomeSyncToggle).not.toBeChecked();

    fireEvent.click(deepCheckToggle);
    fireEvent.click(auditLogToggle);
    fireEvent.click(genomeSyncToggle);

    await waitFor(async () => {
      const stored = await chrome.storage.local.get([
        'optInDeepCheck',
        'optInAuditLog',
        'optInGenomeSync',
      ]);
      expect(stored.optInDeepCheck).toBe(true);
      expect(stored.optInAuditLog).toBe(true);
      expect(stored.optInGenomeSync).toBe(true);
    });
  });

  it('shows the paused-audit-log banner when entries exist and logging is disabled', async () => {
    await chrome.storage.local.set({
      optInAuditLog: false,
      'sdh:audit-log': [{ ts: 1, kind: 'deep-check', summary: 'asin=B0001' }],
    });

    render(<PrivacyTab />);

    expect(
      await screen.findByText(
        'Audit log paused. Existing entries retained. Use Wipe All Data to clear.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('asin=B0001')).toBeInTheDocument();
  });

  it('renders the latest audit log entries', async () => {
    await chrome.storage.local.set({
      optInAuditLog: true,
      'sdh:audit-log': [
        { ts: 1, kind: 'deep-check', summary: 'asin=B0001' },
        { ts: 2, kind: 'deep-check', summary: 'asin=B0002' },
      ],
    });

    render(<PrivacyTab />);

    expect(await screen.findByText('asin=B0001')).toBeInTheDocument();
    expect(screen.getByText('asin=B0002')).toBeInTheDocument();
  });

  it('registers a scheduled wipe alarm', async () => {
    const createSpy = vi.spyOn(chrome.alarms, 'create');
    render(<PrivacyTab />);

    fireEvent.change(await screen.findByLabelText('Schedule wipe in seconds'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Wipe' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith('sdh:scheduled-wipe', {
        when: expect.any(Number),
      });
    });
  });

  it('exports the genome payload successfully', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<PrivacyTab />);

    fireEvent.click(await screen.findByText('Export Genome'));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  it('shows an alert when export fails', async () => {
    vi.mocked(genome.loadGenome).mockRejectedValueOnce(new Error('export failed'));
    render(<PrivacyTab />);

    fireEvent.click(await screen.findByText('Export Genome'));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith('Failed to export data.');
    });
  });

  it('does not wipe when the confirmation is cancelled', async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    render(<PrivacyTab />);

    fireEvent.click(await screen.findByText('Wipe All Data'));

    expect(storage.wipeAllData).not.toHaveBeenCalled();
  });

  it('handles wipe all data after confirmation', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    render(<PrivacyTab />);

    fireEvent.click(await screen.findByText('Wipe All Data'));

    await waitFor(() => {
      expect(storage.wipeAllData).toHaveBeenCalled();
    });
  });

  it('shows an alert when wiping data fails', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(storage.wipeAllData).mockRejectedValueOnce(new Error('wipe failed'));
    render(<PrivacyTab />);

    fireEvent.click(await screen.findByText('Wipe All Data'));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith('Failed to wipe data.');
    });
  });
});
