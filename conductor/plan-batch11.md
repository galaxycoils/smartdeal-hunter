# Phase 3 Batch 1 — Multi-Store Expansion (P3.1)

**Goal:** Support international Amazon domains (UK, DE, JP) with locale-aware scraping and scoring normalization.

## Tasks

### P3.1.1 — Global Host Support

- [ ] Update `wxt.config.ts` `host_permissions` to include:
  - `https://*.amazon.co.uk/*`
  - `https://*.amazon.de/*`
  - `https://*.amazon.co.jp/*`
- [ ] Update `entrypoints/content.ts` `matches` array to include the new international domains.
- [ ] Update `entrypoints/popup/Dashboard.tsx` `isAmazonProductUrl` regex to handle UK, DE, and JP TLDs.

### P3.1.2 — Locale-Aware Scraper

- [ ] Refactor `lib/scraper.ts`:
  - `extractFromDom`: Update price regex to handle different currency symbols and decimal separators (e.g., `,` for DE).
  - `extractFromDom`: Update rating regex for international text (e.g., "4.5 von 5 Sternen", "5つ星のうち4.5").
  - `scrapeProduct`: Detect currency/locale from URL or `lang` attribute.

### P3.1.3 — Dimensionless Scoring Normalization & Messaging

- [ ] Update `lib/scoring.ts`: Replace the hardcoded `200` max price in `toAttributeVector` with a locale-aware `getMaxPrice(currency)` function (e.g., 200 for USD/EUR/GBP, 30000 for JPY) to avoid brittle static exchange rates.
- [ ] Update `lib/messaging/types.ts`: Extend `ScrapeResponse` and `RenderPanelMessage` payload to include `price`, `currency`, and `region`.
- [ ] Update `lib/analysis-cache.ts`: Add fallback handling for existing cached products missing `currency` or `region` (default to USD/US).

### P3.1.4 — International UI Polish

- [ ] Update `components/ui/ScoutPanel.tsx` and `entrypoints/popup/Dashboard.tsx` to display the actual `price` and `currency` formatting alongside the scores.
- [ ] Add a "Region Detected" badge (e.g., US, UK, DE, JP) in the Scout Result cards based on the returned payload.

## Verification

- [ ] New unit tests in `tests/lib/scraper.test.ts` for UK, DE, and JP mock HTML.
- [ ] New unit tests in `tests/lib/scoring.test.ts` for JPY price normalization.
- [ ] E2E smoke test on a mock Amazon UK product page.
- [ ] Verify `pnpm build` size impact.

## Dependency Order

P3.1.1 -> P3.1.2 -> P3.1.3 -> P3.1.4
