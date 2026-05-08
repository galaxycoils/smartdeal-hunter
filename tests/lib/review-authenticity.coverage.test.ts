import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const summaryPath = resolve(__dirname, '../../coverage/coverage-summary.json');

test.skipIf(!existsSync(summaryPath))(
  'lib/review-authenticity.ts has ≥95% line and branch coverage',
  () => {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    const absKey = resolve(__dirname, '../../lib/review-authenticity.ts');
    const entry = summary[absKey];
    expect(entry, `coverage entry missing for ${absKey}`).toBeDefined();
    expect(entry.lines.pct).toBeGreaterThanOrEqual(95);
    expect(entry.branches.pct).toBeGreaterThanOrEqual(95);
  },
);
