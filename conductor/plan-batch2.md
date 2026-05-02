# Batch 2 Execution Plan v4 — P1.4 + P1.5

**Owner**: main session (metaswarm full)
**Date**: 2026-05-02
**Depends on**: Batch 1 (P1.2, P1.3) — green, uncommitted
**Status**: v4. v1 FAIL (10 fixes), v2 FAIL (6), v3 FAIL (6). v4 closes all 22.

## Goals

| ID             | Task                                                      | Test scope                                                       | Spec hrs |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| P1.5           | Genome Engine — Data Model                                | `tests/lib/genome.test.ts`                                       | 16       |
| P1.4           | Content Script — Amazon Scraper                           | `tests/lib/scraper.test.ts`, `tests/entrypoints/content.test.ts` | 20       |
| (orchestrator) | Typed messaging + arch sync + crypto migration + coverage | inline                                                           | —        |

## Baseline coverage (measured 2026-05-02)

`pnpm test:coverage` with current code (Batch 1 only):

```
Statements: 76.72% (89/116)
Branches:   27.77% (5/18)
Functions:  72.22% (26/36)
Lines:      80.76% (84/104)
```

Pulling down: `entrypoints/popup/**` (0%), `entrypoints/options/**` (0%), `entrypoints/offscreen/main.ts` (0%), `entrypoints/content.ts` (0%, 6 lines).

After excluding popup/options/offscreen-main and adding P1.4+P1.5 tests, expected:

- Stmts/Lines/Funcs: well above 50% (already there).
- Branches: weakest. P1.4 scraper has many tier-fallback branches; tests must explicitly cover each. Realistic target: 50% branches achievable iff scraper tests cover negative paths.

**Gate strategy**: set floor to 50% all four metrics. If post-impl branches < 50%, the response is to **add more negative-path scraper tests** until branches ≥ 50% — NOT lower the floor (per `.coverage-thresholds.json._ratchet_plan` and CLAUDE.md "50% after P1.5"). Lowering the floor below 50% is permitted only via an explicit ratchet amendment to BOTH `.coverage-thresholds.json._ratchet_plan` AND `CLAUDE.md` "Ratchet plan" section in the same commit, with rationale (deferred-ratchet ADR). Default path: more tests, not lower bar.

## Step 0 — Orchestrator-only writes (no subagents touch these)

The orchestrator (this session) is the SOLE writer for:

- `lib/types.ts`
- `lib/messaging/types.ts`
- `lib/storage.ts` (crypto API migration)
- `lib/crypto.ts` (add key-based variants)
- `tests/setup.ts`, `vitest.config.ts`, `.coverage-thresholds.json`, `docs/architecture.md`
- existing tests `tests/lib/storage.test.ts`, `tests/lib/crypto.test.ts` (migrated to key-based API)

Subagents read-only on those.

### `lib/types.ts`

```ts
// USER-TRAIT space
export const GENOME_DIMENSIONS = [
  'price_sensitivity',
  'brand_affinity',
  'quality_priority',
  'sustainability',
  'novelty_seeking',
  'review_weight',
  'discount_sensitivity',
  'category_diversity',
] as const;
export type GenomeDimension = (typeof GENOME_DIMENSIONS)[number];

export interface GenomeDimensionState {
  value: number;
  weight: number;
}

export interface BanditState {
  pulls: Record<GenomeDimension, number>;
  rewards: Record<GenomeDimension, number>;
}

export const GENOME_VERSION_CURRENT = 1 as const;
export const GENOME_VERSIONS_SUPPORTED = [1] as const;
export type GenomeVersion = (typeof GENOME_VERSIONS_SUPPORTED)[number];

export interface Genome {
  version: GenomeVersion;
  isOnboarded: boolean;
  dimensions: Record<GenomeDimension, GenomeDimensionState>;
  bandit: BanditState;
  createdAt: number;
  updatedAt: number;
}

// PRODUCT-ATTRIBUTE space (P1.7 owns extractor, P1.8 owns sim)
export const PRODUCT_ATTRIBUTES = [
  'unit_price',
  'rating_strength',
  'review_volume',
  'brand_trust',
  'discount_pct',
  'eco_signal',
  'novelty_signal',
  'category_breadth',
] as const;
export type ProductAttribute = (typeof PRODUCT_ATTRIBUTES)[number];
export type ProductAttributeVector = Record<ProductAttribute, number>;

// Type-only contract (review v2 fix #3) — NO runtime stub, no throw.
// P1.7 implements; type prevents accidental shipping of un-implemented code.
export type GenomeToProductWeights = (g: Genome) => ProductAttributeVector;

// Content → background payload (architecture.md row #4 update target)
export interface ProductData {
  asin: string;
  title: string;
  price: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  jsonLd: unknown | null;
  url: string;
  scrapedAt: number;
  source: 'url' | 'jsonld' | 'dom';
}
```

