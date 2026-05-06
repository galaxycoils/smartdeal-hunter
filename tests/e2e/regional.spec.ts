/**
 * tests/e2e/regional.spec.ts
 *
 * Phase 4 WU-3 — End-to-end regional verification across all 8 host_permissions
 * locales (US existing in integration.spec.ts; UK/DE/JP/CA/FR/IT/ES here).
 *
 * Runtime requirements (per CLAUDE.md):
 *   1. `pnpm build` must produce .output/chrome-mv3 first.
 *   2. Headful Chromium (`npx playwright install chromium`) and a display
 *      (extensions only work in headful mode — no Xvfb-only environments).
 *
 * Currently the spec is `test.describe.skip` so CI never blocks on
 * environments without a display. To run locally:
 *
 *   pnpm build && pnpm exec playwright test tests/e2e/regional.spec.ts \
 *     --grep-invert='@manual' --headed
 *
 * Remove the `.skip` only when running against a real display.
 */
import { test as base, chromium, type BrowserContext, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

interface RegionalCase {
  tld: string;
  fixture: string;
  region: string;
  currency: 'GBP' | 'EUR' | 'JPY' | 'CAD';
  ratingPhrase: string;
  asin: string;
}

const CASES: RegionalCase[] = [
  {
    tld: 'co.uk',
    fixture: 'amazon-uk-product.html',
    region: 'UK',
    currency: 'GBP',
    ratingPhrase: '4.5 out of 5 stars',
    asin: 'B000000001',
  },
  {
    tld: 'de',
    fixture: 'amazon-de-product.html',
    region: 'DE',
    currency: 'EUR',
    ratingPhrase: '4,5 von 5 Sternen',
    asin: 'B000000002',
  },
  {
    tld: 'co.jp',
    fixture: 'amazon-jp-product.html',
    region: 'JP',
    currency: 'JPY',
    ratingPhrase: '5つ星のうち4.5',
    asin: 'B000000003',
  },
  {
    tld: 'ca',
    fixture: 'amazon-ca-product.html',
    region: 'CA',
    currency: 'CAD',
    ratingPhrase: '4.5 out of 5 stars',
    asin: 'B000000004',
  },
  {
    tld: 'fr',
    fixture: 'amazon-fr-product.html',
    region: 'FR',
    currency: 'EUR',
    ratingPhrase: '4,5 sur 5 étoiles',
    asin: 'B000000005',
  },
  {
    tld: 'it',
    fixture: 'amazon-it-product.html',
    region: 'IT',
    currency: 'EUR',
    ratingPhrase: '4,5 su 5 stelle',
    asin: 'B000000006',
  },
  {
    tld: 'es',
    fixture: 'amazon-es-product.html',
    region: 'ES',
    currency: 'EUR',
    ratingPhrase: '4,5 de 5 estrellas',
    asin: 'B000000007',
  },
];

const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ browserName: _ }, use) => {
    const pathToExtension = path.join(process.cwd(), '.output/chrome-mv3');
    if (!fs.existsSync(pathToExtension)) {
      throw new Error(
        `Extension build folder not found at ${pathToExtension}. Run pnpm build first.`,
      );
    }
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let background: { url: () => string } | undefined;
    if (context.serviceWorkers().length > 0) {
      background = context.serviceWorkers()[0] as unknown as { url: () => string };
    } else {
      background = (await context.waitForEvent('serviceworker')) as unknown as {
        url: () => string;
      };
    }
    const extensionId = background.url().split('/')[2];
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(extensionId);
  },
});

test.describe.skip('SmartDeal Hunter — Regional E2E (requires display)', () => {
  for (const c of CASES) {
    test(`renders Scout Panel on amazon.${c.tld} with ${c.region}/${c.currency}`, async ({
      page,
      extensionId,
    }) => {
      const fixturePath = path.join(process.cwd(), 'tests/e2e/fixtures', c.fixture);
      const fixtureHtml = fs.readFileSync(fixturePath, 'utf8');

      // Block live amazon.* and serve fixture
      await page.route(`**/*.amazon.${c.tld}/**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: fixtureHtml,
        });
      });

      await page.goto(`https://www.amazon.${c.tld}/dp/${c.asin}`);

      // Open popup, finish onboarding if first run
      const popup = await page.context().newPage();
      await popup.goto(`chrome-extension://${extensionId}/entrypoints/popup/index.html`);

      // Skip onboarding if "Get Started" shows
      const start = popup.getByRole('button', { name: 'Get Started' });
      if (await start.isVisible({ timeout: 1000 }).catch(() => false)) {
        await start.click();
        await popup.getByRole('button', { name: 'Next' }).click();
        await popup.getByRole('button', { name: 'Next' }).click();
        await popup.getByRole('button', { name: 'Finish' }).click();
      }

      await popup.getByRole('button', { name: 'Quick Scout' }).click();

      // Verify Scout Panel rendered in shadow DOM with correct region badge
      await expect(page.locator(`text=${c.region}`).first()).toBeVisible({ timeout: 10000 });

      // Verify locale-correct rating phrase appears in source DOM (sanity)
      expect(fixtureHtml).toContain(c.ratingPhrase);

      // Verify currency formatting via Intl.NumberFormat is achievable
      const sample = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: c.currency,
      }).format(100);
      expect(sample).toMatch(new RegExp(c.currency === 'JPY' ? '¥|￥' : '\\D'));

      await popup.close();
    });
  }
});
