# Project Instructions — SmartDeal Hunter

Privacy-first Chrome extension MVP. WXT + Vite + React 19 + TypeScript +
shadcn/ui + ONNX Runtime Web + Web Crypto. Manifest V3.

Specification: `docs/spec/SmartDeal_Hunter_Implementation_Plan.xlsx`
(human + agent summary in `docs/spec/SUMMARY.md`).

### PROTOCOL 0: Universal State Handoff (MANDATORY)

Claude/Gemini internal memory is the SINGLE source of truth for cross-agent context.

1. **On Session Start**: Recall all relevant project entities and relations from memory.
2. **During Execution**: Proactively save important facts, patterns, and decisions to memory via `remember_fact` or `create_entity`.
3. **On Session End**: Summarize the current state in a final `remember_fact` call to ensure the next agent has a clean pickup.
4. **Obsidian Fallback**: Use Obsidian paths ONLY if explicitly requested or if memory is unavailable.

### PROTOCOL 1: Universal Skill Library (MANDATORY)

Expert personas and workflows are managed via Claude/Gemini skills and memory.

1. **Search**: Use `mcp_memory_recall` to find relevant skills or patterns for the current task.
2. **Follow**: Adhere to the "Core Rules" and "Workflows" stored in the knowledge graph.
3. **Evolve**: Update memory entities with new findings and improved patterns after each task.

### Starting work

```text
/start-task
```

Default entry point. Primes the agent, scopes the task, picks the right level of process.

### For complex features (multi-file, spec-driven)

```text
I want you to build [description]. [Tech stack, DoD items, file scope.]
Use the full metaswarm orchestration workflow.
```

Triggers: Research → Plan → Design Review Gate → Work Unit Decomposition → Orchestrated Execution (4-phase loop per unit) → Final Review → PR.

### Available Commands

| Command                  | Purpose                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `/start-task`            | Begin tracked work on a task                                     |
| `/prime`                 | Load relevant knowledge before starting                          |
| `/review-design`         | Trigger parallel design review gate (5 agents)                   |
| `/pr-shepherd <pr>`      | Monitor a PR through to merge                                    |
| `/self-reflect`          | Extract learnings after a PR merge                               |
| `/handle-pr-comments`    | Handle PR review comments                                        |
| `/brainstorm`            | Refine an idea before implementation                             |
| `/create-issue`          | Create a well-structured GitHub Issue                            |
| `/external-tools-health` | Check status of external AI tools (Codex, Gemini)                |
| `/setup`                 | Interactive guided setup — detects project, configures metaswarm |
| `/update`                | Update metaswarm to latest version                               |
| `/status`                | Run diagnostic checks on your installation                       |
| `/start`                 | Alias for `/start-task`                                          |

### Visual Review

Use the `visual-review` skill to take screenshots of pages or extension UIs.
Requires Playwright (`npx playwright install chromium`).

## Testing

- **TDD is mandatory** — Write tests first, watch them fail, then implement.
- **Coverage**: see floor in `.coverage-thresholds.json`. Enforced as a blocking gate before PR creation and task completion.
- Test command: `pnpm test`
- Run-once command: `pnpm test:run`
- Coverage command: `pnpm test:coverage`

## Coverage

Coverage thresholds are defined in `.coverage-thresholds.json` — this is the **source of truth** for coverage requirements. Vitest reads it via `vitest.config.ts`.

**Ratchet plan:**

- 0% at bootstrap (P1.1) ← we are here
- 50% after P1.5 (Genome Engine data model)
- 70% after P1.10 (Scout Result Panel)
- 90% before Chrome Web Store submission (P1.15)

Bump the JSON in the same PR that earns the new floor.

## Quality Gates

- **Design Review Gate**: Parallel 5-agent review after design is drafted (`/review-design`).
- **Plan Review Gate**: Automatic adversarial review after any implementation plan is drafted. ALL must PASS before the plan is presented to the user.
- **Coverage Gate**: Reads `.coverage-thresholds.json` and runs `pnpm test:coverage` — BLOCKING gate before PR creation.

## Workflow Enforcement (MANDATORY)

