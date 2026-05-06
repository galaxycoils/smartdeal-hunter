# Phase 2 Batch 10: Advanced Charting

## Objectives

- Enhance `lib/price-history.ts` to support 30-day filtering.
- Upgrade `components/ui/PriceChart.tsx` to provide interactive 30-day charting using Recharts.
- Add textual "Price Trend" analysis (e.g., "30-day trend: +5%").

## Implementation Plan

1. **lib/price-history.ts**:
   - Add `get30DayPriceHistory(asin: string)` function.
   - Implement date calculation logic (Date.now() - 30 days).
2. **components/ui/PriceChart.tsx**:
   - Update chart configuration for improved readability.
   - Use 'recharts' features for interactivity (activeDot, tooltip, custom formatting).
   - Add trend indicator component based on historical data calculations.
3. **Tests**:
   - Update `tests/components/ui/PriceChart.test.tsx` to verify interactive chart elements.
   - Add `tests/lib/price-history.test.ts` (if not exists) to test 30-day filter logic.

## Verification Gate

- All tests pass, including the new 30-day filter logic.
- Price trend indicator correctly calculates trend percentage.
- Interactive chart elements (tooltip, active dot) are visible.
