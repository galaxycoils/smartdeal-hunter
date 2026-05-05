import {
  setEncryptedItem,
  getEncryptedItem,
  setItem,
  getItem,
  deleteItem,
  STORE_ANALYSIS_CACHE,
} from './storage';

const METADATA_KEY = '__dc_metadata__';
const KEY_PREFIX = 'dc:';

interface DeepCheckMetadata {
  timestamp: number;
}

export class DeepCheckCache {
  constructor(
    private readonly cryptoKey: CryptoKey,
    private readonly ttlMs: number = 3_600_000,
  ) {}

  async set<T>(asin: string, value: T): Promise<void> {
    const key = `${KEY_PREFIX}${asin}`;
    await setEncryptedItem(STORE_ANALYSIS_CACHE, key, value, this.cryptoKey);

    const metadata =
      (await getItem<Record<string, DeepCheckMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    metadata[key] = { timestamp: Date.now() };
    await setItem(STORE_ANALYSIS_CACHE, METADATA_KEY, metadata);
  }

  async get<T>(asin: string): Promise<T | undefined> {
    const key = `${KEY_PREFIX}${asin}`;
    const metadata =
      (await getItem<Record<string, DeepCheckMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    const entry = metadata[key];

    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      await this.remove(asin);
      return undefined;
    }

    return getEncryptedItem<T>(STORE_ANALYSIS_CACHE, key, this.cryptoKey);
  }

  async remove(asin: string): Promise<void> {
    const key = `${KEY_PREFIX}${asin}`;
    await deleteItem(STORE_ANALYSIS_CACHE, key);
    const metadata =
      (await getItem<Record<string, DeepCheckMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    if (metadata[key]) {
      delete metadata[key];
      await setItem(STORE_ANALYSIS_CACHE, METADATA_KEY, metadata);
    }
  }

  async flush(): Promise<void> {
    const metadata =
      (await getItem<Record<string, DeepCheckMetadata>>(STORE_ANALYSIS_CACHE, METADATA_KEY)) || {};
    await Promise.all(Object.keys(metadata).map((key) => deleteItem(STORE_ANALYSIS_CACHE, key)));
    await deleteItem(STORE_ANALYSIS_CACHE, METADATA_KEY);
  }
}
