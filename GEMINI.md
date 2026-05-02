# GEMINI.md — Gemini CLI session entry point

This project uses the same rules as `CLAUDE.md`. Read it first.

## ⚠️ MANDATORY FIRST READ

Before doing ANYTHING in this repo, read these files in order:

1. `CLAUDE.md` — project rules (TDD, plan-review gate, subagent discipline, coverage ratchet). Apply to your work as if it said GEMINI.md.
2. `conductor/plan-phase1.md` — original Phase 1 roadmap.
3. `docs/spec/SUMMARY.md` — task table + rationale.

## Current state (2026-05-02)

Batches 1 through 6 (P1.2 - P1.14) are **DONE and COMMITTED**.

- **P1.11**: Feedback Loop Engine.
- **P1.12**: Product Cache & Indexing.
- **P1.13**: Privacy & Compliance Shell (Options Page: Export/Wipe).
- **P1.14**: E2E Integration Tests (Playwright setup + fixture-based test).
- All unit/integration tests pass (78/78). Lint clean.
- Coverage: **81% Statements** (threshold 70% maintained).
- E2E: Playwright setup ready in `tests/e2e/`. Requires `pnpm build` to run locally.

## Next Task: Phase 1 Batch 7

We are now ready for **Batch 7**:

- **Task P1.15**: Bundle Optimization & Store Prep (Depends on P1.14).
- Final Polish & CWS Dev Submission.

**First step**: Create `conductor/plan-batch7.md` and run the plan-review-gate.

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
