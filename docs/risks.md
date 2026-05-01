# Risk Register

Mirrors the `Risk Register` sheet of the spec. Keep in sync. Reassess at each phase boundary.

| ID  | Cat    | Description                                          | Prob | Impact | Score | Mitigation                                                                                                           | Owner     |
| --- | ------ | ---------------------------------------------------- | ---- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| R1  | Tech   | Amazon DOM changes break scraper                     | M    | H      | 2     | Dual-strategy: JSON-LD primary + DOM fallback. Weekly automated test on top-100 ASINs.                               | QA        |
| R2  | Tech   | Bundle > 2.5 MB                                      | M    | M      | 2     | Quantized (int8) ONNX. Dynamic-import ML modules. Tree-shake shadcn/ui. Monitor with `vite-bundle-analyzer`.         | Tech Lead |
| R3  | Tech   | WebNN/ONNX runtime incompatible with user's Chrome   | L    | H      | 1     | Graceful degrade: WebNN → WASM → pure-JS heuristics. Min Chrome 116.                                                 | ML        |
| R4  | Tech   | SW terminates during long ML inference               | L    | H      | 1     | All heavy compute in offscreen doc (persistent). SW only orchestrates.                                               | Backend   |
| R5  | Legal  | CWS rejects submission                               | M    | H      | 2     | Pre-submission policy audit. Privacy policy URL, Limited Use cert, single-purpose explanation. Reviewer notes ready. | PO        |
| R6  | Legal  | Amazon interprets scraping as TOS violation          | L    | H      | 1     | Read publicly visible DOM/JSON-LD only. No bulk downloading. Rate-limit internal requests.                           | Tech Lead |
| R7  | Legal  | FTC/Amazon affiliate enforcement                     | L    | H      | 1     | MVP: zero affiliate links. Future monetization → independent legal review + `#ad`.                                   | PO        |
| R8  | Market | User distrust of AI extensions (Incogni 2025 report) | M    | M      | 2     | Differentiate via transparency: open-source Genome logic, local-only badge, third-party audit. Minimum permissions.  | PO        |
| R9  | Market | Competitor releases similar feature in Amazon app    | M    | M      | 2     | Differentiate: ethical bundle optimizer, repairability scores, local privacy. Build community.                       | PO        |
| R10 | Tech   | React 19 concurrent features cause extension issues  | L    | M      | 1     | Test in all contexts. Use stable `createRoot`. Avoid experimental APIs. React 18 fallback ready.                     | Frontend  |
| R11 | Tech   | PBKDF2 too slow on low-end Chromebooks               | L    | M      | 1     | Benchmark on low-end. If > 2 s, reduce iterations to 100K + UI progress. Cache derived key in memory.                | Backend   |
| R12 | Tech   | Genome feedback loop overfits                        | M    | M      | 2     | Conservative LR (α ≤ 0.05). Cap single-update magnitude. Time-decay weighting.                                       | ML        |

**Summary:** 0 high (≥ 6), 0 medium (4–5), 12 low (≤ 3). Reassess if any score climbs.
