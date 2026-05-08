# 🏹 SmartDeal Hunter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/tahamtandariush/smartdeal-hunter/releases)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v0.1.0-green.svg)](https://chrome.google.com/webstore)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)

**SmartDeal Hunter** is a privacy-first Amazon shopping assistant that helps you make smarter purchases through on-device analysis. Unlike traditional extensions, it never tracks your browsing history, injects affiliate links, or sends your personal data to remote servers.

---

## 🌟 Key Features

### 🧠 Genome Engine

Your shopping preferences are unique. The **Genome Engine** builds a local profile of what matters to you—whether it's review quality, brand trust, or extreme discount depth.

- **Personal Fit Score:** Every product is scored against your specific priorities.
- **On-Device Learning:** Learns from your feedback (Saved, Purchased, Not Interested) without ever leaving your machine.
- **Cross-Page Sync:** Your genome stays consistent across all Amazon tabs in real-time.

### ⚖️ True Value Analysis

Get an objective 0–100 quality signal for any product.

- **Price History:** View 30-day price trend charts built from your local scouting history.
- **Sentiment Analysis:** On-device summarization of reviews (Gemini Nano fallback chain).
- **Scout Panel:** A non-intrusive shadow-DOM overlay that appears only when you need it.

### 🌍 International Support

Scout deals across 8 global Amazon marketplaces with localized parsing for:

- 🇺🇸 US (.com)
- 🇬🇧 UK (.co.uk)
- 🇩🇪 DE (.de)
- 🇯🇵 JP (.co.jp)
- 🇨🇦 CA (.ca)
- 🇫🇷 FR (.fr)
- 🇮🇹 IT (.it)
- 🇪🇸 ES (.es)

### 🛡️ Privacy by Design

- **Zero Telemetry:** No tracking, no advertising IDs, no background scraping.
- **Local Encryption:** Your profile is encrypted with **AES-GCM-256** using a key derived via **PBKDF2** (600,000 iterations).
- **Opt-in Only:** Advanced features like "Deep Check" (via Amazon Creators API) require explicit user consent and are rate-limited.
- **Audit Logs:** View every privacy-sensitive action the extension takes in the local Audit Log.

### 📦 Ethical Bundle Optimizer

Discover product combinations that actually make sense for your needs, generated locally from your history and preferences.

---

## 🛠 Tech Stack

