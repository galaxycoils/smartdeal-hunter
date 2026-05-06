# Chrome Web Store Submission Checklist — v0.1.0

This file holds every CWS dashboard field with the exact value to
paste, plus a checkbox list of pre-submission asset work.

---

## Listing fields (paste into the CWS dashboard)

### Item details

| Field          | Value                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Name           | `SmartDeal Hunter`                                                                                     |
| Short name     | `SmartDeal`                                                                                            |
| Summary (≤132) | `Privacy-first Amazon shopping assistant. On-device True Value + Personal Fit scoring. Zero tracking.` |
| Category       | `Productivity` (primary) / `Shopping` (secondary)                                                      |
| Language       | `en`                                                                                                   |

### Detailed description (≤16 000 chars)

```
SmartDeal Hunter scores Amazon products against YOUR preferences,
entirely on your device. Nothing leaves the browser unless you
explicitly opt in to the Deep Check feature.

What it does:
* "True Value" score — combines price-per-unit, ratings, brand trust,
  and seasonal pricing into a single 0-100 number.
* "Personal Fit" score — a Genome you tune with 8 sliders during
  onboarding (price sensitivity, brand affinity, quality priority,
  sustainability, novelty seeking, review weight, discount sensitivity,
  category diversity) is matched against the product's attribute vector
  using cosine similarity.
* 30-day price history chart — built from the prices you actually
  scout, stored locally in IndexedDB.
* Locale support for 8 Amazon marketplaces (US, UK, DE, JP, CA, FR, IT, ES)
  with per-region currency formatting and rating-phrase parsing.
* Optional Gemini Nano sentiment summary of review text you provide
  (on-device; falls back to a local keyword heuristic if Nano is
  unavailable).
* Optional "Deep Check" via Amazon Creators API for live product data
  (requires explicit OAuth opt-in; rate-limited to 10 calls/min).

What it does NOT do:
* No tracking, no analytics, no telemetry, no remote logging.
* No affiliate-link injection — ever.
* No background scraping — every analysis is user-initiated.
* No data ever leaves your browser unless you opt in to Deep Check.

Privacy by design:
* AES-GCM-256 encryption + PBKDF2 (600 000 iterations) for stored data.
* Encryption keys held in memory only, never persisted.
* Built for Manifest V3, with a strict CSP
  (`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`).
* "Wipe All Data" + "Schedule Wipe" controls in the Privacy tab.

Open source: https://github.com/tahamtandariush/smartdeal-hunter
Privacy policy: https://github.com/tahamtandariush/smartdeal-hunter/blob/main/docs/privacy-policy.md
Contact: tahamtandariush@gmail.com
```

### Privacy practices

| Field                                              | Value                                                                                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single purpose declaration                         | `Provide on-device scoring and price-history insights for products on Amazon retail pages. The extension activates only when the user explicitly clicks Quick Scout on an Amazon product page.` |
| Data usage limits — disclosed                      | We collect no remote data. Local data (Genome, cache, price history) is encrypted on-device and never transmitted.                                                                              |
| Data handling certification — comply with policies | Yes.                                                                                                                                                                                            |
| Privacy policy URL                                 | `<HOST THIS BEFORE SUBMIT>` (canonical text in `docs/privacy-policy.md`; placeholder until user confirms hosting plan)                                                                          |

### Permission justifications (CWS dashboard accepts free text per permission)

```
activeTab    — Required to read the current Amazon product page when the user clicks Quick Scout. Used only on user action.
scripting    — Required to inject the SmartDeal Scout panel UI into the active Amazon tab when the user requests an analysis.
storage      — Required to persist the user's Genome (preference vector) and UI preferences across sessions, on-device only.
alarms       — Required to fire the user-scheduled data wipe at the user's chosen future time.
offscreen    — Required to run heavy on-device ML inference (ONNX Runtime Web) inside an MV3 offscreen document; the service worker cannot host this directly.
```

### Host-permission justifications (one per host_permissions entry)

```
*.amazon.com/*    — Read product pages on the US Amazon marketplace so the extension can score them locally.
*.amazon.co.uk/*  — Same, UK marketplace.
*.amazon.de/*     — Same, Germany.
*.amazon.co.jp/*  — Same, Japan.
*.amazon.ca/*     — Same, Canada.
*.amazon.fr/*     — Same, France.
*.amazon.it/*     — Same, Italy.
*.amazon.es/*     — Same, Spain.
```

### Reviewer notes (free text)

```
TEST INSTRUCTIONS

1. Install the extension. Click the toolbar icon to open the popup.
2. Onboarding: pick any slider values; click Get Started, then Next, Next, Finish.
3. Open https://www.amazon.com/dp/B08N5WRWNW (or any other amazon.* product page).
4. Click Quick Scout in the popup. The Scout panel appears in the page (shadow DOM)
   with two scores (True Value and Personal Fit) and a 30-day price-trend chart.
5. To verify the privacy claims:
   - Open chrome://extensions, click Service Worker / Inspect.
   - Open the Network tab in DevTools. Use the extension. The only network calls
     you should see are when you explicitly click "Connect to Amazon" in the
     options page Deep Check tab.
   - All other functionality (scoring, charting, Nano summary fallback) is
     on-device.
6. Privacy controls: open the extension's Options page → Privacy tab →
   "Wipe All Data". Confirm the dialog. All local data is removed.

The extension does not require an account, does not collect telemetry,
and does not function on any non-Amazon domain. The Deep Check OAuth
flow is the only optional remote integration and is gated behind
explicit user action.
```

---

## Pre-submission asset checklist

- [x] **Manifest icons** — 16, 32, 48, 96, 128 px PNG present in `public/icon/`. Built manifest at `.output/chrome-mv3/manifest.json` carries all five.
- [x] **Manifest single-purpose declaration** — kept OUT of the manifest (not a real MV3 field). Lives in this checklist for the CWS dashboard form only.
- [x] **CSP** — `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`, verified in built manifest.
- [x] **`homepage_url`** — `https://github.com/tahamtandariush/smartdeal-hunter` (real, not placeholder).
- [x] **`author.email`** — `tahamtandariush@gmail.com`.
- [x] **Bundle size** — 1.21 MB total (cap 2.5 MB; 2× headroom). `pnpm build && ls -la .output/smartdeal-hunter-*.zip` to verify zip.
- [ ] **5 screenshots @ 1280×800 PNG** — captured by user, NOT in this commit. Save under `docs/store-assets/screenshots/`. Required:
  1. Onboarding step 1 (slider tutorial)
  2. Quick Scout button on Amazon product page
  3. Scout result panel with both scores + price chart
  4. Options → Genome editor
  5. Options → Privacy controls
- [ ] **Promotional tile 440×280 PNG** — optional; skip for v0.1.0.
- [ ] **Privacy policy hosted at a public URL** — paste URL into CWS dashboard. Canonical text in `docs/privacy-policy.md`.

---

## Submission flow

1. Verify checkboxes above.
2. Run `pnpm build && pnpm zip` to produce `.output/smartdeal-hunter-<version>-chrome.zip`.
3. Upload zip to https://chrome.google.com/webstore/devconsole.
4. Paste fields above into the dashboard.
5. Mark the listing as **Public** (or **Unlisted** for staged rollout).
6. Submit for review.
7. Track review status; respond to any reviewer questions promptly.
