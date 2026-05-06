/**
 * Phase 4 WU-4 — scrape latency perf budget.
 *
 * Budget: scrapeProduct on each WU-3 regional fixture, p95 < 200 ms.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { scrapeProduct } from '../../lib/scraper';

const FIXTURES = [
  { tld: 'co.uk', file: 'amazon-uk-product.html' },
  { tld: 'de', file: 'amazon-de-product.html' },
  { tld: 'co.jp', file: 'amazon-jp-product.html' },
  { tld: 'ca', file: 'amazon-ca-product.html' },
  { tld: 'fr', file: 'amazon-fr-product.html' },
  { tld: 'it', file: 'amazon-it-product.html' },
  { tld: 'es', file: 'amazon-es-product.html' },
] as const;

const RUNS = 20;
const BUDGET_P95_MS = 200;

const percentile = (samples: number[], p: number): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
};

const parseDoc = (html: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

describe('perf: scrape latency across regional fixtures', () => {
  for (const f of FIXTURES) {
    it(`scrapeProduct on amazon.${f.tld} fixture: p95 < ${BUDGET_P95_MS} ms over ${RUNS} runs`, () => {
      const html = readFileSync(join(process.cwd(), 'tests/e2e/fixtures', f.file), 'utf8');
      const url = `https://www.amazon.${f.tld}/dp/B000000001`;

      // warmup
      scrapeProduct(url, parseDoc(html), () => 1000);

      const samples: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const doc = parseDoc(html);
        const start = performance.now();
        scrapeProduct(url, doc, () => 1000);
        samples.push(performance.now() - start);
      }
      const p95 = percentile(samples, 95);
      expect(p95).toBeLessThan(BUDGET_P95_MS);
    });
  }
});
