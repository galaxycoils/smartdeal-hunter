import { describe, it, expect, beforeEach } from 'vitest';
import { appendAuditLog, getAuditLogEntries, AUDIT_LOG_KEY } from '../../lib/audit-log';

describe('Audit Log', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  it('does not append when opt-in is disabled', async () => {
    await chrome.storage.local.set({ optInAuditLog: false });

    await appendAuditLog({ kind: 'deep-check', summary: 'asin=B0001' });

    const stored = await chrome.storage.local.get(AUDIT_LOG_KEY);
    expect(stored[AUDIT_LOG_KEY]).toBeUndefined();
  });

  it('appends entries when opt-in is enabled', async () => {
    await chrome.storage.local.set({ optInAuditLog: true });

    await appendAuditLog({ kind: 'deep-check', summary: 'asin=B0001' });

    await expect(getAuditLogEntries()).resolves.toEqual([
      expect.objectContaining({
        kind: 'deep-check',
        summary: 'asin=B0001',
        ts: expect.any(Number),
      }),
    ]);
  });

  it('retains existing entries when opt-in is turned off', async () => {
    await chrome.storage.local.set({ optInAuditLog: true });
    await appendAuditLog({ kind: 'deep-check', summary: 'asin=B0001' });
    await chrome.storage.local.set({ optInAuditLog: false });

    await appendAuditLog({ kind: 'deep-check', summary: 'asin=B0002' });

    await expect(getAuditLogEntries()).resolves.toHaveLength(1);
  });

  it('evicts older entries once the ring buffer exceeds 500 items', async () => {
    await chrome.storage.local.set({ optInAuditLog: true });

    for (let index = 0; index < 505; index += 1) {
      await appendAuditLog({ kind: 'deep-check', summary: `asin=${index}` });
    }

    const entries = await getAuditLogEntries(500);
    expect(entries).toHaveLength(500);
    expect(entries[0]?.summary).toBe('asin=5');
    expect(entries.at(-1)?.summary).toBe('asin=504');
  });
});