### `lib/messaging/types.ts` (review v2 fix #1 — no escape hatch)

```ts
import type { ProductData } from '../types';

// Each message is a tightly-typed discriminated variant. No open `[k:string]:unknown`.
// Future tasks add their own variants by extending this file.

export interface ExecuteScraperRequest {
  type: 'EXECUTE_SCRAPER';
}
export interface ProductDataResponse {
  type: 'PRODUCT_DATA';
  payload: ProductData | null;
}

export type ContentMessage = ExecuteScraperRequest | ProductDataResponse;
// Background↔offscreen + popup↔background variants land in their owning tasks.
```

### `lib/crypto.ts` migration (review v2 fix #2 + v3 fix #4)

Replace the password-based hot-path API entirely. Final surface:

- `deriveKey(password: string, salt: BufferSource): Promise<CryptoKey>` — unchanged. The ONLY entry point that runs PBKDF2 600K. Called once per session by P1.6 onboarding.
- `encryptWithKey(data: string, key: CryptoKey): Promise<Uint8Array>` — packs `[iv(12) | ciphertext(...)]`. No salt prepend (key already derived; salt stored separately by caller during onboarding).
- `decryptWithKey(blob: Uint8Array, key: CryptoKey): Promise<string>`.

Delete `encrypt(data, password)` and `decrypt(blob, password)`. No `@deprecated` JSDoc theater — one way to do the thing. Bootstrap onboarding: derive key once, persist salt (plain) in IndexedDB under `auth:salt`, hold key in session memory.

Existing `tests/lib/crypto.test.ts`: rewrite to test `deriveKey` + `encryptWithKey` + `decryptWithKey` only. Cases: roundtrip with key, decrypt fails on wrong key, two `encryptWithKey` calls produce different ciphertext (random IV), `deriveKey` produces different keys for different salts.

### `lib/storage.ts` migration

Replace `setEncryptedItem(key, value, password)` + `getEncryptedItem(key, password)` with key-based equivalents that also accept an explicit `storeName` (current code hardcodes `STORE_GENOME`):

```ts
export async function setEncryptedItem<T>(
  storeName: string,
  dbKey: string,
  value: T,
  cryptoKey: CryptoKey,
): Promise<void>;
export async function getEncryptedItem<T>(
  storeName: string,
  dbKey: string,
  cryptoKey: CryptoKey,
): Promise<T | undefined>;
```

Internally call `encryptWithKey` / `decryptWithKey`. No password param exists in the storage API at all.

`tests/lib/storage.test.ts` rewrite (orchestrator-owned):

- Replace the hand-rolled IndexedDB mock so `objectStore(name)` actually keys per-store correctly. Current mock writes go to `mockDB.stores.get(name)` — already per-store. But the hardcoded `STORE_GENOME` in the production code went away; tests must pass `storeName` explicitly and assert routing per store.
- Add `beforeAll` that derives a single `CryptoKey` via `deriveKey('test-pw', salt)`; reuse across cases (avoid 600K iterations × N cases).
- Cases: plain set/get/delete (unchanged); encrypted set/get with key roundtrip in STORE_GENOME; encrypted set/get in STORE_PRODUCT_CACHE (new, asserts storeName parameter is honored); wipeAllData.

### `docs/architecture.md` row #3 + #4 sync (review v2 fix #6)

**Row 3** changes message-routing description:

```
| 3 | Background | Content Script | EXECUTE_SCRAPER | runtime.sendMessage to statically-registered content script (matches https://*.amazon.com/*); content script handles via runtime.onMessage. (NOT scripting.executeScript — content script is statically declared via WXT defineContentScript.) |
```

**Row 4** payload extends to v3 ProductData shape:

```
| 4 | Content Script | Background | PRODUCT_DATA | { asin, title, price, currency, rating, reviewCount, imageUrl, jsonLd, url, scrapedAt, source } — see `lib/types.ts ProductData` |
```

**Row 7 (`RENDER_PANEL`)** — add clarifying note that bg → content also flows via `runtime.sendMessage` to the static content script, NOT `scripting.executeScript`:

