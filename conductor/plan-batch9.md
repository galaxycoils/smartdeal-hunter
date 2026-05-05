# Phase 2 — Batch 9 (revised iter 5)

Goal: Implement Ethical Bundle Optimizer, Bundle UI Panel, Deep Check Integration, Advanced Privacy Controls, Cross-Page Genome Sync. TDD-first. Coverage 90/90/90/90 per task. Bundle ceiling 2.5 MB.

## Spec deviation

**P2.7 API target = Amazon Creators API (OAuth bearer)**, NOT PA-API 5.0.

- Reason: PA-API 5.0 requires AWS Sig v4, out of scope for MVP.
- Deviation propagates from P2.6 (`lib/amazon-oauth.ts`).
- **APPROVED 2026-05-05** by user (response: "approve"). Locked in.

## Codebase facts (grep-verified 2026-05-05, must-honor)

| Claim                                         | Reality                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `wipeAll()`                                   | Does NOT exist. Actual: `wipeAllData()` at `lib/storage.ts:122`                                                |
| `STORE_GENOME`                                | NOT exported. Internal `const` at `lib/storage.ts:10`                                                          |
| `STORE_PRODUCT_CACHE`, `STORE_ANALYSIS_CACHE` | EXPORTED at `lib/storage.ts:11-12`                                                                             |
| `saveGenome` sig                              | 3-arg: `(g, key, now = Date.now)` at `lib/genome.ts:101`                                                       |
| `Product` type                                | Does NOT exist. Actual: `ProductData` at `lib/types.ts:51`                                                     |
| `ANALYZE` handler                             | Does NOT exist. Handlers: `START_ANALYSIS`, `COMPUTE_SCORES`, `UPDATE_GENOME`, `SCRAPE_REQUEST`                |
| `chrome.storage.onChanged` for IDB writes     | Does NOT fire. IDB is independent of `chrome.storage`. Need explicit sentinel write                            |
| Offscreen `REQUEST_GENOME_KEY` handshake      | Does NOT exist. Only `COMPUTE_SCORES` handled in `entrypoints/offscreen/main.ts`                               |
| `AnalysisCacheManager.METADATA_KEY`           | Hardcoded `'__metadata__'` at `lib/analysis-cache.ts:10`. Two managers collide                                 |
| `entrypoints/offscreen/main.ts` coverage      | EXCLUDED at `vitest.config.ts:31`                                                                              |
| `tests/setup.ts` mocks                        | Only `browser.runtime` + `browser.offscreen`. NO `chrome.storage`, `chrome.alarms`, `chrome.storage.onChanged` |
| `wipeGenome()`                                | Only deletes `GENOME_DB_KEY`. Won't clear oauth co-tenants                                                     |
| `validateGenome`                              | Strict `version === GENOME_VERSION_CURRENT` (1) check at `lib/genome.ts:33`                                    |
| `Genome.version`                              | Schema-version field. Reused for sync = collision (avoid)                                                      |

## Cross-cutting verification

- TDD: write failing tests first.
- Per task: `pnpm test:run`, `pnpm tsc --noEmit`, `pnpm test:coverage`.
- After all tasks land + integration commit: `pnpm build`, assert `.output/*.zip` ≤ 2.5 MB.
- **Per-file coverage enforcement:** `vitest.config.ts` extended — `coverage.thresholds` becomes a per-file map for new/modified files in this batch. CI fails if any single file drops below 90/90/90/90.
- **Test infra extension (REQUIRED):** `tests/setup.ts` extended to mock `chrome.storage.local` (`get`/`set`/`remove`/`onChanged.addListener`) and `chrome.alarms` (`create`/`onAlarm.addListener`/`clear`). Recommended: import `fakeBrowser` from `wxt/testing` and reset between tests. Add to modified-files of every task that touches these APIs.
- **Privacy grep gate (CI-blocking):** new code clean for ALL of:
  - `fetch(`
  - `XMLHttpRequest`
  - `navigator.sendBeacon`
  - `WebSocket(`
  - `new EventSource(`
  - `chrome.runtime.connectNative`
  - `import(` (dynamic, no runtime URL imports)
  - `new Image(` (1×1 tracking-pixel beacon vector)
  - `createElement('img')` / `createElement("img")` (cross-origin src exfiltration; gate scoped to non-`components/` paths since JSX `<img>` is acceptable inside UI components)
    Zero hits except inside `lib/deep-check.ts`.

---

## Tasks

