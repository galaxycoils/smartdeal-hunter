# Phase 4 — Release Hardening (Iter 3 — FINAL)

**Pre-state**: HEAD `9766484`. 246/246 tests. Coverage 96.62 / 90.53 / 94.38 / 98.56. Build 1.21 MB chrome-mv3. Largest chunk `content-scripts/content.js` 707 kB. 17 commits ahead of `origin/main`, never pushed.

**Goal**: Make extension submittable to Chrome Web Store. Lock perf budget. Ratchet coverage floor. Audit security + a11y.

**Out of scope**: New features. Spec changes. Anything Firefox/Safari. Anything cloud.

**Iter 3 changes from iter 2** (addressing Plan-Review-Gate iter 2 blockers — Completeness PASS, Feasibility FAIL, Scope FAIL):

- WU-6: `manifest.single_purpose` removed from `wxt.config.ts` scope (NOT a real Chrome MV3 manifest field; would emit unrecognized-field warning). Single-purpose declaration lives ONLY in `docs/cws-submission-checklist.md` (CWS dashboard listing field, not manifest).
- WU-5: viz chunk budget loosened ≤ 400 kB → ≤ 500 kB (recharts 3.8.1 + framer-motion 12.38.0 minified ≈ 450 kB floor). Partial-rollback path (`≤ 1.1 MB total` keeping PriceChart import narrowing + manualChunks but reverting content.ts dynamic-import) codified as alternative PASS, not just rollback.
- WU-5 + WU-6 file-scope conflict on `wxt.config.ts` made explicit: WU-5 modifies `build.rollupOptions` block; WU-6 modifies `manifest` block. Non-overlapping. Sequential order WU-5 → WU-6 enforced by dependency graph.
- WU-8: enumerates module-level mutable state grep across content scripts + lib (catches pre-existing `lib/price-history.ts:12-13` `lastTimestamp`/`counter`). Audit, not block — content scripts have document-lifetime persistence so SW statelessness invariant doesn't strictly apply, but documented for completeness.
- WU-10: reframed. Current `lib/sentiment.ts` is a 4-line stub returning mock text. Phase 3 commit `e7e89db` claimed "Gemini Nano Sentiment Analysis" but shipped only a stub. WU-10 = completing that incomplete Phase 3 work, NOT a new feature. Commit prefix: `fix(p3.3)` not `feat(p4)`.

**Iter 2 changes from iter 1** (kept for reference):

- WU-1 DoD enumerates ms-collision counter, NaN/neg price, ASIN-with-`:`, IDB roundtrip.
- WU-2 ratchet conservative: 90 → 91.
- WU-3 expanded: CA + FR + IT + ES fixtures, en-CA decoupling edge; `integration.spec.ts` modification spelled out exactly.
- WU-4: drop `vitest bench` for assertion path. Use `vitest test` in `tests/performance/` w/ `performance.now()` thresholds. Explicit Nano warmup.
- WU-5: ScoutPanel dynamic-import + Suspense fallback added as explicit sub-task.
- WU-7: full version-string consumer scope from `grep` (8 files).
- New WU-8 Security audit. WU-9 A11y audit. WU-10 Nano-fallback test.
- `tests/perf/` → `tests/performance/` (existing convention).
- Perf baseline pinned BEFORE WU-5 begins.

---

## Work Units

### WU-1 — Coverage backfill: `lib/price-history.ts`

**File scope** (modify): `tests/lib/price-history.test.ts`.
**File scope** (read-only): `lib/price-history.ts`, `lib/storage.ts`.

**DoD** (objectively verifiable):

- [ ] `pnpm test:coverage` reports `lib/price-history.ts` ≥ 90% statements / branches / functions / lines.
- [ ] Test cases — each must include at least one `expect`:
  1. `savePrice` followed by `getPriceHistory(asin)` returns `[{ date, price }]` (roundtrip via IDB mock).
  2. Two `savePrice(asin, p)` calls inside the same `Date.now()` ms produce distinct stored keys (`lastTimestamp` collision branch — line 17, counter increment line 18).
  3. Counter resets to 0 when next call falls in a new ms (line 19-21 `else` branch).
  4. ASIN containing `:` (e.g. `B00:WEIRD`) — `key = ${asin}:${uniqueTimestamp}` round-trips correctly (verifies parse is `:`-tolerant; failing test acceptable + documented as known limitation if so).
  5. `savePrice(asin, NaN)` — assert behavior (either rejects, or stores `NaN` and `getPriceHistory` returns it). Document choice in test name.
  6. `savePrice(asin, -5)` — assert negative price is stored verbatim (no clipping at this layer).
  7. `getPriceHistory` returns ascending-by-date when records inserted out of order.
  8. `get30DayPriceHistory` filters out records older than `Date.now() - 30 * 86400000`.
  9. `get30DayPriceHistory` includes the boundary (record exactly 30 days old by `>=` comparison — line 44).
  10. Empty store returns `[]` for both `getPriceHistory` and `get30DayPriceHistory`.
