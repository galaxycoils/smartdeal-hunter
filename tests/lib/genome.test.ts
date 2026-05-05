import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  defaultGenome,
  validateGenome,
  clipAndRenormalize,
  loadGenome,
  saveGenome,
  wipeGenome,
  onGenomeChange,
  GENOME_STORE,
  GENOME_DB_KEY,
  GenomeStaleError,
} from '../../lib/genome';
import { GENOME_DIMENSIONS } from '../../lib/types';
import { deriveKey } from '../../lib/crypto';
import { setEncryptedItem, getItem, STORE_OAUTH } from '../../lib/storage';
import {
  installIndexedDbMock,
  resetIndexedDbMock,
  seedDatabase,
  getDatabaseStores,
} from '../helpers/indexeddb';

const DB_NAME = 'SmartDealHunterDB';

describe('Genome Engine', () => {
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    const salt = new Uint8Array(16);
    sharedKey = await deriveKey('test-pw', salt);
  });

  beforeEach(() => {
    resetIndexedDbMock();
    vi.clearAllMocks();
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
    expect(g.revision).toBe(1);
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
    expect(validateGenome(defaultGenome())).toBe(true);
  });

  it('validateGenome accepts legacy records without revision and rejects invalid schemas', () => {
    const legacy = defaultGenome();
    delete legacy.revision;
    expect(validateGenome(legacy)).toBe(true);

    const g = defaultGenome();
    const missingDim = JSON.parse(JSON.stringify(g));
    delete missingDim.dimensions.price_sensitivity;
    expect(validateGenome(missingDim)).toBe(false);

    const highValue = JSON.parse(JSON.stringify(g));
    highValue.dimensions.price_sensitivity.value = 1.5;
    expect(validateGenome(highValue)).toBe(false);

    const badWeight = JSON.parse(JSON.stringify(g));
    badWeight.dimensions.price_sensitivity.weight = 0;
    expect(validateGenome(badWeight)).toBe(false);

    const badVersion = JSON.parse(JSON.stringify(g));
    badVersion.version = 2;
    expect(validateGenome(badVersion)).toBe(false);

    const badRevision = JSON.parse(JSON.stringify(g));
    badRevision.revision = 0;
    expect(validateGenome(badRevision)).toBe(false);
  });

  it('clipAndRenormalize clamps values and renormalizes weights', () => {
    const g = defaultGenome();
    g.dimensions.price_sensitivity.value = 1.5;
    g.dimensions.brand_affinity.value = -0.5;

    for (const dim of GENOME_DIMENSIONS) {
      g.dimensions[dim].weight = 1;
    }

    const clipped = clipAndRenormalize(g);
    expect(clipped.dimensions.price_sensitivity.value).toBe(1);
    expect(clipped.dimensions.brand_affinity.value).toBe(0);
    for (const dim of GENOME_DIMENSIONS) {
      expect(clipped.dimensions[dim].weight).toBe(0.125);
    }
  });

  it('clipAndRenormalize distributes evenly when all weights are zero', () => {
    const g = defaultGenome();
    for (const dim of GENOME_DIMENSIONS) {
      g.dimensions[dim].weight = 0;
    }

    const clipped = clipAndRenormalize(g);
    const expected = 1 / GENOME_DIMENSIONS.length;
    for (const dim of GENOME_DIMENSIONS) {
      expect(clipped.dimensions[dim].weight).toBeCloseTo(expected, 10);
    }
  });

  it('loadGenome returns defaultGenome when no record exists', async () => {
    const g = await loadGenome(sharedKey);
    expect(validateGenome(g)).toBe(true);
    expect(g.isOnboarded).toBe(false);
    expect(g.revision).toBe(1);
  });

  it('loadGenome promotes a legacy record without revision to revision 1', async () => {
    const legacy = defaultGenome();
    delete legacy.revision;
    await setEncryptedItem(GENOME_STORE, GENOME_DB_KEY, legacy, sharedKey);

    await expect(loadGenome(sharedKey)).resolves.toMatchObject({ revision: 1 });
  });

  it('loadGenome throws on validation failure via corrupted store', async () => {
    const corrupted = {
      version: 99,
      isOnboarded: true,
      dimensions: {},
      bandit: { pulls: {}, rewards: {} },
      createdAt: 0,
      updatedAt: 0,
    };

    await setEncryptedItem(GENOME_STORE, GENOME_DB_KEY, corrupted, sharedKey);
    await expect(loadGenome(sharedKey)).rejects.toThrow('Genome validation failed during load');
  });

  it('saveGenome throws when the stored genome is invalid', async () => {
    await setEncryptedItem(
      GENOME_STORE,
      GENOME_DB_KEY,
      {
        version: 99,
        isOnboarded: true,
        dimensions: {},
        bandit: { pulls: {}, rewards: {} },
        createdAt: 0,
        updatedAt: 0,
      },
      sharedKey,
    );

    await expect(saveGenome(defaultGenome(), sharedKey)).rejects.toThrow(
      'Genome validation failed during save',
    );
  });

  it('saveGenome persists revision 1 for a first save, updates timestamps, and writes the revision sentinel', async () => {
    const setSpy = vi.spyOn(chrome.storage.local, 'set');
    const g = defaultGenome(() => 100);
    g.revision = 1;
    await saveGenome(g, sharedKey, {
      now: () => 200,
    });

    const loaded = await loadGenome(sharedKey);
    expect(loaded.revision).toBe(1);
    expect(loaded.updatedAt).toBe(200);
    expect(setSpy).toHaveBeenCalledWith({ 'sdh:genome-revision': 1 });
  });

  it('throws GenomeStaleError when expectedRevision does not match the stored revision', async () => {
    const saved = defaultGenome();
    await saveGenome(saved, sharedKey, { now: () => 100 });

    const current = await loadGenome(sharedKey);
    current.isOnboarded = true;

    await expect(
      saveGenome(current, sharedKey, { now: () => 200, expectedRevision: 2 }),
    ).rejects.toBeInstanceOf(GenomeStaleError);
  });

  it('rejects the second of two concurrent stale saves', async () => {
    const initial = defaultGenome();
    await saveGenome(initial, sharedKey, { now: () => 100 });

    const first = await loadGenome(sharedKey);
    const second = await loadGenome(sharedKey);

    first.isOnboarded = true;
    second.isOnboarded = true;

    await saveGenome(first, sharedKey, { now: () => 200, expectedRevision: 1 });
    await expect(
      saveGenome(second, sharedKey, { now: () => 300, expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(GenomeStaleError);
  });

  it('exports GenomeStaleError from both genome entrypoints', async () => {
    const errorsModule = await import('../../lib/errors/genome-errors');
    expect(errorsModule.GenomeStaleError).toBe(GenomeStaleError);
  });

  it('subscribes to genome revision changes and unsubscribes cleanly', async () => {
    const callback = vi.fn();
    const unsubscribe = onGenomeChange(callback);

    await chrome.storage.local.set({ ignored: 1 });
    await chrome.storage.local.set({ 'sdh:genome-revision': 2 });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);

    unsubscribe();
    await chrome.storage.local.set({ 'sdh:genome-revision': 3 });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('wipeGenome clears only the genome store and leaves oauth tokens intact', async () => {
    const genome = defaultGenome();
    await saveGenome(genome, sharedKey);
    await setEncryptedItem(
      STORE_OAUTH,
      'tokens',
      { accessToken: 'x', refreshToken: 'y', expiresAt: 1 },
      sharedKey,
    );

    await wipeGenome();

    await expect(loadGenome(sharedKey)).resolves.toMatchObject({ isOnboarded: false, revision: 1 });
    await expect(getItem(STORE_OAUTH, 'tokens')).resolves.toBeDefined();
  });

  it('preserves database contents during downgrade mismatch checks', async () => {
    seedDatabase(
      DB_NAME,
      5,
      {
        [GENOME_STORE]: { [GENOME_DB_KEY]: 'ciphertext-placeholder' },
        oauth: { tokens: 'ciphertext-placeholder' },
      },
      { failOnLowerVersion: false },
    );

    const stores = getDatabaseStores(DB_NAME);
    expect(stores?.get(GENOME_STORE)?.get(GENOME_DB_KEY)).toBe('ciphertext-placeholder');
  });
});
