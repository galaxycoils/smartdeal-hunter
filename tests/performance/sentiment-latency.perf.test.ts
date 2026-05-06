/**
 * Phase 4 WU-4 — sentiment latency perf budget.
 *
 * Two branches per CLAUDE.md degradation chain:
 *   A) Nano available: warmup + 5 measured runs, p95 < 1500 ms
 *   B) Nano absent (heuristic fallback): 20 measured runs, p95 < 50 ms
 *
 * Branch selected at runtime by checking `typeof self.ai === 'object'`.
 * Tests stub the global so behavior is deterministic regardless of host.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyzeSentiment } from '../../lib/sentiment';

type GlobalWithAi = typeof globalThis & {
  ai?: {
    summarizer?: {
      create: () => Promise<{ summarize: (t: string) => Promise<string> }>;
    };
  };
};

const g = globalThis as GlobalWithAi;

const SAMPLE_LONG = (
  'I bought this last month and it has been excellent. ' +
  'The build quality is great and battery life is amazing. ' +
  'Customer service was helpful when I had a question. ' +
  'Highly recommend for anyone in the market for one. ' +
  'A few minor nitpicks but overall best in class.'
).repeat(3);

const percentile = (samples: number[], p: number): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
};

describe('perf: sentiment branch B — heuristic fallback (Nano absent)', () => {
  beforeEach(() => {
    delete g.ai;
  });

  it('p95 of 20 heuristic runs is under 50 ms', async () => {
    // warmup
    await analyzeSentiment(SAMPLE_LONG);

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await analyzeSentiment(SAMPLE_LONG);
      samples.push(performance.now() - start);
    }
    const p95 = percentile(samples, 95);
    expect(p95).toBeLessThan(50);
  });
});

describe('perf: sentiment branch A — Nano available (mocked summarizer)', () => {
  beforeEach(() => {
    // Mock Nano with a small artificial latency to exercise the warm path
    g.ai = {
      summarizer: {
        create: vi.fn().mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 5));
          return {
            summarize: vi.fn().mockImplementation(async () => {
              await new Promise((r) => setTimeout(r, 10));
              return 'Concise mock summary, generally positive.';
            }),
          };
        }),
      },
    };
  });

  afterEach(() => {
    delete g.ai;
  });

  it('p95 of 5 Nano runs is under 1500 ms after explicit warmup', async () => {
    // warmup — discard
    await analyzeSentiment(SAMPLE_LONG);

    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await analyzeSentiment(SAMPLE_LONG);
      samples.push(performance.now() - start);
    }
    const p95 = percentile(samples, 95);
    expect(p95).toBeLessThan(1500);
  });
});
