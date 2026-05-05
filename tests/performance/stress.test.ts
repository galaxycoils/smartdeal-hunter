import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { deepCheck } from '../../lib/deep-check';
import { AnalysisCacheManager } from '../../lib/analysis-cache';
import { deriveKey } from '../../lib/crypto';
import { setEncryptedItem, STORE_OAUTH } from '../../lib/storage';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';

describe('Stress Tests', () => {
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    const salt = new Uint8Array(16);
    sharedKey = await deriveKey('test-pw', salt);
  });

  beforeEach(() => {
    resetIndexedDbMock();
  });

  it('handles 100 cache writes/reads rapidly', async () => {
    const cache = new AnalysisCacheManager(sharedKey);
    const start = performance.now();
    await Promise.all(
      Array.from({ length: 100 }).map(async (_, i) => {
        await cache.set(`B000${i}`, {
          trueValue: 50,
          personalFit: 0.8,
          timestamp: Date.now(),
        });
        await cache.get(`B000${i}`);
      }),
    );
    const end = performance.now();
    expect(end - start).toBeLessThan(1000);
  });

  it('handles deep check rate limits safely under load', async () => {
    await chrome.storage.local.set({ optInDeepCheck: true });

    // We expect some to fail with rate limits
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ asin: 'B001', price: 99 }),
    });

    // Reset rate window to avoid test bleed
    await chrome.storage.local.set({ 'sdh:deep-check-rate-window': [] });

    // Give it valid encrypted tokens so requests succeed
    await setEncryptedItem(
      STORE_OAUTH,
      'tokens',
      { accessToken: 'x', refreshToken: 'y', expiresAt: 100 },
      sharedKey,
    );

    let rateLimitedCount = 0;
    for (let i = 0; i < 20; i++) {
      try {
        await deepCheck(`A000${i}`, sharedKey, { fetchImpl });
      } catch (e) {
        if (e && typeof e === 'object' && 'name' in e && e.name === 'DeepCheckRateLimitedError') {
          rateLimitedCount++;
        } else {
          console.error('Other error:', e);
        }
      }
    }

    // Rate limit is 10/min, so we should get rate limits for 10
    expect(rateLimitedCount).toBeGreaterThanOrEqual(10);
  });
});
