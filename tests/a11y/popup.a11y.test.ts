/**
 * Phase 4 WU-9 — popup accessibility audit.
 *
 * Runs axe-core against the popup primitives and asserts zero
 * `serious` and `critical` violations under WCAG 2.1 AA.
 *
 * Severities `minor` and `moderate` are reported in the JSON output
 * for follow-up but do not fail the suite at this gate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import axe from 'axe-core';
import '@testing-library/jest-dom/vitest';

import { Dashboard } from '../../entrypoints/popup/Dashboard';
import { Onboarding } from '../../entrypoints/popup/Onboarding';
import { GENOME_DIMENSIONS, type Genome } from '../../lib/types';
import * as genomeLib from '../../lib/genome';

vi.mock('../../lib/genome', () => ({
  defaultGenome: vi.fn(),
  saveGenome: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com', active: true }]),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}));

const mockGenome = (): Genome =>
  ({
    version: 1,
    isOnboarded: true,
    dimensions: GENOME_DIMENSIONS.reduce(
      (acc, dim) => {
        acc[dim] = { value: 0.5, weight: 1 / GENOME_DIMENSIONS.length };
        return acc;
      },
      {} as Record<string, { value: number; weight: number }>,
    ),
    bandit: { pulls: {}, rewards: {} },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }) as Genome;

const SEVERE = ['serious', 'critical'];

const runAxe = async (container: HTMLElement) => {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  });
  return results.violations.filter((v) => SEVERE.includes(v.impact ?? ''));
};

describe('a11y: popup primitives (WCAG 2.1 AA, serious + critical only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(genomeLib.defaultGenome).mockReturnValue(mockGenome());
  });

  afterEach(() => {
    cleanup();
  });

  it('Dashboard idle state has zero severe violations', async () => {
    const { container } = render(React.createElement(Dashboard, { genome: mockGenome() }));
    const violations = await runAxe(container);
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`)
        .join('\n');
      throw new Error(`axe Dashboard found ${violations.length}:\n${summary}`);
    }
    expect(violations).toHaveLength(0);
  });

  it('Onboarding step 1 has zero severe violations', async () => {
    const mockKey = {} as CryptoKey;
    const { container } = render(
      React.createElement(Onboarding, { cryptoKey: mockKey, onComplete: vi.fn() }),
    );
    const violations = await runAxe(container);
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`)
        .join('\n');
      throw new Error(`axe Onboarding found ${violations.length}:\n${summary}`);
    }
    expect(violations).toHaveLength(0);
  });
});
