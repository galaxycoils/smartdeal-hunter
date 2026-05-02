import { describe, it, expect, beforeAll, vi } from 'vitest';
import {
  defaultGenome,
  validateGenome,
  clipAndRenormalize,
  loadGenome,
  saveGenome,
  wipeGenome,
  GENOME_STORE,
  GENOME_DB_KEY,
} from '../../lib/genome';
import { GENOME_DIMENSIONS } from '../../lib/types';
import { deriveKey } from '../../lib/crypto';
import { setEncryptedItem } from '../../lib/storage';

// Same minimal mock for IndexedDB as storage.test.ts
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

describe('Genome Engine', () => {
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    const salt = new Uint8Array(16);
    sharedKey = await deriveKey('test-pw', salt);
  });

  it('schema snapshot matches GENOME_DIMENSIONS', () => {
    expect(GENOME_DIMENSIONS).toMatchInlineSnapshot(`
      [
        "price_sensitivity",
        "brand_affinity",
        "quality_priority",
        "sustainability",
        "novelty_seeking",
        "review_weight",
        "discount_sensitivity",
        "category_diversity",
      ]
    `);
  });

  it('defaultGenome has expected shape', () => {
    const now = () => 1000;
    const g = defaultGenome(now);

    expect(g.version).toBe(1);
    expect(g.isOnboarded).toBe(false);
    expect(g.createdAt).toBe(1000);
    expect(g.updatedAt).toBe(1000);

    let weightSum = 0;
    for (const dim of GENOME_DIMENSIONS) {
      expect(g.dimensions[dim]).toBeDefined();
      expect(g.dimensions[dim].value).toBe(0.5);
      weightSum += g.dimensions[dim].weight;

      expect(g.bandit.pulls[dim]).toBe(0);
      expect(g.bandit.rewards[dim]).toBe(0);
    }

    expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.000001);
  });

  it('validateGenome accepts default genome', () => {
    const g = defaultGenome();
    expect(validateGenome(g)).toBe(true);
  });

  it('validateGenome rejects invalid schemas', () => {
    const g = defaultGenome();

    // Missing dimension
    const missingDim = JSON.parse(JSON.stringify(g));
    delete missingDim.dimensions.price_sensitivity;
    expect(validateGenome(missingDim)).toBe(false);

    // Value > 1
    const highValue = JSON.parse(JSON.stringify(g));
    highValue.dimensions.price_sensitivity.value = 1.5;
    expect(validateGenome(highValue)).toBe(false);

    // Value < 0
    const lowValue = JSON.parse(JSON.stringify(g));
    lowValue.dimensions.price_sensitivity.value = -0.5;
    expect(validateGenome(lowValue)).toBe(false);

    // Weight sum not near 1.0
    const badWeight = JSON.parse(JSON.stringify(g));
    badWeight.dimensions.price_sensitivity.weight = 0;
    expect(validateGenome(badWeight)).toBe(false);

    // Version mismatch
    const badVersion = JSON.parse(JSON.stringify(g));
    badVersion.version = 2;
    expect(validateGenome(badVersion)).toBe(false);

    // Missing isOnboarded
    const missingOnboarded = JSON.parse(JSON.stringify(g));
    delete missingOnboarded.isOnboarded;
    expect(validateGenome(missingOnboarded)).toBe(false);

    // Bad bandit
    const badBandit = JSON.parse(JSON.stringify(g));
    delete badBandit.bandit.pulls.price_sensitivity;
    expect(validateGenome(badBandit)).toBe(false);
  });

  it('clipAndRenormalize clamps values and renormalizes weights', () => {
    const g = defaultGenome();
    g.dimensions.price_sensitivity.value = 1.5;
    g.dimensions.brand_affinity.value = -0.5;

    // Mess up weights to be all 1s
    for (const dim of GENOME_DIMENSIONS) {
      g.dimensions[dim].weight = 1;
    }

    const clipped = clipAndRenormalize(g);

    expect(clipped.dimensions.price_sensitivity.value).toBe(1);
    expect(clipped.dimensions.brand_affinity.value).toBe(0);

    // Each should now be 1/8 (0.125)
    for (const dim of GENOME_DIMENSIONS) {
      expect(clipped.dimensions[dim].weight).toBe(0.125);
    }
  });

  it('roundtrips securely through storage', async () => {
    const g = defaultGenome();
    g.isOnboarded = true;

    await saveGenome(g, sharedKey);
    const loaded = await loadGenome(sharedKey);

    expect(loaded).toEqual(g);
  });

  it('loadGenome returns defaultGenome when no record exists', async () => {
    mockDB.stores.get(GENOME_STORE)?.clear();
    const g = await loadGenome(sharedKey);
    expect(validateGenome(g)).toBe(true);
    expect(g.isOnboarded).toBe(false);
  });

  it('loadGenome throws on validation failure via corrupted store', async () => {
    // Write syntactically valid but semantically invalid data
    const corrupted = {
      version: 99,
      isOnboarded: true,
      dimensions: {},
      bandit: { pulls: {}, rewards: {} },
      createdAt: 0,
      updatedAt: 0,
    };

    await setEncryptedItem(GENOME_STORE, GENOME_DB_KEY, corrupted, sharedKey);
    await expect(loadGenome(sharedKey)).rejects.toThrow();
  });

  it('wipeGenome clears stored value', async () => {
    await saveGenome(defaultGenome(), sharedKey);
    await wipeGenome();

    // Should return fresh default
    const g = await loadGenome(sharedKey);
    expect(g.isOnboarded).toBe(false);
  });
});
