# Phase 3 — Scaling & Intelligence

**Objective:** Expand SmartDeal Hunter's utility beyond Amazon US and deepen price/sentiment intelligence via local-first visualization and advanced LLM integration.

## Tasks

### P3.1 Multi-Store Expansion

**Goal:** Support major Amazon international domains.

- [ ] Implement locale-aware scraper logic (Amazon UK, DE, JP, CA, FR, IT, ES).
- [ ] Add currency normalization engine for Genome scoring consistency.
- [ ] Update UI to display local pricing and shipping availability.
- [ ] **Acceptance:** Validated ASIN detection and scoring on 3+ non-US domains.

### P3.2 Price History Visualization

**Goal:** Provide on-device price context without external trackers.

- [ ] Implement local database for price tracking (IndexedDB/WXT Storage).
- [ ] Add Chart.js or lightweight SVG charting to Scout Panel and Popup.
- [ ] Calculate and display "Price Percentile" against seen local history.
- [ ] **Acceptance:** Interactive price history chart renders in Shadow-DOM panel.

### P3.3 Advanced Local LLM Sentiment

**Goal:** Upgrade "True Value" using local review summarization.

- [ ] Integrate Gemini Nano (Chrome built-in AI) or lightweight ONNX model for review summary.
- [ ] Extract "Pros/Cons" from top 10 local reviews on-device.
- [ ] Factor summary sentiment into the Genome 'Personal Fit' score.
- [ ] **Acceptance:** 1-paragraph on-device review summary appears in Deep Check tab.

### P3.4 Visual Identity & Assets

**Goal:** Move from bootstrap icons to branded professional assets.

- [ ] Generate unique brand mark and promotional tiles (docs/store-assets).
- [ ] Implement consistent animation layer (framer-motion or shadcn/animate).
- [ ] **Acceptance:** 100% of 'bootstrap' visual debt replaced with bespoke design.

## Technical Mandates

1. **Zero Cloud:** All P3 data (price history, LLM summaries) must remain local.
2. **Bundle Size:** Maintain < 5MB production build (inc. model assets if packaged).
3. **Performance:** Scrape + Chart render < 800ms.

## Dependency Order

P3.1 (Expansion) -> P3.2 (History) -> P3.3 (Intelligence)
