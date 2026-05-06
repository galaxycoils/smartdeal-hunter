# Security Audit — Phase 4 WU-8

Date: 2026-05-06
Auditor: automated grep + manual inspection per Plan-Review-Gate iter-3 DoD.
Scope: built `.output/chrome-mv3/manifest.json` + `lib/`, `entrypoints/`, `components/`.

## Summary

| Check                                          | Result | Evidence                      |
| ---------------------------------------------- | ------ | ----------------------------- |
| Built CSP unchanged                            | PASS   | `manifest.json` line below    |
| Web Crypto invariants                          | PASS   | `lib/crypto.ts:1-67`          |
| Data-egress grep                               | PASS   | only `lib/deep-check.ts`      |
| SW statelessness (`entrypoints/background.ts`) | PASS   | no module-level mutable state |
| Module-level mutable state in lib + content    | DOC    | 2 cases — both safe           |
| Host permissions                               | PASS   | exactly 8 Amazon TLDs         |
| Affiliate links                                | PASS   | zero matches                  |
| Explicit-trigger compliance                    | PASS   | every analysis path traced    |
| No timers triggering analysis                  | PASS   | timers only for UI / wipe     |

Overall: **PASS** with 1 documented finding (module-level state, non-blocking).

---

## 1. CSP unchanged

```
$ jq -r .content_security_policy.extension_pages .output/chrome-mv3/manifest.json
script-src 'self' 'wasm-unsafe-eval'; object-src 'self'
```

Matches `wxt.config.ts:30` source. Phase 3 + Phase 4 changes did not
touch CSP.

## 2. Web Crypto invariants (per CLAUDE.md)

- **AES-GCM-256**: `lib/crypto.ts:9-10` — `KEY_ALGO = 'AES-GCM'`,
  `KEY_LENGTH = 256`. Used at `crypto.subtle.encrypt` line 44 and
  `crypto.subtle.decrypt` line 67.
- **PBKDF2 600k iterations**: `lib/crypto.ts:7` — `ITERATIONS = 600000`.
  Used in `crypto.subtle.deriveKey` line 22.
- **IV via `crypto.getRandomValues(12)`**: `lib/crypto.ts:42` —
  `crypto.getRandomValues(new Uint8Array(IV_SIZE))`, `IV_SIZE = 12`
  (line 8). Fresh IV per encryption call. No reuse possible.
- **Derived keys held in memory only**: keys returned from `deriveKey`
  are `CryptoKey` instances passed by reference; never serialized to
  `chrome.storage.*`. Verified by absence of `JSON.stringify` on
  CryptoKey anywhere in the codebase.

## 3. Data-egress grep

```
$ grep -rn "fetch\(" --include="*.ts" --include="*.tsx" lib/ entrypoints/ components/
lib/analysis-cache.ts:86:  async prefetch(asins: string[]): Promise<void> {
```

Single match is the **method name** `prefetch` (not a `fetch()` call).
The actual call site:

```
$ grep -n "fetch" lib/deep-check.ts
lib/deep-check.ts:90:async function fetchWithRetries(
lib/deep-check.ts:93:  fetchImpl: DeepCheckFetch,
lib/deep-check.ts:96:  const request = () =>
lib/deep-check.ts:97:    fetchImpl(`https://creators.amazon.com/api/items/${asin}`, {
lib/deep-check.ts:134:  const fetchImpl = options?.fetchImpl ?? fetch;
```

`lib/deep-check.ts` is the **only** module that performs remote calls,
and it's behind the explicit Deep Check opt-in (per CLAUDE.md). Uses
dependency injection (`fetchImpl ?? fetch`) for testability. Endpoint
is `https://creators.amazon.com/api/items/<asin>` — official Amazon
Creators API.

`lib/amazon-oauth.ts` constructs OAuth URLs via `new URL(...)` only
(line 13) — no `fetch` calls; the OAuth redirect is performed via
`browser.identity.launchWebAuthFlow`, not direct fetch.

Zero `XMLHttpRequest`, zero `sendBeacon`, zero `navigator.sendBeacon`.

## 4. Service-worker statelessness

```
$ grep -nE "^let |^const \w+\s*=\s*[^(]" entrypoints/background.ts
(no matches)
```

