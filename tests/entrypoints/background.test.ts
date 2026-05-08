import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBrowser } = vi.hoisted(() => ({
  mockBrowser: {
    runtime: {
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(),
      id: 'test-id',
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
    },
  },
}));

const { genomeChangeCallbacks } = vi.hoisted(() => ({
  genomeChangeCallbacks: [] as Array<(revision: number) => void>,
}));

vi.mock('wxt/browser', () => ({ browser: mockBrowser }));

vi.mock('../../lib/offscreen-manager', () => ({
  ensureOffscreen: vi.fn().mockResolvedValue(undefined),
  closeOffscreen: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/crypto', () => ({
  deriveKey: vi.fn().mockResolvedValue({ type: 'mock-key' } as unknown as CryptoKey),
}));

vi.mock('../../lib/genome', () => ({
  loadGenome: vi.fn(),
  saveGenome: vi.fn().mockResolvedValue(undefined),
  onGenomeChange: vi.fn((callback: (revision: number) => void) => {
    genomeChangeCallbacks.push(callback);
    return vi.fn();
  }),
}));

vi.mock('../../lib/cache', () => ({
  cacheProduct: vi.fn().mockResolvedValue(undefined),
  getCachedProduct: vi.fn(),
}));

vi.mock('../../lib/storage', () => ({
  setItem: vi.fn().mockResolvedValue(undefined),
  STORE_HISTORY_EVENTS: 'history_events',
  wipeAllData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/scoring', () => ({
  toAttributeVector: vi.fn().mockReturnValue({ unit_price: 0.5 }),
}));

vi.mock('../../lib/feedback', () => ({
  calculateFeedbackUpdate: vi.fn().mockImplementation((g) => g),
}));

vi.mock('../../lib/price-alerts', () => ({
  enrollAlert: vi.fn().mockResolvedValue(undefined),
  disenrollAlert: vi.fn().mockResolvedValue(undefined),
  listEnrolledAlerts: vi.fn().mockResolvedValue([]),
  checkAllAlerts: vi.fn().mockResolvedValue(undefined),
  ALARM_NAME: 'sdh:price-check',
}));

vi.mock('../../lib/review-authenticity', () => ({
  calculateAuthenticityScore: vi.fn().mockReturnValue({
    score: 72,
    sampleCount: 10,
    suspiciousIndices: [],
    reasons: {},
  }),
}));

vi.mock('../../lib/audit-log', () => ({
  appendAuditLog: vi.fn().mockResolvedValue(undefined),
  getAuditLogEntries: vi.fn().mockResolvedValue([]),
  AUDIT_LOG_KEY: 'sdh:audit-log',
}));

import background from '../../entrypoints/background';
import { loadGenome, saveGenome } from '../../lib/genome';
import { getCachedProduct, cacheProduct } from '../../lib/cache';
import { ensureOffscreen } from '../../lib/offscreen-manager';
import { calculateFeedbackUpdate } from '../../lib/feedback';
import { setItem, STORE_HISTORY_EVENTS, wipeAllData } from '../../lib/storage';
import {
  enrollAlert,
  disenrollAlert,
  listEnrolledAlerts,
  checkAllAlerts,
} from '../../lib/price-alerts';
import { calculateAuthenticityScore } from '../../lib/review-authenticity';
import { appendAuditLog } from '../../lib/audit-log';

