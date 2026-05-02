import type { Genome, ProductAttributeVector, GenomeDimension, ProductAttribute } from './types';
import { clipAndRenormalize } from './genome';

const DIMENSION_TO_ATTRIBUTE: Record<GenomeDimension, ProductAttribute> = {
  price_sensitivity: 'unit_price',
  brand_affinity: 'brand_trust',
  quality_priority: 'rating_strength',
  sustainability: 'eco_signal',
  novelty_seeking: 'novelty_signal',
  review_weight: 'review_volume',
  discount_sensitivity: 'discount_pct',
  category_diversity: 'category_breadth',
};

export type FeedbackType = 'not_interested' | 'saved' | 'purchased';

const LEARNING_RATES: Record<FeedbackType, number> = {
  saved: 0.05,
  purchased: 0.1,
  not_interested: 0.05,
};

const REWARDS: Record<FeedbackType, number> = {
  saved: 0.5,
  purchased: 1.0,
  not_interested: 0.0,
};

export function calculateFeedbackUpdate(
  genome: Genome,
  productVector: ProductAttributeVector,
  feedbackType: FeedbackType,
): Genome {
  // Deep copy to avoid mutation
  const newGenome = JSON.parse(JSON.stringify(genome)) as Genome;

  const rate = LEARNING_RATES[feedbackType];
  const reward = REWARDS[feedbackType];
  const isPositive = feedbackType === 'saved' || feedbackType === 'purchased';

  for (const dim of Object.keys(DIMENSION_TO_ATTRIBUTE) as GenomeDimension[]) {
    const attr = DIMENSION_TO_ATTRIBUTE[dim];
    const productVal = productVector[attr];
    const currentVal = newGenome.dimensions[dim].value;

    const diff = productVal - currentVal;

    if (isPositive) {
      // Move closer to product vector
      newGenome.dimensions[dim].value = currentVal + diff * rate;
    } else {
      // Move away from product vector
      newGenome.dimensions[dim].value = currentVal - diff * rate;
    }

    // Update bandit
    newGenome.bandit.pulls[dim] += 1;
    newGenome.bandit.rewards[dim] += reward;
  }

  return clipAndRenormalize(newGenome);
}
