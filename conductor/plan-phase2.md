# Phase 2 — Extended MVP

Goal: Ethical Bundle Optimizer, analysis cache, Amazon Creators API (Deep Check), full Options Page, prod CWS release.

## Batch 1 (P2.1)

**Task:** P2.1 Options Page Architecture (Tabs: Settings / Privacy / Genome / DeepCheck / About)
**Deps:** P1.9 (done)
**Owner:** Frontend

### Architecture / Tech Stack

- Frontend: WXT + Vite + React 19 + Tailwind CSS + shadcn/ui inspired components.
- State: React local state for tabs.

### Acceptance Criteria

- [ ] Options page has a functional tab navigation system.
- [ ] Tabs include: Settings, Privacy, Genome, DeepCheck, About.
- [ ] Existing privacy and export/wipe logic is moved into the "Privacy" tab.
- [ ] Other tabs render placeholders until their tasks (e.g. P2.2, P2.7) are implemented.
- [ ] Accessibility: Keyboard navigable tabs using ARIA `role="tablist"`, `role="tab"`, `role="tabpanel"`.
- [ ] 90% coverage threshold maintained.

### Plan

1. **Components**: Create `components/ui/Tabs.tsx` to handle tab state and accessibility.
2. **Refactor**: Update `entrypoints/options/App.tsx` to utilize `Tabs` component.
3. **Migration**: Move existing export/wipe functionality into a `<PrivacyTab />` component.
4. **Placeholders**: Create `<SettingsTab />`, `<GenomeTab />`, `<DeepCheckTab />`, `<AboutTab />` placeholders.
5. **Testing**: Update `tests/entrypoints/options/App.test.tsx` (if exists) or create new tests to verify tab switching and ARIA roles. Create tests for `Tabs` component.

### Verification

- `pnpm test:run`
- `pnpm tsc --noEmit`
- `pnpm test:coverage`

### Next Steps

Once this plan is approved via Plan Review Gate, implement the changes.
