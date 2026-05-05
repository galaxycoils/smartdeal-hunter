import { ensureOffscreen } from '../lib/offscreen-manager';
import type {
  ScrapeRequest,
  ExecuteScraperRequest,
  ProductDataResponse,
  ComputeScoresRequest,
  ScoreResultResponse,
  RenderPanelMessage,
  UpdateGenomeRequest,
} from '../lib/messaging/types';
import { loadGenome, onGenomeChange, saveGenome } from '../lib/genome';
import { deriveKey } from '../lib/crypto';
import { cacheProduct, getCachedProduct } from '../lib/cache';
import { toAttributeVector } from '../lib/scoring';
import { calculateFeedbackUpdate } from '../lib/feedback';
import { setItem, STORE_HISTORY_EVENTS, wipeAllData } from '../lib/storage';

export default defineBackground(() => {
  console.log('[smartdeal-hunter] background ready', { id: browser.runtime.id });

  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== 'sdh:scheduled-wipe') {
      return;
    }

    const stored = await chrome.storage.local.get('sdh:in-flight');
    if (typeof stored['sdh:in-flight'] === 'number') {
      await chrome.alarms.create('sdh:scheduled-wipe', { when: Date.now() + 30_000 });
      return;
    }

    await wipeAllData();
  });

  void (async () => {
    const salt = new Uint8Array(16);
    const key = await deriveKey('bootstrap-session-password', salt);
    onGenomeChange(() => {
      void loadGenome(key);
    });
  })();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Legacy support for START_ANALYSIS or basic offscreen proxying
    if (message.type === 'START_ANALYSIS' || message.type === 'COMPUTE_SCORES') {
      ensureOffscreen().then(() => {
        browser.runtime.sendMessage({ target: 'offscreen', ...message }).then(sendResponse);
      });
      return true;
    }

    if (message.type === 'UPDATE_GENOME') {
      const msg = message as UpdateGenomeRequest;
      handleUpdateGenome(msg.payload.asin, msg.payload.feedbackType)
        .then((success) => {
          sendResponse({ success });
        })
        .catch((err) => {
          console.error('[smartdeal-hunter] Feedback update failed', err);
          sendResponse({ success: false, error: err.message });
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

  async function handleUpdateGenome(
    asin: string,
    feedbackType: 'not_interested' | 'saved' | 'purchased',
  ): Promise<boolean> {
    const salt = new Uint8Array(16);
    const key = await deriveKey('bootstrap-session-password', salt);

    const product = await getCachedProduct(asin, key);
    if (!product) {
      throw new Error('Product not found in cache');
    }

    const genome = await loadGenome(key);
    if (!genome.isOnboarded) {
      throw new Error('User not onboarded');
    }

    const productVector = toAttributeVector(product);
    const updatedGenome = calculateFeedbackUpdate(genome, productVector, feedbackType);
    await saveGenome(updatedGenome, key);
    return true;
  }

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

    // 2.5 Cache product
    await cacheProduct(productData, key);

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
    const ts = Date.now();
    await setItem(STORE_HISTORY_EVENTS, `${ts}:${productData.asin}`, {
      ts,
      asin: productData.asin,
      kind: 'analyze',
    });

    return true;
  }
});
