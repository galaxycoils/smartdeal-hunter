import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBrowser } = vi.hoisted(() => ({
  mockBrowser: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
      sendMessage: vi.fn(),
      id: 'test-id',
    },
  },
}));

vi.mock('wxt/browser', () => ({
  browser: mockBrowser,
}));

// Mock the manager to avoid side effects
vi.mock('../../lib/offscreen-manager', () => ({
  ensureOffscreen: vi.fn().mockResolvedValue(undefined),
  closeOffscreen: vi.fn().mockResolvedValue(undefined),
}));

import background from '../../entrypoints/background';

describe('Background Service Worker', () => {
  let messageListener: (...args: unknown[]) => unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate WXT background initialization
    background.main();
    messageListener = mockBrowser.runtime.onMessage.addListener.mock.calls[0][0];
  });

  it('should handle START_ANALYSIS message', async () => {
    const sendResponse = vi.fn();
    const message = { type: 'START_ANALYSIS', payload: { asin: 'B00001' } };

    mockBrowser.runtime.sendMessage.mockResolvedValue({ success: true });

    const result = messageListener(message, {}, sendResponse);

    expect(result).toBe(true); // Indicates async response

    // Wait for internal promises
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith({
      target: 'offscreen',
      ...message,
    });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});
