import {
  setEncryptedItem,
  getEncryptedItem,
  setItem,
  getItem,
  deleteItem,
  STORE_ANALYSIS_CACHE,
} from './storage';

const METADATA_KEY = '__metadata__';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AnalysisMetadata {
  timestamp: number;
}

export class AnalysisCacheManager {
  private cryptoKey: CryptoKey;
  private ttlMs: number;

  constructor(cryptoKey: CryptoKey, ttlMs: number = DEFAULT_TTL_MS) {
    this.cryptoKey = cryptoKey;
    this.ttlMs = ttlMs;
  }

  /**
   * Caches an analysis result with TTL.
   */
  async set<T>(asin: string, analysis: T): Promise<void> {
    await setEncryptedItem(STORE_ANALYSIS_CACHE, asin, analysis, this.cryptoKey);

    const metadata =
      (await getItem<Record<string, AnalysisMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    metadata[asin] = { timestamp: Date.now() };
    await setItem(STORE_ANALYSIS_CACHE, METADATA_KEY, metadata);
  }

  /**
   * Retrieves a cached analysis result if it hasn't expired.
   */
  async get<T>(asin: string): Promise<T | undefined> {
    const metadata =
      (await getItem<Record<string, AnalysisMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    const meta = metadata[asin];

    if (!meta) return undefined;

    if (Date.now() - meta.timestamp > this.ttlMs) {
      // Expired
      await this.remove(asin);
      return undefined;
    }

    return getEncryptedItem<T>(STORE_ANALYSIS_CACHE, asin, this.cryptoKey);
  }

  /**
   * Removes a specific item from the cache.
   */
  async remove(asin: string): Promise<void> {
    await deleteItem(STORE_ANALYSIS_CACHE, asin);
    const metadata =
      (await getItem<Record<string, AnalysisMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    if (metadata[asin]) {
      delete metadata[asin];
      await setItem(STORE_ANALYSIS_CACHE, METADATA_KEY, metadata);
    }
  }

  /**
   * Manually flushes all analysis cache items.
   */
  async flush(): Promise<void> {
    const metadata =
      (await getItem<Record<string, AnalysisMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    const asins = Object.keys(metadata);

    await Promise.all(asins.map((asin) => deleteItem(STORE_ANALYSIS_CACHE, asin)));

    await deleteItem(STORE_ANALYSIS_CACHE, METADATA_KEY);
  }

  /**
   * Prefetches analyses for multiple ASINs (stub).
   */
  async prefetch(asins: string[]): Promise<void> {
    // Stub implementation for prefetch logic
    // Can be used to load items in memory or eagerly fetch from an API
    void asins;
    return Promise.resolve();
  }
}
