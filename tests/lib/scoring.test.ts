import { describe, it, expect } from 'vitest';
import { calculateTrueValue, calculatePersonalFit } from '../../lib/scoring';
import type { ProductData, Genome } from '../../lib/types';
import { MAX_PERSONAL_FIT } from '../../lib/scoring-constants';

describe('Scoring Algorithm', () => {
  const mockProduct: ProductData = {
    asin: 'B000000000',
    title: 'Test Product',
    price: 100,
    currency: 'USD',
    rating: 4.5,
    reviewCount: 1000,
    imageUrl: null,
    jsonLd: {
      brand: { name: 'Premium' },
    },
    url: 'https://amazon.com/dp/B000000000',
    scrapedAt: Date.now(),
    source: 'dom',
    listPrice: 120,
    unitPrice: null,
    quantity: null,
  };

  const mockGenome: Genome = {
    version: 1,
    isOnboarded: true,
    dimensions: {
      price_sensitivity: { value: 0.8, weight: 1 },
      brand_affinity: { value: 0.2, weight: 1 },
      quality_priority: { value: 0.9, weight: 1 },
      sustainability: { value: 0.1, weight: 1 },
      novelty_seeking: { value: 0.3, weight: 1 },
      review_weight: { value: 0.7, weight: 1 },
      discount_sensitivity: { value: 0.6, weight: 1 },
      category_diversity: { value: 0.4, weight: 1 },
    },
    bandit: {
      pulls: {
        price_sensitivity: 0,
        brand_affinity: 0,
        quality_priority: 0,
        sustainability: 0,
        novelty_seeking: 0,
        review_weight: 0,
        discount_sensitivity: 0,
        category_diversity: 0,
      },
      rewards: {
        price_sensitivity: 0,
        brand_affinity: 0,
        quality_priority: 0,
        sustainability: 0,
        novelty_seeking: 0,
        review_weight: 0,
        discount_sensitivity: 0,
        category_diversity: 0,
      },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  describe('calculateTrueValue', () => {
    it('should calculate a score for a standard product', () => {
      const score = calculateTrueValue(mockProduct);

      // rating_score = 4.5 / 5 = 0.9
      // confidence = 1000 / (1000 + 1000) = 0.5
      // rating_strength = 0.9 * 0.5 = 0.45
      // brand_score = 1.0 (Premium)
      // discountPct = (120 - 100) / 120 = 0.166...
      // valueScore = 0.5 + (0.166 / 0.2) * 0.5 = 0.9166...
      // true_value = (0.45 * 0.4 + 1.0 * 0.3 + 0.9166 * 0.3) * 100 = 75.5

      expect(score).toBeCloseTo(75.5, 1);
    });

    it('should return 0 for product with no price and no rating', () => {
      const poorProduct = {
        ...mockProduct,
        price: null,
        rating: null,
        reviewCount: null,
        jsonLd: null,
      };
      expect(calculateTrueValue(poorProduct)).toBe(0);
    });

    it('should handle missing brand by defaulting to Generic', () => {
      const genericProduct = { ...mockProduct, jsonLd: null };
      const score = calculateTrueValue(genericProduct);

      // rating_strength = 0.45
      // brand_score = 0.5 (Generic)
      // valueScore = 0.9166...
      // true_value = (0.45 * 0.4 + 0.5 * 0.3 + 0.9166 * 0.3) * 100 = 60.5

      expect(score).toBeCloseTo(60.5, 1);
    });

    it('should handle brand as a string in jsonLd', () => {
      const stringBrandProduct = {
        ...mockProduct,
        jsonLd: { brand: 'Verified' },
      };
      const score = calculateTrueValue(stringBrandProduct);

      // rating_strength = 0.45
      // brand_score = 0.8 (Verified)
      // valueScore = 0.9166...
      // true_value = (0.45 * 0.4 + 0.8 * 0.3 + 0.9166 * 0.3) * 100 = 69.5

      expect(score).toBeCloseTo(69.5, 1);
    });
  });

  describe('calculatePersonalFit', () => {
    it('should calculate a fit score between 0 and 100', () => {
      const score = calculatePersonalFit(mockGenome, mockProduct);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(MAX_PERSONAL_FIT);
    });

    it('should return a higher score for a product matching genome preferences', () => {
      const highQualityGenome: Genome = {
        ...mockGenome,
        dimensions: {
          ...mockGenome.dimensions,
          quality_priority: { value: 1.0, weight: 1 },
          review_weight: { value: 1.0, weight: 1 },
        },
      };

      const highQualityProduct: ProductData = {
        ...mockProduct,
        rating: 5.0,
        reviewCount: 5000,
      };

      const lowQualityProduct: ProductData = {
        ...mockProduct,
        rating: 2.0,
        reviewCount: 10,
      };

      const highFit = calculatePersonalFit(highQualityGenome, highQualityProduct);
      const lowFit = calculatePersonalFit(highQualityGenome, lowQualityProduct);

      expect(highFit).toBeGreaterThan(lowFit);
    });
  });
});
