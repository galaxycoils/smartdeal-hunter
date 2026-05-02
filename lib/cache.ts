import { ProductData } from './types';
import { setEncryptedItem, getEncryptedItem, setItem, getItem, deleteItem } from './storage';

const STORE_PRODUCT_CACHE = 'product_cache';
const METADATA_KEY = '__metadata__';

/**
 * Caches a product securely and updates the cache metadata.
 */
export async function cacheProduct(product: ProductData, key: CryptoKey): Promise<void> {
  await setEncryptedItem(STORE_PRODUCT_CACHE, product.asin, product, key);

  const metadata = (await getItem<Record<string, number>>(STORE_PRODUCT_CACHE, METADATA_KEY)) || {};
  metadata[product.asin] = product.scrapedAt;
  await setItem(STORE_PRODUCT_CACHE, METADATA_KEY, metadata);
}

/**
 * Retrieves a cached product securely.
 */
export async function getCachedProduct(
  asin: string,
  key: CryptoKey,
): Promise<ProductData | undefined> {
  return getEncryptedItem<ProductData>(STORE_PRODUCT_CACHE, asin, key);
}

/**
 * Cleans up products older than 7 days from the cache.
 */
export async function cleanCache(): Promise<void> {
  const metadata = (await getItem<Record<string, number>>(STORE_PRODUCT_CACHE, METADATA_KEY)) || {};
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  let changed = false;

  for (const [asin, scrapedAt] of Object.entries(metadata)) {
    if (now - scrapedAt > SEVEN_DAYS_MS) {
      await deleteItem(STORE_PRODUCT_CACHE, asin);
      delete metadata[asin];
      changed = true;
    }
  }

  if (changed) {
    await setItem(STORE_PRODUCT_CACHE, METADATA_KEY, metadata);
  }
}
