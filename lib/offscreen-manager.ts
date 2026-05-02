import { browser } from 'wxt/browser';

/**
 * Manager for the Chrome Offscreen Document lifecycle.
 * Needed for features not available in service workers (WASM, WebGPU, DOM).
 */

const OFFSCREEN_PATH = '/offscreen.html' as const;

/**
 * Ensures the offscreen document is open.
 */
export async function ensureOffscreen(): Promise<void> {
  const existingContexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await browser.offscreen.createDocument({
    url: browser.runtime.getURL(OFFSCREEN_PATH),
    reasons: [browser.offscreen.Reason.LOCAL_STORAGE],
    justification: 'Perform local ML inference using ONNX Runtime (WASM/WebGPU).',
  });
}

/**
 * Closes the offscreen document.
 */
export async function closeOffscreen(): Promise<void> {
  const existingContexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    await browser.offscreen.closeDocument();
  }
}