### P2.4 Ethical Bundle Optimizer

**Deps:** P1.7, P1.8 (done)
**Owner:** ML
**Files (new):** `lib/bundle-optimizer.ts`, `lib/bundle-optimizer.test.ts`, `lib/__fixtures__/bundle-seeds.json`.
**Modified:**

- `lib/storage.ts` — add `STORE_HISTORY_EVENTS = 'history_events'` (export), bump `DB_VERSION` 2→3, add `DBVersionMismatchError` class export, add open-time guard `if (db.version > DB_VERSION) throw new DBVersionMismatchError()`.
- `lib/types.ts` — add `HistoryEvent` type.
- `entrypoints/background.ts` — write `HistoryEvent` of `kind: 'analyze'` after step 4 (RENDER_PANEL succeeds) inside `handleScrapeRequest` (insertion point: `entrypoints/background.ts:144`, after `await browser.tabs.sendMessage(targetTabId, renderReq)`).
- `tests/setup.ts` — extend with `chrome.storage.local` mocks (one-time, reused by P2.7/P2.8/P2.9).

**`HistoryEvent` schema:**

```ts
type HistoryEvent = {
  ts: number; // ms epoch
  asin: string;
  kind: 'view' | 'analyze' | 'bundle-add';
};
```

Storage key = `${ts}:${asin}` (lex-sortable). Writes explicit-trigger only.

**IDB v2→v3 migration & rollback:**

- `onupgradeneeded` adds `STORE_HISTORY_EVENTS` only when absent; existing stores untouched.
- **Future-version guard:** open-time check throws `DBVersionMismatchError` when `db.version > DB_VERSION`. Test asserts synthetic v4 DB triggers error (no silent corruption on downgrade).
- Documented in `lib/storage.ts` module comment.

**Public types (consumed by P2.5):**

- `Bundle = { items: BundleItem[]; rationale: string; score: number }`
- `BundleItem = { asin: string; title: string; price?: number; individualScore: number }`
- `optimizeBundle(seed: ProductData, candidates: ProductData[], genome: Genome): Bundle[]` — uses `ProductData`, not non-existent `Product`.

**Acceptance-rate proxy:**

- Fixture: `lib/__fixtures__/bundle-seeds.json` — 20 seed `ProductData` records + candidate sets + per-seed `acceptedAsins: string[]` (hand-labeled). Committed alongside test.
- Predicate: `wouldAccept(asin, seed) = seed.acceptedAsins.includes(asin)`.
- Test: `optimizeBundle(seed, candidates, genome).flatMap(b => b.items.map(i => i.asin))` recall ≥ 15% averaged across 20 seeds.

**Acceptance Criteria:**

- [ ] `STORE_HISTORY_EVENTS` is exported from `lib/storage.ts`.
- [ ] `DB_VERSION` bumped 2→3; `STORE_HISTORY_EVENTS` created in `onupgradeneeded`.
- [ ] `DBVersionMismatchError` exported; open of synthetic v4 DB throws.
- [ ] Migration test: v2-data DB upgrades to v3 cleanly; `STORE_HISTORY_EVENTS` empty post-upgrade.
- [ ] `handleScrapeRequest` writes `HistoryEvent` after RENDER_PANEL.
- [ ] Co-occurrence matrix derived from `STORE_HISTORY_EVENTS` reads. No remote calls.
- [ ] Rationale strings reference Genome traits.
- [ ] Unit tests cover: empty store, single event, top-K=3 ranking, zero-Genome-weight edge, rationale.
- [ ] Acceptance-rate proxy: ≥15% recall across 20 fixture seeds.
- [ ] **Downgrade-data-preservation test:** after `DBVersionMismatchError` throw on synthetic v4 DB, re-opening with v4-aware code returns original data unmodified (no destructive read).
- [ ] **HistoryEvent ≠ audit-log boundary:** `HistoryEvent` writes to `STORE_HISTORY_EVENTS` are NOT mirrored to audit-log. Test asserts no duplication. Rationale: `STORE_HISTORY_EVENTS` = local behavioral data for optimizer; audit-log = user-visible privacy ledger.
- [ ] 90% per-file coverage on `lib/bundle-optimizer.ts` and modified regions of `lib/storage.ts`.

### P2.5 Bundle UI Panel