type Listener = (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown;

const flush = () => new Promise((r) => setTimeout(r, 0));

const onboardedGenome = { isOnboarded: true, dimensions: {}, bandit: {} } as never;
const unboardedGenome = { isOnboarded: false } as never;

const productData = {
  asin: 'B00ABC',
  title: 't',
  source: 'url',
  url: '',
  price: 10,
  currency: 'USD',
  rating: 4,
  reviewCount: 5,
  imageUrl: null,
  jsonLd: null,
  scrapedAt: 1,
  listPrice: null,
  unitPrice: null,
  quantity: null,
};

describe('Background Service Worker', () => {
  let listener: Listener;
  let alarmListener: ((alarm: chrome.alarms.Alarm) => Promise<void>) | undefined;
  let notificationClickListener: ((notificationId: string) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    genomeChangeCallbacks.length = 0;
    alarmListener = undefined;
    notificationClickListener = undefined;
    vi.spyOn(chrome.alarms.onAlarm, 'addListener').mockImplementation((callback) => {
      alarmListener = callback as (alarm: chrome.alarms.Alarm) => Promise<void>;
    });
    vi.spyOn(chrome.notifications.onClicked, 'addListener').mockImplementation((callback) => {
      notificationClickListener = callback as (id: string) => Promise<void>;
    });
    background.main();
    listener = mockBrowser.runtime.onMessage.addListener.mock.calls[0][0] as Listener;
  });

  describe('START_ANALYSIS / COMPUTE_SCORES proxy', () => {
    it('proxies START_ANALYSIS to offscreen', async () => {
      const sendResponse = vi.fn();
      mockBrowser.runtime.sendMessage.mockResolvedValue({ success: true });
      const result = listener({ type: 'START_ANALYSIS', payload: { asin: 'X' } }, {}, sendResponse);
      expect(result).toBe(true);
      await flush();
      await flush();
      expect(ensureOffscreen).toHaveBeenCalled();
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'offscreen', type: 'START_ANALYSIS' }),
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('proxies COMPUTE_SCORES to offscreen', async () => {
      const sendResponse = vi.fn();
      mockBrowser.runtime.sendMessage.mockResolvedValue({ ok: 1 });
      listener({ type: 'COMPUTE_SCORES' }, {}, sendResponse);
      await flush();
      await flush();
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'offscreen', type: 'COMPUTE_SCORES' }),
      );
    });
  });

  describe('scheduled wipe alarm', () => {
    it('ignores unrelated alarms', async () => {
      await alarmListener?.({ name: 'other-alarm' });
      expect(wipeAllData).not.toHaveBeenCalled();
    });

    it('wipes all data when the scheduled wipe alarm fires without in-flight work', async () => {
      await alarmListener?.({ name: 'sdh:scheduled-wipe' });
      expect(wipeAllData).toHaveBeenCalled();
    });

    it('defers scheduled wipe when in-flight work is present', async () => {
      const createSpy = vi.spyOn(chrome.alarms, 'create');
      await chrome.storage.local.set({ 'sdh:in-flight': Date.now() });
      await alarmListener?.({ name: 'sdh:scheduled-wipe' });

      expect(wipeAllData).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledWith('sdh:scheduled-wipe', { when: expect.any(Number) });
    });
  });

  describe('price-check alarm', () => {
    it('runs checkAllAlerts when sdh:price-check fires', async () => {
      await alarmListener?.({ name: 'sdh:price-check' } as chrome.alarms.Alarm);
      expect(checkAllAlerts).toHaveBeenCalledTimes(1);
    });

    it('does not run checkAllAlerts for unrelated alarms', async () => {
      await alarmListener?.({ name: 'other' } as chrome.alarms.Alarm);
      expect(checkAllAlerts).not.toHaveBeenCalled();
    });
  });

  describe('alert message handlers', () => {
    it('handles ENROLL_ALERT', async () => {
      const sendResponse = vi.fn();
      listener({ type: 'ENROLL_ALERT', payload: { asin: 'B07A' } }, {}, sendResponse);
      await flush();
      await flush();
      expect(enrollAlert).toHaveBeenCalledWith('B07A', expect.anything());
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('handles DISENROLL_ALERT', async () => {
      const sendResponse = vi.fn();
      listener({ type: 'DISENROLL_ALERT', payload: { asin: 'B07A' } }, {}, sendResponse);
      await flush();
      await flush();
      expect(disenrollAlert).toHaveBeenCalledWith('B07A', expect.anything());
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('handles LIST_ENROLLED_ALERTS', async () => {
      vi.mocked(listEnrolledAlerts).mockResolvedValue(['B07A', 'B07B']);
      const sendResponse = vi.fn();
      listener({ type: 'LIST_ENROLLED_ALERTS' }, {}, sendResponse);
      await flush();
      await flush();
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'ENROLLED_ALERTS',
        payload: { asins: ['B07A', 'B07B'] },
      });
    });
  });

  describe('notifications.onClicked', () => {
    it('focuses existing tab when cached product url matches', async () => {
      vi.mocked(getCachedProduct).mockResolvedValue({
        ...productData,
        url: 'https://www.amazon.com/dp/B07A',
      } as never);
      mockBrowser.tabs.query.mockResolvedValue([{ id: 42, windowId: 7 }]);
      const winUpdate = vi.spyOn(chrome.windows, 'update').mockResolvedValue({} as never);
      const notifClear = vi.spyOn(chrome.notifications, 'clear').mockResolvedValue(true);

      await notificationClickListener?.('sdh:price-alert:B07A');

      expect(mockBrowser.tabs.update).toHaveBeenCalledWith(42, { active: true });
      expect(winUpdate).toHaveBeenCalledWith(7, { focused: true });
      expect(notifClear).toHaveBeenCalledWith('sdh:price-alert:B07A');
    });

    it('does NOT open new tab when no matching tab exists (invariant #3)', async () => {
      vi.mocked(getCachedProduct).mockResolvedValue({
        ...productData,
        url: 'https://www.amazon.com/dp/B07A',
      } as never);
      mockBrowser.tabs.query.mockResolvedValue([]);
      const notifClear = vi.spyOn(chrome.notifications, 'clear').mockResolvedValue(true);

      await notificationClickListener?.('sdh:price-alert:B07A');

      expect(mockBrowser.tabs.create).not.toHaveBeenCalled();
      expect(mockBrowser.tabs.update).not.toHaveBeenCalled();
      expect(notifClear).toHaveBeenCalled();
    });

    it('no-ops on cache miss', async () => {
      vi.mocked(getCachedProduct).mockResolvedValue(undefined);
      const notifClear = vi.spyOn(chrome.notifications, 'clear').mockResolvedValue(true);

      await notificationClickListener?.('sdh:price-alert:B07A');

      expect(mockBrowser.tabs.create).not.toHaveBeenCalled();
      expect(mockBrowser.tabs.update).not.toHaveBeenCalled();
      expect(notifClear).toHaveBeenCalled();
    });

    it('ignores notifications without sdh:price-alert: prefix', async () => {
      await notificationClickListener?.('other-id');
      expect(mockBrowser.tabs.update).not.toHaveBeenCalled();
    });
  });

  describe('UPDATE_GENOME', () => {
    it('subscribes to genome revisions and reloads the genome when they change', async () => {
      vi.mocked(loadGenome).mockResolvedValue(onboardedGenome);
      await flush();

      const callback = genomeChangeCallbacks[0];
      expect(callback).toBeTypeOf('function');

      callback(2);
      await flush();

      expect(loadGenome).toHaveBeenCalled();
    });

    it('updates genome and saves on cached product + onboarded user', async () => {
      vi.mocked(getCachedProduct).mockResolvedValue(productData as never);
      vi.mocked(loadGenome).mockResolvedValue(onboardedGenome);
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_GENOME', payload: { asin: 'B00ABC', feedbackType: 'saved' } },
        {},
        sendResponse,
      );
      await flush();
      await flush();
      await flush();

      expect(calculateFeedbackUpdate).toHaveBeenCalled();
      expect(saveGenome).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('returns error when product not in cache', async () => {
      vi.mocked(getCachedProduct).mockResolvedValue(undefined);
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_GENOME', payload: { asin: 'B00X', feedbackType: 'saved' } },
        {},
        sendResponse,
      );
      await flush();
      await flush();
      await flush();

      expect(saveGenome).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Product not found in cache' }),
      );
    });

    it('returns error when user not onboarded', async () => {
      vi.mocked(getCachedProduct).mockResolvedValue(productData as never);
      vi.mocked(loadGenome).mockResolvedValue(unboardedGenome);
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_GENOME', payload: { asin: 'B00X', feedbackType: 'purchased' } },
        {},
        sendResponse,
      );
      await flush();
      await flush();
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'User not onboarded' }),
      );
    });
  });

  describe('SCRAPE_REQUEST', () => {
    function setupHappyPath() {
      mockBrowser.tabs.query.mockResolvedValue([{ id: 7 }]);
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        type: 'PRODUCT_DATA',
        payload: productData as never,
      });
      vi.mocked(loadGenome).mockResolvedValue(onboardedGenome);
      mockBrowser.runtime.sendMessage.mockResolvedValue({
        type: 'SCORE_RESULT',
        payload: { trueValue: 80, personalFit: 70 },
      });
    }

    it('runs full orchestration on happy path with provided tabId', async () => {
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        type: 'PRODUCT_DATA',
        payload: productData as never,
      });
      vi.mocked(loadGenome).mockResolvedValue(onboardedGenome);
      mockBrowser.runtime.sendMessage.mockResolvedValue({
        type: 'SCORE_RESULT',
        payload: { trueValue: 80, personalFit: 70 },
      });
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST', tabId: 42 }, {}, sendResponse);
      await flush();
      await flush();
      await flush();
      await flush();

      expect(mockBrowser.tabs.query).not.toHaveBeenCalled();
      expect(cacheProduct).toHaveBeenCalled();
      expect(ensureOffscreen).toHaveBeenCalled();
      expect(mockBrowser.tabs.sendMessage).toHaveBeenLastCalledWith(
        42,
        expect.objectContaining({ type: 'RENDER_PANEL' }),
      );
      expect(setItem).toHaveBeenCalledWith(
        STORE_HISTORY_EVENTS,
        expect.stringMatching(new RegExp(`:${productData.asin}$`)),
        expect.objectContaining({
          ts: expect.any(Number),
          asin: productData.asin,
          kind: 'analyze',
        }),
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        payload: expect.objectContaining({
          asin: productData.asin,
          trueValue: expect.any(Number),
          personalFit: expect.any(Number),
        }),
      });
    });

    it('queries active tab when tabId omitted', async () => {
      setupHappyPath();
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST' }, {}, sendResponse);
      await flush();
      await flush();
      await flush();
      await flush();

      expect(mockBrowser.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        payload: expect.objectContaining({
          asin: expect.any(String),
          trueValue: expect.any(Number),
          personalFit: expect.any(Number),
        }),
      });
    });

    it('errors when no active tab is found', async () => {
      mockBrowser.tabs.query.mockResolvedValue([]);
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST' }, {}, sendResponse);
      await flush();
      await flush();
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'No active tab found' }),
      );
    });

    it('errors when scraper returns wrong shape', async () => {
      mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
      mockBrowser.tabs.sendMessage.mockResolvedValue(null);
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST' }, {}, sendResponse);
      await flush();
      await flush();
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to scrape product data',
        }),
      );
    });

    it('errors when product has no ASIN', async () => {
      mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        type: 'PRODUCT_DATA',
        payload: { ...productData, asin: '' },
      });
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST' }, {}, sendResponse);
      await flush();
      await flush();
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'No ASIN found for product' }),
      );
    });

    it('errors when user not onboarded during scrape', async () => {
      mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        type: 'PRODUCT_DATA',
        payload: productData as never,
      });
      vi.mocked(loadGenome).mockResolvedValue(unboardedGenome);
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST' }, {}, sendResponse);
      await flush();
      await flush();
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'User not onboarded' }),
      );
    });

    it('errors when offscreen score result is malformed', async () => {
      mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        type: 'PRODUCT_DATA',
        payload: productData as never,
      });
      vi.mocked(loadGenome).mockResolvedValue(onboardedGenome);
      mockBrowser.runtime.sendMessage.mockResolvedValue({ type: 'BAD' });
      const sendResponse = vi.fn();

      listener({ type: 'SCRAPE_REQUEST' }, {}, sendResponse);
      await flush();
      await flush();
      await flush();
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Failed to compute scores' }),
      );
    });
  });

  describe('COMPUTE_AUTHENTICITY handler', () => {
    const syntheticSamples = Array.from({ length: 10 }, (_, i) => ({
      rating: 4,
      body: `Review body number ${i} with unique text to avoid similarity`,
      date: `January ${i + 1}, 2024`,
      verified: true,
      helpful: i,
    }));

    const baseRequest = {
      type: 'COMPUTE_AUTHENTICITY' as const,
      payload: { asin: 'B0TEST1234', samples: syntheticSamples },
    };

    it('returns AUTHENTICITY_RESULT with score (0-100) and correct sampleCount', async () => {
      const sendResponse = vi.fn();
      listener(baseRequest, {}, sendResponse);
      await flush();
      await flush();
      expect(calculateAuthenticityScore).toHaveBeenCalledWith(syntheticSamples);
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'AUTHENTICITY_RESULT',
        payload: expect.objectContaining({
          score: expect.any(Number),
          sampleCount: 10,
        }),
      });
      const { payload } = sendResponse.mock.calls[0][0] as { payload: { score: number } };
      expect(payload.score).toBeGreaterThanOrEqual(0);
      expect(payload.score).toBeLessThanOrEqual(100);
    });

    it('appends audit-log entry when optInAuditLog is true', async () => {
      await chrome.storage.local.set({ optInAuditLog: true });
      const sendResponse = vi.fn();
      listener(baseRequest, {}, sendResponse);
      await flush();
      await flush();
      expect(appendAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'review-authenticity-evaluated',
          summary: expect.stringMatching(/asin=B0TEST1234 n=\d+ score=\d+/),
        }),
      );
    });

    it('does NOT append audit-log entry when optInAuditLog is false', async () => {
      await chrome.storage.local.set({ optInAuditLog: false });
      vi.mocked(appendAuditLog).mockClear();
      const sendResponse = vi.fn();
      listener(baseRequest, {}, sendResponse);
      await flush();
      await flush();
      expect(appendAuditLog).not.toHaveBeenCalled();
    });

    it('produces identical responses on two calls (no module-level cache)', async () => {
      const sr1 = vi.fn();
      const sr2 = vi.fn();
      listener(baseRequest, {}, sr1);
      await flush();
      await flush();
      listener(baseRequest, {}, sr2);
      await flush();
      await flush();
      expect(sr1).toHaveBeenCalledTimes(1);
      expect(sr2).toHaveBeenCalledTimes(1);
      expect(sr1.mock.calls[0][0]).toEqual(sr2.mock.calls[0][0]);
    });
  });

  it('ignores unknown message types', () => {
    const sendResponse = vi.fn();
    const result = listener({ type: 'NOPE' }, {}, sendResponse);
    expect(result).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
