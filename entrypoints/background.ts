import { ensureOffscreen } from '../lib/offscreen-manager';

export default defineBackground(() => {
  console.log('[smartdeal-hunter] background ready', { id: browser.runtime.id });

  // Handle messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_ANALYSIS') {
      // Trigger offscreen inference
      ensureOffscreen().then(() => {
        // Forward to offscreen
        browser.runtime
          .sendMessage({
            target: 'offscreen',
            ...message,
          })
          .then(sendResponse);
      });
      return true; // Keep channel open for async response
    }
  });
});
