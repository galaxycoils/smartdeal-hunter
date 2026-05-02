import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentMessage, ProductDataResponse } from '../../lib/messaging/types';
import { scrapeProduct } from '../../lib/scraper';

const { mockBrowser } = vi.hoisted(() => ({
  mockBrowser: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
    },
  },
}));

vi.mock('wxt/browser', () => ({
  browser: mockBrowser,
}));

vi.mock('../../lib/scraper', () => ({
  scrapeProduct: vi.fn(),
}));

import contentScript from '../../entrypoints/content';

describe('Content Script', () => {
  let messageListener: (
    msg: ContentMessage,
    sender: unknown,
    sendResponse: (response: ProductDataResponse) => void,
  ) => boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    contentScript.main({} as never);
    messageListener = mockBrowser.runtime.onMessage.addListener.mock.calls[0][0];
  });

  it('ignores non-EXECUTE_SCRAPER messages', () => {
    // @ts-expect-error Intentionally invalid type
    const result = messageListener({ type: 'OTHER' }, {}, vi.fn());
    expect(result).toBeUndefined();
  });

  it('calls scraper with location.href and document on EXECUTE_SCRAPER', () => {
    const sendResponse = vi.fn();
    const mockProductData = {
      asin: 'B0001',
      title: 'Test',
      source: 'url' as const,
      url: 'test',
      price: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      imageUrl: null,
      jsonLd: null,
      scrapedAt: 1,
      listPrice: null,
      unitPrice: null,
      quantity: null,
    };

    vi.mocked(scrapeProduct).mockReturnValue(mockProductData);

    const result = messageListener({ type: 'EXECUTE_SCRAPER' }, {}, sendResponse);

    expect(scrapeProduct).toHaveBeenCalledWith(location.href, document);
    expect(sendResponse).toHaveBeenCalledWith({
      type: 'PRODUCT_DATA',
      payload: mockProductData,
    });
    expect(result).toBe(true);
  });
});
