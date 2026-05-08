import type { ReviewSample, AuthenticityResult } from './types';

export const SIGNAL_WEIGHTS = {
  bigramJaccardUniqueness: 0.25,
  ratingDistribution: 0.2,
  temporalCluster: 0.15,
  bodyLengthVariance: 0.1,
  verifiedRatio: 0.15,
  helpfulVotesAvg: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Bigram helpers
// ---------------------------------------------------------------------------

function buildBigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s[i] + s[i + 1]);
  }
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// ---------------------------------------------------------------------------
// Signal functions (each returns 0–100; higher = more authentic)
// ---------------------------------------------------------------------------

function signalBigramJaccardUniqueness(bodies: string[]): number {
  const bigrams = bodies.map((b) => buildBigrams(b.toLowerCase()));
  let totalSim = 0;
  let pairs = 0;
  for (let i = 0; i < bigrams.length; i++) {
    for (let j = i + 1; j < bigrams.length; j++) {
      totalSim += jaccardSimilarity(bigrams[i], bigrams[j]);
      pairs++;
    }
  }
  return 100 - Math.round((pairs > 0 ? totalSim / pairs : 0) * 100);
}

function signalRatingDistribution(ratings: number[]): number {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    if (r in counts) counts[r]++;
  }
  const maxFraction = Math.max(...Object.values(counts)) / ratings.length;
  return 100 - Math.round(maxFraction * 100);
}

function parseDate(dateStr: string): Date | null {
  const cleaned = dateStr.replace(/^Reviewed in .+ on /, '').trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function signalTemporalCluster(dates: string[]): number {
  const parsed = dates.map(parseDate).filter((d): d is Date => d !== null);
  if (parsed.length < 3) return 50;

  const ms = parsed.map((d) => d.getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      gaps.push((ms[j] - ms[i]) / 86_400_000); // days
    }
  }
  gaps.sort((a, b) => a - b);
  const medianGap = median(gaps);
  return Math.min(100, Math.round(medianGap * 5));
}

function signalBodyLengthVariance(bodies: string[]): number {
  const lengths = bodies.map((b) => b.length);
  const mean = lengths.reduce((s, l) => s + l, 0) / lengths.length;
  if (mean === 0) return 0;
  const variance = lengths.reduce((s, l) => s + (l - mean) ** 2, 0) / lengths.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.min(100, Math.round(cv * 200));
}

function signalVerifiedRatio(samples: ReviewSample[]): number {
  const verified = samples.filter((s) => s.verified).length;
  return Math.round((verified / samples.length) * 100);
}

function signalHelpfulVotesAvg(samples: ReviewSample[]): number {
  const mean = samples.reduce((s, r) => s + r.helpful, 0) / samples.length;
  return Math.min(100, Math.round(mean * 10));
}

// ---------------------------------------------------------------------------
// Per-review suspicion tally
// ---------------------------------------------------------------------------

interface SuspicionEntry {
  index: number;
  tally: number;
  reasons: string[];
}

function computeSuspicion(
  samples: ReviewSample[],
  bigrams: Set<string>[],
  parsedDates: (Date | null)[],
): SuspicionEntry[] {
  const entries: SuspicionEntry[] = samples.map((_, i) => ({
    index: i,
    tally: 0,
    reasons: [],
  }));

  // Duplicate body (Jaccard >= 0.6 with another review)
  for (let i = 0; i < bigrams.length; i++) {
    for (let j = i + 1; j < bigrams.length; j++) {
      if (jaccardSimilarity(bigrams[i], bigrams[j]) >= 0.6) {
        entries[i].tally += 30;
        entries[i].reasons.push('duplicate body content');
        entries[j].tally += 30;
        entries[j].reasons.push('duplicate body content');
      }
    }
  }

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];

    // 5-star with empty/very short body (< 50 chars)
    if (s.rating === 5 && s.body.length < 50) {
      entries[i].tally += 20;
      entries[i].reasons.push('5-star with very short body');
    }

    // Not verified + 5-star
    if (!s.verified && s.rating === 5) {
      entries[i].tally += 15;
      entries[i].reasons.push('unverified 5-star review');
    }

    // Helpful votes 0 AND not verified
    if (s.helpful === 0 && !s.verified) {
      entries[i].tally += 10;
      entries[i].reasons.push('no helpful votes and unverified');
    }
  }

  // Date in dense cluster (within 24h of >= 3 others)
  for (let i = 0; i < parsedDates.length; i++) {
    const di = parsedDates[i];
    if (di === null) continue;
    let closeCount = 0;
    for (let j = 0; j < parsedDates.length; j++) {
      if (i === j) continue;
      const dj = parsedDates[j];
      if (dj === null) continue;
      if (Math.abs(di.getTime() - dj.getTime()) <= 86_400_000) closeCount++;
    }
    if (closeCount >= 3) {
      entries[i].tally += 15;
      entries[i].reasons.push('posted in 24h cluster');
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function calculateAuthenticityScore(samples: ReviewSample[]): AuthenticityResult {
  if (samples.length < 5) {
    return { score: 50, sampleCount: samples.length, suspiciousIndices: [], reasons: {} };
  }

  const bodies = samples.map((s) => s.body);
  const bigrams = bodies.map((b) => buildBigrams(b.toLowerCase()));
  const parsedDates = samples.map((s) => parseDate(s.date));

  const signals = {
    bigramJaccardUniqueness: signalBigramJaccardUniqueness(bodies),
    ratingDistribution: signalRatingDistribution(samples.map((s) => s.rating)),
    temporalCluster: signalTemporalCluster(samples.map((s) => s.date)),
    bodyLengthVariance: signalBodyLengthVariance(bodies),
    verifiedRatio: signalVerifiedRatio(samples),
    helpfulVotesAvg: signalHelpfulVotesAvg(samples),
  };

  const composite = Math.round(
    SIGNAL_WEIGHTS.bigramJaccardUniqueness * signals.bigramJaccardUniqueness +
      SIGNAL_WEIGHTS.ratingDistribution * signals.ratingDistribution +
      SIGNAL_WEIGHTS.temporalCluster * signals.temporalCluster +
      SIGNAL_WEIGHTS.bodyLengthVariance * signals.bodyLengthVariance +
      SIGNAL_WEIGHTS.verifiedRatio * signals.verifiedRatio +
      SIGNAL_WEIGHTS.helpfulVotesAvg * signals.helpfulVotesAvg,
  );

  const suspicionEntries = computeSuspicion(samples, bigrams, parsedDates);
  const withTally = suspicionEntries
    .filter((e) => e.tally > 0)
    .sort((a, b) => b.tally - a.tally)
    .slice(0, 10);

  const suspiciousIndices = withTally.map((e) => e.index);
  const reasons: Record<number, string[]> = {};
  for (const e of withTally) {
    // Deduplicate reasons (same reason may be added multiple times from pair loop)
    reasons[e.index] = [...new Set(e.reasons)];
  }

  return {
    score: Math.max(0, Math.min(100, composite)),
    sampleCount: samples.length,
    suspiciousIndices,
    reasons,
  };
}
