# Perf Budget — Phase 4

Source of truth: `docs/perf-baseline.json` (numbers + budgets) and
`tests/performance/*.perf.test.ts` (enforcement, blocking).

## Budgets

| Concern                   | p95 budget | Test file                                          |
| ------------------------- | ---------- | -------------------------------------------------- |
| PriceChart render (n=30)  | 800 ms     | `tests/performance/chart-render.perf.test.ts`      |
| scrapeProduct (per local) | 200 ms     | `tests/performance/scrape-latency.perf.test.ts`    |
| sentiment heuristic       | 50 ms      | `tests/performance/sentiment-latency.perf.test.ts` |
| sentiment Nano (mocked)   | 1500 ms    | `tests/performance/sentiment-latency.perf.test.ts` |

All four are **blocking** — `expect(p95).toBeLessThan(...)` fails the
suite (and therefore CI) on regression. They run as part of
`pnpm test:run` (no separate gate) so any PR sees them.

## Rationale

- **Chart render 800 ms**: ScoutPanel must feel snappy on click. Initial
  recharts mount of 30 points is the heaviest UI cost in the popup
  shadow-DOM; 800 ms is a noticeable but tolerable budget under v8.
- **Scrape 200 ms**: scraper runs on every Quick Scout and on every
  matching content-script load. Above 200 ms users perceive lag.
- **Sentiment heuristic 50 ms**: pure-JS keyword scan; should be
  effectively instant.
- **Sentiment Nano 1500 ms**: on-device summarizer is bounded by Chrome's
  Prompt API. Real-world cold call can exceed; the mocked test verifies
  the call-shape works under a generous warm budget. Hardware budget is
  validated manually before each release (see release checklist).

## Rollback if regressed

1. Identify the offending commit via `git bisect run pnpm test:run -- tests/performance/`.
2. If a feature change is the cause, prefer revert over budget loosening.
3. If genuinely needed, raise the budget by ≤ 20 % and note the
   rationale in `docs/perf-baseline.json` `notes`. Larger changes
   require a new Plan-Review-Gate iteration.

## Capturing a fresh baseline

```bash
pnpm test:run -- tests/performance/*.perf.test.ts --reporter=verbose
# Read the printed durations, then update budgets in
# docs/perf-baseline.json + this doc + the test files in lockstep.
```

Baseline pinned **before** any WU-5 (bundle reduction) work begins so
WU-5 has a real regression target.