- [ ] All 246+ existing tests still pass.
- [ ] `pnpm tsc --noEmit` clean. `pnpm lint` clean.

**Adversarial check**: reviewer rejects if any test merely calls API without an `expect`; rejects if branch coverage for `lib/price-history.ts` is reported < 90%.

**Commit**: `test(p4.1): backfill price-history coverage to ≥ 90%`.

---

### WU-2 — Coverage floor ratchet 90 → 91

**Depends on**: WU-1.

**Why 91 not 92**: Iter-1 feasibility blocker — current global branches = 90.53. Single-file backfill on `price-history.ts` lifts global branches enough for 91 with margin, but 92 is unsafe without enumerated additional backfills.

**File scope** (modify): `.coverage-thresholds.json`.
**File scope** (read-only): `vitest.config.ts`.

**DoD**:

- [ ] All four axes in `.coverage-thresholds.json` set to `91`.
- [ ] `pnpm test:coverage` passes with new floor.
- [ ] Verify in same WU that `vitest.config.ts` actually reads `thresholds.global.*` (regression check on `c9d9eab`). Add a comment in `.coverage-thresholds.json` if any axis is at risk of regression.
- [ ] Note added to `conductor/STATE_HANDOFF.md` Phase 4 section: "floor ratcheted 90 → 91 in WU-2".

**Adversarial check**: reviewer must run `pnpm test:coverage` and confirm threshold is enforced (deliberately drop a test temporarily, see if gate fires).

**Commit**: `test(p4.1): ratchet coverage floor 90 → 91`.

---

### WU-3 — E2E regional fixtures (P4.1)

**Depends on**: none. Parallel-eligible w/ WU-1 + WU-2.

**File scope** (create):

- `tests/e2e/fixtures/amazon-uk-product.html`
- `tests/e2e/fixtures/amazon-de-product.html`
- `tests/e2e/fixtures/amazon-jp-product.html`
- `tests/e2e/fixtures/amazon-ca-product.html` (en-CA, CAD currency, USD-shaped numbers)
- `tests/e2e/fixtures/amazon-fr-product.html`
- `tests/e2e/fixtures/amazon-it-product.html`
- `tests/e2e/fixtures/amazon-es-product.html`
- `tests/e2e/regional.spec.ts`

**File scope** (modify):

- `tests/e2e/integration.spec.ts` — extend the existing test matrix array literal (currently US-only). Append 7 entries `{ tld, currency, regionCode, fixture }` and parametrize the existing `test.each` block. NO new `test()` calls. NO logic changes.

**DoD**:

- [ ] Each fixture is a real Amazon snapshot with locale-correct DOM:
  - UK: `£`, `4.5 out of 5 stars`, `/dp/<asin>` URL.
  - DE: `€`, `4,5 von 5 Sternen`, comma decimal.
  - JP: `￥`, `5つ星のうち4.5`, no decimals.
  - CA: `CDN$`, `4.5 out of 5 stars`, USD-shaped digit grouping (proves currency-vs-locale decoupling).
  - FR: `€`, `4,5 sur 5 étoiles`.
  - IT: `€`, `4,5 su 5 stelle`.
  - ES: `EUR`, `4,5 de 5 estrellas`.
- [ ] `regional.spec.ts` for each fixture asserts:
  - `page.route()` blocks live `amazon.*` requests.
  - Region badge text matches expected `regionCode`.
  - Displayed price string matches `Intl.NumberFormat(locale, { style: 'currency', currency }).format(parsed)`.
  - `trueValue` and `personalFit` ∈ `[0, 100]`.
- [ ] `pnpm exec playwright test` green locally — US existing + 7 new regional.
- [ ] No flake on 3 consecutive runs.

