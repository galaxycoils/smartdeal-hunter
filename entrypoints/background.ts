import { ensureOffscreen } from '../lib/offscreen-manager';
import type {
  ScrapeRequest,
  ExecuteScraperRequest,
  ProductDataResponse,
  ComputeScoresRequest,
  ScoreResultResponse,
  RenderPanelMessage,
} from '../lib/messaging/types';
import { loadGenome } from '../lib/genome';
import { deriveKey } from '../lib/crypto';

export default defineBackground(() => {
  console.log('[smartdeal-hunter] background ready', { id: browser.runtime.id });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Legacy support for START_ANALYSIS or basic offscreen proxying
    if (message.type === 'START_ANALYSIS' || message.type === 'COMPUTE_SCORES') {
      ensureOffscreen().then(() => {
        browser.runtime.sendMessage({ target: 'offscreen', ...message }).then(sendResponse);
      });
      return true;
    }

    if (message.type === 'SCRAPE_REQUEST') {
      const msg = message as ScrapeRequest;
      // Handle the orchestration async
      handleScrapeRequest(msg.tabId)
        .then((success) => {
          sendResponse({ success });
        })
        .catch((err) => {
          console.error('[smartdeal-hunter] Orchestration failed', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep channel open
    }
  });

  async function handleScrapeRequest(tabId?: number): Promise<boolean> {
    let targetTabId = tabId;
    if (!targetTabId) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0 || !tabs[0].id) {
        throw new Error('No active tab found');
      }
      targetTabId = tabs[0].id;
    }

    // 1. Trigger Scraper
    const executeReq: ExecuteScraperRequest = { type: 'EXECUTE_SCRAPER' };
    const scraperRes = await browser.tabs.sendMessage<ExecuteScraperRequest, ProductDataResponse>(
      targetTabId,
      executeReq,
    );

    if (!scraperRes || scraperRes.type !== 'PRODUCT_DATA' || !scraperRes.payload) {
      throw new Error('Failed to scrape product data');
    }

    const productData = scraperRes.payload;
    if (!productData.asin) {
      throw new Error('No ASIN found for product');
    }

    // 2. Load Genome (using session key strategy for MVP)
    const salt = new Uint8Array(16); // Same all-zeros salt as popup App.tsx
    const key = await deriveKey('bootstrap-session-password', salt);
    const genome = await loadGenome(key);

    if (!genome.isOnboarded) {
      throw new Error('User not onboarded');
    }

    // 3. Compute Scores
    await ensureOffscreen();
    const computeReq: ComputeScoresRequest = {
      type: 'COMPUTE_SCORES',
      target: 'offscreen',
      payload: { productData, genome },
    };

    const scoreRes = await browser.runtime.sendMessage<ComputeScoresRequest, ScoreResultResponse>(
      computeReq,
    );

    if (!scoreRes || scoreRes.type !== 'SCORE_RESULT') {
      throw new Error('Failed to compute scores');
    }

    // 4. Render Panel
    const renderReq: RenderPanelMessage = {
      type: 'RENDER_PANEL',
      payload: {
        asin: productData.asin,
        trueValue: scoreRes.payload.trueValue,
        personalFit: scoreRes.payload.personalFit,
      },
    };

    await browser.tabs.sendMessage(targetTabId, renderReq);

    return true;
  }
});
