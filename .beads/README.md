# .beads — Context Recovery Store

This directory is the `.beads/` fallback store for SmartDeal Hunter.

## Why this exists

`CLAUDE.md` §"Context Recovery (Surviving Compaction)" states:

> Approved plans and state are persisted to memory and `.beads/` locally to survive session compaction.

The canonical `bd` CLI (`github.com/steveyegge/beads`) was **not available** in this environment
(checked via `which bd`). This JSON-file fallback is used instead and is fully machine-readable
by future agents.

## Structure

```
.beads/
  README.md          ← this file
  manifest.json      ← index of all tasks + topological order
  issues/
    P1.1.json        ← one file per spec task
    P1.2.json
    …
    P2.11.json
```

## Schema (per issue file)

| Field         | Type             | Notes                                                    |
| ------------- | ---------------- | -------------------------------------------------------- |
| `id`          | string           | Spec ID, e.g. `"P1.2"`                                   |
| `title`       | string           | Spec task title                                          |
| `description` | string           | Expanded description from SUMMARY.md / xlsx              |
| `phase`       | number           | 1 or 2                                                   |
| `week`        | number           | Sprint week (1–14)                                       |
| `hours`       | number           | Estimated effort in hours                                |
| `owner`       | string           | Role: Tech Lead / Backend / Frontend / ML / QA / PO      |
| `depends_on`  | string[]         | Blocking task IDs (must be `done` before this can start) |
| `status`      | "done" \| "open" | `done` = P1.1 only (commit 4a59701)                      |
| `commit`      | string \| null   | Git commit SHA if `done`                                 |

## Topological levels (dependency graph)

```
Level 0 (no deps):       P1.1
Level 1 (dep on L0):     P1.2, P1.3
Level 2 (dep on L1):     P1.4, P1.5
Level 3 (dep on L2):     P1.6, P1.7, P1.12
Level 4 (dep on L3):     P1.8, P1.9
Level 5 (dep on L4):     P1.10, P1.11, P2.1
Level 6 (dep on L5):     P1.13, P1.14, P2.2, P2.4
Level 7 (dep on L6):     P1.15, P2.3, P2.5, P2.6, P2.8
Level 8 (dep on L7):     P2.7, P2.9
Level 9 (dep on L8):     P2.10
Level 10 (dep on L9):    P2.11
```

P1.2 has exactly one blocker: P1.1 (status: done). It is **immediately startable**.

## Maintenance

When a task is completed:

1. Update its `status` to `"done"` and set `commit` to the merge SHA.
2. Re-verify downstream tasks are unblocked.
3. Commit the change with message `chore(beads): mark <ID> done`.
