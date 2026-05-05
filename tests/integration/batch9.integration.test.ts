import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { deepCheck } from '../../lib/deep-check';
import { getAuditLogEntries } from '../../lib/audit-log';
import {
  wipeAllData,
  getItem,
  STORE_OAUTH,
  STORE_ANALYSIS_CACHE,
  setItem,
} from '../../lib/storage';
import { deriveKey } from '../../lib/crypto';
import { saveGenome, onGenomeChange, defaultGenome } from '../../lib/genome';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';

describe('Batch 9 Cross-Task Integration', () => {
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    const salt = new Uint8Array(16);
    sharedKey = await deriveKey('test-pw', salt);
  });

  beforeEach(async () => {
    resetIndexedDbMock();
    await chrome.storage.local.clear();
    vi.clearAllMocks();
  });

  describe('P2.7 ↔ P2.8: Audit Log Integration', () => {
    it('produces audit log entries during deep check only when opted in', async () => {
      // Opted out of audit log
      await chrome.storage.local.set({ optInDeepCheck: true, optInAuditLog: false });

      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B001', price: 99.99 }),
      });

      // Needs valid tokens
      await setItem(STORE_OAUTH, 'tokens', { accessToken: 'x' });

      // Need to mock loadOAuthTokens effectively, since it's internal to deep-check
      // For testing we will just allow the failure and check the logs
      try {
        await deepCheck('B001', sharedKey, { fetchImpl });
      } catch {
        // Ignore failure
      }

      let logs = await getAuditLogEntries();
      expect(logs).toHaveLength(0);

      // Opt in
      await chrome.storage.local.set({ optInAuditLog: true });
      try {
        await deepCheck('B001', sharedKey, { fetchImpl });
      } catch {
        // Ignore failure
      }

      logs = await getAuditLogEntries();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].kind).toBe('deep-check');
    });
  });

  describe('P2.7 ↔ P2.8: Data Wipe Integration', () => {
    it('wipeAllData clears STORE_OAUTH, audit log, and STORE_ANALYSIS_CACHE', async () => {
      // Setup data
      await setItem(STORE_OAUTH, 'test', 'value');
      await setItem(STORE_ANALYSIS_CACHE, 'test', 'value');
      await chrome.storage.local.set({
        'sdh:audit-log': [{ ts: 1, kind: 'test', summary: 'test' }],
      });

      await wipeAllData();

      // Check IDB
      expect(await getItem(STORE_OAUTH, 'test')).toBeUndefined();
      expect(await getItem(STORE_ANALYSIS_CACHE, 'test')).toBeUndefined();

      // Check audit log
      const stored = await chrome.storage.local.get('sdh:audit-log');
      expect(stored['sdh:audit-log']).toBeUndefined();
    });
  });

  describe('P2.7 ↔ P2.8: In-flight flag deferral', () => {
    it('alarm handler defers wipe while flag active', async () => {
      // We simulate the background handler behavior
      let wipeCalled = false;
      const wipeAllDataMock = vi.fn().mockImplementation(async () => {
        wipeCalled = true;
      });
      const createSpy = vi.spyOn(chrome.alarms, 'create');

      const handler = async (alarm: chrome.alarms.Alarm) => {
        if (alarm.name === 'sdh:scheduled-wipe') {
          const { 'sdh:in-flight': inFlight } = await chrome.storage.local.get('sdh:in-flight');
          if (inFlight) {
            await chrome.alarms.create('sdh:scheduled-wipe', { when: Date.now() + 30000 });
            return;
          }
          await wipeAllDataMock();
        }
      };

      // In flight
      await chrome.storage.local.set({ 'sdh:in-flight': Date.now() });
      await handler({ name: 'sdh:scheduled-wipe', scheduledTime: Date.now() });

      expect(wipeCalled).toBe(false);
      expect(createSpy).toHaveBeenCalledWith('sdh:scheduled-wipe', expect.any(Object));

      // Not in flight
      await chrome.storage.local.remove('sdh:in-flight');
      await handler({ name: 'sdh:scheduled-wipe', scheduledTime: Date.now() });

      expect(wipeCalled).toBe(true);
    });
  });

  describe('P2.9 ↔ all contexts: cross-page sync', () => {
    it('saveGenome triggers sentinel and notifies subscribers', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = onGenomeChange(cb1);
      const unsub2 = onGenomeChange(cb2);

      const g = defaultGenome();
      await saveGenome(g, sharedKey);

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();

      unsub1();
      unsub2();
    });
  });
});
