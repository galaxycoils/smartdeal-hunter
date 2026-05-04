# Batch 7 Execution Plan — P1.15 Bundle Optimization & Store Prep

**Owner**: main session
**Date**: 2026-05-04
**Depends on**: Batch 6 (P1.13, P1.14) — committed `a2ce4a7`
**Spec hrs**: 20
**Goal**: Phase 1 closeout. Production-ready MV3 extension ready for CWS dev-channel submit.

## Baseline (from Batch 6)

- Bundle: `.output/chrome-mv3` = 260 KB (cap 2.5 MB → 10× headroom).
- Coverage: `81.42 / 72.76 / 87.87 / 83.88` (S/B/F/L). Floor 70/70/70/70.
- Test files: 15 passing (78 tests).
- Branch: `main`, clean tree.

## Goals

| ID  | Task                                   | Test scope                                                                        | Owner |
| --- | -------------------------------------- | --------------------------------------------------------------------------------- | ----- |
| 7.1 | Coverage ratchet to 90%                | new + expanded tests on `background.ts`, `content.ts`, `storage.ts`, `scoring.ts` | main  |
| 7.2 | Manifest polish + permission rationale | `wxt.config.ts`                                                                   | main  |
| 7.3 | Bundle verify                          | `pnpm build` → assert size, `pnpm zip` smoke                                      | main  |
| 7.4 | Store listing copy                     | `docs/store-listing.md`                                                           | main  |
| 7.5 | Coverage threshold bump + commit       | `.coverage-thresholds.json`                                                       | main  |

## Step 1 — Coverage ratchet (7.1)

Hot files needing branches/lines:

- `entrypoints/background.ts` (15 % stmts) — only `START_ANALYSIS` covered. Need: `UPDATE_GENOME` (success + product-not-found + not-onboarded), `SCRAPE_REQUEST` (happy path + no-active-tab + scrape-fail + score-fail + no-asin), `COMPUTE_SCORES` proxy.
- `entrypoints/content.ts` (31 % stmts) — only `EXECUTE_SCRAPER`. Need: `RENDER_PANEL` (mount + remount/remove existing + onClose + onFeedback message dispatch). Use `vi.mock` for `wxt/sandbox` `createShadowRootUi` + `react-dom/client`.
- `lib/storage.ts` (33 % branches) — `setEncryptedItem` / `getEncryptedItem` round-trip, `getEncryptedItem` undefined branch, `wipeAllData` clears multiple stores. Use fake-indexeddb if not present, else inline mock.
- `lib/scoring.ts` (75 % branches) — null/undefined paths in `toAttributeVector`, edge prices, missing rating/reviewCount.
- `lib/genome.ts` (82 % branches) — load with no salt (fresh genome), invalid decrypt path.

Approach: TDD-light — read file, write test against existing behavior, run, iterate. Single agent (typescript-pro) with hard write scope:

- Write: `tests/entrypoints/background.test.ts`, `tests/entrypoints/content.test.ts`, `tests/lib/storage.test.ts`, `tests/lib/scoring.test.ts`, `tests/lib/genome.test.ts`.
- Read-only: corresponding source under `entrypoints/` + `lib/`.

Exit gate: `pnpm test:run` green, all four metrics ≥ 90 %.

## Step 2 — Manifest polish (7.2)

`wxt.config.ts` updates:

- `description`: ≤ 132 chars (CWS limit). Current: 100 chars — OK, keep.
- Add `homepage_url` placeholder (`https://github.com/<owner>/smartdeal-hunter`).
- Confirm `icons` resolved (16/32/48/96/128 present in `public/icon/` — WXT auto-wires).
- Verify `permissions` minimal: `activeTab`, `scripting`, `storage`, `alarms`, `offscreen`. Justify each in store listing.

## Step 3 — Bundle verify (7.3)

```
pnpm build && du -sh .output/chrome-mv3
pnpm zip       # writes .output/*.zip
```

Assert size < 2.5 MB. Record numbers in commit body.

## Step 4 — Store listing (7.4)

Create `docs/store-listing.md` with:

- **Short description** (≤ 132 chars).
- **Detailed description** (markdown allowed in CWS form).
- **Category**: Shopping.
- **Languages**: English (US).
- **Single-purpose**: "Privacy-first shopping assistant for Amazon: scores products by True Value and Personal Fit, on-device, no tracking."
- **Permission rationale**: per-permission one-liners.
- **Privacy disclosures**: zero remote data transmission; data stays on-device; encryption summary.
- **Screenshot plan**: 5 × 1280×800 PNG — popup dashboard, onboarding step, scout panel injected, options privacy page, feedback flow. (Capture deferred to manual run; doc lists shots required.)

## Step 5 — Threshold bump + commit (7.5)

`.coverage-thresholds.json` → 90 / 90 / 90 / 90.

Commit:

```
feat(p1.15): bundle optimization & store prep

- Raise coverage floor to 90/90/90/90 (was 70).
- Expand background + content + storage tests.
- Manifest polish, store listing draft.
- Verified bundle size <NNN> KB / 2.5 MB cap.
```

## Quality Gates

- TDD-light: write tests, run, fix.
- Typecheck: `pnpm tsc --noEmit`.
- Lint: `pnpm lint`.
- Coverage gate: 90 floor → blocks if regressed.
- E2E: orchestrator runs `pnpm exec playwright test` only if user requests (headful, slow).
- No `--no-verify`.

## Out of scope (Phase 2)

- Actual CWS dev-channel upload (requires Google account + manual review).
- Screenshot capture (manual; doc lists requirements).
- Privacy policy hosting URL (placeholder).
- Real homepage URL.
