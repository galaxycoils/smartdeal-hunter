# Phase 3 Batch 2 — Advanced Visualization & Regional Scaling

**Goal:** Refine price history charts (P3.2) and expand Amazon support to remaining EU domains (FR, IT, ES, CA).

## Tasks

### P3.2.1 — Advanced Charting (P3.2)

- [ ] Upgrade `components/ui/PriceChart.tsx` to include interactive tooltips and historical price points using `recharts`.
- [ ] Implement data storage/retrieval for 30-day price history in `lib/price-history.ts`.
- [ ] Add "Price Trend" analysis (e.g., "Trending down") below the chart.

### P3.2.2 — International Expansion (P3.1.2)

- [ ] Implement scraper support for Amazon CA, FR, IT, ES.
- [ ] Update locale-specific currency and region handling.
- [ ] Verification: Unit tests for CA, FR, IT, ES mock HTML.

### P3.2.3 — UI/UX Finalization

- [ ] Add "View Price History" toggle in the Scout Panel.
- [ ] Refine animation transitions between states.

## Verification

- [ ] Interactive price history chart renders with data.
- [ ] Unit tests for new international scraper domains pass.
- [ ] No regression on P3.1/P3.3 functionality.
