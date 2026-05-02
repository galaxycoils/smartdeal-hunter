# GEMINI.md — Gemini CLI session entry point

This project uses the same rules as `CLAUDE.md`. Read it first.

## ⚠️ MANDATORY FIRST READ

Before doing ANYTHING in this repo, read these files in order:

1. `CLAUDE.md` — project rules (TDD, plan-review gate, subagent discipline, coverage ratchet). Apply to your work as if it said GEMINI.md.
2. `conductor/plan-phase1.md` — original Phase 1 roadmap.
3. `docs/spec/SUMMARY.md` — task table + rationale.

## Current state (2026-05-02)

Batches 1 through 4 (P1.2 - P1.10) are **DONE and COMMITTED**.

- **P1.6**: Onboarding UI.
- **P1.7/1.8**: True Value & Personal Fit scoring engine.
- **P1.9**: Popup Dashboard UI.
- **P1.10**: Scout Result Panel.
- All tests pass (66/66). Lint clean.
- Coverage threshold: **70/70/70/70** achieved and enforced in `.coverage-thresholds.json`.

## Next Task: Phase 1 Batch 5

We are now ready for **Batch 5**:

- **Task P1.11**: Feedback Loop Engine (Depends on P1.8, P1.10).
- **Task P1.12**: Product Cache & Indexing (Depends on P1.2, P1.4).

**First step**: Create `conductor/plan-batch5.md` and run the plan-review-gate.

## Hard rules (from CLAUDE.md)

- TDD strict — failing test first, then minimal impl.
- NEVER `--no-verify`. NEVER `git push --force` without user approval.
- Subagent file-scope is hard. Define it in the prompt; revert if violated.
- PBKDF2 600K only via `deriveKey` (called once per session). Hot path uses `CryptoKey`.
- Coverage floor only goes up. Current floor: 70%. Next bump (90%) after P1.15.
- Caveman ULTRA mode for the user. Code/commits/PRs: write normal.
- Constant memory updates. Checkpoint to `project_smartdeal_overview.md` at every meaningful step.
- After every commit: update Obsidian vault `STATE_HANDOFF.md` at `/Users/cmd/Documents/Obsidian Vault/PROJECTS/SmartDeal-Hunter/`.

## Verification commands

```bash
git status
pnpm test:run          # all green expected
pnpm tsc --noEmit      # 0 errors expected
pnpm test:coverage     # measure vs 70% floor
```

## When in doubt

Ask the user.