**Adversarial check**: reviewer pulls one fixture, confirms it is NOT a TLD-swapped US copy. Rejects if any locale fixture lacks locale-specific rating phrase. Reviewer specifically checks CA fixture exercises currency-vs-locale decoupling (CAD currency, en-locale digit grouping).

**Commit**: `test(p4.1): playwright e2e for amazon UK, DE, JP, CA, FR, IT, ES`.

---

### WU-4 — Performance assertions (P4.2)

**Depends on**: WU-3 (uses regional fixtures).

**Approach revision**: Iter-1 blocker — Vitest 4 `bench` has no fail-threshold API. Use `vitest test` w/ `performance.now()` measurements + numeric `expect(...).toBeLessThan(budget)`. Place under existing `tests/performance/` convention.

**File scope** (create):

- `tests/performance/chart-render.perf.test.ts`
- `tests/performance/scrape-latency.perf.test.ts`
- `tests/performance/sentiment-latency.perf.test.ts`
- `docs/perf-budget.md`
- `docs/perf-baseline.json` (committed numeric baseline measured on this machine; iter-2 reviewer may flag if non-portable, but acceptable as starting reference)

**File scope** (modify):

- `package.json` — add `"perf": "vitest run tests/performance/**/*.perf.test.ts"` (does NOT touch existing `test:run`).

**DoD**:

- [ ] `chart-render.perf.test.ts` renders `<PriceChart>` w/ 30 records via `@testing-library/react`, measures via `performance.now()` × 20 runs, asserts p95 < 800 ms via `expect(p95).toBeLessThan(800)`.
- [ ] `scrape-latency.perf.test.ts` runs `scrapeProduct(html)` against each WU-3 fixture × 20 runs, asserts p95 < 200 ms.
- [ ] `sentiment-latency.perf.test.ts`:
  - Branch A (Nano available): explicit warmup call `await summarizeReviews(['warmup'])` discarded; then 5 measured runs; assert p95 < 1500 ms.
  - Branch B (Nano unavailable per `chrome.ai` undefined or stub): assert fallback returns within 50 ms (pure-JS heuristic budget per CLAUDE.md degradation chain).
  - Branch selected by checking `typeof self.ai === 'object'` at runtime, NOT by env var.
- [ ] `docs/perf-budget.md` lists each budget + rationale + rollback plan if regressed.
- [ ] `docs/perf-baseline.json` committed with the measured numbers BEFORE WU-5 starts (so WU-5 can compare).
- [ ] `pnpm perf` runs cleanly. Exit code non-zero on any budget miss.

**Adversarial check**: reviewer must verify (a) `expect(...).toBeLessThan(...)` is used, NOT `console.log`; (b) Nano warmup is a pre-loop call discarded from the measurement window; (c) baseline JSON is committed BEFORE WU-5 commit.

**Commit**: `test(p4.2): perf assertions for chart, scrape, sentiment + baseline`.

---

### WU-5 — Bundle reduction via ScoutPanel dynamic-import (P4.3)

**Depends on**: WU-4 (perf baseline pinned first).

**Approach revision**: Iter-1 blocker — content.js 707 kB includes ScoutPanel → PriceChart → recharts + framer-motion, all statically imported. Tree-shake alone insufficient. Real fix = dynamic-import ScoutPanel (and its transitive recharts/framer-motion deps) at the `RENDER_PANEL` handler in `entrypoints/content.ts`.

**File scope** (modify):

