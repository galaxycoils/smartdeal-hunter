import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { deriveKey } from '../../lib/crypto';
import { AnalysisCacheManager } from '../../lib/analysis-cache';
import { DeepCheckCache } from '../../lib/deep-check-cache';
import { getItem, STORE_ANALYSIS_CACHE } from '../../lib/storage';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';

describe('DeepCheckCache', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    key = await deriveKey('cache-test', new Uint8Array(16));
  });

  beforeEach(() => {
    resetIndexedDbMock();
  });

  it('stores and retrieves deep-check results with a dedicated metadata key', async () => {
    const cache = new DeepCheckCache(key, 3_600_000);

    await cache.set('B0001', { price: 19.99 });

    await expect(cache.get('B0001')).resolves.toEqual({ price: 19.99 });
    await expect(getItem(STORE_ANALYSIS_CACHE, '__dc_metadata__')).resolves.toEqual({
      'dc:B0001': { timestamp: expect.any(Number) },
    });
  });

  it('expires stale entries based on ttl', async () => {
    const cache = new DeepCheckCache(key, 1);
    await cache.set('B0001', { price: 19.99 });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(cache.get('B0001')).resolves.toBeUndefined();
  });

  it('coexists with AnalysisCacheManager without metadata collisions', async () => {
    const deepCheckCache = new DeepCheckCache(key, 3_600_000);
    const analysisCache = new AnalysisCacheManager(key, 3_600_000);

    await deepCheckCache.set('B0001', { livePrice: 19.99 });
    await analysisCache.set('B0001', { score: 88 });

    await expect(deepCheckCache.get('B0001')).resolves.toEqual({ livePrice: 19.99 });
    await expect(analysisCache.get('B0001')).resolves.toEqual({ score: 88 });
    await expect(getItem(STORE_ANALYSIS_CACHE, '__dc_metadata__')).resolves.toEqual({
      'dc:B0001': { timestamp: expect.any(Number) },
    });
    await expect(getItem(STORE_ANALYSIS_CACHE, '__metadata__')).resolves.toEqual({
      B0001: { timestamp: expect.any(Number) },
    });
  });

  it('flushes deep-check entries without touching standard analysis metadata', async () => {
    const deepCheckCache = new DeepCheckCache(key, 3_600_000);
    const analysisCache = new AnalysisCacheManager(key, 3_600_000);

    await deepCheckCache.set('B0001', { livePrice: 19.99 });
    await analysisCache.set('B0001', { score: 88 });

    await deepCheckCache.flush();

    await expect(deepCheckCache.get('B0001')).resolves.toBeUndefined();
    await expect(analysisCache.get('B0001')).resolves.toEqual({ score: 88 });
  });

  it('removes missing entries without rewriting metadata', async () => {
    const cache = new DeepCheckCache(key, 3_600_000);
    await expect(cache.remove('missing')).resolves.toBeUndefined();
  });
});