```
| 7 | Background | Content Script | RENDER_PANEL | runtime.sendMessage to the same static content script (matches https://*.amazon.com/*); content script renders Shadow-DOM panel with score data + alternative suggestions |
```

(All three rows in-scope for orchestrator this batch.)

### `vitest.config.ts` coverage exclusions

Add to `coverage.exclude`:

- `entrypoints/popup/**`
- `entrypoints/options/**`
- `entrypoints/offscreen/main.ts`

Reason: P1.6/P1.9/P1.10 (popup) and P1.13 (options) own those; offscreen-main goes live with P1.7/P1.8 ML wiring. Excluding lifts denominators that can't be raised inside this batch.

### `.coverage-thresholds.json` bump (post-impl)

Set all four to 50. Run gate. If branches < 50, lower to floor(measured) − 2.

### Pre-step empirical check (review v2 fix #4)

Already verified empirically: `pnpm test:run` passes 14/14 with `tests/lib/crypto.test.ts` exercising `subtle.deriveKey` (PBKDF2 600K) + AES-GCM under `happy-dom` 15. Roundtrip works. Genome roundtrip test design proceeds without polyfill.

## Step 1 — P1.5 Genome Engine (parallel)

**Agent**: `typescript-pro`
**Write scope**: `lib/genome.ts`, `tests/lib/genome.test.ts`. Nothing else.
**Read-only**: `lib/types.ts`, `lib/storage.ts`, `lib/crypto.ts`.

### Surface

```ts
// lib/genome.ts
import type { Genome, GenomeDimension } from './types';

export const GENOME_DB_KEY = 'genome:v1';
export const GENOME_STORE = 'genome';

export function defaultGenome(now?: () => number): Genome;
export function validateGenome(g: unknown): g is Genome;
export function clipAndRenormalize(g: Genome): Genome;
export async function loadGenome(key: CryptoKey, now?: () => number): Promise<Genome>;
export async function saveGenome(g: Genome, key: CryptoKey, now?: () => number): Promise<void>;
export async function wipeGenome(): Promise<void>;
// NO genomeToProductWeights stub. P1.7 implements per type contract in lib/types.ts.
```

### Tests (TDD)

- `defaultGenome` shape (version=1, isOnboarded=false, 8 dims, weights sum=1, bandit zeros).
- `validateGenome` accept default; reject: missing dim, value > 1, value < 0, weight sum 0.5, version=2, missing isOnboarded, bad bandit.
- `clipAndRenormalize` clamps -0.5→0, 1.5→1, renormalizes weights from {1,1,1,1,1,1,1,1} → {0.125 each}.
- Roundtrip: derive key once via `deriveKey('pw', salt)`; `saveGenome(g, key)` → `loadGenome(key)` deep-equals.
- `loadGenome` returns `defaultGenome()` when no record exists.
- `loadGenome` throws on validation failure. Test method: write a syntactically-valid-but-semantically-invalid genome via `setEncryptedItem(GENOME_STORE, GENOME_DB_KEY, {version:99, isOnboarded:true, dimensions:{}, bandit:{pulls:{},rewards:{}}, createdAt:0, updatedAt:0}, key)`, then `await expect(loadGenome(key)).rejects.toThrow()`. (This exercises the validation path. Bytes-corruption that breaks AES-GCM auth tag is a different failure mode — out of scope; decrypt itself throws then.)
- `defaultGenome()` exhaustively asserts all 8 `GenomeDimension` keys present in `dimensions`, `bandit.pulls`, `bandit.rewards` (TS `Record<K,V>` is structural — runtime assertion required).
- Schema snapshot: `expect(GENOME_DIMENSIONS).toMatchSnapshot()`.
- `wipeGenome` clears stored value.

## Step 2 — P1.4 Amazon Scraper (parallel)

**Agent**: `typescript-pro`
**Write scope**: `lib/scraper.ts`, `entrypoints/content.ts`, `tests/lib/scraper.test.ts`, `tests/entrypoints/content.test.ts`.
**Read-only**: `lib/types.ts`, `lib/messaging/types.ts`.

### Surface

