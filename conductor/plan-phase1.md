# Phase 1 Execution Plan (Parallel)

**Objective**: Complete P1.2 through P1.13 using parallel subagents to speed up execution, while monitoring HDD space.

## Strategy

Due to dependencies, we will batch independent tasks and invoke subagents concurrently where safe.

### Batch 1 (Complete)

- **Task P1.2**: Storage & Encryption Layer. [√]
- **Task P1.3**: Background Service Worker + offscreen lifecycle manager. [√]

### Batch 2 (Immediate)

- **Task P1.4**: Content Script — Amazon Scraper (URL ASIN → JSON-LD → DOM).
  - _Agent_: `typescript-pro`
  - _Scope_: `entrypoints/content.ts`, `lib/scraper.ts`
- **Task P1.5**: Genome Engine — Data Model (8–12-dim preference vector, encrypted CRUD).
  - _Agent_: `typescript-pro` + `security-engineer`
  - _Scope_: `lib/genome.ts`, `lib/types.ts`

### Batch 3 (Depends on Batch 2)

- **Task P1.6**: Onboarding Flow UI. _Depends on P1.5._
- **Task P1.7**: True Value Score Algorithm. _Depends on P1.4, P1.5._

_(Subsequent batches will follow dependency graph in `docs/spec/SUMMARY.md`)_

## HDD Monitoring

- Before each batch, monitor free space using local shell tools.
- If space < 2GB, we will pause and execute migration to Google Drive.

## Verification

- Each subagent MUST write tests (TDD) and ensure coverage gates pass.
- Final review via `/self-reflect` before moving to next batch.
