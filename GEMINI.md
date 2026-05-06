# GEMINI.md — Gemini CLI session entry point

This project uses the same rules as `CLAUDE.md`. Read it first.

## ⚠️ MANDATORY FIRST READ

Before doing ANYTHING in this repo, read these files in order:

1. `CLAUDE.md` — project rules (TDD, plan-review gate, subagent discipline, coverage ratchet). Apply to your work as if it said GEMINI.md.
2. `conductor/STATE_HANDOFF.md` — current version status and release history.
3. `docs/cws-submission-checklist.md` — store listing details for current version.

## Current state (2026-05-06)

**Phase 1, 2, 3, and 4 are COMPLETE and COMMITTED.**
**Version 0.1.0 is officially released and tagged.**

- **Tests**: 281 passing.
- **Coverage**: 97.72% (Statements) / 91.4% (Branches).
- **Bundle**: 1.21MB total / 375KB ZIP.
- **Status**: Ready for Chrome Web Store submission.

## Release Summary v0.1.0

- **International**: support for US, UK, DE, JP, CA, FR, IT, ES.
- **Visuals**: 30-day interactive price history charts (Recharts).
- **Intelligence**: Gemini Nano on-device sentiment summary chain.
- **Compliance**: Comprehensive privacy controls + audit log.

## Verification commands

```bash
git status
pnpm test:run          # all green expected
pnpm tsc --noEmit      # 0 errors expected
pnpm test:coverage     # measure vs 91% floor
```

## Next Task

Wait for CWS approval of v0.1.0. Future roadmap: Phase 5 (Marketplace comparisons & Price alerts).
