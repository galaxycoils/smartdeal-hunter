import { test as base, chromium, type BrowserContext, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Custom fixture to load the Chrome extension
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ browserName: _ }, use) => {
    const pathToExtension = path.join(process.cwd(), '.output/chrome-mv3');

    // Ensure the folder exists to avoid cryptic Playwright errors
    if (!fs.existsSync(pathToExtension)) {
      throw new Error(
        `Extension build folder not found at ${pathToExtension}. Run pnpm build first.`,
      );
    }

    const context = await chromium.launchPersistentContext('', {
      headless: false, // extensions only work in headful mode
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

test.describe('SmartDeal Hunter E2E', () => {
  test('should complete onboarding and show scout panel on Amazon', async ({
    page,
    extensionId,
  }) => {
    // 1. Go to Popup / Onboarding
    await page.goto(`chrome-extension://${extensionId}/entrypoints/popup/index.html`);

    // Step 0: Welcome
    await expect(page.getByText('Welcome to SmartDeal Hunter')).toBeVisible();
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Step 1: Preferences
    await expect(page.getByText('Your Preferences')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: All Set
    await expect(page.getByText('All Set!')).toBeVisible();
    await page.getByRole('button', { name: 'Finish' }).click();

    // Verify Dashboard
    await expect(page.getByText('Genome active and ready')).toBeVisible();

    // 2. Intercept Amazon and verify Scout Panel
    const fixturePath = path.join(process.cwd(), 'tests/e2e/fixtures/amazon-product.html');
    const fixtureHtml = fs.readFileSync(fixturePath, 'utf8');

    await page.route('**/*.amazon.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixtureHtml,
      });
    });

    await page.goto('https://www.amazon.com/dp/B000000000');

    // Trigger Scout from Popup (simulated by SCRAPE_REQUEST)
    // Actually, in the real app, user clicks "Quick Scout" in popup.
    // Let's just open popup again and click Quick Scout.
    await page.goto(`chrome-extension://${extensionId}/entrypoints/popup/index.html`);
    await page.getByRole('button', { name: 'Quick Scout' }).click();

    // Navigate back to amazon tab or check the injection
    // Note: createShadowRootUi injects into the page.
    const amazonPage = await page.context().newPage();
    await amazonPage.route('**/*.amazon.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml });
    });
    await amazonPage.goto('https://www.amazon.com/dp/B000000000');

    // Trigger from original page
    await page.bringToFront();
    await page.getByRole('button', { name: 'Quick Scout' }).click();

    // Check amazonPage for shadow root
    await amazonPage.bringToFront();
    const _scoutPanel = amazonPage.locator('smartdeal-scout-panel');
    // WXT createShadowRootUi uses the name as the tag or container id.
    // We expect the panel to be visible.
    await expect(amazonPage.locator('h2:has-text("SmartDeal Scout")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should wipe all data from options page', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/entrypoints/options/index.html`);

    await expect(page.getByText('Privacy & Compliance')).toBeVisible();

    // Click Wipe
    await page.getByRole('button', { name: 'Wipe All Data' }).click();

    // Confirm (browser.dialog is handled by playwright or we mock the UI confirm)
    // In our App.tsx we used window.confirm
    page.on('dialog', (dialog) => dialog.accept());

    await expect(page.getByText('All data has been cleared')).toBeVisible();
  });
});