**Deps:** P2.4 (sequential — runs after P2.4 commit lands)
**Owner:** Frontend
**Files (new):** `components/ui/BundlePanel.tsx`, `components/ui/BundlePanel.test.tsx`.
**Data source:** Bundle items come ONLY from `lib/bundle-optimizer.ts#optimizeBundle()`. No DOM scraping. Seed `ProductData` passed as prop.
**Acceptance Criteria:**

- [ ] Imports `Bundle`, `BundleItem` from `lib/bundle-optimizer.ts`.
- [ ] Renders each `BundleItem` with title, individualScore, `Bundle.rationale`.
- [ ] Empty state when optimizer returns `[]`.
- [ ] Component test: empty, 1 bundle, 3 bundles, rationale render.
- [ ] 90% per-file coverage on the component.

### P2.7 Deep Check Integration

**Deps:** P2.6 (done — `AmazonOAuth` Creators-API stub), user-approved deviation (above).
**Owner:** Backend
**Files (new):**

- `lib/deep-check.ts`
- `lib/deep-check.test.ts`
- `lib/deep-check-cache.ts` (dedicated 1-hr cache; does NOT extend `AnalysisCacheManager` — see decision below)
- `lib/deep-check-cache.test.ts`
- `lib/oauth-token-store.ts`
- `lib/oauth-token-store.test.ts`
- `lib/errors/deep-check-errors.ts` (`DeepCheckOptedOutError`, `DeepCheckRateLimitedError`, `DeepCheckAuthError`; re-exported from `lib/deep-check.ts`)

**Modified:**

- `components/ui/DeepCheckTab.tsx`
- `lib/storage.ts` — add `export const STORE_OAUTH = 'oauth'` (NEW dedicated store; bumps `DB_VERSION` 3→4 in same migration as P2.4 — NOTE: P2.4 owns the v2→v3 bump; P2.7 owns the v3→v4 bump, must run AFTER P2.4 commit lands or ordered in same upgrade transaction). Extend `wipeAllData()` — already wipes all stores via `db.objectStoreNames`, so adding `STORE_OAUTH` is automatic. NO change to `wipeAllData` body needed; test asserts new store gets cleared.

**Cache decision (resolves metadata-key collision):**

- New `lib/deep-check-cache.ts` is its OWN module, modeled on `AnalysisCacheManager` but writes to `STORE_ANALYSIS_CACHE` with key prefix `dc:` AND a separate metadata key `__dc_metadata__`. No collision with the existing 24-hr `AnalysisCacheManager` whose metadata is `__metadata__`.
- Constructor: `new DeepCheckCache(cryptoKey, ttlMs = 3_600_000)`.
- Public methods: `get(asin)`, `set(asin, value)`, `remove(asin)`, `flush()`.

**`STORE_OAUTH` rationale:**

