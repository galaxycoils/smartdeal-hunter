import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheProduct, getCachedProduct, cleanCache } from '../../lib/cache';
import * as storage from '../../lib/storage';
import { ProductData } from '../../lib/types';

vi.mock('../../lib/storage', () => ({
  setEncryptedItem: vi.fn(),
  getEncryptedItem: vi.fn(),
  setItem: vi.fn(),
  getItem: vi.fn(),
  deleteItem: vi.fn(),
}));

describe('Product Cache', () => {
  const mockKey = {} as CryptoKey;
  const mockProduct: ProductData = {
    asin: 'B012345678',
    title: 'Test Product',
    price: 19.99,
    currency: 'USD',
    rating: 4.5,
    reviewCount: 100,
    imageUrl: 'http://example.com/image.jpg',
    jsonLd: null,
    url: 'http://example.com/product',
    scrapedAt: 1000000000000,
    source: 'dom',
    listPrice: 24.99,
    unitPrice: null,
    quantity: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1000000000000);
  });

  it('should cache a product and update metadata', async () => {
    vi.mocked(storage.getItem).mockResolvedValue({});

    await cacheProduct(mockProduct, mockKey);

    expect(storage.setEncryptedItem).toHaveBeenCalledWith(
      'product_cache',
      'B012345678',
      mockProduct,
      mockKey,
    );
    expect(storage.getItem).toHaveBeenCalledWith('product_cache', '__metadata__');
    expect(storage.setItem).toHaveBeenCalledWith('product_cache', '__metadata__', {
      B012345678: 1000000000000,
    });
  });

  it('should handle undefined metadata when caching a product', async () => {
    vi.mocked(storage.getItem).mockResolvedValue(undefined);

    await cacheProduct(mockProduct, mockKey);

    expect(storage.setItem).toHaveBeenCalledWith('product_cache', '__metadata__', {
      B012345678: 1000000000000,
    });
  });

  it('should handle undefined metadata when cleaning cache', async () => {
    vi.mocked(storage.getItem).mockResolvedValue(undefined);

    await cleanCache();

    expect(storage.deleteItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('should get a cached product', async () => {
    vi.mocked(storage.getEncryptedItem).mockResolvedValue(mockProduct);

    const product = await getCachedProduct('B012345678', mockKey);

    expect(storage.getEncryptedItem).toHaveBeenCalledWith('product_cache', 'B012345678', mockKey);
    expect(product).toEqual(mockProduct);
  });

  it('should return undefined if product is not in cache', async () => {
    vi.mocked(storage.getEncryptedItem).mockResolvedValue(undefined);

    const product = await getCachedProduct('B012345678', mockKey);

    expect(product).toBeUndefined();
  });

  it('should clean cache by removing products older than 7 days', async () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = 1000000000000;
    vi.setSystemTime(now);

    const metadata = {
      OLD_PRODUCT: now - SEVEN_DAYS_MS - 1,
      NEW_PRODUCT: now - SEVEN_DAYS_MS + 1,
    };
    vi.mocked(storage.getItem).mockResolvedValue(metadata);

    await cleanCache();

    expect(storage.getItem).toHaveBeenCalledWith('product_cache', '__metadata__');
    expect(storage.deleteItem).toHaveBeenCalledWith('product_cache', 'OLD_PRODUCT');
    expect(storage.deleteItem).not.toHaveBeenCalledWith('product_cache', 'NEW_PRODUCT');
    expect(storage.setItem).toHaveBeenCalledWith('product_cache', '__metadata__', {
      NEW_PRODUCT: now - SEVEN_DAYS_MS + 1,
    });
  });

  it('should not update metadata if no products were removed during cleanCache', async () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = 1000000000000;
    vi.setSystemTime(now);

    const metadata = {
      NEW_PRODUCT: now - SEVEN_DAYS_MS + 1,
    };
    vi.mocked(storage.getItem).mockResolvedValue(metadata);

    await cleanCache();

    expect(storage.deleteItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
