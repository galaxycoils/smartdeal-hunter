# Batch 3 Execution Plan v2 — P1.6 + P1.7

**Owner**: main session (metaswarm full)
**Date**: 2026-05-02
**Depends on**: Batch 2 (P1.4, P1.5) — committed
**Status**: v2. v1 FAIL (5 fixes). v2 incorporates all fixes.

## Goals

| ID             | Task                                          | Test scope                                    | Spec hrs |
| -------------- | --------------------------------------------- | --------------------------------------------- | -------- |
| P1.6           | Onboarding Flow UI                            | `tests/entrypoints/popup/Onboarding.test.tsx` | 20       |
| P1.7           | True Value Score Algorithm                    | `tests/lib/scoring.test.ts`                   | 24       |
| (orchestrator) | Component library + messaging + orchestration | inline                                        | —        |

## Step 0 — Orchestrator-only writes

### 1. `lib/types.ts` Expansion

```ts
// Update ProductData to support heuristics
export interface ProductData {
  // ... existing fields
  listPrice: number | null;
  unitPrice: number | null;
  quantity: number | null;
}
```

### 2. `lib/scoring-constants.ts` (NEW)

Define explicit constants for heuristics:

- `BASE_RATING_WEIGHT`, `REVIEW_COUNT_SCALE`, `BRAND_TRUST_MAP`, etc.
- No magic numbers in `scoring.ts`.

### 3. `lib/messaging/types.ts` expansion

```ts
export interface ComputeScoresRequest {
  type: 'COMPUTE_SCORES';
  payload: { productData: ProductData; genome: Genome };
}
export interface ScoreResultResponse {
  type: 'SCORE_RESULT';
  payload: {
    trueValue: number;
    personalFit: number;
    breakdown: Record<string, number>;
  };
}
export interface ComputeScoresError {
  type: 'SCORE_ERROR';
  error: string;
}
export type OffscreenMessage = ComputeScoresRequest | ScoreResultResponse | ComputeScoresError;
```

### 4. Background Orchestration (`entrypoints/background.ts`)

- Ensure `ensureOffscreen()` is called before routing `COMPUTE_SCORES`.
- Handle `SCORE_RESULT` vs `SCORE_ERROR`.

### 5. Shared UI Components & Tests

- `components/ui/` (Slider, Button, Card).
- `tests/components/ui/` (isolation tests).

## Step 1 — P1.6 Onboarding Flow UI (parallel)

**Agent**: `typescript-pro` + `a11y-architect`
**Scope**: `entrypoints/popup/Onboarding.tsx`, `tests/entrypoints/popup/Onboarding.test.tsx`.
**Constraints**: Must use orchestrator's shared components.

## Step 2 — P1.7 True Value Score Algorithm (parallel)

**Agent**: `typescript-pro`
**Scope**: `lib/scoring.ts`, `tests/lib/scoring.test.ts`.
**Constraints**: Must use `lib/scoring-constants.ts`.

## Quality Gates

- TDD mandatory.
- Coverage: 50% floor.
- Typecheck clean.
