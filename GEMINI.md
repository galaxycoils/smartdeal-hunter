# GEMINI.md — Gemini CLI session entry point

This project uses the same rules as `CLAUDE.md`. Read it first.

## ⚠️ MANDATORY FIRST READ

Before doing ANYTHING in this repo, read these files in order:

1. `CLAUDE.md` — project rules (TDD, plan-review gate, subagent discipline, coverage ratchet). Apply to your work as if it said GEMINI.md.
2. `conductor/plan-phase1.md` — original Phase 1 roadmap.
3. `docs/spec/SUMMARY.md` — task table + rationale.

## Current state (2026-05-02 15:15 EDT)

Batch 1 (P1.2, P1.3) and Batch 2 (P1.4, P1.5) are **DONE and COMMITTED**.

- **P1.2/1.3**: Encryption (key-based), storage (IndexedDB), offscreen manager, background SW.
- **P1.4**: Amazon Scraper (URL/JSON-LD/DOM) + Content script.
- **P1.5**: Genome Engine (Model, Validation, Persistence).
- All tests pass (42/42). Lint clean.
- Coverage threshold: **50/50/50/50** achieved and enforced in `.coverage-thresholds.json`.

## Next Task: Phase 1 Batch 3

We are now ready for **Batch 3**:

- **Task P1.6**: Onboarding Flow UI (Depends on P1.5).
- **Task P1.7**: True Value Score Algorithm (Depends on P1.4, P1.5).

**First step**: Create `conductor/plan-batch3.md` and run the plan-review-gate.

## Hard rules (from CLAUDE.md)

- TDD strict — failing test first, then minimal impl.
- NEVER `--no-verify`. NEVER `git push --force` without user approval.
- Subagent file-scope is hard. Define it in the prompt; revert if violated.
- PBKDF2 600K only via `deriveKey` (called once per session). Hot path uses `CryptoKey`.
- Coverage floor only goes up. Current floor: 50%. Next bump (70%) after P1.10.
- Caveman ULTRA mode for the user. Code/commits/PRs: write normal.
- Constant memory updates. Checkpoint to `project_smartdeal_overview.md` at every meaningful step.
- After every commit: update Obsidian vault `STATE_HANDOFF.md` at `/Users/cmd/Documents/Obsidian Vault/PROJECTS/SmartDeal-Hunter/`.

## Verification commands

```bash
git status
pnpm test:run          # all green expected
pnpm tsc --noEmit      # 0 errors expected
pnpm test:coverage     # measure vs 50% floor
```

## When in doubt

Ask the user.
