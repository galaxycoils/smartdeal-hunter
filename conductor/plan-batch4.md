# Batch 4 Execution Plan v2 — P1.9 + P1.10

**Owner**: main session (metaswarm full)
**Date**: 2026-05-02
**Depends on**: Batch 3 (P1.6, P1.7, P1.8) — committed
**Status**: v2. v1 FAIL (3 fixes). v2 incorporates all fixes.

## Goals

| ID             | Task                                             | Test scope                                   | Spec hrs |
| -------------- | ------------------------------------------------ | -------------------------------------------- | -------- |
| P1.9           | Popup Dashboard UI                               | `tests/entrypoints/popup/Dashboard.test.tsx` | 20       |
| P1.10          | Scout Result Panel                               | `tests/components/ui/ScoutPanel.test.tsx`    | 20       |
| (orchestrator) | Messaging expansion + Shadow DOM injection setup | inline                                       | —        |

## Baseline coverage (measured post-Batch 3)

```
Statements   : 91.75% ( 256/279 )
Branches     : 82.05% ( 160/195 )
Functions    : 89.28% ( 50/56 )
Lines        : 96.35% ( 238/247 )
```

Current floor: 50/50/50/50.
Next ratchet: 70% after P1.10.

## Step 0 — Orchestrator-only writes

The orchestrator is the SOLE writer for:

- `lib/messaging/types.ts` (expansion for Scrape request and render commands)
- `entrypoints/background.ts` (handling Quick Scout triggering from Popup -> Content)
- `entrypoints/content.ts` (Shadow DOM injection logic scaffold using WXT `createShadowRootUi` for CSS isolation)
- `vitest.config.ts`, `.coverage-thresholds.json`

### `lib/messaging/types.ts` expansion

```ts
export interface ScrapeRequest {
  type: 'SCRAPE_REQUEST';
  tabId?: number; // Optional, bg uses active tab if missing
}

export interface RenderPanelMessage {
  type: 'RENDER_PANEL';
  payload: {
    asin: string; // Required for feedback buttons
    trueValue: number;
    personalFit: number;
    // other display data
  };
}
// update unions
```

### Background Orchestration (`entrypoints/background.ts`)

- Handle `SCRAPE_REQUEST` from popup.
- Query active tab.
- Send `EXECUTE_SCRAPER` to content script on that tab.
- Wait for `PRODUCT_DATA`, then send `COMPUTE_SCORES` to offscreen.
- Wait for `SCORE_RESULT`, then send `RENDER_PANEL` back to content script.

## Step 1 — P1.9 Popup Dashboard UI (parallel)

**Agent**: `typescript-pro`
**Write scope**: `entrypoints/popup/Dashboard.tsx`, `entrypoints/popup/App.tsx`, `tests/entrypoints/popup/Dashboard.test.tsx`.
**Read-only**: `lib/genome.ts`, `lib/messaging/types.ts`, `components/ui/**`.

### Surface

- Displays current Genome summary (top dimensions).
- "Quick Scout" button: sends `SCRAPE_REQUEST` to background.
- "Recent Analyses" stub.
- Needs to integrate cleanly into `App.tsx` (replaces placeholder text when `isOnboarded: true`).

### Tests (TDD)

- Renders Quick Scout button and Genome summary.
- Clicking Quick Scout calls `browser.runtime.sendMessage` with `SCRAPE_REQUEST`.
- Renders without crashing.

## Step 2 — P1.10 Scout Result Panel (parallel)

**Agent**: `typescript-pro`
**Write scope**: `components/ui/ScoutPanel.tsx`, `tests/components/ui/ScoutPanel.test.tsx`.
**Read-only**: `lib/types.ts`, `lib/messaging/types.ts`, `components/ui/**`.

### Surface

- Visual panel overlaying Amazon page.
- Displays True Value score and Personal Fit score.
- Feedback buttons (Not Interested, Saved, Purchased) - stub onClick for now (they will send `UPDATE_GENOME` using `asin`).
- Should use Shadcn-like shared components.

### Tests (TDD)

- Renders scores correctly.
- Shows feedback buttons.
- Handles edge cases (null scores).

## Quality Gates

- TDD: tests first, fail, then impl.
- Typecheck: `pnpm tsc --noEmit`.
- Coverage: Post P1.10, coverage floor rises to 70%.
- Subagent discipline: hard write scope.

## Commit decision

Two commits at end of Batch 4:

1. `feat(p1.9): popup dashboard with quick scout trigger`
2. `feat(p1.10): scout result panel and end-to-end background orchestration`
