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
    },
  },
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
}));

vi.mock('../../lib/cache', () => ({
  cacheProduct: vi.fn().mockResolvedValue(undefined),
  getCachedProduct: vi.fn(),
}));

vi.mock('../../lib/scoring', () => ({
  toAttributeVector: vi.fn().mockReturnValue({ unit_price: 0.5 }),
}));

vi.mock('../../lib/feedback', () => ({
  calculateFeedbackUpdate: vi.fn().mockImplementation((g) => g),
}));

import background from '../../entrypoints/background';
import { loadGenome, saveGenome } from '../../lib/genome';
import { getCachedProduct, cacheProduct } from '../../lib/cache';
import { ensureOffscreen } from '../../lib/offscreen-manager';
import { calculateFeedbackUpdate } from '../../lib/feedback';

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

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('UPDATE_GENOME', () => {
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
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
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
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
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

  it('ignores unknown message types', () => {
    const sendResponse = vi.fn();
    const result = listener({ type: 'NOPE' }, {}, sendResponse);
    expect(result).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
