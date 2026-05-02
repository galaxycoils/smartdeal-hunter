# Batch 6 Execution Plan v2 — P1.13 + P1.14

**Owner**: main session (metaswarm full)
**Date**: 2026-05-02
**Depends on**: Batch 5 (P1.11, P1.12) — committed
**Status**: v2. v1 FAIL (3 fixes). v2 incorporates all fixes.

## Goals

| ID             | Task                         | Test scope                               | Spec hrs |
| -------------- | ---------------------------- | ---------------------------------------- | -------- |
| P1.13          | Privacy & Compliance Shell   | `tests/entrypoints/options/App.test.tsx` | 16       |
| P1.14          | E2E Integration Tests        | `tests/e2e/integration.spec.ts`          | 20       |
| (orchestrator) | Playwright Setup + Utilities | inline                                   | —        |

## Baseline coverage (measured post-Batch 5)

```
Statements   : 81.42% ( 298/366 )
Branches     : 72.76% ( 171/235 )
Functions    : 87.87% ( 58/66 )
Lines        : 83.88% ( 281/335 )
```

Current floor: 70/70/70/70.
Next ratchet: 90% after P1.15.

## Step 0 — Orchestrator-only writes

The orchestrator is the SOLE writer for:

- `package.json` (installing `@playwright/test`)
- `playwright.config.ts` (configuring Playwright to load the WXT extension using `--disable-extensions-except` and `--load-extension` flags pointing to `.output/chrome-mv3`)
- `lib/messaging/types.ts` (add `DATA_WIPED` message)
- `tests/e2e/setup.ts` (playwright extension scaffolding)
- `vitest.config.ts`, `.coverage-thresholds.json`

### `lib/messaging/types.ts` expansion

```ts
export interface DataWipedMessage {
  type: 'DATA_WIPED';
}
// update unions
```

### Playwright Setup

- Install Playwright.
- Configure `playwright.config.ts` to launch Chromium with `--disable-extensions-except` and `--load-extension` pointing to `.output/chrome-mv3`.

## Step 1 — P1.13 Privacy & Compliance Shell (parallel)

**Agent**: `typescript-pro`
**Write scope**: `entrypoints/options/App.tsx`, `tests/entrypoints/options/App.test.tsx`.
**Read-only**: `lib/genome.ts`, `lib/storage.ts`, `components/ui/**`, `lib/messaging/types.ts`.

### Surface

- Options Page UI.
- Displays Compliance Notice (FTC/Chrome Web Store policies: "All data stays on device. No silent tracking.").
- "Export Data" button: Dumps `loadGenome` (and potentially cache, but genome is enough for MVP compliance) to a `.json` file using browser downloads API or a Blob URL.
- "Wipe All Data" button: Calls `wipeAllData` from `lib/storage.ts` and shows a confirmation. Broadcasts `DATA_WIPED` via `browser.runtime.sendMessage` so other contexts can clear memory state.

### Tests (TDD)

- Unit tests using React Testing Library to verify buttons render and call appropriate functions (`wipeAllData`, export blob, message broadcast).

## Step 2 — P1.14 E2E Integration Tests (parallel)

**Agent**: `e2e-runner` or `typescript-pro` with Playwright knowledge.
**Write scope**: `tests/e2e/integration.spec.ts`, `tests/e2e/fixtures/amazon-product.html`.
**Read-only**: Ext APIs.

### Surface

- Uses Playwright to run an end-to-end flow.
- Installs the extension (orchestrator sets up the config).
- Opens the popup -> clicks through Onboarding.
- Navigates to an Amazon page. **MUST** use `page.route()` to block live network requests and serve a static local HTML fixture (`amazon-product.html`) to prevent brittleness against live Amazon.com.
- Verifies the ScoutPanel is injected.
- Navigates to Options page -> clicks Wipe Data.

### Tests (TDD)

- A single comprehensive E2E test file covering the "happy path".

## Quality Gates

- TDD: tests first, fail, then impl.
- Typecheck: `pnpm tsc --noEmit`.
- Coverage: Maintain > 70% floor.
- Subagent discipline: hard write scope.

## Commit decision

Two commits at end of Batch 6:

1. `feat(p1.13): privacy compliance shell in options page`
2. `test(p1.14): playwright e2e integration test`
