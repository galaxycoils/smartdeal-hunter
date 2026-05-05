import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  setItem,
  getItem,
  deleteItem,
  setEncryptedItem,
  getEncryptedItem,
  wipeAllData,
  getAllItems,
  STORE_PRODUCT_CACHE,
  STORE_ANALYSIS_CACHE,
  STORE_HISTORY_EVENTS,
  STORE_OAUTH,
  DBVersionMismatchError,
} from '../../lib/storage';
import { deriveKey } from '../../lib/crypto';
import {
  installIndexedDbMock,
  resetIndexedDbMock,
  seedDatabase,
  getDatabaseStores,
  setIndexedDbOpenError,
} from '../helpers/indexeddb';

const DB_NAME = 'SmartDealHunterDB';
const STORE_GENOME = 'genome';

describe('Storage Layer', () => {
  let testKey: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    const salt = new Uint8Array(16);
    testKey = await deriveKey('test-pw', salt);
  });

  beforeEach(() => {
    resetIndexedDbMock();
  });

  it('stores and retrieves plain items', async () => {
    await setItem(STORE_PRODUCT_CACHE, 'test-key', { foo: 'bar' });

    await expect(getItem(STORE_PRODUCT_CACHE, 'test-key')).resolves.toEqual({ foo: 'bar' });
  });

  it('deletes items', async () => {
    await setItem(STORE_PRODUCT_CACHE, 'test-key', 'value');
    await deleteItem(STORE_PRODUCT_CACHE, 'test-key');

    await expect(getItem(STORE_PRODUCT_CACHE, 'test-key')).resolves.toBeUndefined();
  });

  it('stores and retrieves encrypted items in the genome store', async () => {
    const value = { fit: 0.85, preferences: [1, 0, 1] };

    await setEncryptedItem(STORE_GENOME, 'genome-key', value, testKey);

    await expect(getEncryptedItem(STORE_GENOME, 'genome-key', testKey)).resolves.toEqual(value);
    expect(getDatabaseStores(DB_NAME)?.get(STORE_PRODUCT_CACHE)?.has('genome-key')).toBe(false);
  });

  it('stores and retrieves encrypted items in the product cache store', async () => {
    const value = { secret: 'data' };

    await setEncryptedItem(STORE_PRODUCT_CACHE, 'product-key', value, testKey);

    await expect(getEncryptedItem(STORE_PRODUCT_CACHE, 'product-key', testKey)).resolves.toEqual(
      value,
    );
    expect(getDatabaseStores(DB_NAME)?.get(STORE_GENOME)?.has('product-key')).toBe(false);
  });

  it('returns undefined for missing encrypted items', async () => {
    await expect(getEncryptedItem(STORE_GENOME, 'absent', testKey)).resolves.toBeUndefined();
  });

  it('returns all items from a store', async () => {
    await setItem(STORE_HISTORY_EVENTS, '1:A', { ts: 1, asin: 'A', kind: 'analyze' });
    await setItem(STORE_HISTORY_EVENTS, '2:B', { ts: 2, asin: 'B', kind: 'view' });

    await expect(getAllItems(STORE_HISTORY_EVENTS)).resolves.toEqual([
      { ts: 1, asin: 'A', kind: 'analyze' },
      { ts: 2, asin: 'B', kind: 'view' },
    ]);
  });

  it('wipes all stores, including history and oauth stores', async () => {
    await setItem(STORE_GENOME, 'g1', 'v1');
    await setItem(STORE_PRODUCT_CACHE, 'p1', 'v2');
    await setItem(STORE_ANALYSIS_CACHE, 'a1', 'v3');
    await setItem(STORE_HISTORY_EVENTS, 'h1', { ts: 1, asin: 'A', kind: 'analyze' });
    await setItem(STORE_OAUTH, 'tokens', { accessToken: 'x' });

    await wipeAllData();

    await expect(getItem(STORE_GENOME, 'g1')).resolves.toBeUndefined();
    await expect(getItem(STORE_PRODUCT_CACHE, 'p1')).resolves.toBeUndefined();
    await expect(getItem(STORE_ANALYSIS_CACHE, 'a1')).resolves.toBeUndefined();
    await expect(getItem(STORE_HISTORY_EVENTS, 'h1')).resolves.toBeUndefined();
    await expect(getItem(STORE_OAUTH, 'tokens')).resolves.toBeUndefined();
  });

  it('creates all required stores on initial upgrade', async () => {
    await setItem(STORE_GENOME, 'k', 'v');

    const stores = getDatabaseStores(DB_NAME);
    expect(stores?.has(STORE_GENOME)).toBe(true);
    expect(stores?.has(STORE_PRODUCT_CACHE)).toBe(true);
    expect(stores?.has(STORE_ANALYSIS_CACHE)).toBe(true);
    expect(stores?.has(STORE_HISTORY_EVENTS)).toBe(true);
    expect(stores?.has(STORE_OAUTH)).toBe(true);
  });

  it('upgrades a v2 database and preserves existing data while adding new stores', async () => {
    seedDatabase(DB_NAME, 2, {
      [STORE_GENOME]: { g1: 'persisted-genome' },
      [STORE_PRODUCT_CACHE]: { p1: 'persisted-product' },
      [STORE_ANALYSIS_CACHE]: { a1: 'persisted-analysis' },
    });

    await expect(getItem(STORE_GENOME, 'g1')).resolves.toBe('persisted-genome');

    const stores = getDatabaseStores(DB_NAME);
    expect(stores?.has(STORE_HISTORY_EVENTS)).toBe(true);
    expect(stores?.has(STORE_OAUTH)).toBe(true);
    expect(stores?.get(STORE_HISTORY_EVENTS)?.size).toBe(0);
    expect(stores?.get(STORE_OAUTH)?.size).toBe(0);
  });

  it('throws DBVersionMismatchError when opening a future-version database', async () => {
    seedDatabase(
      DB_NAME,
      5,
      {
        [STORE_GENOME]: { g1: 'future-genome' },
        [STORE_PRODUCT_CACHE]: {},
        [STORE_ANALYSIS_CACHE]: {},
        [STORE_HISTORY_EVENTS]: {},
        [STORE_OAUTH]: {},
      },
      { failOnLowerVersion: false },
    );

    await expect(getItem(STORE_GENOME, 'g1')).rejects.toBeInstanceOf(DBVersionMismatchError);
  });

  it('preserves future-version data after version mismatch rejection', async () => {
    seedDatabase(
      DB_NAME,
      5,
      {
        [STORE_GENOME]: { g1: 'future-genome' },
        [STORE_PRODUCT_CACHE]: {},
        [STORE_ANALYSIS_CACHE]: {},
        [STORE_HISTORY_EVENTS]: {},
        [STORE_OAUTH]: { tokens: { accessToken: 'future-token' } },
      },
      { failOnLowerVersion: false },
    );

    await expect(getItem(STORE_GENOME, 'g1')).rejects.toBeInstanceOf(DBVersionMismatchError);

    const stores = getDatabaseStores(DB_NAME);
    expect(stores?.get(STORE_GENOME)?.get('g1')).toBe('future-genome');
    expect(stores?.get(STORE_OAUTH)?.get('tokens')).toEqual({ accessToken: 'future-token' });
  });

  it('rejects when indexedDB open errors', async () => {
    setIndexedDbOpenError(new Error('boom'));

    await expect(setItem(STORE_GENOME, 'k', 'v')).rejects.toThrow('boom');
  });
});
