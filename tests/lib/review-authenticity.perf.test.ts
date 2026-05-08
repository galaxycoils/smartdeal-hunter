import { test, expect } from 'vitest';
import { calculateAuthenticityScore } from '@/lib/review-authenticity';
import type { ReviewSample } from '@/lib/types';

// Generate 50 samples with ~2 KB bodies as per D15 spec
function genCorpus(n: number): ReviewSample[] {
  const base = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
  const bodyPad = base.repeat(Math.ceil(2048 / base.length)).slice(0, 2048);

  return Array.from({ length: n }, (_, i) => ({
    id: `perf-r${i}`,
    title: `Performance test review ${i}`,
    body: `Review ${i}: ${bodyPad.slice(0, 2000 - String(i).length)}`,
    rating: (i % 5) + 1,
    date: `Reviewed in the United States on March ${(i % 28) + 1}, 2024`,
    helpful: i % 20,
    verified: i % 3 !== 0,
  }));
}

test('perf: median ≤ 200ms over 5 runs on 50-sample 2KB-body corpus', { retry: 2 }, () => {
  const corpus = genCorpus(50);
  const runs: number[] = [];

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    calculateAuthenticityScore(corpus);
    runs.push(performance.now() - t0);
  }

  runs.sort((a, b) => a - b);
  const median = runs[2];
  expect(median).toBeLessThan(200);
});
