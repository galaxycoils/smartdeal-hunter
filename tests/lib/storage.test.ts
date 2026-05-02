import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  setItem,
  getItem,
  deleteItem,
  setEncryptedItem,
  getEncryptedItem,
  wipeAllData,
} from '../../lib/storage';
import { deriveKey } from '../../lib/crypto';

// Minimal mock for IndexedDB
const mockDB = {
  stores: new Map<string, Map<string, unknown>>(),
};

const createMockRequest = (result: unknown) => ({
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
  result,
});

vi.stubGlobal('indexedDB', {
  open: vi.fn().mockImplementation((_name, _version) => {
    const request = createMockRequest({
      objectStoreNames: Object.assign(['genome', 'product_cache'], {
        contains: (_n: string) => true,
      }),
      transaction: (_storeNames: string | string[], _mode: string) => ({
        objectStore: (name: string) => ({
          put: vi.fn().mockImplementation((val, key) => {
            if (!mockDB.stores.has(name)) mockDB.stores.set(name, new Map());
            mockDB.stores.get(name)!.set(key, val);
            const req = createMockRequest(key);
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          }),
          get: vi.fn().mockImplementation((key) => {
            const val = mockDB.stores.get(name)?.get(key);
            const req = createMockRequest(val);
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          }),
          delete: vi.fn().mockImplementation((key) => {
            mockDB.stores.get(name)?.delete(key);
            const req = createMockRequest(undefined);
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          }),
          clear: vi.fn().mockImplementation(() => {
            mockDB.stores.get(name)?.clear();
            const req = createMockRequest(undefined);
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          }),
        }),
      }),
    });
    setTimeout(() => request.onsuccess?.(), 0);
    return request;
  }),
});

describe('Storage Layer', () => {
  let testKey: CryptoKey;

  beforeAll(async () => {
    const salt = new Uint8Array(16);
    testKey = await deriveKey('test-pw', salt);
  });

  beforeEach(() => {
    mockDB.stores.clear();
    mockDB.stores.set('genome', new Map());
    mockDB.stores.set('product_cache', new Map());
  });

  it('should store and retrieve plain items', async () => {
    const key = 'test-key';
    const value = { foo: 'bar' };
    await setItem('product_cache', key, value);
    const retrieved = await getItem('product_cache', key);
    expect(retrieved).toEqual(value);
  });

  it('should delete items', async () => {
    const key = 'test-key';
    await setItem('product_cache', key, 'val');
    await deleteItem('product_cache', key);
    const retrieved = await getItem('product_cache', key);
    expect(retrieved).toBeUndefined();
  });

  it('should store and retrieve encrypted items in STORE_GENOME', async () => {
    const key = 'genome-key';
    const value = { fit: 0.85, preferences: [1, 0, 1] };

    await setEncryptedItem('genome', key, value, testKey);
    const retrieved = await getEncryptedItem('genome', key, testKey);
    expect(retrieved).toEqual(value);

    // Assert per-store routing
    expect(mockDB.stores.get('genome')?.has(key)).toBe(true);
    expect(mockDB.stores.get('product_cache')?.has(key)).toBe(false);
  });

  it('should store and retrieve encrypted items in STORE_PRODUCT_CACHE', async () => {
    const key = 'product-key';
    const value = { secret: 'data' };

    await setEncryptedItem('product_cache', key, value, testKey);
    const retrieved = await getEncryptedItem('product_cache', key, testKey);
    expect(retrieved).toEqual(value);

    // Assert per-store routing
    expect(mockDB.stores.get('product_cache')?.has(key)).toBe(true);
    expect(mockDB.stores.get('genome')?.has(key)).toBe(false);
  });

  it('should return undefined for missing items', async () => {
    const retrieved = await getItem('product_cache', 'non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('should wipe all data', async () => {
    await setItem('genome', 'g1', 'v1');
    await setItem('product_cache', 'p1', 'v2');

    await wipeAllData();

    expect(await getItem('genome', 'g1')).toBeUndefined();
    expect(await getItem('product_cache', 'p1')).toBeUndefined();
  });
});
