# Phase 4 (Narrow Scope) — CWS & Release v0.1.0

**Goal**: Prepare final submission assets and perform v0.1.0 release.

**Tasks**:

- [ ] **WU-6: CWS Submission Prereqs**
  - [ ] Verify `manifest.json` icons (16, 32, 48, 128).
  - [ ] Verify CSP and permissions.
  - [ ] Generate `docs/cws-submission-checklist.md`.
  - [ ] Verify Privacy Policy text in `docs/privacy-policy.md`.
- [ ] **WU-7: Release Engineering v0.1.0**
  - [ ] Bump version in `package.json`, `wxt.config.ts`, `Dashboard.tsx`.
  - [ ] Update `CHANGELOG.md`.
  - [ ] Final `pnpm build && pnpm zip`.

**Verification**:

- `pnpm build` reports total size ≤ 2.5MB.
- `pnpm test:run` all green.
- `grep -rn "0.0.1"` returns no non-frozen matches.
