import { scrapeProduct } from '../lib/scraper';
import type { ContentMessage, ProductDataResponse } from '../lib/messaging/types';

export default defineContentScript({
  matches: ['https://*.amazon.com/*'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((msg: ContentMessage, _sender, sendResponse) => {
      if (msg.type !== 'EXECUTE_SCRAPER') return;
      const payload = scrapeProduct(location.href, document);
      const response: ProductDataResponse = { type: 'PRODUCT_DATA', payload };
      sendResponse(response);
      return true;
    });
  },
});
