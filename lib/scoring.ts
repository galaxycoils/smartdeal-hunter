import type { ProductData, Genome, ProductAttributeVector } from './types';
import {
  BASE_RATING_WEIGHT,
  REVIEW_COUNT_SCALE,
  BRAND_TRUST_MAP,
  MAX_TRUE_VALUE,
  MAX_PERSONAL_FIT,
  DISCOUNT_THRESHOLD,
} from './scoring-constants';
import { getMaxPrice } from './currency';

/**
 * Extracts brand name from ProductData (jsonLd or title)
 */
const extractBrand = (data: ProductData): string => {
  if (data.jsonLd && typeof data.jsonLd === 'object' && data.jsonLd !== null) {
    const jsonLd = data.jsonLd as { brand?: { name?: string } | string };
    if (jsonLd.brand && typeof jsonLd.brand === 'object' && jsonLd.brand.name)
      return jsonLd.brand.name;
    if (typeof jsonLd.brand === 'string') return jsonLd.brand;
  }
  // Fallback to Generic if not found
  return 'Generic';
};

/**
 * Calculates rating strength based on rating and review count
 */
const calculateRatingStrength = (rating: number | null, reviewCount: number | null): number => {
  if (rating === null || reviewCount === null || reviewCount === 0) return 0;
  const ratingScore = rating / 5.0;
  const confidence = reviewCount / (reviewCount + REVIEW_COUNT_SCALE);
  return ratingScore * confidence;
};

/**
 * Calculates a value score based on price normalization and discounts
 */
const calculateValueScore = (data: ProductData): number => {
  const discountPct =
    data.listPrice && data.price && data.listPrice > 0
      ? Math.max(0, (data.listPrice - data.price) / data.listPrice)
      : 0;

  // If discount meets threshold, it's a high value (1.0)
  // Otherwise, it scales from 0.5 (neutral) to 1.0
  return discountPct >= DISCOUNT_THRESHOLD
    ? 1.0
    : 0.5 + (discountPct / (DISCOUNT_THRESHOLD || 1)) * 0.5;
};

/**
 * Calculates True Value score (intrinsic quality/trust/value)
 */
export const calculateTrueValue = (data: ProductData): number => {
  // Handle missing data: if no rating and no price, return 0
  if (data.rating === null && data.price === null) return 0;

  const ratingStrength = calculateRatingStrength(data.rating, data.reviewCount);
  const brand = extractBrand(data);
  const brandScore = BRAND_TRUST_MAP[brand] || BRAND_TRUST_MAP['Generic'];
  const valueScore = calculateValueScore(data);

  // Weighted sum:
  // BASE_RATING_WEIGHT (0.4) for rating strength
  // Remaining 0.6 split equally between brand trust and price/unit value
  const remainingWeight = 1.0 - BASE_RATING_WEIGHT;
  const brandWeight = remainingWeight / 2;
  const valueWeight = remainingWeight / 2;

  const score =
    (ratingStrength * BASE_RATING_WEIGHT + brandScore * brandWeight + valueScore * valueWeight) *
    MAX_TRUE_VALUE;

  return Math.min(MAX_TRUE_VALUE, Math.max(0, score));
};

/**
 * Maps ProductData to a ProductAttributeVector for personal fit calculation
 */
export const toAttributeVector = (data: ProductData): ProductAttributeVector => {
  const ratingStrength = calculateRatingStrength(data.rating, data.reviewCount);
  const brand = extractBrand(data);
  const brandTrust = BRAND_TRUST_MAP[brand] || BRAND_TRUST_MAP['Generic'];

  const discountPct =
    data.listPrice && data.price && data.listPrice > 0
      ? Math.max(0, (data.listPrice - data.price) / data.listPrice)
      : 0;

  // Normalize price: 0 is expensive (maxPrice+), 1 is cheap ($0)
  const maxPrice = getMaxPrice(data.currency || 'USD');
  const normalizedPrice = data.price ? Math.max(0, 1 - data.price / maxPrice) : 0.5;

  return {
    unit_price: normalizedPrice,
    rating_strength: ratingStrength,
    review_volume: data.reviewCount ? Math.min(1, data.reviewCount / REVIEW_COUNT_SCALE) : 0,
    brand_trust: brandTrust,
    discount_pct: discountPct,
    eco_signal: 0.5, // Neutral placeholder
    novelty_signal: 0.5, // Neutral placeholder
    category_breadth: 0.5, // Neutral placeholder
  };
};

/**
 * Calculates Personal Fit score (alignment with user genome)
 */
export const calculatePersonalFit = (genome: Genome, data: ProductData): number => {
  const vector = toAttributeVector(data);
  const dimensions = genome.dimensions;

  // Weighted dot product between genome dimensions and product attributes
  const dotProduct =
    dimensions.price_sensitivity.value * vector.unit_price +
    dimensions.brand_affinity.value * vector.brand_trust +
    dimensions.quality_priority.value * vector.rating_strength +
    dimensions.review_weight.value * vector.review_volume +
    dimensions.discount_sensitivity.value * vector.discount_pct +
    dimensions.sustainability.value * vector.eco_signal +
    dimensions.novelty_seeking.value * vector.novelty_signal +
    dimensions.category_diversity.value * vector.category_breadth;

  const totalWeight = Object.values(dimensions).reduce((sum, d) => sum + d.weight, 0);

  if (totalWeight === 0) return 0;

  const normalizedScore = (dotProduct / totalWeight) * MAX_PERSONAL_FIT;

  return Math.min(MAX_PERSONAL_FIT, Math.max(0, normalizedScore));
};