- Dedicated store avoids co-tenancy in `STORE_GENOME`.
- Avoids the `wipeGenome()` semantic gap (reviewer iter 4 issue #12). `wipeGenome()` continues to only delete genome blob.
- `wipeAllData()` clears it automatically via `db.objectStoreNames` enumeration.
- Test: `wipeAllData()` clears `STORE_OAUTH`; `wipeGenome()` does NOT clear `STORE_OAUTH` (correct boundary).

**API target:** Amazon Creators API, OAuth bearer.

**`sdh:in-flight` flag (P2.7 is SOLE producer; P2.8 alarm handler is SOLE consumer):**

- `deepCheck()` lifecycle:
  1. Entry: read `chrome.storage.local.get('sdh:in-flight')`. If present and age (`Date.now() - value`) > 60_000 ms → treat as stale, `chrome.storage.local.remove('sdh:in-flight')`.
  2. Before first network call: `chrome.storage.local.set({ 'sdh:in-flight': Date.now() })`.
  3. Wrap in `try { … } finally { await chrome.storage.local.remove('sdh:in-flight') }` — clears on both success and error.

**Cache-vs-opt-out flip-after-fill behavior:**

- Opt-in → fill → opt-out: subsequent `deepCheck()` throws `DeepCheckOptedOutError` BEFORE any cache read.
- Cache entries persist on disk until `wipeAllData()` or TTL expires. Opt-out gates new calls only.
- Test: opt-in → fill → opt-out → throws (NOT cache hit) → flip back to opt-in → returns cached value if within TTL.

**Acceptance Criteria:**

- [ ] `STORE_OAUTH = 'oauth'` exported from `lib/storage.ts`; `onupgradeneeded` creates it; `DB_VERSION` 3→4.
- [ ] Future-version guard from P2.4 still works after the 3→4 bump (test re-runs synthetic v5).
- [ ] `oauth-token-store.ts` reads/writes `{ accessToken, refreshToken, expiresAt }` to `STORE_OAUTH` key `tokens`. Uses `setEncryptedItem`/`getEncryptedItem`. Test: round-trip.
- [ ] `wipeAllData()` clears `STORE_OAUTH`; `wipeGenome()` does NOT (boundary preserved).
- [ ] Opt-in gate (BLOCKING privacy invariant): first network statement is `if (!(await isDeepCheckOptedIn())) throw new DeepCheckOptedOutError()`.
- [ ] Cache-vs-opt-out flip-after-fill test passes per behavior above.
- [ ] 1-hr cache via `DeepCheckCache` (separate module, separate metadata namespace).
- [ ] Rate limit: 10 calls / 60s rolling window. On hit, return cached value if present.
- [ ] Cold-start (cache empty + rate-limited): throw `DeepCheckRateLimitedError` with `retryAfterMs`.
- [ ] Exponential backoff (250ms→500ms→1000ms, 3 retries) for transient 5xx and 429.
- [ ] Token refresh: on 401, call `AmazonOAuth.refreshTokens(refreshToken)`, persist, retry once. On second 401, throw `DeepCheckAuthError`.
- [ ] **Concurrent-refresh single-flight:** two simultaneous 401s yield exactly ONE `refreshTokens` call (mutex/single-flight). Both original calls retry with the new token. Asserts no double-write to `STORE_OAUTH`.
- [ ] **Audit-log integration (mirror of P2.8 AC):** every `deepCheck()` success AND failure calls `auditLog.append({ kind: 'deep-check', summary: 'asin=…' })`, gated on `optInAuditLog === true`. Test asserts wiring from P2.7 side.
- [ ] **Cache coexistence regression test:** instantiate `AnalysisCacheManager` and `DeepCheckCache` against same `STORE_ANALYSIS_CACHE`; round-trip both; assert `__metadata__` and `__dc_metadata__` untouched by the other; assert key prefixes `dc:` and existing analysis-cache keys do not collide.
- [ ] `sdh:in-flight` lifecycle test: flag set before fetch, cleared in finally on success+error, stale (>60s) auto-cleared on entry.
- [ ] `DeepCheckTab.tsx` updated: status pill (Idle/Loading/Cached/RateLimited/OptedOut/AuthError) + last-fetched ts.
- [ ] All tests above + token persistence round-trip.
- [ ] 90% per-file coverage on `lib/deep-check.ts`, `lib/deep-check-cache.ts`, `lib/oauth-token-store.ts`, `lib/errors/deep-check-errors.ts`.

### P2.8 Advanced Privacy Controls

**Deps:** P2.1 (done)
**Owner:** Frontend
**Files (new):** `components/ui/PrivacyTab.tsx`, `components/ui/PrivacyTab.test.tsx`, `lib/audit-log.ts`, `lib/audit-log.test.ts`.
**Modified:**

- `entrypoints/options/App.tsx` — extract inline PrivacyTab (current location: `App.tsx:13-106`).
- `entrypoints/background.ts` — add `chrome.alarms.onAlarm.addListener` for alarm name `sdh:scheduled-wipe`.
- `wxt.config.ts` — add `alarms` to `manifest.permissions`.

**Audit-log retention on `optInAuditLog` toggle-off:**

- Toggle true→false STOPS new appends (gating in `auditLog.append()`).
- Existing buffer RETAINED on disk (no auto-wipe).
- UI banner: "Audit log paused. Existing entries retained. Use 'Wipe All Data' to clear."
- Only `wipeAllData()` (explicit user action) deletes them.

**Acceptance Criteria:**

- [ ] Test asserts `wxt.config.ts` includes `alarms` in `manifest.permissions`.
- [ ] Toggles `optInDeepCheck`, `optInAuditLog`, `optInGenomeSync` (all boolean). Stored in `chrome.storage.local`. Defaults all `false`.
- [ ] Audit log: `lib/audit-log.ts` writes `{ ts, kind, summary }` to `chrome.storage.local` ring buffer at key `'sdh:audit-log'` (cap 500). NO remote transmission. UI lists last 50. Key namespace `sdh:` reserved across batch (other reserved keys: `sdh:in-flight`, `sdh:genome-revision`, `sdh:scheduled-wipe`).
- [ ] Audit-log toggle-off retention test (per behavior above).
- [ ] Audit-log integration with P2.7: `lib/deep-check.ts` calls `auditLog.append({ kind: 'deep-check', summary: 'asin=…' })` on every success+failure (gated on `optInAuditLog === true`). Test asserts wiring.
- [ ] Scheduled wipe uses `chrome.alarms` (NOT `setTimeout`). Alarm name `sdh:scheduled-wipe`. Background handler calls `wipeAllData()`.
- [ ] Wipe-mid-action protection: handler reads `chrome.storage.local.get('sdh:in-flight')` (produced by P2.7 `deepCheck()`). If present, re-arm alarm at +30s and skip.
- [ ] Tests cover: alarms permission present, toggle persistence, ring-buffer eviction, audit-log Deep Check integration, alarm registration, alarm-fires-wipe, alarm-defers-when-in-flight, PrivacyTab render.
- [ ] E2E (Playwright): existing suite passes; add 1 spec scheduling wipe at +5s asserting data cleared. Skipped on CI if alarm timing flaky.
- [ ] 90% per-file coverage on `components/ui/PrivacyTab.tsx`, `lib/audit-log.ts`, modified regions of `entrypoints/background.ts`.

### P2.9 Cross-Page Genome Sync

**Deps:** P2.2 (done)
**Owner:** Backend
**Files (new):** `lib/errors/genome-errors.ts` (`GenomeStaleError`; re-exported from `lib/genome.ts`).
**Modified:** `lib/genome.ts`, `lib/types.ts`, `vitest.config.ts` (per below).

**Mechanism (resolves reviewer iter 4 BLOCKING #1 + #2):**

- Genome persists in IndexedDB. `chrome.storage.onChanged` does NOT fire on IDB writes.
- **Sentinel-write fix:** `saveGenome()` writes a sentinel to `chrome.storage.local` AFTER the IDB write succeeds:
  ```ts
  await setEncryptedItem(GENOME_STORE, GENOME_DB_KEY, g, key);
  await chrome.storage.local.set({ 'sdh:genome-revision': g.revision });
  ```
- The sentinel value is the new `revision` number (NOT the genome itself — sentinel is unencrypted, contains no PII).
- `onGenomeChange(cb)` listens to `chrome.storage.onChanged` filtered to key `'sdh:genome-revision'`. On change, callback invokes a re-load of the Genome via `loadGenome(key)` performed by the caller — so the callback signature is `(revision: number) => void`, NOT `(g: Genome) => void`.
- Each subscriber context (popup, options, background) holds its own `CryptoKey` already; they call `loadGenome(key)` themselves on receiving a revision change. No key handshake to offscreen needed.

**Subscriber scope:** popup + options + background ONLY. **Offscreen DROPPED from P2.9 subscriber list** per reviewer iter 4 BLOCKING #2 alt: avoids the non-existent `REQUEST_GENOME_KEY` handshake. Offscreen receives Genome via existing `COMPUTE_SCORES` payload (`entrypoints/offscreen/main.ts:16`); no live-update need.

**Type extension:**

```ts
// lib/types.ts
interface Genome {
  // existing fields…
  revision?: number; // new field; absence = legacy record
}
```

`validateGenome` updated: `revision` is optional `number ≥ 1` or `undefined`. Schema `version` unchanged.

**Function signatures:**

- `saveGenome(g: Genome, key: CryptoKey, opts?: { now?: () => number; expectedRevision?: number }): Promise<void>` — replaces 3rd-arg `now = Date.now`. **Breaking change** for any caller passing `now` positionally; grep-verified zero such callers exist (`grep -rn 'saveGenome(' --include='*.ts'` shows only 2-arg calls in `entrypoints/background.ts:76` and tests). Plan logs the grep verification as a pre-implementation step.
- `onGenomeChange(cb: (revision: number) => void): () => void` — `chrome.storage.onChanged` listener filtered to `'sdh:genome-revision'`. Returns unsubscribe fn.

**`GenomeStaleError`:** defined in `lib/errors/genome-errors.ts`, re-exported from `lib/genome.ts`. Tests assert both import paths.

**`vitest.config.ts` modification (resolves reviewer iter 4 HIGH #10):**

- Remove `entrypoints/offscreen/main.ts` from `coverage.exclude` if any P2.9 tests touch it. (Plan currently scopes offscreen out of P2.9, so this modification may not be needed. If P2.9 ends up not modifying offscreen → no vitest.config.ts change. Decide at implementation time and record in commit.)
- BUT: `vitest.config.ts` IS modified to switch global `coverage.thresholds` to per-file map for new/modified files in this batch. List in P2.9 modified files.

**Acceptance Criteria:**

- [ ] `revision` increments on every `saveGenome`. Default initial value = 1 (set on first save if absent).
- [ ] Legacy un-versioned (no `revision`) record reads succeed; `loadGenome` returns object with `revision: 1` populated by upgrade-on-read.
- [ ] If `opts.expectedRevision` provided and disk record's `revision` differs → throw `GenomeStaleError`. Omitted = legacy mode.
- [ ] Race-condition automated test (BLOCKING): two concurrent `saveGenome` with stale `expectedRevision`; second throws. NOT manual.
- [ ] `GenomeStaleError` importable from BOTH `lib/genome` and `lib/errors/genome-errors`. Test asserts.
- [ ] **Sentinel-write test:** `saveGenome` calls `chrome.storage.local.set({ 'sdh:genome-revision': N })` after IDB write. Mock asserts call sequence.
- [ ] `onGenomeChange` subscribers in popup + options + background receive revision change event. Three context tests added (offscreen excluded by design).
- [ ] **Offscreen-exclusion regression gate:** negative test asserts offscreen context (`entrypoints/offscreen/main.ts`) does NOT call `onGenomeChange`. CI grep gate: `rg -l 'onGenomeChange' entrypoints/offscreen` returns no matches. Comment in `lib/genome.ts` documents the design decision.
- [ ] Schema-version field (`Genome.version`) untouched; `validateGenome` still rejects non-current schema versions.
- [ ] Pre-implementation step: run `grep -rn 'saveGenome(' --include='*.ts' --include='*.tsx'` and log to commit message; assert no 3-arg-`now` callers exist.
- [ ] Tests cover: legacy auto-promote, save increments revision, stale-write rejection, onGenomeChange delivery to 3 contexts, unsubscribe cleanup, sentinel-write happens after IDB write succeeds.
- [ ] 90% per-file coverage on `lib/genome.ts`, `lib/errors/genome-errors.ts`.

---

## Cross-task integration tests (FINAL COMMIT — runs only after all 4 parallel tasks merge)

Resolves reviewer iter 4 HIGH #11 (cross-task ordering). New file: `tests/integration/batch9.integration.test.ts`. NOT gated per-task. Commit comes after P2.4, P2.7, P2.8, P2.9 all land.

- [ ] P2.7 ↔ P2.8: `deep-check.ts` calls produce audit-log entries when `optInAuditLog === true`, none when false.
- [ ] P2.7 ↔ P2.8: `wipeAllData()` clears `STORE_OAUTH` AND audit log AND `STORE_ANALYSIS_CACHE`.
- [ ] P2.4 → P2.5: optimizer output type passes type-check at `BundlePanel` consumption point (compile-time check in component test).
- [ ] P2.7 ↔ P2.8: `deepCheck()` sets `sdh:in-flight`; alarm handler defers wipe while flag active. End-to-end test mocks alarm.
- [ ] P2.9 ↔ all contexts: `saveGenome` triggers sentinel; popup/options/background subscribers all receive revision change.

---

## Dependency / Execution Order

```
P2.4 ──┐
P2.7   ├── parallel
P2.8   ┤
P2.9 ──┘

P2.5 — sequential after P2.4 commit lands.

Cross-task integration commit — sequential after ALL FOUR parallel tasks merge.
```

**DB_VERSION coordination:**

- P2.4 owns 2→3 bump (adds `STORE_HISTORY_EVENTS`).
- P2.7 owns 3→4 bump (adds `STORE_OAUTH`).
- If P2.4 and P2.7 land in either order, the later one rebases its bump to the next available number. Implementation rule: P2.7 reads the current `DB_VERSION` after rebase and bumps to `current + 1`. Migration code is purely additive (new store create-if-absent), so order doesn't break data.

Each task = own commit, Conventional Commits format, `P2.x` in subject.

---

## Final Verification

- `pnpm test:run` — all suites pass.
- `pnpm tsc --noEmit` — clean.
- `pnpm test:coverage` — per-file 90/90/90/90 enforced.
- `pnpm build` — `.output/*.zip` ≤ 2.5 MB.
- `pnpm exec playwright test` — E2E passes locally.
- Privacy grep gate (expanded set above) — zero hits in new code outside `lib/deep-check.ts`.
- Update `docs/STATE_HANDOFF.md` (Obsidian) + claude-mem after each commit.
