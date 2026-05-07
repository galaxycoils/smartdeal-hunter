# Changelog

All notable changes to SmartDeal Hunter are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-07

Phase 5.1 — Local Price Alerts.

### Added

- **Price alerts** — opt-in "Watch this ASIN" toggle in the Scout panel.
  Alarm-driven re-check (`sdh:price-check`, period ≥ 30 min) compares the
  cached price against the locally collected 30-day low and fires a
  `chrome.notifications` system notification when the price beats the low.
  All evaluation runs on-device against IndexedDB; **no remote calls.**
- **Enrolled-alert management** in Options → Privacy:
  list of enrolled ASINs with per-row un-enroll button, OS-permission
  status pill, and "Notifications: blocked by OS" banner when the user
  has denied browser notification permission.
- **`notifications` permission** added to the manifest. Notifications fire
  only after explicit user opt-in via the Watch toggle.
- **Audit log** extended with `price-alert-enroll`, `price-alert-disenroll`,
  and `price-alert-fired` event kinds (gated by the existing
  `optInAuditLog` toggle).
- **Notification click handler** focuses an existing tab matching the
  cached product URL. **Never opens a new tab** (privacy invariant: no
  auto-navigation). Click clears the notification regardless.

### Changed

- **IndexedDB schema bumped from v4 → v5** with a new `price_alerts`
  encrypted store. Existing v4 data is preserved on upgrade. Downgrading
  from v0.2.0 to a v0.1.x build will refuse to open the database
  (`DBVersionMismatchError`); users wanting to downgrade must wipe data
  via Options → Privacy → Wipe All Data.
- `lib/storage.ts` exports new `getAllEncryptedItems<T>(storeName, key)`
  helper for bulk-decrypted reads from any encrypted store.

### Privacy

- All four privacy invariants preserved: zero remote, encrypted-at-rest
  (AES-GCM-256), explicit-trigger only (alarm reads only locally
  collected price history; never scrapes), bundle ≤ 2.5 MB, Chrome ≥ 116,
  service-worker-stateless (alarm handler re-derives bootstrap key on
  every wake), IDB forward-only.

## [0.1.0] — 2026-05-06

First public release. Closes spec Phase 1 + Phase 2 + post-spec Phase 3
(multi-store + price history + sentiment + brand polish) + Phase 4
(release hardening: coverage backfill, perf assertions, security +
a11y audits, CWS submission prereqs).

### Added

- **Multi-store support** for 8 Amazon marketplaces: US, UK, DE, JP, CA,
  FR, IT, ES. Locale-aware scraper handles per-region currency symbols,
  decimal separators, and rating-phrase formats.
- **30-day price history** stored locally in IndexedDB, surfaced as a
  collapsible interactive chart in the Scout panel (`recharts`).
- **Gemini Nano sentiment summary** with three-tier degradation chain
  (Nano → error fallback → pure-JS keyword heuristic). On-device only.
- **Brand assets** (`assets/brand/logo.svg`) and `framer-motion` UI
  transitions in Card + ScoutPanel.
- **Quick Scout state machine** (`idle | scouting | success | error`)
  with explicit tab-guard for `*.amazon.<tld>` hosts and shadcn/ui
  toast notifications.
- **Tailwind v4 + shadcn/ui** wired to the WXT React extension.
  Component primitives: Button, Card, Slider, Tabs, Badge, Alert,
  Skeleton, Progress, Separator, Sonner.
- **7 regional Playwright E2E fixtures** under `tests/e2e/fixtures/`
  with parametrized `tests/e2e/regional.spec.ts` (skipped by default
  because Playwright extension tests need a real display; run with
  `--headed` locally).
- **Perf assertion harness** under `tests/performance/`:
  - `chart-render.perf.test.ts` (PriceChart 30 records, p95 < 800 ms)
  - `scrape-latency.perf.test.ts` (per-locale, p95 < 200 ms)
  - `sentiment-latency.perf.test.ts` (heuristic p95 < 50 ms; mocked Nano p95 < 1500 ms)
- **Perf baseline** at `docs/perf-baseline.json` and budget rationale
  at `docs/perf-budget.md`.
- **Security audit** at `docs/security-audit-phase4.md` (PASS — CSP,
  Web Crypto, egress, SW statelessness, host perms, affiliate,
  explicit-trigger, telemetry).
- **A11y audit** at `docs/a11y-audit-phase4.md` (PASS — `axe-core` 4.11.4,
  zero serious + critical violations under WCAG 2.1 AA).
