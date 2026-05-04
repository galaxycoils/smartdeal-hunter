import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalysisCacheManager } from '../../lib/analysis-cache';
import {
  setItem,
  getItem,
  deleteItem,
  setEncryptedItem,
  getEncryptedItem,
  STORE_ANALYSIS_CACHE,
} from '../../lib/storage';

// Mock storage module
vi.mock('../../lib/storage', () => ({
  setItem: vi.fn(),
  getItem: vi.fn(),
  deleteItem: vi.fn(),
  setEncryptedItem: vi.fn(),
  getEncryptedItem: vi.fn(),
  STORE_ANALYSIS_CACHE: 'analysis_cache',
}));

describe('AnalysisCacheManager', () => {
  let cacheManager: AnalysisCacheManager;
  let mockKey: CryptoKey;
  const METADATA_KEY = '__metadata__';

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    mockKey = {} as CryptoKey;
    cacheManager = new AnalysisCacheManager(mockKey, 1000); // 1 second TTL for easy testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set', () => {
    it('should securely store analysis and update metadata', async () => {
      const asin = 'B012345678';
      const analysis = { score: 95 };
      vi.setSystemTime(1000000);

      vi.mocked(getItem).mockResolvedValueOnce({}); // Initial metadata fetch

      await cacheManager.set(asin, analysis);

      expect(setEncryptedItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, asin, analysis, mockKey);
      expect(setItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, METADATA_KEY, {
        [asin]: { timestamp: 1000000 },
      });
    });

    it('should preserve existing metadata when updating', async () => {
      const asin = 'B012345678';
      const analysis = { score: 95 };
      vi.setSystemTime(2000000);

      const existingMetadata = {
        B098765432: { timestamp: 1000000 },
      };
      vi.mocked(getItem).mockResolvedValueOnce(existingMetadata);

      await cacheManager.set(asin, analysis);

      expect(setItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, METADATA_KEY, {
        B098765432: { timestamp: 1000000 },
        [asin]: { timestamp: 2000000 },
      });
    });
  });

  describe('get', () => {
    it('should return undefined if no metadata exists', async () => {
      vi.mocked(getItem).mockResolvedValueOnce(null);
      const result = await cacheManager.get('B012345678');
      expect(result).toBeUndefined();
    });

    it('should return undefined if analysis is not in metadata', async () => {
      vi.mocked(getItem).mockResolvedValueOnce({ OTHER_ASIN: { timestamp: 1000000 } });
      const result = await cacheManager.get('B012345678');
      expect(result).toBeUndefined();
    });

    it('should return undefined and remove item if expired', async () => {
      const asin = 'B012345678';
      vi.setSystemTime(2000000); // Current time

      vi.mocked(getItem).mockResolvedValue({
        [asin]: { timestamp: 1000000 }, // Older than 1 second TTL (1000ms)
      });

      const result = await cacheManager.get(asin);

      expect(result).toBeUndefined();
      expect(deleteItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, asin);
      // Wait, inside get, it calls remove, which fetches metadata again
      expect(setItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, METADATA_KEY, {});
    });

    it('should return encrypted item if within TTL', async () => {
      const asin = 'B012345678';
      vi.setSystemTime(1000500); // 500ms elapsed

      vi.mocked(getItem).mockResolvedValue({
        [asin]: { timestamp: 1000000 },
      });
      vi.mocked(getEncryptedItem).mockResolvedValue({ score: 95 });

      const result = await cacheManager.get(asin);

      expect(result).toEqual({ score: 95 });
      expect(getEncryptedItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, asin, mockKey);
    });
  });

  describe('remove', () => {
    it('should delete item and update metadata', async () => {
      const asin = 'B012345678';
      vi.mocked(getItem).mockResolvedValue({
        [asin]: { timestamp: 1000000 },
        OTHER: { timestamp: 1000000 },
      });

      await cacheManager.remove(asin);

      expect(deleteItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, asin);
      expect(setItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, METADATA_KEY, {
        OTHER: { timestamp: 1000000 },
      });
    });

    it('should not update metadata if asin not present', async () => {
      const asin = 'B012345678';
      vi.mocked(getItem).mockResolvedValue({
        OTHER: { timestamp: 1000000 },
      });

      await cacheManager.remove(asin);

      expect(deleteItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, asin);
      expect(setItem).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should delete all cached items and metadata', async () => {
      vi.mocked(getItem).mockResolvedValue({
        ASIN_1: { timestamp: 1000000 },
        ASIN_2: { timestamp: 1000000 },
      });

      await cacheManager.flush();

      expect(deleteItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, 'ASIN_1');
      expect(deleteItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, 'ASIN_2');
      expect(deleteItem).toHaveBeenCalledWith(STORE_ANALYSIS_CACHE, METADATA_KEY);
    });
  });

  describe('prefetch', () => {
    it('should resolve immediately as it is a stub', async () => {
      await expect(cacheManager.prefetch(['ASIN_1', 'ASIN_2'])).resolves.toBeUndefined();
    });
  });
});