- **Framework:** [WXT 0.20](https://wxt.dev/) (Web Extension Toolbox)
- **UI:** [React 19](https://react.dev/), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Charts:** [Recharts](https://recharts.org/) for price history visualization.
- **State:** [Genome State Management](https://github.com/tahamtandariush/smartdeal-hunter/blob/main/lib/genome.ts)
- **ML/Inference:** [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- **Security:** Web Crypto API (AES-GCM, PBKDF2)
- **Testing:** [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)

---

## 🚀 Getting Started

### Installation (Developer Channel)

1. Download the latest [Release Zip](https://github.com/tahamtandariush/smartdeal-hunter/releases).
2. Unzip the file.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer Mode** (top right toggle).
5. Click **Load unpacked** and select the `.output/chrome-mv3` folder.

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server with HMR
pnpm dev

# Run unit and integration tests
pnpm test:run

# Build production version
pnpm build
```

---

## 📊 Project Status: v0.1.0 (Phase 4 COMPLETE)

We have successfully delivered the core pillars of SmartDeal Hunter:

- [x] **Secure Architecture:** PBKDF2-backed local encryption.
- [x] **Scout & Genome:** Fully functional on-device scoring.
- [x] **Multi-Store Support:** Full support for 8 international Amazon locales.
- [x] **Price Visualization:** Local 30-day price trend charts.
- [x] **Privacy & Compliance:** Comprehensive user control, audit logs, and CWS readiness.
- [x] **Audited Quality:** 100% passing tests with >91% coverage and zero a11y/security blockers.

---

## ✨ What's New

Released since v0.1.0 — fully additive, all privacy invariants preserved.

### v0.2.1 — On-Device Review Authenticity

- **6-heuristic authenticity score (0–100)** surfaced in the Scout panel:
  bigram-Jaccard uniqueness, rating distribution, temporal clustering,
  body-length variance, verified-purchase ratio, and helpful-votes average.
- **"Why?" disclosure** lists up to three reasons a review looked suspicious.
- **Zero remote calls.** Review text never leaves the device, is never
  persisted to IndexedDB, and is never written to the audit log.
- New optional audit-log kind `review-authenticity-evaluated` (gated by the
  existing opt-in toggle) records ASIN, sample count, and score only.

### v0.2.0 — Local Price Alerts (Phase 5.1)

- **"Watch this ASIN" toggle** in the Scout panel — opt-in per product.
- **Alarm-driven re-checks** via `chrome.alarms` (period ≥ 30 min) compare
  the cached price against the locally collected 30-day low.
- **System notifications** fire only when the price beats the local low.
  No remote service, no push subscription.
- **Enrolled-alert management** in Options → Privacy: per-row un-enroll,
  OS-permission status pill, "blocked by OS" banner when notifications are
  denied.
- **Notification clicks focus an existing tab** matching the cached product
  URL — they never open a new tab (privacy invariant: no auto-navigation).
- IndexedDB schema bumped to **v5** with a new encrypted `price_alerts`
  store. Existing v4 data is preserved on upgrade.
- Audit log gains `price-alert-enroll`, `price-alert-disenroll`, and
  `price-alert-fired` kinds (gated by the opt-in toggle).

See [`CHANGELOG.md`](./CHANGELOG.md) for the full history.

---

## 🧩 Extension Architecture

SmartDeal Hunter is a Manifest V3 extension. The service worker stays
stateless — all state persists to `chrome.storage.local` and IndexedDB —
and heavy ML inference runs in an offscreen document so the SW can
terminate when idle without losing work.

| Entrypoint                     | Role                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `entrypoints/background.ts`    | Service worker — orchestration, alarms, message routing       |
| `entrypoints/content.ts`       | Amazon page scraper + Scout overlay injector (shadow DOM)     |
| `entrypoints/popup/`           | Toolbar popup UI                                              |
| `entrypoints/options/`         | Settings, privacy controls, audit log, enrolled alerts        |
| `entrypoints/offscreen/`       | ONNX Runtime Web inference host (WebNN → WASM fallback)       |

Shared modules live in `lib/` (storage, genome, scoring, price alerts,
review authenticity, etc.) and shared UI in `components/`.

---

## 🔐 Permissions

The extension requests the minimum permissions needed for explicit-trigger,
on-device analysis. Every permission below is justified by a user-visible
feature.

| Permission        | Why it's needed                                                          |
| ----------------- | ------------------------------------------------------------------------ |
| `activeTab`       | Read the current Amazon tab when the user clicks Scout                   |
| `scripting`       | Inject the Scout shadow-DOM overlay on demand                            |
| `storage`         | Persist encrypted genome + scout history to `chrome.storage.local`       |
| `alarms`          | Periodic re-check for opted-in price alerts                              |
| `notifications`   | Local price-drop notifications (no remote push, opt-in only)             |
| `offscreen`       | Host the ONNX Runtime Web inference document                             |

**Host permissions** are scoped to the eight supported Amazon locales
(`*.amazon.com`, `.co.uk`, `.de`, `.co.jp`, `.ca`, `.fr`, `.it`, `.es`).
**Minimum Chrome version: 116** (required for stable WebNN + offscreen API).

---

## 🧪 Available Scripts

All scripts run via `pnpm`. Firefox variants (`dev:firefox`, `build:firefox`,
`zip:firefox`) build the Manifest V2 / WebExtension bundle for Mozilla.

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm dev`             | WXT dev server with HMR (Chrome MV3)                          |
| `pnpm build`           | Production build → `.output/chrome-mv3`                       |
| `pnpm zip`             | Build + zipped artifact for Chrome Web Store / sideload       |
| `pnpm typecheck`       | TypeScript compile check (no emit)                            |
| `pnpm lint`            | ESLint                                                        |
| `pnpm lint:fix`        | ESLint with autofix                                           |
| `pnpm format`          | Prettier write                                                |
| `pnpm format:check`    | Prettier check (CI-safe)                                      |
| `pnpm test`            | Vitest watch mode                                             |
| `pnpm test:run`        | Vitest single run                                             |
| `pnpm test:coverage`   | Coverage report (gated by `.coverage-thresholds.json`)        |
| `pnpm perf`            | Performance assertion suite (`tests/performance/`)            |

A Husky pre-commit hook runs `lint-staged` (ESLint + Prettier) on staged
files automatically.

---

## 🛡️ Quality Gates

Every change is gated by automated CI before it can land.

- **Coverage floor: ≥ 91 %** across statements, branches, functions, and
  lines. Source of truth: [`.coverage-thresholds.json`](./.coverage-thresholds.json).
  Vitest reads the file directly, so the JSON is the only place to bump.
- **Bundle budget: ≤ 2.5 MB zipped.** Enforced in
  [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — the build step
  fails the PR if the produced zip grows past the cap.
- **CI workflow** runs `format:check`, `lint`, `typecheck`, `test:coverage`,
  `build`, and `zip` on every push and pull request.
- **Release workflow** (`.github/workflows/release.yml`) builds, tests, and
  attaches the signed zip to GitHub Releases when a `v*` tag is pushed.

---

## 📚 Documentation

- 🌐 **Privacy Policy (hosted):** <https://galaxycoils.github.io/smartdeal-hunter/>
- 📐 [Architecture](./docs/architecture.md) — service worker / offscreen split, message contracts
- ⚖️ [Compliance](./docs/compliance.md) — CWS, GDPR, CCPA posture
- 🔒 [Security Audit (Phase 4)](./docs/security-audit-phase4.md)
- ♿ [Accessibility Audit (Phase 4)](./docs/a11y-audit-phase4.md)
- ⚡ [Performance Budget](./docs/perf-budget.md) — render & inference targets
- ⚠️ [Risks](./docs/risks.md) — threat model and mitigations
- 🛍️ [Store Listing](./docs/store-listing.md) — CWS copy and assets
- 📜 [Changelog](./CHANGELOG.md)

---

## 🗺️ Roadmap

Tracked in detail at [`conductor/plan-phase5-roadmap.md`](./conductor/plan-phase5-roadmap.md).

- ✅ **Phase 5.1** — Local price alerts (shipped in v0.2.0)
- ✅ **Phase 5.5** — On-device review authenticity (shipped in v0.2.1)
- 🔜 Expanded review-authenticity locale coverage (UK, DE, JP, CA, FR, IT, ES)
- 🔜 Genome-aware bundle suggestions across saved scout history
- 🔜 Optional Deep Check (opt-in, rate-limited Amazon Creators API)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for privacy-conscious shoppers.
</p>
