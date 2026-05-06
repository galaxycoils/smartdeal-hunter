# Implementation Plan - Phase 3 Parallel Execution

## 1. 🔍 Analysis & Context

- **Objective:** Execute Phase 3 parallel streams: Amazon Scraper, Price History DB, Gemini Sentiment, Branded Assets.
- **Streams:**
  - Stream 1: P3.1.2 (Amazon TLDs: CA, FR, IT, ES)
  - Stream 2: P3.2 (Price History DB & SVG charts)
  - Stream 3: P3.3 (Gemini Sentiment Integration)
  - Stream 4: P3.4 (Branded Assets & Animations)
- **Risks:** Resource contention if streams share storage/DB.

## 2. 📋 Checklist

- [ ] Stream 1: Amazon TLD expansion
- [ ] Stream 2: Price History DB & SVG Chart
- [ ] Stream 3: Gemini Sentiment
- [ ] Stream 4: Branded Assets & Animations
- [ ] Verification & Integration

## 3. 📝 Implementation Details

### Stream 1: P3.1.2 (Scraper)

- **Action**: Update `lib/scraper.ts` regex and fetch logic to handle Amazon TLDs.
- **Verification**: New TLD test cases in `tests/lib/scraper.test.ts`.

### Stream 2: P3.2 (History)

- **Action**:
  - Update `lib/price-history.ts` (IndexedDB logic).
  - Add `PriceChart.tsx` (Recharts/SVG).
  - Modify `entrypoints/content.ts` for tracking.
- **Verification**: DB store verification, Chart component test.

### Stream 3: P3.3 (Sentiment)

- **Action**:
  - Implement `lib/sentiment.ts` (Gemini Nano via Chrome AI API).
  - Add summary UI to `components/ui/DeepCheckTab.tsx`.
- **Verification**: Test sentiment summary generation.

### Stream 4: P3.4 (Assets)

- **Action**:
  - Add `assets/brand/`.
  - Update UI components to use tokens.
  - Add `Framer Motion` for entry animations.
- **Verification**: Visual check of branding.

## 4. 🧪 Testing Strategy

- All streams require unit/integration tests before final integration.

## 5. ✅ Success Criteria

- Amazon CA/FR/IT/ES scraping works.
- Price chart displays price history.
- Sentiment summary appears on Deep Check.
- UI uses branded assets + animations.
