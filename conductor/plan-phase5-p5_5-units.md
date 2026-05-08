# P5.5 Work Unit Decomposition

Plan: `conductor/plan-phase5-p5_5.md` (iter 2, PASS 3/3 on 2026-05-07).
Exec mode: Metaswarm orchestrated 4-phase loop per unit (impl → validate → adversarial review → commit).

| WU  | Scope                                                          | Files                                                                                                                                                                 | Deps     | Status  |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| WU1 | Types + messaging + audit-log union                            | `lib/types.ts`, `lib/messaging/types.ts`, `lib/audit-log.ts`                                                                                                          | —        | pending |
| WU2 | Review extractor + synthetic US fixture                        | `lib/review-extractor.ts`, `tests/lib/review-extractor.test.ts`, `tests/fixtures/reviews/us-synthetic.html`, `tests/fixtures/reviews/README.md`                       | WU1      | pending |
| WU3 | Authenticity scorer (6 signals) + unit/perf/per-file-cov tests | `lib/review-authenticity.ts`, `tests/lib/review-authenticity.test.ts`, `tests/lib/review-authenticity.perf.test.ts`, `tests/lib/review-authenticity.coverage.test.ts` | WU1      | pending |
| WU4 | Background handler for COMPUTE_AUTHENTICITY                    | `entrypoints/background.ts`, `tests/entrypoints/background.test.ts`                                                                                                   | WU1, WU3 | pending |
| WU5 | ScoutPanel integration (extract+request+render)                | `components/ui/ScoutPanel.tsx`, `tests/components/ui/ScoutPanel.test.tsx`                                                                                             | WU2, WU4 | pending |
| WU6 | PrivacyTab forward-compat regression test                      | `components/ui/PrivacyTab.tsx`, `tests/components/ui/PrivacyTab.test.tsx`                                                                                             | WU1      | pending |
| WU7 | Docs + version bump + roadmap amend                            | `CHANGELOG.md`, `docs/privacy-policy.md`, `docs/cws-submission-checklist.md`, `package.json`, `wxt.config.ts`, `conductor/plan-phase5-roadmap.md`                     | WU5      | pending |

## Final gates (after WU7)

1. `pnpm test:run` — 281+N pass
2. `pnpm test:coverage` — global ≥91, per-file ≥95 on new modules
3. Privacy grep gate — empty match
4. `pnpm build && pnpm zip` — bundle delta ≤ 10 KB; total ≤ 2.5 MB
5. `/self-reflect` capture
6. Conventional commit: `feat(p5.5): on-device review authenticity score`
7. Update Obsidian `STATE_HANDOFF.md`

## Feasibility caveats from gate (non-blocking, address in WU3/WU4)

- D15: clarify `bench()` vs `test()` + `vi.retry` mechanics at impl
- D13: use absolute path for `coverage-summary.json` key + skip-if-missing guard
- `lib/types.ts` row: EXTEND (not NEW)
