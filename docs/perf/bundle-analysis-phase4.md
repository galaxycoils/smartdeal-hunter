# Bundle Analysis — Phase 4 WU-5

**TL;DR**: Total chrome-mv3 build = **1.21 MB**, well under the 2.5 MB
CWS submission cap. Largest chunk is `content-scripts/content.js`
at **707 kB**, which transitively pulls in recharts + framer-motion
through ScoutPanel.

**Both primary and alternative WU-5 paths from `conductor/plan-phase4.md`
are blocked by an architectural constraint discovered during exec.**
Real reduction requires a follow-up architectural WU (post-v0.1.0).

## What was attempted

| Attempt                                                        | Result                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output.manualChunks` for recharts + framer                    | **Build error**: WXT disables `output.codeSplitting` for content scripts. `Invalid configuration: "output.manualChunks" cannot be used when "output.codeSplitting" is set to false.`                                                                                                |
| Dynamic `import()` of ScoutPanel inside `RENDER_PANEL` handler | Not viable. WXT bundles content scripts as single self-contained files because MV3 content scripts run in the page-isolated world and cannot fetch additional JS chunks from the extension origin without `web_accessible_resources` declarations + `chrome.runtime.getURL` wiring. |
| PriceChart import narrowing                                    | Already minimal in the existing source (named imports for `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`). No further narrowing available without dropping features.                                                                      |

## Why the constraint is real, not a config bug

MV3 content scripts execute injected into the page's isolated world.
Static imports are bundled at build time into a single file because
the page cannot fetch chunks from `chrome-extension://<id>/...` without
explicit declarations:

1. Each chunk URL must be added to `manifest.web_accessible_resources`
   with the matching origin.
2. The dynamic-import statement must use `chrome.runtime.getURL(...)`
   to construct an absolute extension URL, since relative `import()`
   resolves against the page origin (which is `https://amazon.com`,
   not the extension).
3. CSP for the page must allow extension-origin script loads, which
   requires per-page negotiation.

WXT chooses to single-file content scripts to avoid this footgun
(`output.codeSplitting: false`).

## Bundle composition (current 707 kB content.js)

Approximate breakdown (from prior measurement):

| Module           | Approx | Notes                        |
| ---------------- | -----: | ---------------------------- |
| recharts 3.8.1   | 300 kB | LineChart subtree only used  |
| framer-motion 12 | 150 kB | ScoutPanel transitions       |
| React 19         | 130 kB | content-script-only build    |
| ScoutPanel + UI  |  80 kB | components/ui/\* tree-shaken |
| Tailwind utils   |  20 kB | per-class injection          |
| App glue         |  27 kB | scraper + messaging types    |

## Decision for v0.1.0

**Accept current bundle.** 1.21 MB total is 2× under the CWS 2.5 MB
cap. No user-facing perf regression observed (perf benches WU-4 stay
green: chart render p95 < 800 ms, scrape < 200 ms).

## Follow-up work (post-v0.1.0)

A future architectural WU should:

1. Add `manifest.web_accessible_resources` entry covering
   `chunks/viz-*.js` for amazon.\* hosts.
2. Refactor `entrypoints/content.ts` to use `chrome.runtime.getURL`
   when constructing the dynamic-import URL.
3. Override WXT's `output.codeSplitting: false` for the content-script
   build only (not the popup/options builds, which already split).
4. Re-attempt `manualChunks` for recharts + framer-motion.
5. Expected gain: content.js drops to ~300 kB; viz chunk emits at
   ~450 kB and loads only when ScoutPanel actually mounts.

This work is non-trivial (must verify the chunk URL rewriting works
in the page-isolated world across all 8 host_permissions origins) and
out of scope for release hardening. Tracked as a follow-up issue.
