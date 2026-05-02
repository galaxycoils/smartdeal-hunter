# Architecture

Mirrors the `Tech Stack & Architecture` sheet of the spec. Keep in sync.

## Runtime layers (MV3 isolated contexts)

| Layer                       | Technology                 | Responsibilities                                                                        | Constraints                                                                        |
| --------------------------- | -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Background (Service Worker) | TypeScript / WXT           | Event routing, storage orchestration, offscreen lifecycle, message hub                  | No DOM access. Terminates when idle. **State must live in `chrome.storage` only.** |
| Content Script              | TypeScript + Shadow-DOM UI | Page scraping (URL → JSON-LD → DOM), inject Scout Result panel, send data to background | Isolated world. No access to page-JS variables. CSP restrictions.                  |
| Popup                       | React 19 + shadcn/ui       | Quick Scout trigger, Genome summary, recent analyses, onboarding entry                  | Closes on blur. Lightweight. No persistent state.                                  |
| Options Page                | React 19 + shadcn/ui       | Genome editor, privacy controls, export/wipe, Deep Check toggle, compliance info        | Full-page SPA. Prefer `chrome.storage` over `localStorage`.                        |
| Offscreen Document          | ONNX Runtime Web / WebNN   | Heavy ML: embedding extraction, score computation, optional LLM deobfuscation           | No `chrome.storage`/`tabs` APIs. Only `chrome.runtime` messaging. Invisible DOM.   |

## Message-passing flow (Quick Scout)

| #   | From           | To             | Type            | Payload                                                                                                                                                                   |
| --- | -------------- | -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User           | Popup          | CLICK           | Trigger Scout on active tab                                                                                                                                               |
| 2   | Popup          | Background     | SCRAPE_REQUEST  | `{ tabId, action: 'analyzeProduct' }`                                                                                                                                     |
| 3   | Background     | Content Script | EXECUTE_SCRAPER | inject scraper via `scripting.executeScript`                                                                                                                              |
| 4   | Content Script | Background     | PRODUCT_DATA    | `{ asin, title, price, rating, reviewCount, jsonLd, url }`                                                                                                                |
| 5   | Background     | Offscreen      | COMPUTE_SCORES  | `{ productData, genomeVector }`                                                                                                                                           |
| 6   | Offscreen      | Background     | SCORE_RESULT    | `{ trueValue: 78, personalFit: 82, breakdown: {…} }`                                                                                                                      |
| 7   | Background     | Content Script | RENDER_PANEL    | runtime.sendMessage to the same static content script (matches https://_.amazon.com/_); content script renders Shadow-DOM panel with score data + alternative suggestions |
| 8   | User           | Content Script | FEEDBACK        | `{ action: 'notInterested' \| 'saved' \| 'purchased', asin }`                                                                                                             |
| 9   | Content Script | Background     | UPDATE_GENOME   | feedback vector for gradient update                                                                                                                                       |
| 10  | Background     | Popup          | SYNC_STATE      | updated Genome + recent analyses list                                                                                                                                     |

## Security & encryption model

| Component            | Mechanism                                                 | Standard                     | Rationale                                                       |
| -------------------- | --------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| Key Derivation       | PBKDF2-SHA-256, 600K iter                                 | NIST SP 800-132 / OWASP 2023 | Slows brute-force; 600K is OWASP recommendation                 |
| Symmetric Encryption | AES-GCM-256                                               | NIST FIPS 197                | Authenticated encryption prevents tampering                     |
| Random IV            | `crypto.getRandomValues(12)`                              | Web Crypto                   | 96-bit nonce; never reuse with same key                         |
| Key Storage          | Memory only — never persisted                             | Zero-trust local             | Disk-stored keys defeat the purpose; password-manager pattern   |
| Data Storage         | `chrome.storage.local` + IndexedDB                        | Chrome Extension APIs        | Sandboxed per-extension; IndexedDB for structured large objects |
| CSP                  | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` | Manifest V3                  | Required for ONNX WASM backend; no inline scripts               |

## TODO (filled in as P1.x lands)

- [ ] Concrete typed message schema in `lib/messaging/`
- [ ] Encrypted storage wrapper API in `lib/storage/`
- [ ] Offscreen lifecycle manager in `entrypoints/background.ts` + `lib/offscreen/`
- [ ] Diagram of execution path (mermaid)
      ckground.ts`+`lib/offscreen/`
- [ ] Diagram of execution path (mermaid)
