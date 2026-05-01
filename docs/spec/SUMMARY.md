# SmartDeal Hunter — Implementation Plan Summary

> Plain-text mirror of `SmartDeal_Hunter_Implementation_Plan.xlsx` for fast agent + human reading. Always check the xlsx for canonical values; this file is regenerated alongside spec changes.

## Key Metrics & Decisions

| Metric              | Value / Decision                              | Research Basis                                                                                |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Framework           | WXT (Vite-based)                              | Active community migration from Plasmo; ~300 KB smaller bundles                               |
| Build Tool          | Vite + WXT                                    | Reliable HMR; Parcel/Plasmo has unpatched upstream bugs                                       |
| Extension Platform  | Manifest V3                                   | Mandatory for Chrome Web Store; SW lifecycle requires storage-API patterns                    |
| ML Runtime          | Offscreen Document + ONNX/WebNN               | SW cannot access WebGPU/WASM directly; offscreen doc required                                 |
| Local Encryption    | AES-GCM-256 + PBKDF2 (Web Crypto)             | Standard for password-manager-grade client-side encryption without backend                    |
| Scraping Strategy   | URL → JSON-LD (Schema.org) → DOM              | 10× faster than DOM parsing; Amazon ASIN URL patterns are structurally stable                 |
| Bundle Target       | < 2.5 MB                                      | Tree-shaking + code splitting; React 19 concurrent mode reduces content-script latency ~68 ms |
| Compliance Standard | Chrome Web Store Limited Use + FTC Disclosure | User-data policy prohibits silent tracking; affiliate links require conspicuous disclosure    |
| Rec Algorithm       | Local Multi-Armed Bandit + Genome Profile     | On-device exploration/exploitation balance; no server required (FedRec surveys)               |

## Strategic Objectives

| Objective                       | Success Criteria                                                                | Priority | Phase |
| ------------------------------- | ------------------------------------------------------------------------------- | -------- | ----- |
| Production-ready MV3 extension  | Passes Chrome Web Store review on first submission                              | High     | 1     |
| Privacy-first local computing   | Zero remote data transmission; AES-GCM encrypted storage                        | High     | 1     |
| True Value scoring engine       | Score < 500 ms on average product page (50-product benchmark)                   | High     | 1     |
| Personal Fit Genome             | Onboarding quiz → ≥ 8-dimension preference vector; ≥ 70% completion             | High     | 1     |
| Amazon/Chrome policy compliance | No affiliate injection; no silent tracking; explicit consent. 100% policy audit | Critical | 1     |
| Ethical bundle optimizer        | Local-only suggestions with rationales; ≥ 15% acceptance                        | Medium   | 2     |
| Amazon Creators API integration | OAuth Deep Check, scoped permissions only                                       | Medium   | 2     |
| Extensible foundation           | New marketplace integration < 2 weeks                                           | Medium   | 2     |

## Scope

**In:** Amazon.com (ASIN extraction), on-demand user-triggered analysis, local ML inference (ONNX Runtime Web / WebNN), Chrome + Edge, JSON export & secure wipe, True Value + Personal Fit scoring, local-heuristic bundle suggestions.

**Out (future):** other Amazon marketplaces (UK/DE/JP), auto-scanning, server-side / cloud ML, Firefox & Safari, cloud backup/sync, historical price tracking, real-time inventory/pricing APIs.

## Phase 1 — Core MVP (Weeks 1–8, 15 tasks, 276 hrs)

Goal: production-ready MV3 extension with Genome Engine, True Value Scout, local encryption, popup UI. Submit to CWS dev channel at P1.15.

