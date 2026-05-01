# Compliance Matrix

Mirrors the `Compliance Matrix` sheet of the spec. Keep in sync. Every shipped feature must be cross-checked against this file before PR merge.

## Chrome Web Store Developer Program Policies

| Policy                                                     | Implementation                                                                                                     | Verification                                                 | Priority |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------- |
| Limited Use: collect only data required for single purpose | Genome stored locally only; no remote transmission; scraped product data discarded after scoring unless user saves | Code audit + network proxy test (zero external calls)        | Critical |
| No sale/transfer of user data                              | No analytics SDKs, no tracking pixels, no data brokers. Amazon API only after explicit opt-in.                     | Dependency audit (`package.json` review) + network test      | Critical |
| Prominent Disclosure for non-obvious data collection       | Privacy Notice in onboarding + Options. "What we collect" summary in popup footer.                                 | UX review: disclosure visible within 1 click                 | High     |
| Encrypt sensitive user data                                | AES-GCM-256 for Genome and saved products. HTTPS for any external API (Deep Check only).                           | Pen-test: extract storage files, verify ciphertext           | High     |
| Minimum functionality / no broken features                 | All UI buttons wired to real functions. No placeholder screens at release. Graceful error handling.                | Manual QA + Playwright suite                                 | High     |
| No misleading or unexpected behavior                       | On-demand only. No hidden auto-scraping.                                                                           | Code review + dynamic analysis (background activity monitor) | High     |
| Accurate metadata and privacy labels                       | CWS listing: privacy policy URL, data-usage cert, single-purpose description, screenshot accuracy                  | Pre-submission checklist                                     | Medium   |
| Affiliate disclosure                                       | **MVP injects no affiliate links.** Future monetization → explicit `#ad` / "Paid link".                            | Legal review of any monetization feature                     | Medium   |

## Amazon & FTC Compliance

| Rule                            | Requirement                                                   | Implementation                                                              | Risk if Violated                                                |
| ------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| No affiliate-link injection     | Extension must never modify Amazon URLs to add affiliate tags | Scraper extracts data only; all links remain unmodified                     | Amazon Associates termination; FTC fine up to $51,744/violation |
| No auto-navigation              | User must explicitly trigger every action                     | All analysis explicit click; no redirects; no auto-cart                     | CWS removal; user-trust erosion                                 |
| No bulk scraping                | PA-API for displaying products to users only                  | Deep Check = single product per user action; rate-limit enforced            | API key revocation; legal action                                |
| Accurate pricing (if displayed) | Prices from Amazon API, not cached/manual                     | Deep Check fetches live; local analysis does NOT display price (only score) | Amazon TOS violation                                            |
| FTC Endorsement Disclosure      | Material connection clearly + conspicuously                   | No endorsements in MVP. Future paid recs require `#ad`                      | FTC civil penalty; CWS removal                                  |
| Data Minimization (GDPR/CCPA)   | Only necessary data; deletion mechanism                       | Genome 8–12 dims max. One-click secure wipe. Export provided.               | Regulatory fine; class-action risk                              |

## Privacy Controls Implementation Checklist

| Control                           | Location                   | Status (Bootstrap) | User Action                                      |
| --------------------------------- | -------------------------- | ------------------ | ------------------------------------------------ |
| View all stored data              | Options > Privacy          | Required           | "View Data" → JSON preview                       |
| Export to JSON                    | Options > Privacy          | Required           | "Export" → `genome.json` download                |
| Secure data wipe                  | Options > Privacy          | Required           | "Wipe All Data" → confirm → overwrite + delete   |
| Disable Deep Check / external API | Options > Deep Check       | Required           | toggle off → all external calls blocked          |
| Disable product caching           | Options > Privacy          | Recommended        | toggle off → no product retention beyond session |
| Disable ML offscreen doc          | Options > Advanced         | Optional           | toggle off → fall back to lightweight heuristics |
| Onboarding consent                | First-run wizard           | Required           | Click "I understand" before proceeding           |
| Privacy policy link               | Popup footer + CWS listing | Required           | Always available                                 |

## TODO

- [ ] Privacy policy URL (host before CWS submission, P1.15).
- [ ] Penetration-test report for storage encryption (before P1.15).
- [ ] Reviewer notes draft addressing common CWS rejection reasons (P1.15).