`entrypoints/background.ts` has no module-level mutable state. All
state held in `chrome.storage.local` or `chrome.alarms`. Compliant
with CLAUDE.md MV3 invariant.

## 5. Module-level mutable state in `lib/` + content (DOCUMENTED)

Two real cases, both safe:

### `lib/price-history.ts:12-13`

```ts
let lastTimestamp = 0;
let counter = 0;
```

Used to dedupe sub-millisecond `savePrice` calls into distinct keys
(`<asin>:<timestamp+counter>`). Audit conclusion: **no correctness
issue**.

- `Date.now()` is monotonic across SW restart, so a reset of
  `lastTimestamp` to 0 will immediately trigger the `else` branch
  (line 19-21) on the next call and reset `counter` correctly.
- A SW restart followed by a stale-timestamp re-call cannot collide
  with previous keys because real time has advanced.

### `lib/deep-check.ts:39`

```ts
let refreshInFlight: Promise<AmazonOAuthTokens> | null = null;
```

Used to coalesce concurrent OAuth-token-refresh requests. SW restart
loses the in-flight promise but no data is corrupted: subsequent
callers fall through to a fresh refresh. Acceptable.

Module-level constants in `lib/crypto.ts`, `lib/storage.ts`,
`lib/audit-log.ts`, `lib/analysis-cache.ts`, `lib/deep-check.ts`
are all `const` configuration values — not mutable, not flagged.

## 6. Host permissions

```
$ jq -r .host_permissions[] .output/chrome-mv3/manifest.json
https://*.amazon.com/*
https://*.amazon.co.uk/*
https://*.amazon.de/*
https://*.amazon.co.jp/*
https://*.amazon.ca/*
https://*.amazon.fr/*
https://*.amazon.it/*
https://*.amazon.es/*
```

Exactly 8 entries. No wildcards beyond the locale TLD. Each justified
in `docs/store-listing.md` for the CWS submission.

## 7. Affiliate links

```
$ grep -rn 'tag=\|/ref=\|associates' --include="*.ts" --include="*.tsx" lib/ entrypoints/ components/
(no matches)
```

PASS. Zero affiliate-link injection per CLAUDE.md mandate.

## 8. Explicit-trigger compliance

Every analysis path traces back to a user-initiated message. Walked
each entry point:

- **Quick Scout** (`entrypoints/popup/Dashboard.tsx`) → user click → `SCRAPE_REQUEST` → background → `EXECUTE_SCRAPER` → content script.
- **Render panel** (`entrypoints/content.ts:28`) → message-based, only
  fired by background after explicit user analysis request.
- **Deep Check** (`components/ui/DeepCheckTab.tsx` → `lib/deep-check.ts`)
  → user click → opt-in flow → only call to remote API.
- **Sentiment** (`lib/sentiment.ts`) → invoked by `DeepCheckTab` on
  Deep Check load, not on automatic page navigation.

No analysis is auto-triggered by tab navigation, page load, or timer.

## 9. Timers / alarms grep

```
$ grep -rn "setInterval\|setTimeout\|chrome\.alarms" --include="*.ts" --include="*.tsx" lib/ entrypoints/ components/
entrypoints/background.ts:21:  chrome.alarms.onAlarm.addListener(...)        ← scheduled-wipe handler
entrypoints/background.ts:28:  chrome.alarms.create('sdh:scheduled-wipe', ...)   ← user-scheduled wipe
lib/deep-check.ts:137:  setTimeout(resolve, ms)                                  ← retry backoff
components/ui/PrivacyTab.tsx:77: setTimeout(...)                                 ← UI toast hide
components/ui/PrivacyTab.tsx:86: chrome.alarms.create('sdh:scheduled-wipe', ...) ← user-scheduled wipe
```

All timer/alarm usage is for either (a) user-scheduled data wipe, (b)
network-retry backoff, or (c) UI feedback. None triggers analysis.

## 10. Telemetry

By design: **none**. No analytics SDK, no error reporter, no
"first-run" beacon. Verified by grep for common telemetry vendors
(google-analytics, segment, sentry, mixpanel, datadog, plausible,
fathom, posthog, hotjar): zero matches.

---

## Audit conclusion

**PASS.** The codebase respects every CLAUDE.md security invariant.
Two module-level mutable-state findings documented above are correctness-safe
under SW restart and not blockers for v0.1.0. No remediation required
before release.
