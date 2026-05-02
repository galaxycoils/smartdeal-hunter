/**
 * Offscreen document script for SmartDeal Hunter.
 * Handles computation-heavy tasks like ML inference.
 */
import { calculateTrueValue, calculatePersonalFit } from '../../lib/scoring';
import type { OffscreenMessage } from '../../lib/messaging/types';

console.log('[smartdeal-hunter] offscreen ready');

browser.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  // Only handle messages targeted at the offscreen document
  // @ts-expect-error - target is not on all message types but we check it
  if (message.target !== 'offscreen') return;

  if (message.type === 'COMPUTE_SCORES') {
    const { productData, genome } = message.payload;

    try {
      const trueValue = calculateTrueValue(productData);
      const personalFit = calculatePersonalFit(genome, productData);

      sendResponse({
        type: 'SCORE_RESULT',
        payload: {
          trueValue,
          personalFit,
          breakdown: {
            rating: calculateTrueValue(productData), // Example breakdown
          },
        },
      });
    } catch (err) {
      sendResponse({
        type: 'SCORE_ERROR',
        error: err instanceof Error ? err.message : 'Unknown scoring error',
      });
    }

    return true; // Async response
  }
});
