# Chrome Web Store Listing — SmartDeal Hunter v0.0.1

Source-of-truth copy for the Chrome Web Store dev-channel submission. Pasteable
into the developer dashboard.

## Identity

- **Name**: SmartDeal Hunter
- **Short name**: SmartDeal
- **Version**: 0.0.1
- **Category**: Shopping
- **Languages**: English (United States)
- **Visibility**: Unlisted (dev channel) → Public after Phase 2 review

## Short description (≤ 132 chars)

> Privacy-first Amazon shopping assistant. On-device True Value + Personal Fit
> scoring. No tracking.

(99 chars — within limit.)

## Detailed description

```
SmartDeal Hunter helps you make smarter Amazon purchases without giving up your
privacy.

WHAT IT DOES
• True Value score — combines price, ratings, brand trust, and discount depth
  into a 0–100 quality signal.
• Personal Fit score — learns from your feedback (saved / not interested /
  purchased) to align recommendations with your preferences.
• Scout panel — a non-intrusive overlay on Amazon product pages, only when you
  ask for it.

PRIVACY GUARANTEES (MVP)
• Zero remote data transmission. All scoring runs on-device.
• AES-GCM-256 encryption for your preference profile (PBKDF2, 600K iterations).
• No tracking, no telemetry, no advertising IDs.
• No affiliate-link injection. Ever.
• Explicit-trigger only — every analysis is user-initiated. No auto-scraping,
  no auto-navigation.
• Export or wipe all your data at any time from the Options page.

PERMISSIONS — WHY WE ASK
• activeTab — read the current Amazon product page when you click Analyze.
• scripting — inject the scout panel UI into the active tab on demand.
• storage — store your encrypted preference profile (Genome) locally.
• alarms — schedule the optional cache cleanup (no network calls).
• offscreen — run on-device ML inference in an isolated document.
• host: https://*.amazon.com/* — only Amazon US is supported in MVP.

REQUIREMENTS
Chrome 116 or later (for stable WebNN). Falls back to WASM on older builds.

ROADMAP
Phase 2 will add an optional Deep Check feature (opt-in, rate-limited) and a
full Bundle Optimizer. Both will remain transparent and revocable.

OPEN SOURCE
Source code: https://github.com/tahamtandariush/smartdeal-hunter
Bug reports and feedback are welcome.
```

## Single-purpose justification

> Privacy-first shopping assistant for Amazon: scores products by True Value
> and Personal Fit, on-device, with no remote tracking or data transmission.

## Permission rationale (per-permission, for the dashboard form)

| Permission          | Justification (≤ 1000 chars)                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`         | Read the title, price, rating, and review counts of the Amazon page the user explicitly analyzes. Triggered only by user click on the popup or scout panel. No background scraping. |
| `scripting`         | Inject the scout panel UI (a shadow-DOM overlay) into the active Amazon tab so scores can be shown next to the product.                                                             |
| `storage`           | Persist the user's encrypted preference profile (the "Genome") and a small product cache locally via IndexedDB. Never transmitted off-device.                                       |
| `alarms`            | Schedule a daily cleanup pass over the product cache to delete entries older than 7 days.                                                                                           |
| `offscreen`         | Run on-device ML inference (ONNX Runtime Web on WASM/WebGPU) inside an isolated Offscreen Document, since service workers cannot host these APIs.                                   |
| host `*.amazon.com` | MVP only supports Amazon US product pages. Other Amazon domains and other retailers are out of scope for v0.0.1.                                                                    |

## Privacy disclosures (CWS Privacy Practices form)

- **Single purpose**: Score Amazon products for True Value and Personal Fit.
- **Data collected**:
  - **Web history** — only the active Amazon product URL when the user
    explicitly clicks Analyze. Stored locally; never transmitted.
  - **User activity** — saved/not-interested/purchased feedback the user
    explicitly provides. Stored locally, encrypted; never transmitted.
- **Data NOT collected**: PII, authentication info, financial info, health
  info, location, exact metrics, communications.
- **Use of data**: Solely to compute on-device scores. Not sold, not shared,
  not used for ads.
- **Encryption in transit**: N/A — no data leaves the device in MVP.
- **Encryption at rest**: AES-GCM-256, 12-byte random IV per record, key
  derived via PBKDF2 (600K iterations).

## Screenshots (5 × 1280×800 PNG required)

To be captured manually before submission. Per Chrome Web Store policy:

| #   | Filename                 | Subject                                                              |
| --- | ------------------------ | -------------------------------------------------------------------- |
| 1   | `01-popup-dashboard.png` | Popup with onboarding complete, current state, Analyze button.       |
| 2   | `02-onboarding.png`      | Onboarding wizard mid-flow showing Likert sliders.                   |
| 3   | `03-scout-panel.png`     | Amazon product page with the injected scout panel overlay visible.   |
| 4   | `04-options-privacy.png` | Options page showing the Privacy section with Export / Wipe buttons. |
| 5   | `05-feedback.png`        | Feedback flow: Saved / Not interested / Purchased buttons.           |

Capture procedure:

1. `pnpm build` then load `.output/chrome-mv3` as an unpacked extension in
   Chrome 116+.
2. Use `metaswarm:visual-review` (Playwright headful) or DevTools device
   toolbar at 1280×800 to capture each shot.
3. Save under `docs/store-assets/screenshots/`.

## Promotional images (optional, for store front placement)

| Asset              | Size       | Status              |
| ------------------ | ---------- | ------------------- |
| Small promo tile   | 440 × 280  | Skip for dev review |
| Marquee promo tile | 1400 × 560 | Skip for dev review |

## Submission checklist

- [x] Manifest V3 with `minimum_chrome_version: 116`.
- [x] Bundle size < 2.5 MB (current: 435 kB built / 148 kB zipped).
- [x] All 5 icon sizes present (16/32/48/96/128).
- [x] Coverage gate ≥ 90 % (current: 98.36 / 93.19 / 93.93 / 99.7).
- [x] CSP locked: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.
- [x] Author + homepage_url declared.
- [x] No affiliate-link injection.
- [ ] Privacy policy URL hosted (placeholder: GitHub README until Phase 2).
- [ ] 5 screenshots captured at 1280×800.
- [ ] CWS developer account paid + verified.
- [ ] Upload `.output/smartdeal-hunter-0.0.1-chrome.zip` and complete listing.

## Notes

- Real homepage URL placeholder uses the project's GitHub repo. Replace before
  public release.
- Screenshot capture and CWS upload are manual and out of automated scope.
- Privacy policy text lives in the `docs/compliance.md` and the Options page;
  CWS requires a hosted URL — wire one when the public site exists.
