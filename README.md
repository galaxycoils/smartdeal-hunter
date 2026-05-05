# SmartDeal Hunter

Privacy-first Amazon shopping assistant. On-device True Value + Personal Fit
scoring. No tracking. No affiliate injection. Ever.

Spec: `docs/spec/SmartDeal_Hunter_Implementation_Plan.xlsx` (and the human
mirror at `docs/spec/SUMMARY.md`).

Process: see `CLAUDE.md` for the metaswarm pipeline, gates, and conventions.

## Stack

- WXT 0.20 + Vite + React 19 + TypeScript 5.9 strict, Manifest V3
- Vitest 2.1 + happy-dom + v8 coverage
- ESLint flat + Prettier + husky + lint-staged
- ONNX Runtime Web + WebNN (P1.7+); Web Crypto AES-GCM-256 + PBKDF2 (P1.2)
- shadcn/ui + Tailwind (initialised; no components added at bootstrap)
- Min Chrome 116

## Dev

```sh
pnpm install
pnpm dev               # WXT dev server with HMR
pnpm build             # Production build → .output/chrome-mv3/
pnpm typecheck
pnpm lint
pnpm test              # vitest watch
pnpm test:run          # vitest single-pass
pnpm test:coverage     # enforces .coverage-thresholds.json
```

Load unpacked: Chrome → `chrome://extensions` → enable Developer Mode →
"Load unpacked" → select `.output/chrome-mv3/`.

## Coverage ratchet

Defined in `.coverage-thresholds.json`. Bump in the same PR that earns the new floor.

| Floor | Earned by                        |
| ----- | -------------------------------- |
| 0%    | Bootstrap (P1.1) — current       |
| 50%   | After P1.5 (Genome data model)   |
| 70%   | After P1.10 (Scout Result Panel) |
| 90%   | Before CWS submission (P1.15)    |

## Status

Phase 2 is implemented locally, including:

- Ethical Bundle Optimizer with local-only history scoring
- Deep Check backend with OAuth token storage, cache, retry, and rate limiting
- Advanced Privacy Controls with audit log, opt-in toggles, and scheduled wipe
- Cross-page Genome revision sync for popup, options, and background

Latest verified gates:

- `pnpm test:run` → 204 passing tests
- `pnpm tsc --noEmit` → pass
- `pnpm test:coverage` → 97.29 / 90.20 / 94.61 / 99.59
- `pnpm build` → 448.02 kB output
- `pnpm zip` → `.output/smartdeal-hunter-0.0.1-chrome.zip` at 151.47 kB
