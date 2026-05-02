/**
 * Offscreen document script for SmartDeal Hunter.
 * Handles computation-heavy tasks like ML inference.
 */

console.log('[smartdeal-hunter] offscreen ready');

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages targeted at the offscreen document
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_ANALYSIS') {
    console.log('[smartdeal-hunter] performing analysis in offscreen...', message.payload);

    // Scaffold: simulate work
    setTimeout(() => {
      sendResponse({
        success: true,
        payload: {
          asin: message.payload.asin,
          score: Math.random(), // Placeholder for P1.7/P1.8
          status: 'COMPLETED',
        },
      });
    }, 500);

    return true; // Async response
  }
});
