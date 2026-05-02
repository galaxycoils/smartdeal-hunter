import { scrapeProduct } from '../lib/scraper';
import type { ContentMessage, ProductDataResponse } from '../lib/messaging/types';
import ReactDOM from 'react-dom/client';
import React from 'react';
import { ScoutPanel } from '../components/ui/ScoutPanel';

let uiInstance: { remove: () => void; mount: () => void } | null = null;

export default defineContentScript({
  matches: ['https://*.amazon.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    browser.runtime.onMessage.addListener((msg: ContentMessage, _sender, sendResponse) => {
      if (msg.type === 'EXECUTE_SCRAPER') {
        const payload = scrapeProduct(location.href, document);
        const response: ProductDataResponse = { type: 'PRODUCT_DATA', payload };
        sendResponse(response);
        return true;
      } else if (msg.type === 'RENDER_PANEL') {
        const payload = msg.payload;

        // Remove existing UI if present
        if (uiInstance) {
          uiInstance.remove();
        }

        // Mount new UI using WXT's shadow root API
        createShadowRootUi(ctx, {
          name: 'smartdeal-scout-panel',
          position: 'inline',
          append: 'first',
          onMount: (container) => {
            const root = ReactDOM.createRoot(container);
            root.render(
              React.createElement(ScoutPanel, {
                asin: payload.asin,
                trueValue: Math.round(payload.trueValue),
                personalFit: Math.round(payload.personalFit),
                onClose: () => uiInstance?.remove(),
                onFeedback: (type) => console.log('Feedback:', type),
              }),
            );
            return root;
          },
          onRemove: (root) => {
            root?.unmount();
          },
        }).then((ui) => {
          uiInstance = ui as unknown as { remove: () => void; mount: () => void };
          uiInstance.mount();
          sendResponse({ success: true });
        });

        return true; // async response
      }
    });
  },
});
