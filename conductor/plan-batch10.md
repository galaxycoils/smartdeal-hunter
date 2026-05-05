# Phase 2 — Batch 10

Goal: Complete Phase 2. Implement Performance & Regression Testing (P2.10) and Store Release & Monitoring (P2.11).

## Tasks

### P2.10 Performance & Regression Testing

**Deps:** P2.5, P2.7
**Owner:** QA
**Files (new):** `tests/performance/benchmark.test.ts`, `tests/performance/stress.test.ts`
**Files (modified):** `playwright.config.ts`, `vitest.config.ts`

**Acceptance Criteria:**

- [ ] Add ML benchmark tests for Genome scoring engine ensuring < 500ms execution time on average product page (50-product benchmark).
- [ ] Add stress tests for Analysis Cache Manager and Deep Check API (simulated/mocked responses).
- [ ] Lighthouse integration for Options page performance validation.
- [ ] Ensure all existing 208 tests pass.
- [ ] Maintain 90/90/90/90 coverage.

### P2.11 Store Release & Monitoring

**Deps:** P2.10
**Owner:** Tech Lead
**Files (modified):** `wxt.config.ts`, `README.md`, `docs/store-listing.md`

**Acceptance Criteria:**

- [ ] Update `wxt.config.ts` with error tracking configuration (basic global error listener, no external tracking service needed to maintain privacy, just robust console/local logging).
- [ ] Produce production build (`pnpm build`).
- [ ] Verify zipped extension is < 2.5MB.
- [ ] Update `docs/store-listing.md` with final release notes and screenshots requirement checklist.
- [ ] Update `README.md` to reflect Phase 2 completion.

## Dependency / Execution Order

P2.10 -> P2.11

## Final Verification

- `pnpm test:run`
- `pnpm tsc --noEmit`
- `pnpm test:coverage`
- `pnpm build`
- `pnpm zip`
