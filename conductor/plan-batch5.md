# Batch 5 Execution Plan v2 — P1.11 + P1.12

**Owner**: main session (metaswarm full)
**Date**: 2026-05-02
**Depends on**: Batch 4 (P1.9, P1.10) — committed
**Status**: v2. v1 FAIL (3 fixes). v2 incorporates all fixes.

## Goals

| ID             | Task                                           | Test scope                   | Spec hrs |
| -------------- | ---------------------------------------------- | ---------------------------- | -------- |
| P1.11          | Feedback Loop Engine                           | `tests/lib/feedback.test.ts` | 16       |
| P1.12          | Product Cache & Indexing                       | `tests/lib/cache.test.ts`    | 12       |
| (orchestrator) | Messaging expansion + Wire up feedback from UI | inline                       | —        |

## Baseline coverage (measured post-Batch 4)

```
Statements   : 82.91% ( 262/316 )
Branches     : 73.27% ( 159/217 )
Functions    : 88.52% ( 54/61 )
Lines        : 85.96% ( 245/285 )
```

Current floor: 70/70/70/70.
Next ratchet: 90% after P1.15.

## Step 1 — P1.11 Feedback Loop Engine (parallel)

**Agent**: `typescript-pro`
**Write scope**: `lib/feedback.ts`, `tests/lib/feedback.test.ts`.
**Read-only**: `lib/types.ts`, `lib/genome.ts`.

### Surface

- `calculateFeedbackUpdate(genome: Genome, productVector: ProductAttributeVector, feedbackType: 'not_interested' | 'saved' | 'purchased'): Genome`
- The gradient descent logic: move dimensions closer to the product's attributes if positive feedback, further if negative feedback. Conservative learning rate.
- Uses `clipAndRenormalize` to maintain valid Genome state.

### Tests (TDD)

- Positive feedback increases alignment with product vector.
- Negative feedback decreases alignment.
- Weights remain normalized (sum to 1).

## Step 2 — P1.12 Product Cache & Indexing (parallel)

**Agent**: `typescript-pro`
**Write scope**: `lib/cache.ts`, `tests/lib/cache.test.ts`.
**Read-only**: `lib/types.ts`, `lib/storage.ts`.

### Surface

- `cacheProduct(product: ProductData, key: CryptoKey): Promise<void>`
- `getCachedProduct(asin: string, key: CryptoKey): Promise<ProductData | undefined>`
- `cleanCache(): Promise<void>` (LRU or TTL based, max 50MB or just 7-day TTL for MVP).
- Stores encrypted data in `STORE_PRODUCT_CACHE` using `setEncryptedItem`/`getEncryptedItem`.

### Tests (TDD)

- Can store and retrieve encrypted product by ASIN.
- Cache miss returns undefined.

## Step 3 — Orchestrator-only writes

The orchestrator is the SOLE writer for:

- `lib/messaging/types.ts` (expansion for Feedback update command)
- `entrypoints/background.ts` (handle feedback messages, compute gradient update, save genome)
- `entrypoints/content.ts` (wire up the `onFeedback` prop in ScoutPanel)
- `lib/scoring.ts` (export `toAttributeVector` so background can map cached ProductData to ProductAttributeVector)
- `vitest.config.ts`, `.coverage-thresholds.json`

### `lib/messaging/types.ts` expansion

```ts
export interface UpdateGenomeRequest {
  type: 'UPDATE_GENOME';
  payload: {
    asin: string;
    feedbackType: 'not_interested' | 'saved' | 'purchased';
  };
}
// update unions
```

### Background Orchestration (`entrypoints/background.ts`)

- Handle `UPDATE_GENOME` from content script.
- Retrieve `ProductData` for the given ASIN from cache (`getCachedProduct`).
- Map `ProductData` to `ProductAttributeVector` (using exported logic from `scoring.ts`).
- Compute gradient descent update (`calculateFeedbackUpdate`).
- Save updated Genome.

## Quality Gates

- TDD: tests first, fail, then impl.
- Typecheck: `pnpm tsc --noEmit`.
- Coverage: Maintain > 70% floor.
- Subagent discipline: hard write scope.

## Commit decision

Two commits at end of Batch 5:

1. `feat(p1.11): feedback loop engine`
2. `feat(p1.12): product cache and indexing`