These rules ensure the full metaswarm pipeline is followed regardless of which skill initiated the work.

### After Brainstorming

When brainstorming completes:

1. **STOP** — do NOT proceed directly to implementation.
2. **RUN the Design Review Gate**.
3. **WAIT** for all 5 review agents (PM, Architect, Designer, Security, CTO) to approve.
4. **ONLY THEN** proceed.

### After Any Plan Is Created

When a plan is produced:

1. **STOP**.
2. **RUN the Plan Review Gate**.
3. **WAIT** for PASS.
4. **ONLY THEN** present to user.

### Execution Method Choice

Always ask the user which approach they want: Metaswarm (thorough), Subagent-driven (fast), or Parallel session.

### Before Finishing a Development Branch

1. **STOP** before merge/PR.
2. **RUN `/self-reflect`** to capture learnings in memory.
3. **THEN** proceed.

### Use `/start-task` Instead of EnterPlanMode

Use `/start-task` for tasks touching 3+ files to ensure quality gates are not bypassed.

### Subagent Discipline

- **NEVER** use `--no-verify`.
- **NEVER** use `git push --force` without approval.
- **ALWAYS** follow TDD.
- **NEVER** self-certify.
- **STAY** within assigned file scope.

### Pre-PR Knowledge Capture

Run `/self-reflect` to extract learnings into memory before creating PRs.

### Context Recovery (Surviving Compaction)

Approved plans and state are persisted to memory and `.beads/` locally to survive session compaction.

## Key Decisions

Stored in knowledge graph memory. Use `recall` to find architectural precedents.

## Notes — SmartDeal-specific

- **Manifest V3 service-worker statelessness**: never rely on globals; persist all state in `chrome.storage.local` or IndexedDB. The SW terminates when idle.
- **Heavy ML in Offscreen Document only**: SW cannot access WebGPU/WASM directly; all ONNX Runtime Web inference runs in `entrypoints/offscreen/`. Background SW only orchestrates.
- **Web Crypto encryption**: AES-GCM-256 + PBKDF2 (600K iterations, OWASP 2023). Derived keys held in **memory only** — never persisted. IV via `crypto.getRandomValues(12)`; never reuse with same key.
- **Product extraction order**: URL-first ASIN detection (`/dp/`, `/gp/product/`) → JSON-LD Schema.org → DOM fallback. Conservative selectors for fallback.
- **NO affiliate-link injection ever.** MVP has zero monetization. Future monetization requires legal review + conspicuous `#ad` disclosure.
- **Explicit-trigger only**: every analysis must be user-initiated. No auto-scraping, no auto-navigation, no auto-add-to-cart.
- **Privacy boundary**: zero remote data transmission in MVP. Deep Check (Phase 2) is the only external call, behind explicit opt-in + per-call rate limiting.
- **CSP**: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. Required for ONNX WASM backend.
- **React 19**: use stable `createRoot` API. Avoid experimental hooks. Test in popup, options, and shadow-DOM contexts.
- **Bundle target**: < 2.5 MB. Tree-shake shadcn/ui (import only used components). Quantized (int8) ONNX models. Dynamic-import the ML modules.
- **Minimum Chrome 116** (for stable WebNN). Graceful degradation: WebNN → WASM → pure-JS heuristics.

## Path Map

| Concern                         | Path                                                  |
| ------------------------------- | ----------------------------------------------------- |
| Background service worker       | `entrypoints/background.ts`                           |
| Content script (Amazon scraper) | `entrypoints/content.ts`                              |
| Popup UI                        | `entrypoints/popup/`                                  |
| Options page                    | `entrypoints/options/`                                |
| Offscreen document (ML)         | `entrypoints/offscreen/`                              |
| Shared utilities                | `lib/`                                                |
| Shared components               | `components/`                                         |
| Spec                            | `docs/spec/SmartDeal_Hunter_Implementation_Plan.xlsx` |
| Architecture                    | `docs/architecture.md`                                |
| Compliance                      | `docs/compliance.md`                                  |
| Risks                           | `docs/risks.md`                                       |
