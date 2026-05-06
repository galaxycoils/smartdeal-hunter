/**
 * Phase 4 WU-9 — options accessibility audit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import axe from 'axe-core';
import '@testing-library/jest-dom/vitest';

const { mockGenome } = vi.hoisted(() => {
  const dims = [
    'price_sensitivity',
    'brand_affinity',
    'quality_priority',
    'sustainability',
    'novelty_seeking',
    'review_weight',
    'discount_sensitivity',
    'category_diversity',
  ];
  return {
    mockGenome: () => ({
      version: 1,
      isOnboarded: true,
      revision: 1,
      dimensions: dims.reduce(
        (acc, d) => {
          acc[d] = { value: 0.5, weight: 1 / dims.length };
          return acc;
        },
        {} as Record<string, { value: number; weight: number }>,
      ),
      bandit: { pulls: {}, rewards: {} },
      createdAt: 0,
      updatedAt: 0,
    }),
  };
});

vi.mock('../../lib/storage', () => ({
  getEncryptedItem: vi.fn().mockResolvedValue(mockGenome()),
  setEncryptedItem: vi.fn(),
  wipeAllData: vi.fn(),
  STORE_GENOME: 'genome',
}));

vi.mock('../../lib/genome', () => ({
  loadGenome: vi.fn().mockResolvedValue(mockGenome()),
  saveGenome: vi.fn(),
  defaultGenome: vi.fn().mockReturnValue(mockGenome()),
  onGenomeChange: vi.fn().mockReturnValue(() => undefined),
  validateGenome: vi.fn().mockReturnValue(true),
  GENOME_VERSION_CURRENT: 1,
}));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      getManifest: vi.fn().mockReturnValue({ version: '0.0.1', name: 'SmartDeal Hunter' }),
      id: 'mock-extension-id',
    },
    alarms: { create: vi.fn(), clear: vi.fn(), getAll: vi.fn().mockResolvedValue([]) },
  },
}));

import { App } from '../../entrypoints/options/App';

const SEVERE = ['serious', 'critical'];

const runAxe = async (container: HTMLElement) => {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  });
  return results.violations.filter((v) => SEVERE.includes(v.impact ?? ''));
};

describe('a11y: options App (WCAG 2.1 AA, serious + critical only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('Options App default tab has zero severe violations', async () => {
    const { container } = render(React.createElement(App));
    await new Promise((r) => setTimeout(r, 50));
    const violations = await runAxe(container);
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`)
        .join('\n');
      throw new Error(`axe Options found ${violations.length}:\n${summary}`);
    }
    expect(violations).toHaveLength(0);
  });
});
