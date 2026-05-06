# Accessibility Audit — Phase 4 WU-9

Date: 2026-05-06
Tooling: axe-core 4.11.4 (devDep only, NOT bundled into extension).

## Scope

| Surface          | Test file                         | Status                 |
| ---------------- | --------------------------------- | ---------------------- |
| Popup Dashboard  | `tests/a11y/popup.a11y.test.ts`   | PASS (0 severe)        |
| Popup Onboarding | `tests/a11y/popup.a11y.test.ts`   | PASS (0 severe, fixed) |
| Options App      | `tests/a11y/options.a11y.test.ts` | PASS (0 severe)        |

Severity gate: **serious + critical** under `wcag2a`, `wcag2aa`, `wcag21aa` rule sets.
Severities `minor` and `moderate` are not blocking at v0.1.0 but are reported in
the axe JSON output for follow-up.

## Violations found and fixed during this audit

| Surface    | Violation rule                    | Fix                                                                                                                                         |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard  | `aria-progressbar-name` (serious) | Added `aria-label` to both `<Progress>` instances (`entrypoints/popup/Dashboard.tsx:85, 213`).                                              |
| Onboarding | `aria-prohibited-attr` (serious)  | Added explicit `role="progressbar"` + `aria-valuenow/min/max` to the `StepDots` wrapper `<div>` (`entrypoints/popup/Onboarding.tsx:18-32`). |

Both fixes ride in the same WU-9 commit so the failing-then-passing transition
is verifiable in the test suite.

## Manual checks (not automated)

These require a real browser and were verified by the engineer during
Phase 4. Re-verify before each release.

| Check                                                         | Result | Notes                                                                       |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Tab order through Quick Scout flow (popup)                    | PASS   | Quick Scout button → Score result → Feedback buttons; no focus trap.        |
| `Esc` closes ScoutPanel shadow-DOM overlay on Amazon page     | PASS   | Closed via `onClose` handler; focus returns to page.                        |
| Color contrast: PriceChart axis labels on light surface       | PASS   | Default `#666` on white = 5.7:1 contrast (WCAG AA passes for normal text).  |
| Color contrast: Score badge on Card surface (positive `tone`) | PASS   | Tailwind `bg-success` token + `text-foreground`, contrast computed > 4.5:1. |
| Shadow-DOM focusable elements reachable via Tab from page     | PASS   | WXT `createShadowRootUi` mounts focusable React tree; verified manually.    |
| Screen-reader announce of "Step X of Y" in onboarding         | PASS   | `role="progressbar"` + `aria-valuenow` triggers the right announce.         |

## Why some checks remain manual

axe-core in happy-dom can't measure runtime focus order or computed style
contrast against pseudo-elements + Tailwind's CSS custom properties. The
checks above need a real Chromium with the built extension loaded.

## Re-running the gate

```bash
pnpm test:run -- tests/a11y/
```

Failures print the rule id, severity, help URL, and the offending node
selector. Fix the node, re-run, repeat until zero severe.

## Follow-up (not v0.1.0 blockers)

- Enumerate `minor` and `moderate` violations and decide which to fix
  before v0.2.0 (e.g., `landmark-unique`, `region`).
- Add a Tab + Esc keyboard-navigation test using `@testing-library/user-event`
  for the popup flow (currently manual).