| ID    | Task                                                                                   | W   | Hrs | Owner     | Deps             |
| ----- | -------------------------------------------------------------------------------------- | --- | --- | --------- | ---------------- |
| P1.1  | Project Bootstrap & WXT Setup                                                          | 1   | 16  | Tech Lead | —                |
| P1.2  | Storage & Encryption Layer (AES-GCM-256, PBKDF2 600K, IndexedDB wrapper)               | 1   | 20  | Tech Lead | P1.1             |
| P1.3  | Background Service Worker + offscreen lifecycle manager                                | 2   | 16  | Backend   | P1.1             |
| P1.4  | Content Script — Amazon Scraper (URL ASIN → JSON-LD → DOM)                             | 2   | 20  | Frontend  | P1.3             |
| P1.5  | Genome Engine — Data Model (8–12-dim preference vector, encrypted CRUD)                | 3   | 16  | Backend   | P1.2             |
| P1.6  | Onboarding Flow UI (multi-step wizard, Likert sliders, accessible)                     | 3   | 20  | Frontend  | P1.5             |
| P1.7  | True Value Score Algorithm (price/unit, ratings, brand trust, seasonal adj.)           | 4   | 24  | ML        | P1.4, P1.5       |
| P1.8  | Personal Fit Score (cosine sim Genome × product attribute vector)                      | 4   | 20  | ML        | P1.5, P1.7       |
| P1.9  | Popup Dashboard UI (Quick Scout, Genome summary, recent analyses)                      | 5   | 20  | Frontend  | P1.6             |
| P1.10 | Scout Result Panel (radar chart, alternatives, feedback buttons)                       | 5   | 20  | Frontend  | P1.7, P1.8, P1.9 |
| P1.11 | Feedback Loop Engine (gradient descent on Genome, conservative LR)                     | 6   | 16  | ML        | P1.8, P1.10      |
| P1.12 | Product Cache & Indexing (IndexedDB, 7-day TTL, 50 MB LRU)                             | 6   | 12  | Backend   | P1.2, P1.4       |
| P1.13 | Privacy & Compliance Shell (Notice, Export, Wipe)                                      | 7   | 16  | Frontend  | P1.2             |
| P1.14 | E2E Integration Tests (Playwright: install → onboard → scrape → score → export → wipe) | 7   | 20  | QA        | P1.10, P1.13     |
| P1.15 | Bundle Optimization & Store Prep (< 2.5 MB, screenshots, CWS dev submit)               | 8   | 20  | Tech Lead | P1.14            |

## Phase 2 — Extended MVP (Weeks 9–14, 11 tasks, 184 hrs)

Goal: Ethical Bundle Optimizer, analysis cache, Amazon Creators API (Deep Check), full Options Page, prod CWS release.

| ID    | Task                                                                      | W   | Hrs | Owner     | Deps       |
| ----- | ------------------------------------------------------------------------- | --- | --- | --------- | ---------- |
| P2.1  | Options Page Architecture (Tabs: Settings/Privacy/Genome/DeepCheck/About) | 9   | 16  | Frontend  | P1.9       |
| P2.2  | Genome Editor UI (sliders, weight adjustments, JSON import/export)        | 9   | 16  | Frontend  | P2.1       |
| P2.3  | Analysis Cache Manager (TTL, manual flush, prefetch)                      | 10  | 14  | Backend   | P1.12      |
| P2.4  | Ethical Bundle Optimizer (local co-occurrence matrix, rationales)         | 10  | 24  | ML        | P1.7, P1.8 |
| P2.5  | Bundle UI Panel (Frequently Bought Together, individual scores)           | 11  | 16  | Frontend  | P2.4       |
| P2.6  | Amazon Creators API — OAuth (PA-API 5.0, item-lookup scope only)          | 11  | 20  | Backend   | P2.1       |
| P2.7  | Deep Check Integration (PA-API live data, 1-hr cache, 10/min rate)        | 12  | 20  | Backend   | P2.6       |
| P2.8  | Advanced Privacy Controls (toggles, audit log, scheduled wipe)            | 12  | 14  | Frontend  | P2.1       |
| P2.9  | Cross-Page Genome Sync (storage.onChanged, versioning)                    | 13  | 12  | Backend   | P2.2       |
| P2.10 | Performance & Regression Testing (Lighthouse, ML benchmarks, stress)      | 13  | 16  | QA        | P2.5, P2.7 |
| P2.11 | Store Release & Monitoring (prod build, error tracking)                   | 14  | 16  | Tech Lead | P2.10      |

**Project totals:** 28 tasks, 460 hrs, 22 weeks.

## See Also

- `../architecture.md` — runtime layers, data-flow, security model
- `../compliance.md` — CWS / Amazon / FTC matrix
- `../risks.md` — risk register
- The xlsx — canonical source; cell-level rationale, sources, etc.
