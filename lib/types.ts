export const GENOME_DIMENSIONS = [
  'price_sensitivity',
  'brand_affinity',
  'quality_priority',
  'sustainability',
  'novelty_seeking',
  'review_weight',
  'discount_sensitivity',
  'category_diversity',
] as const;
export type GenomeDimension = (typeof GENOME_DIMENSIONS)[number];

export interface GenomeDimensionState {
  value: number;
  weight: number;
}

export interface BanditState {
  pulls: Record<GenomeDimension, number>;
  rewards: Record<GenomeDimension, number>;
}

export const GENOME_VERSION_CURRENT = 1 as const;
export const GENOME_VERSIONS_SUPPORTED = [1] as const;
export type GenomeVersion = (typeof GENOME_VERSIONS_SUPPORTED)[number];

export interface Genome {
  version: GenomeVersion;
  revision?: number;
  isOnboarded: boolean;
  dimensions: Record<GenomeDimension, GenomeDimensionState>;
  bandit: BanditState;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEvent {
  ts: number;
  asin: string;
  kind: 'view' | 'analyze' | 'bundle-add';
}

export const PRODUCT_ATTRIBUTES = [
  'unit_price',
  'rating_strength',
  'review_volume',
  'brand_trust',
  'discount_pct',
  'eco_signal',
  'novelty_signal',
  'category_breadth',
] as const;
export type ProductAttribute = (typeof PRODUCT_ATTRIBUTES)[number];
export type ProductAttributeVector = Record<ProductAttribute, number>;

export type GenomeToProductWeights = (g: Genome) => ProductAttributeVector;

export interface ProductData {
  asin: string;
  title: string;
  price: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  jsonLd: unknown | null;
  url: string;
  scrapedAt: number;
  source: 'url' | 'jsonld' | 'dom';
  listPrice: number | null;
  unitPrice: number | null;
  quantity: number | null;
}

export interface ReviewSample {
  id: string; // DOM id attribute or fallback hash
  title: string; // textContent only; max 200 chars
  body: string; // textContent only; truncated to 2 KB
  rating: number; // integer 1-5
  date: string; // raw textContent of date element
  helpful: number; // helpful-vote count; 0 if absent
  verified: boolean; // true only if "Verified Purchase" detected
}

export interface AuthenticityResult {
  score: number; // 0-100 integer; 50 when sampleCount < 5
  sampleCount: number;
  suspiciousIndices: number[]; // sorted by descending suspicion
  reasons: Record<number, string[]>; // index → list of human-readable reasons
}
