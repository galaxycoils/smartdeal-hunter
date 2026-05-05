import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import bundleSeeds from '../../lib/__fixtures__/bundle-seeds.json';
import { defaultGenome } from '../../lib/genome';
import {
  optimizeBundle,
  refreshBundleHistory,
  type BundleSeedFixture,
} from '../../lib/bundle-optimizer';
import { setItem, STORE_HISTORY_EVENTS } from '../../lib/storage';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';
import type { Genome, ProductData } from '../../lib/types';

function makeGenome(): Genome {
  const genome = defaultGenome();
  genome.isOnboarded = true;
  genome.dimensions.quality_priority.weight = 2;
  genome.dimensions.brand_affinity.weight = 1.5;
  genome.dimensions.review_weight.weight = 1.5;
  return genome;
}

describe('Bundle Optimizer', () => {
  beforeAll(() => {
    installIndexedDbMock();
  });

  beforeEach(async () => {
    resetIndexedDbMock();
    await refreshBundleHistory();
  });

  it('returns an empty list when there are no candidates', () => {
    const bundles = optimizeBundle(bundleSeeds[0].seed as ProductData, [], makeGenome());
    expect(bundles).toEqual([]);
  });

  it('uses history events to rank the best candidate first', async () => {
    const seed = bundleSeeds[0].seed as ProductData;
    const candidates = bundleSeeds[0].candidates as ProductData[];
    await setItem(STORE_HISTORY_EVENTS, '1:C001C', { ts: 1, asin: 'C001C', kind: 'analyze' });
    await setItem(STORE_HISTORY_EVENTS, '2:C001C', { ts: 2, asin: 'C001C', kind: 'analyze' });
    await setItem(STORE_HISTORY_EVENTS, '3:C001B', { ts: 3, asin: 'C001B', kind: 'analyze' });
    await refreshBundleHistory();

    const bundles = optimizeBundle(seed, candidates, makeGenome());
    expect(bundles[0].items[0]?.asin).toBe('C001C');
  });

  it('ignores view-only history events when building bundle history', async () => {
    const seed = bundleSeeds[0].seed as ProductData;
    const candidates = bundleSeeds[0].candidates as ProductData[];
    await setItem(STORE_HISTORY_EVENTS, '1:C001B', { ts: 1, asin: 'C001B', kind: 'view' });
    await refreshBundleHistory();

    const bundles = optimizeBundle(seed, candidates, makeGenome());
    expect(bundles[0].items[0]?.asin).toBe('C001A');
  });

  it('returns a top-3 ranked bundle sorted by score', async () => {
    const seed = bundleSeeds[1].seed as ProductData;
    const candidates = [
      ...(bundleSeeds[1].candidates as ProductData[]),
      {
        asin: 'C002D',
        title: 'Candidate 2D',
        price: 120,
        currency: 'USD',
        rating: 2.9,
        reviewCount: 12,
        imageUrl: null,
        jsonLd: { brand: { name: 'Generic' } },
        url: 'https://amazon.com/dp/C002D',
        scrapedAt: 1,
        source: 'dom' as const,
        listPrice: 120,
        unitPrice: null,
        quantity: null,
      },
    ];

    await setItem(STORE_HISTORY_EVENTS, '1:C002A', { ts: 1, asin: 'C002A', kind: 'analyze' });
    await setItem(STORE_HISTORY_EVENTS, '2:C002C', { ts: 2, asin: 'C002C', kind: 'analyze' });
    await refreshBundleHistory();

    const bundles = optimizeBundle(seed, candidates, makeGenome());

    expect(bundles).toHaveLength(1);
    expect(bundles[0].items).toHaveLength(3);
    expect(bundles[0].items.map((item) => item.asin)).toEqual(['C002A', 'C002C', 'C002B']);
  });

  it('falls back safely when all genome weights are zero', () => {
    const genome = makeGenome();
    for (const dim of Object.values(genome.dimensions)) {
      dim.weight = 0;
    }

    const bundles = optimizeBundle(
      bundleSeeds[2].seed as ProductData,
      bundleSeeds[2].candidates as ProductData[],
      genome,
    );

    expect(bundles).toHaveLength(1);
    expect(bundles[0].score).toBeGreaterThan(0);
    expect(bundles[0].rationale).toContain('local bundle history and product value signals');
  });

  it('returns an empty list when every candidate matches the seed asin', () => {
    const seed = bundleSeeds[2].seed as ProductData;
    const bundles = optimizeBundle(seed, [seed], makeGenome());
    expect(bundles).toEqual([]);
  });

  it('includes rationale text that references the strongest genome traits', () => {
    const bundles = optimizeBundle(
      bundleSeeds[3].seed as ProductData,
      bundleSeeds[3].candidates as ProductData[],
      makeGenome(),
    );

    expect(bundles[0].rationale).toContain('quality priority');
    expect(bundles[0].rationale).toContain('brand affinity');
  });

  it('meets the acceptance-rate proxy across the 20 committed fixture seeds', async () => {
    for (const [index, fixture] of (bundleSeeds as BundleSeedFixture[]).entries()) {
      await setItem(STORE_HISTORY_EVENTS, `${index}:${fixture.acceptedAsins[0]}`, {
        ts: index + 1,
        asin: fixture.acceptedAsins[0],
        kind: 'analyze',
      });
    }
    await refreshBundleHistory();

    const recall =
      (bundleSeeds as BundleSeedFixture[]).reduce((sum, fixture) => {
        const ranked = optimizeBundle(fixture.seed, fixture.candidates, makeGenome()).flatMap(
          (bundle) => bundle.items.map((item) => item.asin),
        );
        const hits = fixture.acceptedAsins.filter((asin) => ranked.includes(asin)).length;
        return sum + hits / fixture.acceptedAsins.length;
      }, 0) / bundleSeeds.length;

    expect(recall).toBeGreaterThanOrEqual(0.15);
  });
});