- **Privacy policy** canonical text at `docs/privacy-policy.md`.
- **CWS submission checklist** at `docs/cws-submission-checklist.md`
  with every dashboard field filled in.
- **`pnpm perf` script** runs only the perf suite.
- **Coverage thresholds** ratcheted 90 → 91 (all four axes) in
  `.coverage-thresholds.json`. Rollback procedure documented.

### Changed

- `lib/sentiment.ts` rewritten from a 4-line stub returning mock text
  into a typed `analyzeSentiment(text): SentimentResult` with three
  Nano paths. `getSentimentSummary` string facade preserved so
  `DeepCheckTab` caller is unchanged.
- `lib/scoring.ts` `toAttributeVector` uses `getMaxPrice(currency)`
  instead of a hardcoded 200 USD ceiling, so JPY (30 000) and other
  high-magnitude currencies score correctly.
- `lib/scraper.ts` `scrapeProduct` now detects locale from the URL
  and applies per-region price + rating regex.
- `entrypoints/popup/Dashboard.tsx` + `Onboarding.tsx`: added explicit
  ARIA attributes (`aria-label` on `<Progress>`, `role="progressbar"`
  - `aria-valuenow/min/max` on StepDots) to fix WCAG 2.1 AA violations
    surfaced by axe-core.
- `entrypoints/popup/Dashboard.tsx`: Scout result card displays the
  parsed price with `Intl.NumberFormat(locale, { style: 'currency', currency })`.
- `lib/messaging/types.ts`: `ScrapeResponse` and `RenderPanelMessage`
  payloads now include `price`, `currency`, `region`.
- `entrypoints/background.ts` `handleScrapeRequest` returns the full
  payload `{ asin, trueValue, personalFit, price, currency, region }`
  instead of a boolean.

### Fixed

- **Coverage gate** was silently disabled across Phase 1 and most of
  Phase 2 because `vitest.config.ts` read `JSON.parse(...).lines`
  directly while `.coverage-thresholds.json` nests under `global`.
  Fixed in `c9d9eab` (Phase 1 P1.15) — now verified again as part of
  WU-2 in Phase 4.
- **Quick Scout silent fail**: handler swallowed errors without UI
  feedback; result panel only rendered on Amazon pages, so on
  non-Amazon tabs the click was a silent no-op. Fixed in `7aceeb4`.
- **Tailwind utilities inert**: `tailwindcss` and `@tailwindcss/vite`
  were never installed, so all utility class names were dead code.
  Wired in `7aceeb4` (Phase 2 hotfix).

### Security

- **Web Crypto** invariants verified in `lib/crypto.ts`: AES-GCM-256,
  PBKDF2 600 000 iterations, IV via `crypto.getRandomValues(12)` per
  call, derived keys held in memory only.
- **Zero remote calls** outside `lib/deep-check.ts` (opt-in Amazon
  Creators API). `lib/amazon-oauth.ts` constructs OAuth URLs only;
  uses `browser.identity.launchWebAuthFlow`, not `fetch`.
- **CSP** unchanged: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.
- **`happy-dom`** updated to `^20.9.0` (security advisory) in `c231de8`.
- **Affiliate links**: zero. Verified by grep in WU-8.

### Build

- Total chrome-mv3 build: **1.21 MB** (cap 2.5 MB; 2× headroom).
- Largest chunk: `content-scripts/content.js` at **707 kB** (recharts
  - framer-motion + ScoutPanel; further reduction blocked by WXT MV3
    content-script `codeSplitting:false` constraint — see
    `docs/perf/bundle-analysis-phase4.md` for the follow-up plan).
- Zip: `.output/smartdeal-hunter-0.1.0-chrome.zip` ≈ 376 kB.

### Tests

- **281 passing** across 42 test files (was 211 at end of Phase 2).
- Coverage: **97.72 / 91.40 / 94.97 / 99.65** (statements / branches / functions / lines).
- New floor: **91 / 91 / 91 / 91** (was 90 / 90 / 90 / 90).
- New `lib/sentiment.ts` and `lib/price-history.ts` both at 100% all axes.

---

## [0.0.1] — 2026-04-XX (pre-release, never published)

Phase 1 + Phase 2 internal milestone. Not published to the Chrome
Web Store. See `conductor/STATE_HANDOFF.md` and the project's
`conductor/plan-batch*.md` files for the Phase 1 + Phase 2 history.
