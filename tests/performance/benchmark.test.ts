import { describe, it, expect } from 'vitest';
import { defaultGenome } from '../../lib/genome';
import { calculateTrueValue, calculatePersonalFit } from '../../lib/scoring';
import { ProductData } from '../../lib/types';

describe('ML Benchmarks', () => {
  it('computes scores for 50 products in under 500ms', () => {
    const genome = defaultGenome();
    const products: ProductData[] = Array.from({ length: 50 }, (_, i) => ({
      asin: `B000${i}`,
      title: `Product ${i}`,
      price: 10 + i,
      currency: 'USD',
      rating: 4.5,
      reviewCount: 1000 + i * 10,
      imageUrl: null,
      jsonLd: null,
      url: `https://www.amazon.com/dp/B000${i}`,
      scrapedAt: Date.now(),
      source: 'dom',
      listPrice: 15 + i,
      unitPrice: 10 + i,
      quantity: 1,
    }));

    const start = performance.now();
    products.forEach((p) => {
      calculateTrueValue(p);
      calculatePersonalFit(genome, p);
    });
    const end = performance.now();
    const elapsed = end - start;

    expect(elapsed).toBeLessThan(500);
  });
});
