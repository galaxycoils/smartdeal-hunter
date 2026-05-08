import { ensureOffscreen } from '../lib/offscreen-manager';
import type {
  ScrapeRequest,
  ExecuteScraperRequest,
  ProductDataResponse,
  ComputeScoresRequest,
  ScoreResultResponse,
  RenderPanelMessage,
  UpdateGenomeRequest,
  EnrollAlertRequest,
  DisenrollAlertRequest,
  ComputeAuthenticityRequest,
} from '../lib/messaging/types';
import { calculateAuthenticityScore } from '../lib/review-authenticity';
import { appendAuditLog } from '../lib/audit-log';
import { loadGenome, onGenomeChange, saveGenome } from '../lib/genome';
import { deriveKey } from '../lib/crypto';
import { cacheProduct, getCachedProduct } from '../lib/cache';
import { toAttributeVector } from '../lib/scoring';
import { calculateFeedbackUpdate } from '../lib/feedback';
import { setItem, STORE_HISTORY_EVENTS, wipeAllData } from '../lib/storage';
import {
  enrollAlert,
  disenrollAlert,
  listEnrolledAlerts,
  checkAllAlerts,
  ALARM_NAME as PRICE_CHECK_ALARM,
} from '../lib/price-alerts';

const NOTIFICATION_PREFIX = 'sdh:price-alert:';

export default defineBackground(() => {
  console.log('[smartdeal-hunter] background ready', { id: browser.runtime.id });

  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === 'sdh:scheduled-wipe') {
      const stored = await chrome.storage.local.get('sdh:in-flight');
      if (typeof stored['sdh:in-flight'] === 'number') {
        await chrome.alarms.create('sdh:scheduled-wipe', { when: Date.now() + 30_000 });
        return;
      }
      await wipeAllData();
      return;
    }

    if (alarm.name === PRICE_CHECK_ALARM) {
      // SW-stateless: re-derive bootstrap key on every wake; never cache module-side.
      const salt = new Uint8Array(16);
      const key = await deriveKey('bootstrap-session-password', salt);
      await checkAllAlerts(key);
      return;
    }
  });

  chrome.notifications.onClicked.addListener(async (notificationId: string) => {
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
    const asin = notificationId.slice(NOTIFICATION_PREFIX.length);

    const salt = new Uint8Array(16);
    const key = await deriveKey('bootstrap-session-password', salt);
    const cached = await getCachedProduct(asin, key);

    if (cached && cached.url) {
      const tabs = await browser.tabs.query({ url: cached.url });
      const match = tabs[0];
      if (match && match.id != null) {
        await browser.tabs.update(match.id, { active: true });
        if (match.windowId != null) {
          await chrome.windows.update(match.windowId, { focused: true });
        }
      }
      // If no matching tab: do NOT open a new one (invariant #3).
    }

    await chrome.notifications.clear(notificationId);
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

    if (
      message.type === 'ENROLL_ALERT' ||
      message.type === 'DISENROLL_ALERT' ||
      message.type === 'LIST_ENROLLED_ALERTS'
    ) {
      handleAlertMessage(message)
        .then((res) => sendResponse(res))
        .catch((err) => {
          console.error('[smartdeal-hunter] Alert handler failed', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message.type === 'COMPUTE_AUTHENTICITY') {
      const msg = message as ComputeAuthenticityRequest;
      handleComputeAuthenticity(msg.payload.asin, msg.payload.samples)
        .then((res) => sendResponse(res))
        .catch((err) => {
          console.error('[smartdeal-hunter] Authenticity handler failed', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message.type === 'SCRAPE_REQUEST') {
      const msg = message as ScrapeRequest;
      // Handle the orchestration async
      handleScrapeRequest(msg.tabId)
        .then((payload) => {
          sendResponse({ success: true, payload });
        })
        .catch((err) => {
          console.error('[smartdeal-hunter] Orchestration failed', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep channel open
    }
  });

  async function handleAlertMessage(
    message: EnrollAlertRequest | DisenrollAlertRequest | { type: 'LIST_ENROLLED_ALERTS' },
  ): Promise<unknown> {
    const salt = new Uint8Array(16);
    const key = await deriveKey('bootstrap-session-password', salt);

    if (message.type === 'ENROLL_ALERT') {
      await enrollAlert(message.payload.asin, key);
      return { success: true };
    }
    if (message.type === 'DISENROLL_ALERT') {
      await disenrollAlert(message.payload.asin, key);
      return { success: true };
    }
    const asins = await listEnrolledAlerts(key);
    return { type: 'ENROLLED_ALERTS', payload: { asins } };
  }

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

  async function handleComputeAuthenticity(
    asin: string,
    samples: import('../lib/types').ReviewSample[],
  ): Promise<{ type: 'AUTHENTICITY_RESULT'; payload: import('../lib/types').AuthenticityResult }> {
    const result = calculateAuthenticityScore(samples);
    const { optInAuditLog = false } = await chrome.storage.local.get({ optInAuditLog: false });
    if (optInAuditLog) {
      await appendAuditLog({
        kind: 'review-authenticity-evaluated',
        summary: `asin=${asin} n=${result.sampleCount} score=${result.score}`,
      });
    }
    return { type: 'AUTHENTICITY_RESULT', payload: result };
  }

  async function handleScrapeRequest(
    tabId?: number,
  ): Promise<{ asin: string; trueValue: number; personalFit: number }> {
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

    return {
      asin: productData.asin,
      trueValue: scoreRes.payload.trueValue,
      personalFit: scoreRes.payload.personalFit,
    };
  }
});