- `entrypoints/content.ts` — replace static `import { ScoutPanel } from '...'` (line 5) with dynamic `await import('../components/ui/ScoutPanel')` inside the `RENDER_PANEL` handler (line 37-44). Keep React.createElement signature.
- `entrypoints/content.ts` — wrap the dynamically-imported component in `React.Suspense` with a 1-line fallback (e.g., `null`), since the chunk fetch happens on first message receipt (synchronous render path becomes async).
- `wxt.config.ts` — add `build.rollupOptions.output.manualChunks` entry ONLY (do NOT modify `manifest` block — that's WU-6 territory; non-overlapping).
- `components/ui/PriceChart.tsx` — narrow recharts named imports to only `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `CartesianGrid` (whatever is actually used).

**DoD — primary path**:

- [ ] `pnpm build` reports `content-scripts/content.js` ≤ 350 kB (was 707 kB; ScoutPanel + recharts + framer-motion split out).
- [ ] New `chunks/viz-*.js` ≤ 500 kB (recharts 3.8.1 + framer-motion 12.38.0 minified floor ≈ 450 kB; 50 kB headroom).
- [ ] Total chrome-mv3 size ≤ 1.0 MB (was 1.21 MB).

**DoD — alternative PASS path** (acceptable if primary path's runtime behavior fails or chunk size exceeds 500 kB):

- [ ] PriceChart import narrowing applied + manualChunks split applied, but `entrypoints/content.ts` reverted to static import.
- [ ] `pnpm build` reports total chrome-mv3 size ≤ 1.1 MB (partial gain from current 1.21 MB).
- [ ] `pnpm exec playwright test` green.
- [ ] Decision logged in commit body with reason (e.g., "MV3 dynamic-import chunk load broken in shadow-DOM context").

**DoD — common (both paths)**:

- [ ] `pnpm exec playwright test` green — Quick Scout still renders ScoutPanel on real Amazon page.
- [ ] WU-4 perf benches still green (no latency regression > 10%; compare against `docs/perf-baseline.json`).
- [ ] Bundle visualizer artifact committed at `docs/perf/stats-phase4.html`.
- [ ] All 246+ unit tests + WU-1 backfill tests still pass.

**Adversarial check**: reviewer compares before/after `stats.html` and confirms savings come from chunk-split, NOT from removing functionality. If primary path: reviewer verifies dynamic-import chunk loads correctly in built output (sniff `.output/chrome-mv3/content-scripts/content.js` for `import(` syntax). If alternative path: reviewer verifies commit body explains the decision.

**Commit**: `perf(p4.3): dynamic-import ScoutPanel in content script (-470 kB)`.

---

### WU-6 — CWS submission prereqs (P4.5)

**Depends on**: WU-5 (need final bundle for upload zip).

**File scope** (create):

- `docs/store-assets/screenshots/01-onboarding-1280x800.png`
- `docs/store-assets/screenshots/02-quick-scout-1280x800.png`
- `docs/store-assets/screenshots/03-scout-result-1280x800.png`
- `docs/store-assets/screenshots/04-options-genome-1280x800.png`
- `docs/store-assets/screenshots/05-privacy-1280x800.png`
- `docs/privacy-policy.md` (canonical text — to be hosted later by user)
- `docs/cws-submission-checklist.md` (enumerates every CWS field with verified value)

**File scope** (modify):

- `wxt.config.ts` — verify `manifest.icons` block exists (16/32/48/128). If WXT auto-generates only from `public/icon/*.png`, add explicit `manifest.icons` block for clarity. Modifies ONLY `manifest` block (does NOT touch `build` block — that's WU-5; non-overlapping).
- `docs/store-listing.md` — mark screenshot checklist done; add `host_permissions` justification text per locale (8 entries).

**Note on `single_purpose`**: NOT a Chrome MV3 manifest field. It is a CWS dashboard listing field declared during submission. Does NOT belong in `wxt.config.ts`. Lives ONLY in `docs/cws-submission-checklist.md` (below) as a copy-pasteable string for the CWS form.

**DoD**:

- [ ] 5 screenshots @ exactly 1280×800 PNG, < 5 MB each, no DEV badge, no PII visible.
- [ ] `docs/privacy-policy.md` covers: data collected (none remote), data stored locally (IDB + chrome.storage.local), Web Crypto encryption, Gemini Nano on-device disclosure, Deep Check explicit opt-in disclosure, contact email, data retention policy, delete-on-uninstall behavior.
- [ ] `docs/cws-submission-checklist.md` enumerates every CWS submission field with the exact value:
  - Name, Summary (132 chars max), Detailed description (16k chars max).
  - Category (Productivity / Shopping).
  - Language (en).
  - Single purpose declaration.
  - Permission justifications: each `permissions` + each `host_permissions` entry justified in 1-2 sentences.
  - Privacy practices: data usage limits, data handling certification.
  - Privacy policy URL (placeholder until user hosts).
  - Reviewer notes: 1-paragraph explanation of how reviewer can test on a non-prod Amazon account.
  - Promotional tile 440×280 — included if user provides; otherwise marked "skip — optional".
  - Test instructions for reviewer.
- [ ] `wxt.config.ts` icons block verified with all 4 sizes (16, 32, 48, 128). Confirm via `cat .output/chrome-mv3/manifest.json | jq .icons`.
- [ ] `pnpm build && pnpm zip` produces `.output/smartdeal-hunter-0.0.1-chrome.zip` ≤ 2.5 MB. Sha256 logged in commit body.
- [ ] User explicitly confirms privacy-policy URL hosting plan before Phase 4 closes (HUMAN CHECKPOINT).
- [ ] `homepage_url` in `wxt.config.ts` already real (`https://github.com/tahamtandariush/smartdeal-hunter`) — verified, not changed.

**Rollback**: if `.zip` > 2.5 MB → revert WU-5 changes selectively (keep PriceChart import narrowing, revert manualChunks) and re-zip; only block this WU if zip still > 2.5 MB after partial WU-5 revert.

**Adversarial check**: reviewer cross-references each screenshot against `docs/store-listing.md` description; rejects DEV-mode artifacts or PII. Reviewer verifies icon block in built manifest, not just source config.

**Commit**: `chore(p4.5): CWS submission assets — screenshots, privacy policy, checklist`.

**HUMAN CHECKPOINT**: REQUIRED before commit (screenshots are user-facing).

---

### WU-7 — Release engineering (P4.6)

**Depends on**: WU-1 through WU-6.

**File scope** (modify) — full version-string consumer scope from `grep -rn "0\.0\.1"`:

- `package.json` — `"version": "0.1.0"`.
- `wxt.config.ts` — `manifest.version: '0.1.0'`.
- `entrypoints/popup/Dashboard.tsx` — bump version label rendered in UI.
- `README.md` — bump any `0.0.1` reference (badge, install instructions, changelog header).
- `tests/setup.ts` — bump `0.0.1` reference if used in fixture defaults.
- `tests/lib/genome.test.ts` — bump if version is asserted.
- `tests/lib/scraper.test.ts` — bump if version is asserted.
- `docs/store-listing.md` — bump version row.
- `conductor/obsidian-phase2-release-handoff.md` — append historical note (do NOT bump; it's a frozen handoff).

**File scope** (create):

- `CHANGELOG.md` — new file, Keep-a-Changelog format.

**DoD**:

- [ ] Every file from grep output is updated EXCEPT frozen handoff docs (which get an appended note).
- [ ] `CHANGELOG.md` follows Keep-a-Changelog 1.1.0 with sections: `## [0.1.0] - 2026-05-XX`, then `### Added`, `### Changed`, `### Fixed`, `### Security`. Each commit since `0.0.1` triaged into one of those buckets.
- [ ] `pnpm test:coverage` green at floor 91.
- [ ] `pnpm exec playwright test` green (all 8 regional + integration).
- [ ] `pnpm perf` green.
- [ ] `pnpm build` size logged in CHANGELOG.
- [ ] `git tag -a v0.1.0 -m "<release notes>"` created locally (NOT pushed).
- [ ] `gh release create v0.1.0 --draft --notes-file CHANGELOG.md` (DRAFT only; user publishes manually).
- [ ] `grep -rn "0\.0\.1"` returns ONLY frozen handoff docs after this WU.

**Adversarial check**: reviewer runs `grep -rn "0\.0\.1" --include='*.{ts,tsx,json,md}' | grep -v conductor/obsidian-` and rejects if any non-frozen reference remains. Reviewer verifies CHANGELOG is human-readable, not a `git log` dump.

**Commit**: `chore(release): v0.1.0`.

**HUMAN CHECKPOINT**: REQUIRED before tag. Pushing requires explicit user authorization per CLAUDE.md.

---

### WU-8 — Security audit (NEW)

**Depends on**: WU-5 (bundle changes can shift attack surface).

**File scope** (create):

- `docs/security-audit-phase4.md`

**File scope** (read-only): all of `lib/`, `entrypoints/`, `components/`, built `.output/chrome-mv3/manifest.json`.

**DoD** (each item must produce a finding line in the audit doc, even "PASS"):

- [ ] **CSP unchanged**: built manifest CSP = `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. Any drift → block.
- [ ] **Web Crypto invariants**: `lib/storage.ts` (or wherever AES-GCM-256 lives) — derived keys held in memory only (never passed to `chrome.storage.*` write). PBKDF2 ≥ 600k iterations. IV via `crypto.getRandomValues(12)`. No IV reuse.
- [ ] **Data-egress grep**: `grep -rn 'fetch\|XMLHttpRequest\|sendBeacon\|navigator\.sendBeacon' --include='*.ts' --include='*.tsx' lib/ entrypoints/ components/ | grep -v lib/deep-check.ts | grep -v lib/amazon-oauth.ts` returns ZERO lines (only deep-check + oauth allowed to talk to Amazon).
- [ ] **Service-worker statelessness**: grep `entrypoints/background.ts` for module-level `let`/`const` mutable state (functions OK, configs OK). Any mutable state outside `chrome.storage.local` or IndexedDB → flag.
- [ ] **Module-level mutable state across content + lib**: grep `lib/ entrypoints/content.ts entrypoints/offscreen/` for module-level `let` declarations. Document each. Pre-existing known case: `lib/price-history.ts:12-13` (`lastTimestamp`, `counter`). Acceptable in content-script context (document-lifetime persistence) but document audit conclusion ("no correctness issue: `Date.now()` monotonic across SW restart, counter reset is safe").
- [ ] **Host permissions**: confirm `wxt.config.ts` `host_permissions` lists exactly 8 Amazon TLDs + nothing wildcard. Justify each in audit.
- [ ] **Affiliate links**: `grep -rn 'tag=\|/ref=\|associates' --include='*.ts' --include='*.tsx'` returns ZERO matches in src.
- [ ] **Explicit-trigger compliance**: every analysis path traces back to a user-initiated message (`SCRAPE_REQUEST`, `RENDER_PANEL`, options-page click). No `setInterval`/`setTimeout`/`chrome.alarms` triggers analysis. Walk each entry point in audit doc.

**Adversarial check**: reviewer runs the same greps independently; rejects audit doc if any "PASS" finding lacks a runnable command demonstrating the result.

**Commit**: `chore(p4): security audit phase 4`.

---

### WU-9 — Accessibility audit (NEW)

**Depends on**: WU-5.

**File scope** (create):

- `tests/a11y/popup.a11y.test.ts`
- `tests/a11y/options.a11y.test.ts`
- `docs/a11y-audit-phase4.md`

**File scope** (modify, only if violations found):

- specific component files identified by axe.

**DoD**:

- [ ] `tests/a11y/*` use `vitest-axe` or equivalent (`axe-core` direct — no new heavy dep if avoidable). Add as devDependency only.
- [ ] Popup pages (Onboarding step 1, step 2, step 3, Dashboard idle, Dashboard scouting, Dashboard success, Dashboard error) — zero axe violations at `serious` and `critical` severities.
- [ ] Options pages (Settings, Privacy, Genome, DeepCheck, About tabs) — zero axe violations at `serious` and `critical` severities.
- [ ] Manual checks documented in `docs/a11y-audit-phase4.md`:
  - Keyboard nav: Tab through Quick Scout → Score panel → Feedback buttons → no traps.
  - Color contrast: PriceChart axes/lines pass WCAG AA against light + dark surface.
  - Shadow-DOM focus: ScoutPanel focusable elements reachable via Tab from page; `Esc` closes.
- [ ] All a11y tests run as part of `pnpm test:run` (no separate gate; just regular tests).

**Adversarial check**: reviewer runs `pnpm test:run -- tests/a11y` and confirms zero failures, AND verifies axe is invoked with `runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa']`, not the default subset.

**Commit**: `test(p4): a11y audit (axe-core) for popup + options`.

---

### WU-10 — Complete Phase 3 sentiment integration (Nano + fallback)

**Why this exists**: Phase 3 commit `e7e89db` claimed "Gemini Nano Sentiment Analysis" but `lib/sentiment.ts` (4 LOC) actually shipped as a stub returning mock text:

```ts
return `Sentiment Analysis: ${text.length > 50 ? 'Positive' : 'Neutral'}. Summary: ${text.substring(0, 50)}...`;
```

WU-10 = completing the unfulfilled Phase 3 promise. NOT a new feature. Commit prefix `fix(p3.3)`.

**Depends on**: none. Parallel-eligible w/ WU-1, WU-3.

**File scope** (modify):

- `lib/sentiment.ts` — replace stub with real chain per CLAUDE.md (`Gemini Nano → WASM heuristic → pure-JS fallback`). When `self.ai?.summarizer` available: call it. On error or unavailable: pure-JS heuristic returning `{ sentiment: 'neutral'|'positive'|'negative', confidence: number }` (simple keyword-count heuristic acceptable since Phase 3 didn't promise model quality, only the integration shape).
- `tests/lib/sentiment.test.ts` — add cases: Nano-available (mocked `self.ai.summarizer.create()`), Nano-errored (rejects), Nano-absent (`self.ai === undefined`).
- `components/ui/DeepCheckTab.tsx:5` — caller import unchanged; signature change to `Promise<{ sentiment, confidence, summary }>` adapted in DeepCheckTab if shape changes (add to file scope if needed).

**DoD**:

- [ ] `lib/sentiment.ts` no longer returns mock string. Returns typed `{ sentiment, confidence, summary?, error? }`.
- [ ] Function handles 3 paths: Nano-success, Nano-error, Nano-absent.
- [ ] Tests cover all 3 paths w/ explicit `expect`.
- [ ] No path throws into the caller — errors return `{ sentiment: 'neutral', confidence: 0, error: <string> }`.
- [ ] Coverage for `lib/sentiment.ts` ≥ 91% all axes.
- [ ] DeepCheckTab still renders (compile + existing test pass).

**Adversarial check**: reviewer stubs `globalThis.ai` for each path, runs test, verifies all 3 expectations fire. Reviewer rejects if any path returns mock-string format from old stub.

**Commit**: `fix(p3.3): complete sentiment.ts Nano integration with fallback chain`.

---

## Cross-cutting checks (apply to every WU)

1. **TDD**: red → green → refactor. Tests committed in same WU as code.
2. **Coverage floor**: 90 → 91 after WU-2; must hold.
3. **No `--no-verify`**.
4. **No new `fetch`/`XMLHttpRequest`/`sendBeacon`** outside `lib/deep-check.ts` + `lib/amazon-oauth.ts`. Re-grep on each commit (codified as WU-8 step).
5. **No globals in service worker.** Persist via `chrome.storage.local` or IndexedDB. (Codified as WU-8 step.)
6. **No affiliate links anywhere.** (Codified as WU-8 step.)
7. **CSP**: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` must remain in built manifest. (Codified as WU-8 step.)
8. **Perf baseline**: `docs/perf-baseline.json` committed in WU-4 BEFORE any WU-5 bundle changes.
9. **Rollback ready**: WU-5 + WU-6 each have explicit rollback steps.

## Dependency graph

```
WU-1 ──► WU-2
WU-3 ──► WU-4 ──► WU-5 ──► WU-6 ──► WU-7
                              │
WU-2 ─────────────────────────┤
WU-5 ──► WU-8 ────────────────┤
WU-5 ──► WU-9 ────────────────┤
WU-10 ────────────────────────┘
```

WU-1, WU-3, WU-10 = parallel-eligible. WU-2 sequential after WU-1. WU-4 sequential after WU-3. WU-5 sequential after WU-4. WU-8 + WU-9 sequential after WU-5. WU-6 sequential after WU-2 + WU-5. WU-7 final.

## Execution order (sequential default)

WU-1 → WU-2 → WU-3 → WU-4 → WU-5 → WU-8 → WU-9 → WU-10 → WU-6 → WU-7.

## Plan-Review-Gate prompts (iter 2)

Each reviewer must produce **PASS / FAIL** with file:line evidence. Iter 2 is the FINAL allowed iteration before user escalation per CLAUDE.md.

- **Feasibility**: Can each WU run on this toolchain (Vitest 4 `test` w/ `performance.now()`, Playwright 1.59, WXT vite plugin, axe-core)? Are bundle targets achievable with the spelled-out ScoutPanel dynamic-import? Is floor 90→91 safe? Verify against `vitest.config.ts`, `wxt.config.ts`, `package.json`.
- **Completeness**: Does each WU enumerate verifiable DoD? Are all 14 iter-1 blockers addressed? Are CWS reqs fully captured? Does WU-10 exhaust the Nano fallback paths? Are perf baseline + rollback steps committed BEFORE the destructive changes? Verify against `lib/price-history.ts`, `entrypoints/content.ts`, `wxt.config.ts`.
- **Scope & Alignment**: Does the plan respect file scopes (no WU touches a file owned by another)? Does it match existing conventions (`tests/performance/` not `tests/perf/`, `tests/a11y/` follows mirror pattern)? Does any WU sneak a feature past the "release hardening" gate? Are CLAUDE.md invariants honored?
