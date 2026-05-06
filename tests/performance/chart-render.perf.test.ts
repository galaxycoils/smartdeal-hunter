/**
 * Phase 4 WU-4 — chart render perf budget.
 *
 * Budget: PriceChart with 30 records renders at p95 < 800 ms in happy-dom.
 *
 * Note: ResponsiveContainer is mocked (recharts requires ResizeObserver
 * which happy-dom doesn't ship). The mock keeps the LineChart subtree
 * which is the real cost driver.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { PriceChart } from '../../components/ui/PriceChart';
import type { PriceRecord } from '../../lib/price-history';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { style: { width: 800, height: 300 } }, children),
  };
});

const RUNS = 20;
const BUDGET_P95_MS = 800;

const buildRecords = (n: number): PriceRecord[] => {
  const now = Date.now();
  const day = 86_400_000;
  return Array.from({ length: n }, (_, i) => ({
    date: now - (n - 1 - i) * day,
    price: 50 + Math.sin(i / 3) * 10 + i * 0.3,
  }));
};

const percentile = (samples: number[], p: number): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
};

describe('perf: chart render', () => {
  beforeAll(() => {
    // warmup — load the chart module + mocks once to avoid cold-import skew
    const { unmount } = render(React.createElement(PriceChart, { data: buildRecords(30) }));
    unmount();
  });

  it('p95 of 20 renders w/ 30 records is under 800 ms', () => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const start = performance.now();
      const { unmount } = render(React.createElement(PriceChart, { data: buildRecords(30) }));
      const end = performance.now();
      samples.push(end - start);
      unmount();
      cleanup();
    }
    const p95 = percentile(samples, 95);
    expect(p95).toBeLessThan(BUDGET_P95_MS);
  });
});
