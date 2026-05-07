# Phase 5 — Roadmap (meta, iter 3)

> Roadmap only. Per-feature implementation lives in `conductor/plan-phase5-<feature>.md` (one file per feature, drafted before exec, gated by `/metaswarm:plan-review-gate`).
> TDD mandatory. Coverage floor 91. Privacy + bundle invariants from `CLAUDE.md` apply unchanged.

## Scope

Four work items per `docs/STATE_HANDOFF.md` Future section + memory `project_v0_1_0_release.md`:

| ID   | Feature                           | Permissions impact                                       | Release target       |
| ---- | --------------------------------- | -------------------------------------------------------- | -------------------- |
| P5.1 | Price Alerts (30-day low)         | new `notifications` permission                           | v0.2.0               |
| P5.2 | Cross-locale Price Compare        | none                                                     | v0.2.0               |
| P5.3 | Multi-retailer (Target / Walmart) | new host permissions for `*.target.com`, `*.walmart.com` | v0.3.0               |
| P5.4 | CWS review monitoring             | none (passive ops)                                       | tracks v0.1.0–v0.3.0 |

P5.1 + P5.2 ship together as v0.2.0. If CWS rejects `notifications`, P5.2 ships v0.2.0 alone and P5.1 defers to v0.2.1 — separate work-unit commits keep them revertible independently. P5.3 ships separately as v0.3.0 because new host permissions force CWS re-review; do not bundle.

## Cross-cutting invariants

Per-feature plans cite these; do not redefine:

| #   | Invariant                                                                                                                                                                                                                                                              | Source                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Zero remote data transmission                                                                                                                                                                                                                                          | `CLAUDE.md` Privacy boundary                                   |
| 2   | AES-GCM-256 + PBKDF2 600K for any newly persisted user-identifying state                                                                                                                                                                                               | `CLAUDE.md` Web Crypto encryption                              |
| 3   | Explicit-trigger only (carve-out: alarm-driven evaluation of _already-collected local_ data is allowed; alarm-driven scraping or remote calls is forbidden)                                                                                                            | `CLAUDE.md` Notes — needs Privacy Policy disclosure for v0.2.0 |
| 4   | Bundle ≤ 2.5 MB (current baseline 375 KB; cumulative cap 420 KB enforced in CI)                                                                                                                                                                                        | `CLAUDE.md` Bundle target                                      |
| 5   | Min Chrome 116 (verify any new API per release)                                                                                                                                                                                                                        | `CLAUDE.md` Notes                                              |
| 6   | SW statelessness — handlers rehydrate state from IDB / `chrome.storage.local` on every wake; no globals                                                                                                                                                                | `CLAUDE.md` Notes                                              |
| 7   | IDB schema is forward-only. New stores or fields require a `DB_VERSION` bump and break downgrade by design (existing `DBVersionMismatchError` guard at `lib/storage.ts:60`). Per-feature plans must document this in the user changelog and treat downgrade as a wipe. | observed in code                                               |

## Per-feature roadmap entries

Each entry below is intentionally brief — implementation depth (file lists, function signatures, coverage percentages, rollback playbooks) belongs in per-feature plans.

### P5.1 — Price Alerts

**Goal**: notify user when a previously scouted ASIN's current price equals or undercuts its 30-day local low. Evaluation is local-only over locally cached price history.

**Permissions delta**: add `notifications`.

**Key code paths to read first**: `entrypoints/background.ts`, `lib/price-history.ts`, `lib/storage.ts`, `lib/messaging/types.ts`, `components/ui/ScoutPanel.tsx`, `components/ui/PrivacyTab.tsx`, `tests/setup.ts`, `wxt.config.ts`, `docs/cws-submission-checklist.md`.

**Open decisions for the per-feature plan** (must resolve before exec):

