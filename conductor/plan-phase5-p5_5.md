# P5.5 — Review Authenticity (on-device, heuristic) — per-feature plan, iter 2

> Per-feature plan for P5.5 from `conductor/plan-phase5-roadmap.md`.
> All cross-cutting invariants (#1–#7 in roadmap) apply. Cite, do not redefine.
> Plan-Review-Gate must PASS before exec. TDD mandatory. Coverage floor 91 (`.coverage-thresholds.json`). Never `--no-verify`.
>
> **Iter 2 changelog (from iter 1 review-gate findings):**
>
> - Messaging redesigned: ScoutPanel runs in **content-script** context via `createShadowRootUi` (`entrypoints/content.ts:37-66`); calls `extractReviews(document)` **directly** and only round-trips to background for scoring. Drops `EXTRACT_REVIEWS`/`REVIEW_SAMPLES` message pair entirely. New variants are scoped to `BackgroundMessage` only (panel → background → reply).
> - **Synthetic-only fixtures.** US-locale only for v0.2.x. No real Amazon HTML in repo. Other locales tracked as follow-up (out of scope).
> - **`ReviewSample` and `AuthenticityResult` interfaces** declared inline (D11).
> - **Reconciliation with `lib/scraper.ts` reviewCount** declared (D12): UI labels "based on N visible reviews"; never claims totals.
> - **Privacy grep gate** extended to include `components/ui/ScoutPanel.tsx`.
> - **Per-file coverage** gated via existing global thresholds; explicit decision to NOT add per-file thresholds (D13).
> - **Audit-log downgrade test** added (D14).
> - **Performance harness** specified (D15).
> - **Multi-selector array shape** specified (D16).
> - **Cache lifetime** clarified: content-script-React-component lifetime = page-load until navigation/reload.

## Goal

When user is on scouted Amazon product page, surface single 0-100 "Reviews authenticity" score in `ScoutPanel` derived from on-device heuristics over review block already present in DOM. Optional "Why?" disclosure exposes top 3 suspicious-signal reviews. Zero remote calls. Review text never leaves device, never persisted to IDB, never written to logs.

## User-facing surface

- **ScoutPanel**: new collapsed row "Reviews: NN% authentic ▮▮▮▮▯" with sample-size annotation "based on N visible reviews" (NOT total review count). Renders only after successful Quick Scout AND when `N ≥ 5`. Below threshold renders "Insufficient review data".
- **"Why?" disclosure**: tap-to-expand inline list of top 3 reviews most flagged by suspicious-signal heuristics, with one-line reason per row. No persistence, no scroll-virtualization.
- **Privacy**: no toggle, no opt-in. Read-only DOM evaluation in same tab user already opened. Surface text reproduces what page already shows.

## Open decisions — resolved

| #   | Decision                                         | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Where extraction runs                            | **Content-script context.** `ScoutPanel` is mounted by `entrypoints/content.ts` via `createShadowRootUi`, so the React component itself has direct `document` access. ScoutPanel calls `extractReviews(document)` synchronously — no message round-trip. No `chrome.tabs.sendMessage` self-message. (Iter 1 finding F2 fix.)                                                                                                                                                                                                                                                                                    |
| D2  | Where scoring runs                               | **Background SW** (`lib/review-authenticity.ts`). Pure functions, no DOM, no globals. ScoutPanel posts `COMPUTE_AUTHENTICITY` via `chrome.runtime.sendMessage` to background; background returns `AUTHENTICITY_RESULT`. Mirrors P5.1's `ENROLL_ALERT` pattern.                                                                                                                                                                                                                                                                                                                                                  |
| D3  | Sample size cap                                  | Up to 50 most-recent visible reviews. Skip if fewer than 5 extractable. Truncate review body to **2 KB** per review before scoring (revised down from 4 KB; tightens performance budget — see D15).                                                                                                                                                                                                                                                                                                                                                                                                             |
| D4  | Heuristic signal set (locked)                    | Six signals, weights frozen in source: `bigramJaccardUniqueness` (0.25), `ratingDistribution` (0.20), `temporalCluster` (0.15), `bodyLengthVariance` (0.10), `verifiedRatio` (0.15), `helpfulVotesAvg` (0.15). Weights live in `lib/review-authenticity.ts` as `const SIGNAL_WEIGHTS = ...` — code-review-locked.                                                                                                                                                                                                                                                                                               |
| D5  | Persistence + cache lifetime                     | None at storage layer. ScoutPanel-component-local `Map<asin, AuthenticityResult>` cache lives only as long as the React component instance. Component instance lifetime = until page navigation, reload, or tab close (content-script lifecycle). On re-mount: cache empty; re-extract. Acceptable: extract+score budget < 200 ms per ASIN (D15). No IDB delta. Invariant #7 untouched.                                                                                                                                                                                                                         |
| D6  | Locale coverage (v0.2.x)                         | **US-locale only.** Synthetic fixture under `tests/fixtures/reviews/us-synthetic.html`. Other 7 locales tracked as follow-up issue (out of scope this plan). Selectors written defensively to match all 8 locales' known DOM shapes, but **only US fixture gates CI**. Roadmap entry for P5.5 amended to reflect this scope.                                                                                                                                                                                                                                                                                    |
| D7  | Messaging                                        | Two new variants: `ComputeAuthenticityRequest { type: 'COMPUTE_AUTHENTICITY'; payload: { samples: ReviewSample[] } }` and `AuthenticityResultResponse { type: 'AUTHENTICITY_RESULT'; payload: AuthenticityResult }`. Both extend `PopupMessage` union (background's `runtime.onMessage` accepts; ScoutPanel sends). No new content-script messages — extraction is in-process. (Iter 1 finding F1+F2 fix.)                                                                                                                                                                                                      |
| D8  | Audit-log integration                            | New kind `'review-authenticity-evaluated'` added to `AuditLogEntry.kind` union. Append gated by existing `optInAuditLog` flag. Summary string: `asin=<ASIN> n=<count> score=<int>`. Reasoning: ASIN is a public Amazon product ID, not user-identifying; combined with score+count it constitutes a behavioural log entry, mitigated by the existing opt-in gate (matches P5.1's `'price-alert-fired'` kind precedent).                                                                                                                                                                                         |
| D9  | Privacy-policy diff                              | Append paragraph to `docs/privacy-policy.md`: in-page DOM read of already-loaded review text; no persistence, no transmission; opt-in audit-log entry contains ASIN + count + score only. CWS submission checklist gets one-liner reviewer note (no permission delta).                                                                                                                                                                                                                                                                                                                                          |
| D10 | DeepCheckTab vs new ScoutPanel disclosure        | `DeepCheckTab` is the existing Phase-2 LLM Deep Check feature (rate-limited remote call). Do **NOT** colocate. Authenticity disclosure is local-only and lives inline in `ScoutPanel`. Naming: code/tests use "authenticity" exclusively; user-facing label is "Why?" disclosure under the score row.                                                                                                                                                                                                                                                                                                           |
| D11 | `ReviewSample` + `AuthenticityResult` shapes     | Declared inline (Iter 1 finding C2 fix): see §"Type definitions" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D12 | Reconciliation with `lib/scraper.ts` reviewCount | (Iter 1 finding C5 fix.) Scraper's `aggregateRating → reviewCount` produces the **total review count** (e.g., 8,432). `extractReviews` produces samples from the **visible review block** only (≤ 50). UI **never claims totals** — label is exactly "based on N visible reviews". Total is not shown next to the authenticity score; it remains in the existing scraper-driven UI surface only. No code reconciliation required.                                                                                                                                                                               |
| D13 | Per-file coverage gate                           | (Iter 1 finding C7 fix.) `.coverage-thresholds.json` is for global floor only. Per-file 95% target on `lib/review-authenticity.ts` is enforced via test design (every signal individually tested + integration tests) and a `tests/lib/review-authenticity.coverage.test.ts` assertion that runs `c8`'s programmatic API against the module. **Do NOT** add per-file thresholds to `.coverage-thresholds.json` — config-floor stays global per project convention.                                                                                                                                              |
| D14 | Audit-log downgrade case                         | (Iter 1 finding C9 fix.) PrivacyTab's audit log renderer currently renders `entry.kind` as a raw string (`components/ui/PrivacyTab.tsx:150`). Unknown literals from a v0.2.1 entry will render as raw text in v0.2.0 — graceful degradation. New regression test in `tests/components/ui/PrivacyTab.test.tsx` seeds a stored entry with `kind: 'review-authenticity-evaluated'` and asserts the row renders without throwing.                                                                                                                                                                                   |
| D15 | Performance budget harness                       | (Iter 1 finding C4 fix.) `tests/lib/review-authenticity.perf.test.ts` uses Vitest's `bench()` API to measure `calculateAuthenticityScore` against a generated 50-sample corpus (each body 2 KB). Budget: median ≤ 200 ms on Vitest's default reporter timing. Tolerance band: assertion uses `expect(median).toBeLessThan(200)` with retry-on-CI-jitter via `vi.retry(2)`.                                                                                                                                                                                                                                      |
| D16 | Multi-selector fallback array shape              | (Iter 1 finding C10 fix.) `lib/review-extractor.ts` exports `const REVIEW_BLOCK_SELECTORS: string[]` — a **flat** array. Each selector tried in order; first that yields ≥ 1 element wins. Per-locale variants live in the same array (e.g., `'[data-hook="review"]'`, `'.review[data-asin]'`, etc.). When the US fixture-snapshot test fails, `git blame` of the array commit history identifies which selector was last edited. Refresh cadence documented in `docs/cws-submission-checklist.md` reviewer-notes section as "review-block selector fixture refresh: ad-hoc per Amazon DOM A/B test detection". |
| D17 | Privacy grep gate scope                          | (Iter 1 finding C6 fix.) Grep includes ScoutPanel.tsx — see §"Privacy grep gate" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Type definitions (D11)

In `lib/types.ts`:

```ts
export interface ReviewSample {
  id: string; // DOM id attribute or fallback hash; not used by scorer, only for suspiciousIndices reverse-lookup
  title: string; // textContent only; max 200 chars
  body: string; // textContent only; truncated to 2 KB (D3)
  rating: number; // integer 1-5; reviews where rating cannot be parsed are skipped
  date: string; // raw textContent of the date element; opaque to scorer (parsed by temporal signal)
  helpful: number; // helpful-vote count; 0 if absent
  verified: boolean; // true only if "Verified Purchase" string detected in element
}

export interface AuthenticityResult {
  score: number; // 0-100 integer; 50 when sampleCount < 5
  sampleCount: number; // number of reviews scored
  suspiciousIndices: number[]; // indices into the input samples array, sorted by descending suspicion
  reasons: Record<number, string[]>; // index → list of human-readable reason strings
}
```

Both are pure data types. No methods, no class. Frozen at code-review time.

## Touch points

| File                                             | Action                                                                                                                                                                                                                                                                                                                                                      | Notes                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/review-extractor.ts`                        | NEW. `export function extractReviews(doc: Document): ReviewSample[]`. Pure DOM read against `REVIEW_BLOCK_SELECTORS` (D16). Truncates body to 2 KB. Returns max 50. Only `textContent` reads — never `innerHTML`.                                                                                                                                           | Pure module. Imported by `ScoutPanel.tsx`. No `fetch`, no globals.                                                                                                           |
| `lib/review-authenticity.ts`                     | NEW. `export function calculateAuthenticityScore(samples: ReviewSample[]): AuthenticityResult`. Six pure-function signals + weighted combine. Returns `{ score, sampleCount, suspiciousIndices, reasons }`.                                                                                                                                                 | Pure module. No DOM, no SW APIs, no globals.                                                                                                                                 |
| `lib/types.ts`                                   | NEW exports `ReviewSample` and `AuthenticityResult` per §"Type definitions". Existing `ProductData` untouched.                                                                                                                                                                                                                                              | Type-only delta. No runtime impact.                                                                                                                                          |
| `lib/messaging/types.ts`                         | Add `ComputeAuthenticityRequest`, `AuthenticityResultResponse` to `PopupMessage` union. No change to `ContentMessage` or `OffscreenMessage` (D7).                                                                                                                                                                                                           | Mirrors P5.1's panel→background pattern.                                                                                                                                     |
| `lib/audit-log.ts`                               | Extend `AuditLogEntry.kind` union with `'review-authenticity-evaluated'`. No new helper.                                                                                                                                                                                                                                                                    | Additive. Existing readers unaffected (graceful render — D14).                                                                                                               |
| `entrypoints/background.ts`                      | Add `COMPUTE_AUTHENTICITY` branch to `runtime.onMessage`. Pure call to `calculateAuthenticityScore`. Append audit-log entry. Reply with `AUTHENTICITY_RESULT`.                                                                                                                                                                                              | SW-stateless: no module-level cache.                                                                                                                                         |
| `entrypoints/content.ts`                         | **No edits.** Extraction is in-process within ScoutPanel (D1). Existing content script unchanged.                                                                                                                                                                                                                                                           | Iter 1 finding F1 fix.                                                                                                                                                       |
| `components/ui/ScoutPanel.tsx`                   | After mount + on `props.asin` change, call `extractReviews(document)` directly; if `samples.length >= 5`, send `COMPUTE_AUTHENTICITY` via `chrome.runtime.sendMessage` to background; on `AUTHENTICITY_RESULT` reply, render score row + "Why?" disclosure. Component-local `Map<asin, AuthenticityResult>` cache. P5.1 "Watch this ASIN" toggle untouched. | All visual states unit-tested.                                                                                                                                               |
| `tests/fixtures/reviews/us-synthetic.html`       | NEW. **Fully synthetic** review block — fictional product, fictional reviewer names, lorem-ipsum-style body content engineered to produce predictable signal values. No Amazon-derived text. ~10 reviews. Cap 50 KB.                                                                                                                                        | Iter 1 finding F3+C8 fix. No copyright surface.                                                                                                                              |
| `tests/fixtures/reviews/README.md`               | NEW. One-page policy: "All review fixtures must be synthetic. No Amazon-derived review text in this directory. Adding a new locale fixture requires this README to be re-read in the PR description."                                                                                                                                                       |                                                                                                                                                                              |
| `tests/lib/review-extractor.test.ts`             | NEW. Tests: empty doc → `[]`; US synthetic fixture → ≥ 5 samples; truncation at 2 KB; missing-rating samples skipped; missing-body samples skipped; first-selector-wins ordering for `REVIEW_BLOCK_SELECTORS`.                                                                                                                                              |                                                                                                                                                                              |
| `tests/lib/review-authenticity.test.ts`          | NEW. Six per-signal tests + integration tests covering: insufficient data → score 50; repetitive corpus → score < 30; diverse authentic corpus → score > 70; verified-only + helpful-votes corpus → boost; rating-distribution edges (≥ 85% 5-star, < 40% 5-star); temporal-cluster detection; determinism (same input → same output across two calls).     | TDD-first.                                                                                                                                                                   |
| `tests/lib/review-authenticity.perf.test.ts`     | NEW. Vitest `bench()` against generated 50-sample 2 KB-body corpus. Budget median ≤ 200 ms (D15).                                                                                                                                                                                                                                                           | `vi.retry(2)` to absorb CI jitter.                                                                                                                                           |
| `tests/lib/review-authenticity.coverage.test.ts` | NEW. Asserts `lib/review-authenticity.ts` per-file line+branch coverage ≥ 95% via `c8` programmatic API or by parsing `coverage/coverage-summary.json` after the main coverage run. (D13.)                                                                                                                                                                  | Runs only when `pnpm test:coverage` produced the summary.                                                                                                                    |
| `tests/components/ui/ScoutPanel.test.tsx`        | Extend with: row hidden on `< 5` samples; row visible with score + "based on N visible reviews" sample-size text; "Why?" disclosure renders top 3 reasons from `result.reasons`; component cache prevents duplicate `chrome.runtime.sendMessage` for same ASIN on re-render.                                                                                |                                                                                                                                                                              |
| `tests/components/ui/PrivacyTab.test.tsx`        | Extend (D14): seed `chrome.storage.local` with audit-log entry whose `kind === 'review-authenticity-evaluated'` AND a synthetic legacy entry with an unknown literal `kind === 'unknown-future-kind' as never`; assert PrivacyTab renders both rows without throwing (graceful renderer regression).                                                        |                                                                                                                                                                              |
| `tests/entrypoints/background.test.ts`           | Extend with: `COMPUTE_AUTHENTICITY` branch returns `AUTHENTICITY_RESULT`; audit-log append only when `optInAuditLog === true`; SW-statelessness — two consecutive `COMPUTE_AUTHENTICITY` calls with identical input produce identical output.                                                                                                               |                                                                                                                                                                              |
| `tests/setup.ts`                                 | No edits required. fakeBrowser already covers `chrome.runtime.sendMessage` + `chrome.runtime.onMessage` (the **only** chrome APIs this feature uses, per D1+D2). Verified by reading the existing `runtime.sendMessage` paths exercised in P5.1 tests.                                                                                                      | Iter 1 finding F4 mitigation: scoping the feature to `runtime.sendMessage` only avoids fakeBrowser-coverage uncertainty around `tabs.sendMessage` cross-context round-trips. |
| `docs/privacy-policy.md`                         | Append paragraph per D9.                                                                                                                                                                                                                                                                                                                                    |                                                                                                                                                                              |
| `docs/cws-submission-checklist.md`               | Append reviewer-notes line: "Review authenticity: in-page DOM read of already-displayed reviews; no remote calls; no persistence." Plus selector-fixture refresh policy line per D16.                                                                                                                                                                       | No permission delta.                                                                                                                                                         |
| `CHANGELOG.md`                                   | New `## [0.2.1] — <date>` entry: "Added: on-device review authenticity score in ScoutPanel (heuristic; no remote calls)."                                                                                                                                                                                                                                   | Patch release. No IDB schema delta. Heading is exactly `## [0.2.1] — <date>` (Iter 1 finding C: heading text consistency).                                                   |
| `package.json` + `wxt.config.ts`                 | Bump `version` from `0.2.0` to `0.2.1` in both files.                                                                                                                                                                                                                                                                                                       |                                                                                                                                                                              |
| `conductor/plan-phase5-roadmap.md`               | Amend P5.5 entry to note "v0.2.x: US-locale only; remaining 7 locales tracked as follow-up".                                                                                                                                                                                                                                                                |                                                                                                                                                                              |

## Privacy + invariants — explicit checks

| Invariant                      | How P5.5 satisfies it                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — zero remote                | No `fetch`, no `WebSocket`, no `EventSource` introduced. Privacy grep gate verifies (D17).                                                       |
| 2 — encryption                 | No new persistent storage. Session-only React state. AES-GCM-256 / PBKDF2 unchanged.                                                             |
| 3 — explicit-trigger carve-out | Evaluation runs on Quick Scout + ScoutPanel mount — both explicit user actions. No alarm-driven path.                                            |
| 4 — bundle ≤ 2.5 MB            | Heuristic-only; no model. Estimated delta < 10 KB zipped (lib code) + 0 KB (fixtures live under `tests/`, not bundled). CI bundle gate enforces. |
| 5 — Chrome ≥ 116               | No new APIs. `runtime.sendMessage` GA since MV3 launch.                                                                                          |
| 6 — SW statelessness           | Background scorer is pure; per-session cache lives in the React component, not in the SW. SW-statelessness test enforces.                        |
| 7 — IDB forward-only           | No `DB_VERSION` change. No new store.                                                                                                            |

## Edge cases

| Risk                                      | Mitigation                                                                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amazon DOM A/B tests break US selectors   | Multi-selector fallback (D16). US fixture-snapshot test fails ⇒ CI blocks. Reviewer-notes step lists ad-hoc fixture refresh.                                                                                                           |
| Non-US locale page                        | Selector list defensive across all 8 locales; if no selector matches, `extractReviews` returns `[]` and ScoutPanel hides the row (`< 5` threshold). No crash.                                                                          |
| User opens non-product page               | `extractReviews` returns `[]`; ScoutPanel hides row. Existing Quick Scout already gates on ASIN presence.                                                                                                                              |
| Review body contains malicious HTML       | Extractor uses `textContent` only, never `innerHTML`. `ReviewSample.body` is plain string. No XSS surface.                                                                                                                             |
| Memory pressure with 50 reviews           | Body truncated to 2 KB before scoring. Worst-case 50 × 2 KB = 100 KB; bigram pass O(N²) at 50 = 2,450 pair comparisons of ≤ 2 KB strings. Performance test asserts median ≤ 200 ms (D15).                                              |
| Re-mount storm on same ASIN               | Component-local cache short-circuits re-extract+rescore for same ASIN. Cache invalidated only on component unmount (page nav/reload/tab close). Acceptable: extract+score budget < 200 ms; even worst-case re-mount is sub-second.     |
| Sentiment vs authenticity confusion       | Distinct module names (`lib/sentiment.ts` vs `lib/review-authenticity.ts`). Distinct types (`SentimentResult` vs `AuthenticityResult`). Distinct UI rows. No code overlap.                                                             |
| User downgrade v0.2.1 → v0.2.0            | No IDB delta; downgrade is clean for storage. Audit-log entries with new kind `'review-authenticity-evaluated'` written by v0.2.1 will be read by v0.2.0's PrivacyTab as raw-string `kind` — graceful render (D14, regression-tested). |
| ASIN/score audit entry as behavioural log | Mitigated by existing `optInAuditLog` gate — log entries only written when user opted in (matches P5.1's `'price-alert-fired'` precedent). D8 reasoning recorded in plan for reviewer audit trail.                                     |

## Test plan (TDD-mandatory, written before impl)

`tests/lib/review-extractor.test.ts` — unit:

- Returns `[]` when DOM has no review block.
- US synthetic fixture → ≥ 5 samples.
- Truncates body > 2 KB.
- Skips reviews missing rating.
- Skips reviews missing body.
- First-selector-wins ordering when multiple `REVIEW_BLOCK_SELECTORS` match.

`tests/lib/review-authenticity.test.ts` — unit (≥ 95% file coverage):

- `< 5` samples → score 50, `sampleCount` populated, `suspiciousIndices` empty.
- Identical-text corpus (10×) → uniqueness < 30 → composite < 50.
- Diverse natural corpus (50, generated) → composite > 70.
- Rating distribution: 100% 5-star → distribution signal ≤ 30.
- Rating distribution: 100% 1-star → distribution signal ≤ 40.
- Temporal cluster: all timestamps within 24 h → temporal signal < 50.
- Verified ratio: 0% verified → verified signal ≤ 30.
- Helpful votes: zero across all → helpful signal ≤ 40.
- Determinism: same input → same output across two calls (purity).

`tests/lib/review-authenticity.perf.test.ts` — bench (D15):

- Vitest `bench()` over generated 50-sample 2 KB-body corpus; assert median ≤ 200 ms via `expect(median).toBeLessThan(200)`. `vi.retry(2)`.

`tests/lib/review-authenticity.coverage.test.ts` — gate (D13):

- Read `coverage/coverage-summary.json`; assert `coverage["lib/review-authenticity.ts"].lines.pct >= 95` and `coverage["lib/review-authenticity.ts"].branches.pct >= 95`.

`tests/components/ui/ScoutPanel.test.tsx` — extend:

- Row hidden when `sampleCount < 5`.
- Row visible with score + "based on N visible reviews" text.
- "Why?" disclosure renders top 3 reasons from `result.reasons`.
- Component cache: same ASIN → no duplicate `runtime.sendMessage` after first round-trip.

`tests/components/ui/PrivacyTab.test.tsx` — extend (D14):

- Stored audit-log entry with `kind === 'review-authenticity-evaluated'` renders without throwing.
- Stored audit-log entry with unknown future `kind` literal renders without throwing.

`tests/entrypoints/background.test.ts` — extend:

- `COMPUTE_AUTHENTICITY` returns `AUTHENTICITY_RESULT` payload.
- Appends `'review-authenticity-evaluated'` audit entry only when `optInAuditLog === true`.
- SW-statelessness: two consecutive `COMPUTE_AUTHENTICITY` with identical input produce identical output.

## Privacy grep gate (D17)

```
grep -rnE 'fetch\(|new WebSocket|new EventSource' \
  lib/review-authenticity.ts \
  lib/review-extractor.ts \
  components/ui/ScoutPanel.tsx \
  entrypoints/background.ts
```

Must show no NEW matches. Existing matches in `entrypoints/background.ts` are pre-existing P5.1 / scraping paths and unchanged.

## Final gate (runs in this order)

1. `pnpm test:run` — all green, including US fixture snapshot.
2. `pnpm tsc --noEmit` — clean.
3. `pnpm test:coverage` — global floor 91 maintained; per-file gate test asserts `lib/review-authenticity.ts` ≥ 95%.
4. `pnpm test tests/lib/review-authenticity.perf.test.ts` — perf budget green.
5. Privacy grep gate (D17) — clean.
6. `pnpm build` + `pnpm zip` — bundle delta within budget; cumulative ≤ 420 KB CI cap.
7. Conventional commit `feat(p5.5): on-device review authenticity score`.
8. Update memory + Obsidian `STATE_HANDOFF.md` per `feedback_obsidian_updates.md`.

## What this plan explicitly does NOT do

- No ONNX model integration. Heuristic only.
- No persistence of authenticity scores or review text.
- No new permissions. No new host_permissions.
- No notifications. P5.1 owns notifications.
- No multi-retailer extraction. P5.3 owns multi-retailer.
- No cross-locale comparison. P5.2 owns cross-locale.
- No popup UI changes. Score lives only in the in-page ScoutPanel.
- No settings toggle. Feature is always on for scouted pages.
- No IDB schema change.
- **No real Amazon HTML in test fixtures. Synthetic-only.**
- **No 8-locale fixture gate in v0.2.x. US-only.** Other 7 locales tracked as follow-up.
- **No `EXTRACT_REVIEWS` / `REVIEW_SAMPLES` cross-context messaging.** ScoutPanel runs in content-script context and calls `extractReviews(document)` directly.
- **No per-file thresholds in `.coverage-thresholds.json`.** Per-file 95% target is enforced by a dedicated coverage-summary regression test.