```ts
// lib/scraper.ts
import type { ProductData } from './types';

export function extractAsinFromUrl(url: string): string | null;
// Patterns: /dp/([A-Z0-9]{10}), /gp/product/([A-Z0-9]{10}), /product/([A-Z0-9]{10}).

export function extractFromJsonLd(doc: Document): Partial<ProductData> | null;
// querySelectorAll('script[type="application/ld+json"]'); JSON.parse safely; @type==='Product'.

export function extractFromDom(doc: Document): Partial<ProductData> | null;
// Conservative selectors: #productTitle, .a-price .a-offscreen, #acrPopover [title],
// #acrCustomerReviewText, #landingImage.

export function scrapeProduct(url: string, doc: Document, now?: () => number): ProductData | null;
// URL ASIN (required) → JSON-LD merge → DOM merge. `source` tagged by which tier
// produced title/price (ASIN itself always from URL).
```

### `entrypoints/content.ts`

WXT auto-imports `defineContentScript` and `browser` (verified — existing P1.1 stub uses no import line; explicit path would be `wxt/utils/define-content-script`, but auto-import is the project convention).

```ts
import { scrapeProduct } from '../lib/scraper';
import type { ContentMessage, ProductDataResponse } from '../lib/messaging/types';

export default defineContentScript({
  matches: ['https://*.amazon.com/*'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((msg: ContentMessage, _sender, sendResponse) => {
      if (msg.type !== 'EXECUTE_SCRAPER') return;
      const payload = scrapeProduct(location.href, document);
      const response: ProductDataResponse = { type: 'PRODUCT_DATA', payload };
      sendResponse(response);
      return true;
    });
  },
});
```

### Tests

`tests/lib/scraper.test.ts`:

- `extractAsinFromUrl`: `/dp/B07XJ8C8F5` → match; `/gp/product/B0CHX1W1XY` → match; `/product/B00ABCDEFG` → match; `/cart` → null; `/dp/B0CHX1W` (9 chars) → null; query string after ASIN preserved.
- `extractFromJsonLd`: valid Product fixture → fields populated; malformed JSON → null (no throw); BreadcrumbList only → null; multiple LD blocks (`Organization` + `Product`) → picks Product.
- `extractFromDom`: full DOM fixture → all fields; missing #productTitle → title null; missing price → price null.
- `scrapeProduct` priority: URL ASIN + Product JSON-LD + DOM → `source='jsonld'`; URL ASIN + no JSON-LD + DOM → `source='dom'`; URL ASIN only (no JSON-LD, no DOM) → still returns object with nulls, `source='url'`; no ASIN → null.
- Realistic Amazon `/dp/` fixture without `application/ld+json` → returns ProductData `source='dom'` with title from `#productTitle`.

`tests/entrypoints/content.test.ts`:

- Mock `wxt/browser` runtime.onMessage like `tests/entrypoints/background.test.ts`.
- Mock `lib/scraper.scrapeProduct`.
- Import default, call `.main()`, capture listener.
- Assert: ignores non-EXECUTE_SCRAPER; calls scraper with `location.href` + `document`; replies `{type:'PRODUCT_DATA', payload}`.

## Quality Gates

- TDD: tests first, fail, then impl, in each subagent.
- Typecheck: `pnpm tsc --noEmit` 0 errors after each step.
- Tests: `pnpm test:run` all green after each step.
- Coverage: `pnpm test:coverage` ≥ 50% all four metrics post-impl, or floor lowered to (measured − 2pp) with reason in commit.
- Subagent discipline: hard write scope, no `--no-verify`, no force-push.

## Concurrency lock

Subagents must NOT write:

- `lib/types.ts`, `lib/storage.ts`, `lib/crypto.ts`, `lib/messaging/**`
- `tests/setup.ts`, `vitest.config.ts`, `.coverage-thresholds.json`
- `docs/**`, `tests/lib/storage.test.ts`, `tests/lib/crypto.test.ts`

Orchestrator-only.

## Commit decision

Two commits at end:

1. `feat(p1.2,p1.3): storage encryption layer + offscreen lifecycle manager`
2. `feat(p1.4,p1.5): amazon scraper + genome engine data model`

(Branch is `main`. No PR — direct commits per existing flow.)

## Risks (residual)

- Branch coverage may miss 50% — fallback documented (lower to measured − 2).
- `wxt/sandbox` import — verified shipped P1.1 content.ts uses `defineContentScript` from `wxt/sandbox`.
- `crypto.subtle` in happy-dom — already exercised by existing tests, confirmed working.

## Post-execution

1. `/self-reflect` — capture learnings.
2. Two commits.
3. Update memory (project) per CLAUDE.md PROTOCOL 0.
