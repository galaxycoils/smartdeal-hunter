# P5.1 — Price Alerts (per-feature plan, iter 1)

> Per-feature plan for P5.1 from `conductor/plan-phase5-roadmap.md` (commit `46e1f6a`).
> All cross-cutting invariants (#1–#7 in roadmap) apply. Cite, do not redefine.
> Plan-Review-Gate must PASS before exec. TDD mandatory. Coverage floor 91 (`.coverage-thresholds.json`). Never `--no-verify`.

## Goal

Notify the user when the current price of an explicitly enrolled ASIN equals or undercuts the lowest price seen in the user's local 30-day price history for that ASIN. Evaluation is local-only over locally cached `STORE_HISTORY_EVENTS`. No remote calls.

## User-facing surface

- **Enroll**: "Watch this ASIN" toggle in `components/ui/ScoutPanel.tsx`. Renders only after a successful Quick Scout (so a price record exists).
- **Manage**: enrolled-ASIN list with un-enroll button in `components/ui/PrivacyTab.tsx`. Shows current low, last-checked timestamp, OS-permission status pill.
- **Notify**: `chrome.notifications` system notification with title + new-vs-low summary. No URL, no genome data, no PII. Click handler behavior defined in §"Notification click handler" below — single source of truth.

## Open decisions — resolved

| #   | Decision                          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Which messaging union(s) extend?  | New `EnrollAlertRequest`, `DisenrollAlertRequest`, `ListEnrolledAlertsRequest`, `ListEnrolledAlertsResponse` extend `PopupMessage` (popup/options → SW). Notifications fire from SW directly via `chrome.notifications.create`; no message back.                                                                                                                                                                                       |
| D2  | Pre-flight permission probe?      | On `mount` of ScoutPanel toggle and PrivacyTab list, call `chrome.notifications.getPermissionLevel()`. If `'denied'`, render banner + disable toggle.                                                                                                                                                                                                                                                                                  |
| D3  | Notification dedup-key shape?     | `${asin}:${utcDay}:${lowWatermark}`. Persisted in `STORE_PRICE_ALERTS` per enrollment. New low resets dedup window for that ASIN.                                                                                                                                                                                                                                                                                                      |
| D4  | `tests/setup.ts` extension scope? | Extend hand-rolled mock with `chrome.notifications.create`, `chrome.notifications.getPermissionLevel`, `chrome.notifications.onClicked`, `chrome.alarms.get`, `chrome.alarms.getAll`, `chrome.alarms.clear` (already present at line 121 — verify), `chrome.tabs.query`, `chrome.tabs.update`. New `__chromeTestHarness.getNotifications()` and `__chromeTestHarness.fireNotificationClick(notificationId)` helpers. No `fakeBrowser`. |
| D5  | Privacy-policy diff?              | Append paragraph to `docs/privacy-policy.md` describing alarm-driven local re-evaluation: opt-in required, ≥30 min period, zero remote calls, only locally-stored data read. CWS submission checklist updated for `notifications` permission justification.                                                                                                                                                                            |

## Touch points

| File                               | Action                                                                                                                                                                                                                                                                                                                                                                         | Notes                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lib/storage.ts`                   | bump `DB_VERSION` 4 → 5; new `STORE_PRICE_ALERTS = 'price_alerts'` constant + `onupgradeneeded` branch creating the store. Add new `getAllEncryptedItems<T>(storeName: string, key: CryptoKey): Promise<T[]>` helper next to existing `getAllItems` at line 103. (`wipeAllData` at line 162 already auto-iterates `db.objectStoreNames` — no edit required for the new store.) | Invariant #7: downgrade-as-wipe documented in CHANGELOG.                                                                           |
| `lib/price-alerts.ts`              | NEW. `enrollAlert(asin, key)`, `disenrollAlert(asin, key)`, `listEnrolledAlerts(key)`, `checkAllAlerts(key)`, `triggerNotification(asin, oldLow, newPrice, dedupKey)`. Persists via `setEncryptedItem` (invariant #2).                                                                                                                                                         | Pure module. No DOM.                                                                                                               |
| `lib/messaging/types.ts`           | add `EnrollAlertRequest { type: 'ENROLL_ALERT'; payload: { asin: string } }`, `DisenrollAlertRequest`, `ListEnrolledAlertsRequest`, `ListEnrolledAlertsResponse { type: 'ENROLLED_ALERTS'; payload: { asins: string[] } }`. Extend `PopupMessage` union.                                                                                                                       | No change to `ContentMessage` / `OffscreenMessage`.                                                                                |
| `entrypoints/background.ts`        | new `chrome.alarms.onAlarm` branch for `sdh:price-check` (period ≥ 30 min). Handler rehydrates enrolled-alert IDs via `listEnrolledAlerts(key)` then runs `checkAllAlerts(key)`. New `runtime.onMessage` branches for the four new variants. Schedule the alarm on first enrollment; clear when last enrollment removed.                                                       | Mirrors `sdh:scheduled-wipe` pattern at line 21. SW-stateless: no module-level state.                                              |
| `lib/audit-log.ts`                 | extend `AuditLogEntry.kind` to include `'price-alert-enroll'`, `'price-alert-disenroll'`, `'price-alert-fired'`. Audit append remains gated by existing `optInAuditLog` flag (no behavior change).                                                                                                                                                                             | Additive type extension. Existing readers unaffected.                                                                              |
| `components/ui/ScoutPanel.tsx`     | render "Watch this ASIN" toggle (disabled when notifications denied). Sends `ENROLL_ALERT` / `DISENROLL_ALERT`. Loads enrollment state via `LIST_ENROLLED_ALERTS` on mount.                                                                                                                                                                                                    | Visible only when `props.asin` is non-null.                                                                                        |
| `components/ui/PrivacyTab.tsx`     | new "Price alerts" section above existing audit log: enrolled-ASIN list, per-row un-enroll button, OS-permission status pill, "Notifications: blocked by OS" banner when `getPermissionLevel() === 'denied'`.                                                                                                                                                                  | Reuses existing `Alert`, `Button` shadcn components.                                                                               |
| `tests/setup.ts`                   | extend mock per D4.                                                                                                                                                                                                                                                                                                                                                            | Mirror existing `chrome.alarms.create` shape. Track notifications fired via a new `__chromeTestHarness.getNotifications()` helper. |
| `wxt.config.ts`                    | add `notifications` to `permissions` array (line 24).                                                                                                                                                                                                                                                                                                                          | No host_permissions change.                                                                                                        |
| `docs/privacy-policy.md`           | append paragraph per D5.                                                                                                                                                                                                                                                                                                                                                       | Replace `<HOST THIS BEFORE SUBMIT>` placeholder URL is unrelated; do not touch.                                                    |
| `docs/cws-submission-checklist.md` | add `notifications` permission justification line; update Description if alert UX is user-visible.                                                                                                                                                                                                                                                                             | Reviewer notes: include alert flow walkthrough.                                                                                    |
| `CHANGELOG.md`                     | new `## v0.2.0` heading: P5.1 + P5.2 entry. Note IDB version bump and downgrade-as-wipe.                                                                                                                                                                                                                                                                                       | Roadmap invariant #7.                                                                                                              |

## Storage schema

`STORE_PRICE_ALERTS` rows keyed by `asin`. Encrypted record shape:

```ts
interface AlertEnrollment {
  asin: string;
  enrolledAt: number; // ms epoch
  lastDedupKey: string | null; // `${asin}:${utcDay}:${lowWatermark}` or null
  lastFiredAt: number | null; // ms epoch
}
```

Encrypted via `setEncryptedItem(STORE_PRICE_ALERTS, asin, record, key)` per invariant #2. Reader: `getEncryptedItem(STORE_PRICE_ALERTS, asin, key)`. Bulk read for `checkAllAlerts` uses new helper `getAllEncryptedItems<T>(storeName, key): Promise<T[]>` added to `lib/storage.ts` (committed in same WU; signature defined here, not deferred).

## Alarm semantics

- Alarm name: `sdh:price-check`. Period: 30 min.
- Created by `enrollAlert` ONLY if no enrollment existed before; cleared by `disenrollAlert` when count reaches zero.
- Idempotent: running the alarm handler with no enrolled alerts is a no-op.
- Re-entrant: handler is fully resumable; no in-memory cursor. Each ASIN is one IDB transaction.
- SW-statelessness: all handler entry points read `STORE_PRICE_ALERTS` from disk.

## Notification semantics

- Title: `"<truncated product title>"` (≤ 60 chars; plain `String.prototype.slice` — no new util).
- Body: `"New price <price> beats your 30-day low <oldLow>"`. Currency formatted via `lib/currency.ts`.
- Dedup: skip `triggerNotification` when `lastDedupKey === currentDedupKey`. Update `lastDedupKey` only after successful `chrome.notifications.create`.
- Notification ID: `sdh:price-alert:${asin}`; collision-free per ASIN.

## Notification click handler

Single source of truth — supersedes any other description in this plan.

`chrome.notifications.onClicked` registered once in `entrypoints/background.ts` (alongside the existing `runtime.onMessage` listener). Behavior on click:

1. Parse the ASIN from the notification ID prefix `sdh:price-alert:`.
2. Read product cache via `getCachedProduct(asin, key)` from `lib/cache.ts:21`.
3. If cache miss (returns `null`): clear notification only; no further action. Test asserts.
4. If cache hit and `cachedProduct.url` is non-empty:
   a. Search existing tabs via `chrome.tabs.query({ url: cachedProduct.url })`.
   b. If a matching tab exists: focus it via `chrome.tabs.update(tab.id, { active: true })` + `chrome.windows.update(tab.windowId, { focused: true })`.
   c. If no matching tab exists: clear notification only. **Do NOT open a new tab.** Opening a new Amazon page would be auto-navigation, which violates invariant #3.

Invariant #3 reconciliation: clicking is an explicit user action, so focusing an _already-open_ tab the user previously navigated to is not auto-navigation. Creating a new tab IS auto-navigation and is forbidden. The plan accepts the cost of "click does nothing if user has closed the source tab" in exchange for the bright-line invariant.

No content script is invoked, no scrape is triggered, no `fetch` is made.

## Privacy + invariants — explicit checks

| Invariant                      | How P5.1 satisfies it                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — zero remote                | All reads against IDB; `chrome.notifications` is OS-local; no `fetch` introduced.                                                                                   |
| 2 — encryption                 | `STORE_PRICE_ALERTS` written via `setEncryptedItem` only.                                                                                                           |
| 3 — explicit-trigger carve-out | Alarm-driven evaluation reads only locally collected `STORE_HISTORY_EVENTS` rows, never scrapes, never makes remote calls. Privacy Policy diff (D5) discloses this. |
| 4 — bundle ≤ 2.5 MB            | Delta budget < 10 KB zipped. CI bundle check enforces.                                                                                                              |
| 5 — Chrome ≥ 116               | `chrome.notifications` GA since Chrome 28. `chrome.alarms` minimum-period semantics unchanged.                                                                      |
| 6 — SW statelessness           | Handler rehydrates from IDB on every wake; no module-level globals.                                                                                                 |
| 7 — IDB forward-only           | `DB_VERSION` bumped to 5; downgrade-as-wipe documented in CHANGELOG.                                                                                                |

## Edge cases

| Risk                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OS-level notification permission denied           | Pre-flight probe via `getPermissionLevel`; UI surfaces denied state; alarm still runs and dedup-tracks but does not fire OS notifications.                                                                                                                                                                                                                                                                                                                                                                         |
| User wipes data while alarm fires                 | `STORE_PRICE_ALERTS` cleared by existing `wipeAllData()`; handler exits clean on empty enrollment list.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Notification fires before product cache populated | Click handler no-ops if cache miss; no error surfaced.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Two alarms fire near-simultaneously after SW wake | Dedup key prevents double-fire for the same UTC day + low-watermark.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| User downgrades v0.2.0 → v0.1.x                   | IDB at version 5 fails `getDB()` with `DBVersionMismatchError`; documented as wipe-required in CHANGELOG.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Bootstrap CryptoKey lifecycle                     | SW-stateless per invariant #6. Alarm handler MUST re-derive the key on each wake — no module-level cache. Pattern: `const salt = new Uint8Array(16); const key = await deriveKey('bootstrap-session-password', salt);` — identical to existing usages at `background.ts:36-37`, `background.ts:84-85`, `background.ts:132-133`. `checkAllAlerts(key)` accepts the key from the caller; the alarm handler is the only caller and re-derives per fire. Document explicitly in code comment. NOT a new privacy claim. |

## Test plan (TDD-mandatory, written before impl)

`tests/lib/price-alerts.test.ts` — unit:

- `enrollAlert` writes encrypted record; second enroll is idempotent.
- `disenrollAlert` removes record; clears alarm when last enrollment removed.
- `listEnrolledAlerts` returns all enrolled ASINs.
- `checkAllAlerts` fires notification when current price < 30-day low; updates `lastDedupKey`.
- `checkAllAlerts` skips when current price ≥ low or when dedup key matches.
- `checkAllAlerts` no-ops on empty enrollment list.
- `checkAllAlerts` with `getPermissionLevel() === 'denied'`: dedup state still updates, NO `chrome.notifications.create` call. (Edge-case row 1.)
- `checkAllAlerts` after mid-run `wipeAllData()`: handler exits clean on subsequent enrollment read returning empty. (Edge-case row 2.)
- SW-statelessness: two consecutive `checkAllAlerts(key)` calls with no in-memory state produce identical post-state.

`tests/lib/storage.test.ts` — extend:

- `getAllEncryptedItems` round-trips multiple encrypted records.
- `getAllEncryptedItems` returns `[]` on empty store.
- `getDB` rejects with `DBVersionMismatchError` when underlying IDB is at a higher version than `DB_VERSION` (regression test for invariant #7 / downgrade-as-wipe; not new behavior, but new store makes the case real). (Edge-case row 5.)

`tests/lib/audit-log.test.ts` — extend (if file does not exist, add):

- New `kind` values appended only when `optInAuditLog === true`.

`tests/components/ScoutPanel.test.tsx` — extend (if exists; otherwise inline-test):

- Toggle renders disabled when permission level is `'denied'`.
- Toggle dispatches `ENROLL_ALERT` and `DISENROLL_ALERT` correctly.

`tests/components/PrivacyTab.test.tsx` — extend:

- Renders enrolled list from `LIST_ENROLLED_ALERTS` response.
- Permission banner renders when `getPermissionLevel() === 'denied'`.

`tests/entrypoints/background.test.ts` — extend (if exists; otherwise create):

- New runtime.onMessage branches return correct response shape (`ENROLL_ALERT`, `DISENROLL_ALERT`, `LIST_ENROLLED_ALERTS`).
- Alarm handler resilience: empty enrollment is no-op; populated enrollment routes through `checkAllAlerts`.
- `chrome.notifications.onClicked` handler — happy path: cache hit + matching tab → calls `chrome.tabs.update` with `active: true`; no `chrome.tabs.create` invoked.
- `chrome.notifications.onClicked` handler — cache miss: no `chrome.tabs.*` call.
- `chrome.notifications.onClicked` handler — cache hit but no matching tab: no `chrome.tabs.create` invoked. (Invariant #3 regression guard.)
- `chrome.notifications.onClicked` handler — no `fetch`/`WebSocket`/content-script invocation in any branch (asserted by absence of mock calls).

`tests/setup.ts` — extend (D4) before any of the above.

`tests/e2e/price-alerts.spec.ts` — NEW Playwright spec:

- Install unpacked extension, scout fixture product, enroll alert, simulate price drop, assert mock notification fired.

## Verification gates

1. `pnpm test:run` — all green.
2. `pnpm tsc --noEmit` — clean.
3. `pnpm test:coverage` — floor 91 maintained globally; `lib/price-alerts.ts` ≥ 95% per-file.
4. SW-statelessness test passes.
5. `pnpm build && pnpm zip` — zip size ≤ 420 KB cumulative cap (invariant #4).
6. Privacy grep gate: `grep -rn 'fetch\|WebSocket\|EventSource' lib/price-alerts.ts entrypoints/background.ts` — only existing legitimate matches.
7. Manual on unpacked: scout product, watch ASIN, simulate drop in DevTools, confirm OS notification.

## Rollback

- `git revert <P5.1 commits>` reverses code.
- Manifest revert removes `notifications` permission (no user-visible breakage).
- IDB rows in `STORE_PRICE_ALERTS` orphaned; harmless. v0.2.x patch can iterate `wipeAllData` to clear if desired.
- `DB_VERSION` cannot be lowered; revert release stays at 5 even if all P5.1 code removed (acceptable; no functional impact).

## Decoupling vs P5.2

P5.1 and P5.2 are committed as independent work-unit commits. Either can be reverted before tag without disturbing the other. If CWS rejects `notifications` for v0.2.0, revert P5.1 commits and ship P5.2 alone (escape hatch documented in roadmap line 17).

## Estimated scope

~24 hrs. 1 work unit. CWS re-review required for `notifications` on v0.2.0 ship.

## Open items requiring user input

None. All roadmap-deferred decisions resolved above (D1–D5).
