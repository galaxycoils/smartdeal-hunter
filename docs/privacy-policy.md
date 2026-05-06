# Privacy Policy — SmartDeal Hunter

**Effective**: 2026-05-06.
**Contact**: tahamtandariush@gmail.com.

SmartDeal Hunter is a privacy-first Chrome extension. The TL;DR: no
personal data leaves your browser unless you explicitly opt in to the
Deep Check feature.

## Data we collect

**None remote.** We operate **entirely on-device**. No analytics, no
telemetry, no error reporting, no first-run beacon. We do not see what
products you scout, what scores you receive, what feedback you give,
or what the extension's heuristics infer about your preferences.

## Data we store locally

The extension stores the following on your device only, inside your
Chrome profile:

| Storage                | Contents                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `chrome.storage.local` | UI preferences, audit log of explicit privacy actions, scheduled-wipe alarm metadata.                                                      |
| IndexedDB (encrypted)  | Your "Genome" preference vector (8 dimensions × weight + value), product cache (TTL 24 h, 50 MB LRU), price history, OAuth refresh tokens. |

**Encryption**: AES-GCM-256 with PBKDF2-derived keys (600,000 iterations).
The encryption key is held in memory only and is **never** persisted.
A fresh 12-byte IV is generated per encryption call via
`crypto.getRandomValues`. No IV reuse with the same key is possible.

## Network connections

Two and only two:

1. **Gemini Nano (on-device)** — when you open the Deep Check tab,
   the extension calls Chrome's built-in `self.ai.summarizer` API to
   produce a local summary of any review text you provide. This call
   is on-device, does not traverse the network, and is provided by
   Chrome itself (not by us).
2. **Amazon Creators API (Deep Check, opt-in only)** — the Deep Check
   feature, behind an explicit "Connect to Amazon" opt-in, calls
   `https://creators.amazon.com/api/items/<asin>` to fetch live data
   for the ASIN you are viewing. We never call this API in the
   background or for any ASIN you have not explicitly scouted.

No other endpoint is contacted. There is no third-party analytics,
no Google Analytics, no Sentry, no Mixpanel, no Datadog, no Segment.

## Permissions

| Permission  | Why we need it                                                                               |
| ----------- | -------------------------------------------------------------------------------------------- |
| `activeTab` | Read the current Amazon product page when you click Quick Scout.                             |
| `scripting` | Inject the Scout panel UI into the active Amazon page on demand.                             |
| `storage`   | Persist your Genome and preferences locally.                                                 |
| `alarms`    | Run the user-scheduled data-wipe at the time you choose.                                     |
| `offscreen` | Run heavy on-device ML in an isolated MV3 offscreen document (cannot run in service worker). |

| Host permission    | Why we need it                                             |
| ------------------ | ---------------------------------------------------------- |
| `*.amazon.com/*`   | Read Amazon US product pages so we can score them locally. |
| `*.amazon.co.uk/*` | Same for the UK marketplace.                               |
| `*.amazon.de/*`    | Same for the German marketplace.                           |
| `*.amazon.co.jp/*` | Same for the Japanese marketplace.                         |
| `*.amazon.ca/*`    | Same for the Canadian marketplace.                         |
| `*.amazon.fr/*`    | Same for the French marketplace.                           |
| `*.amazon.it/*`    | Same for the Italian marketplace.                          |
| `*.amazon.es/*`    | Same for the Spanish marketplace.                          |

We do **not** request, and the extension will not function on, any
non-Amazon domain.

## Cookies and tracking

We do not set cookies. We do not read Amazon's cookies. We do not
fingerprint your browser. We do not inject affiliate or referral
parameters into Amazon URLs.

## Data retention and deletion

- The Genome and product cache live in your local IndexedDB until you
  delete them via the Privacy tab in the extension's options page.
- The product cache TTL is 24 hours per entry, with an LRU cap of
  50 MB; old entries are pruned automatically.
- A "Wipe All Data" button in the Privacy tab clears every store
  immediately. A "Schedule Wipe" option lets you wipe automatically
  at a future time you choose.
- Uninstalling the extension removes all data permanently — Chrome
  deletes the extension's storage when you uninstall.

## Children

The extension is not directed at users under 13 and we do not
knowingly collect any data (locally or otherwise) about minors.
Because we collect no remote data at all, there is nothing to
disclose, transfer, or delete on a per-user basis.

## Changes to this policy

If we ever change this policy, the `Effective` date at the top will
update and the change will be summarized in the project's
`CHANGELOG.md`.

## Contact

Questions or concerns: **tahamtandariush@gmail.com**.

The extension is open source: https://github.com/tahamtandariush/smartdeal-hunter
