# GEMINI.md — Gemini CLI session entry point

This project uses the same rules as `CLAUDE.md`. Read it first.

## ⚠️ MANDATORY FIRST READ

Before doing ANYTHING in this repo, read these files in order:

1. `CLAUDE.md` — project rules (TDD, plan-review gate, subagent discipline, coverage ratchet). Apply to your work as if it said GEMINI.md.
2. `conductor/plan-phase1.md` — original Phase 1 roadmap.
3. `docs/spec/SUMMARY.md` — task table + rationale.

## Current state (2026-05-05)

Phase 1 (P1.1 - P1.15) is **DONE and COMMITTED**.
Phase 2 (P2.1 - P2.11) is **DONE and COMMITTED**.

- All unit/integration tests pass. Lint clean.
- Coverage: **> 90%** (threshold 90% maintained).

## Next Task: Phase 3

We are now ready for **Phase 3 (Post-Release & Scaling)**:

- **P3.1**: Multi-store support (Amazon UK/DE/JP)
- **P3.2**: Price history visualization
- **P3.3**: Advanced local LLM sentiment analysis

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
