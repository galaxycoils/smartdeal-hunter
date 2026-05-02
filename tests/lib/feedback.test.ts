import { describe, it, expect } from 'vitest';
import { calculateFeedbackUpdate } from '../../lib/feedback';
import { defaultGenome } from '../../lib/genome';
import type { ProductAttributeVector } from '../../lib/types';

describe('calculateFeedbackUpdate', () => {
  const baseProductVector: ProductAttributeVector = {
    unit_price: 0.8,
    rating_strength: 0.9,
    review_volume: 0.7,
    brand_trust: 0.6,
    discount_pct: 0.5,
    eco_signal: 0.4,
    novelty_signal: 0.3,
    category_breadth: 0.2,
  };

  it('should move genome values closer to product vector on "purchased"', () => {
    const genome = defaultGenome();
    // default genome values are 0.5
    const updated = calculateFeedbackUpdate(genome, baseProductVector, 'purchased');

    // unit_price: 0.8, current: 0.5. diff: 0.3. rate: 0.1. new: 0.53
    expect(updated.dimensions.price_sensitivity.value).toBeCloseTo(0.53);
    // rating_strength: 0.9, current: 0.5. diff: 0.4. rate: 0.1. new: 0.54
    expect(updated.dimensions.quality_priority.value).toBeCloseTo(0.54);
    // category_breadth: 0.2, current: 0.5. diff: -0.3. rate: 0.1. new: 0.47
    expect(updated.dimensions.category_diversity.value).toBeCloseTo(0.47);

    // Bandit updates
    expect(updated.bandit.pulls.price_sensitivity).toBe(1);
    expect(updated.bandit.rewards.price_sensitivity).toBe(1);
  });

  it('should move genome values closer to product vector on "saved" with smaller rate', () => {
    const genome = defaultGenome();
    const updated = calculateFeedbackUpdate(genome, baseProductVector, 'saved');

    // unit_price: 0.8, current: 0.5. diff: 0.3. rate: 0.05. new: 0.515
    expect(updated.dimensions.price_sensitivity.value).toBeCloseTo(0.515);

    // Bandit updates
    expect(updated.bandit.pulls.price_sensitivity).toBe(1);
    expect(updated.bandit.rewards.price_sensitivity).toBe(0.5);
  });

  it('should move genome values away from product vector on "not_interested"', () => {
    const genome = defaultGenome();
    const updated = calculateFeedbackUpdate(genome, baseProductVector, 'not_interested');

    // unit_price: 0.8, current: 0.5. diff: 0.3. rate: 0.05. new: 0.5 - 0.015 = 0.485
    expect(updated.dimensions.price_sensitivity.value).toBeCloseTo(0.485);
    // category_breadth: 0.2, current: 0.5. diff: -0.3. rate: 0.05. new: 0.5 - (-0.015) = 0.515
    expect(updated.dimensions.category_diversity.value).toBeCloseTo(0.515);

    // Bandit updates
    expect(updated.bandit.pulls.price_sensitivity).toBe(1);
    expect(updated.bandit.rewards.price_sensitivity).toBe(0);
  });

  it('should not mutate the original genome', () => {
    const genome = defaultGenome();
    const originalValue = genome.dimensions.price_sensitivity.value;
    calculateFeedbackUpdate(genome, baseProductVector, 'purchased');
    expect(genome.dimensions.price_sensitivity.value).toBe(originalValue);
  });

  it('should clip values to [0, 1]', () => {
    const genome = defaultGenome();
    genome.dimensions.price_sensitivity.value = 0.95;
    const extremeVector = { ...baseProductVector, unit_price: 1.0 };

    // If we purchase multiple times, it should not exceed 1.0
    let updated = calculateFeedbackUpdate(genome, extremeVector, 'purchased');
    updated = calculateFeedbackUpdate(updated, extremeVector, 'purchased');

    expect(updated.dimensions.price_sensitivity.value).toBeLessThanOrEqual(1.0);
    expect(updated.dimensions.price_sensitivity.value).toBeGreaterThan(0.95);
  });
});
