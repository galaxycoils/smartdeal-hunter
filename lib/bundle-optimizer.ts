import { calculatePersonalFit, calculateTrueValue } from './scoring';
import { getAllItems, STORE_HISTORY_EVENTS } from './storage';
import type { Genome, HistoryEvent, ProductData } from './types';

export interface BundleItem {
  asin: string;
  title: string;
  price?: number;
  individualScore: number;
}

export interface Bundle {
  items: BundleItem[];
  rationale: string;
  score: number;
}

export interface BundleSeedFixture {
  seed: ProductData;
  candidates: ProductData[];
  acceptedAsins: string[];
}

const DIMENSION_LABELS: Record<keyof Genome['dimensions'], string> = {
  price_sensitivity: 'price sensitivity',
  brand_affinity: 'brand affinity',
  quality_priority: 'quality priority',
  sustainability: 'sustainability',
  novelty_seeking: 'novelty seeking',
  review_weight: 'review weighting',
  discount_sensitivity: 'discount sensitivity',
  category_diversity: 'category diversity',
};

let historyCounts = new Map<string, number>();

export async function refreshBundleHistory(): Promise<void> {
  const events = await getAllItems<HistoryEvent>(STORE_HISTORY_EVENTS);
  const nextCounts = new Map<string, number>();

  for (const event of events) {
    if (event.kind === 'view') continue;
    nextCounts.set(event.asin, (nextCounts.get(event.asin) ?? 0) + 1);
  }

  historyCounts = nextCounts;
}

function formatRationale(genome: Genome): string {
  const weighted = Object.entries(genome.dimensions)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .slice(0, 2)
    .map(([name]) => DIMENSION_LABELS[name as keyof Genome['dimensions']]);

  if (weighted.length === 0 || genome.dimensions.price_sensitivity.weight === 0) {
    const nonZero = Object.values(genome.dimensions).some((dim) => dim.weight > 0);
    if (!nonZero) {
      return 'Picked using local bundle history and product value signals.';
    }
  }

  return `Picked using your ${weighted.join(' and ')} preferences plus local bundle history.`;
}

function historyBoost(asin: string, maxCount: number): number {
  if (maxCount === 0) return 0;
  return ((historyCounts.get(asin) ?? 0) / maxCount) * 100;
}

export function optimizeBundle(
  seed: ProductData,
  candidates: ProductData[],
  genome: Genome,
): Bundle[] {
  if (candidates.length === 0) {
    return [];
  }

  const maxHistory = Math.max(0, ...historyCounts.values());
  const ranked = candidates
    .filter((candidate) => candidate.asin !== seed.asin)
    .map((candidate) => {
      const trueValue = calculateTrueValue(candidate);
      const personalFit = calculatePersonalFit(genome, candidate);
      const individualScore = Math.round(
        trueValue * 0.35 + personalFit * 0.35 + historyBoost(candidate.asin, maxHistory) * 0.3,
      );

      return {
        asin: candidate.asin,
        title: candidate.title,
        price: candidate.price ?? undefined,
        individualScore,
      } satisfies BundleItem;
    })
    .sort((a, b) => b.individualScore - a.individualScore)
    .slice(0, 3);

  if (ranked.length === 0) {
    return [];
  }

  const rationale = `${formatRationale(genome)} Seed: ${seed.title}.`;
  const score = Math.round(
    ranked.reduce((sum, item) => sum + item.individualScore, 0) / ranked.length,
  );

  return [
    {
      items: ranked,
      rationale,
      score,
    },
  ];
}