- Which messaging union(s) the new variants extend.
- Pre-flight notification permission probe + OS-denial UI.
- Notification dedup-key shape.
- Whether to extend `tests/setup.ts` chrome mock with `chrome.notifications` + `chrome.alarms.get/getAll/clearAll` (no `fakeBrowser` in repo).
- Privacy Policy diff explaining alarm-driven local re-evaluation (invariant #3 carve-out).

**Verification gates** (defined in detail in per-feature plan):

- Unit + integration tests; coverage floor 91 maintained or ratcheted up.
- SW-statelessness test: two alarm fires with no in-memory state produce identical output.
- Manual end-to-end on unpacked extension.
- Bundle delta within budget.

### P5.2 — Cross-locale Price Compare

**Goal**: surface the prices a user has locally scouted for a given ASIN across each of the 8 supported Amazon locales. Zero remote calls; FX rates frozen at build time.

**Permissions delta**: none.

**Key code paths to read first**: `lib/scraper.ts`, `lib/types.ts`, `lib/price-history.ts`, `lib/currency.ts`, `lib/scoring.ts`, `lib/storage.ts`, `lib/messaging/types.ts`, `components/ui/ScoutPanel.tsx`, `components/ui/PriceChart.tsx`.

**Out of scope for v0.2.0** (to be tracked as separate decision items, not bundled silently):

- Encrypting `STORE_HISTORY_EVENTS` (currently plaintext). If user-identifying classification of marketplace footprint is desired, surface as its own ADR + plan; do not piggyback. Iter 1/2 of this roadmap proposed bundling it; that bundle is REJECTED to keep P5.2 minimally scoped.
- v0.1.1 safe-fail reader patch (consequent of the above; also REJECTED).

**Open decisions for the per-feature plan**:

- Add `locale` to `ProductData` (`lib/types.ts`) and to `PriceRecord` (`lib/price-history.ts`) as optional fields with default reader `'US'`. Confirm whether scraper emits `locale` (currently only `currency`).
- Single FX source of truth: `lib/currency.ts`. `convertTo` and `getMaxPrice` MUST share one frozen table. Per-feature plan defines the shape.
- Cross-locale UI render rules (hide if only one locale scouted, "Not scouted" badge, FX freeze date label).

**Verification gates**: unit + manual + bundle delta within budget; legacy-record reader test (records without `locale` default cleanly).

### P5.3 — Multi-retailer (Target / Walmart)

**Goal**: extend scouting to Target.com and Walmart.com, preserving the URL-first → JSON-LD → DOM extraction order from `CLAUDE.md`.

**Permissions delta**: add `https://*.target.com/*` and `https://*.walmart.com/*` to BOTH `host_permissions` (in `wxt.config.ts`) AND `defineContentScript` `matches` (in `entrypoints/content.ts`). Both fields must update in lockstep.

**Key code paths to read first**: `lib/scraper.ts`, `lib/types.ts`, `lib/genome.ts`, `lib/scoring.ts`, `entrypoints/content.ts`, `wxt.config.ts`, `tests/e2e/`, `docs/cws-submission-checklist.md`.

**Open decisions for the per-feature plan**:

- Refactor: extract `RetailerScraper` interface and dispatch by hostname. Per-retailer modules under `lib/scrapers/`. The per-feature plan MUST include a behavior-preservation snapshot test against the existing Amazon fixture before extracting `lib/scrapers/amazon.ts` — non-negotiable gate.
- Concrete artifact for the genome/scoring retailer-agnostic audit (checklist file or test, not a commit-message line).
- Add optional `retailer` field to `ProductData` and `PriceRecord` with reader default `'amazon'`.
- CWS reviewer notes: per-retailer fixture refresh cadence; on-failure path when all 3 extraction strategies miss.

**Verification gates**: per-scraper unit ≥ 90% coverage; E2E for Target + Walmart; CI check that built `manifest.json` host_permissions count matches content_scripts.matches count.

### P5.4 — CWS review monitoring (passive)

**Goal**: track CWS dev-channel + prod-channel review status across v0.1.0, v0.2.0, v0.3.0.

**Definition of done (terminal)**: closed when v0.3.0 reaches "Published" in CWS prod channel. Re-opened only on subsequent release.

**Per-event work**:

- On approval: tag git with `cws-approved-<version>`; update Obsidian `STATE_HANDOFF.md`.
- On rejection: append verbatim reviewer feedback to `conductor/cws-review-notes.md` mapped to the file/field that needs change. SLA for response: 5 business days; escalate via memory + Obsidian on overrun.

**Verification**: terminal — `git tag --list 'cws-approved-*'` lists `v0.1.0`, `v0.2.0`, `v0.3.0`.

## Plan Review Gate sequencing

Before each per-feature plan exec:

1. Draft `conductor/plan-phase5-<feature>.md`.
2. Run `/metaswarm:plan-review-gate` (Scope, Completeness, Feasibility) — all PASS or iterate (max 3 per `CLAUDE.md` workflow).
3. Ask user execution method.
4. TDD per-task. Never `--no-verify`. Never self-certify.
5. After each commit: update Obsidian `STATE_HANDOFF.md` + memory + (`MEMORY.md` index when adding/removing memory files).

## Release cadence

| Release | Contents                                                | CWS submit                      |
| ------- | ------------------------------------------------------- | ------------------------------- |
| v0.2.0  | P5.1 + P5.2 (or P5.2 alone if `notifications` rejected) | required (new permission)       |
| v0.3.0  | P5.3                                                    | required (new host permissions) |

## Critical files (entry list for per-feature plan drafters)

`entrypoints/background.ts`, `entrypoints/content.ts`, `lib/storage.ts`, `lib/price-history.ts`, `lib/scraper.ts`, `lib/currency.ts`, `lib/scoring.ts`, `lib/genome.ts`, `lib/types.ts`, `lib/messaging/types.ts`, `components/ui/ScoutPanel.tsx`, `components/ui/PrivacyTab.tsx`, `components/ui/PriceChart.tsx`, `tests/setup.ts`, `tests/e2e/`, `wxt.config.ts`, `docs/cws-submission-checklist.md`.
