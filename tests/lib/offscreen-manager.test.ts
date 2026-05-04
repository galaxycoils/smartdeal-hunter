import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBrowser } = vi.hoisted(() => {
  return {
    mockBrowser: {
      runtime: {
        getContexts: vi.fn(),
        getURL: vi.fn((path) => `chrome-extension://id/${path}`),
        ContextType: {
          OFFSCREEN: 'OFFSCREEN',
        },
      },
      offscreen: {
        createDocument: vi.fn(),
        closeDocument: vi.fn(),
        Reason: {
          LOCAL_STORAGE: 'LOCAL_STORAGE',
        },
      },
    },
  };
});

// Mock wxt/browser module
vi.mock('wxt/browser', () => ({
  browser: mockBrowser,
}));

// Import implementation after mocking
import { ensureOffscreen, closeOffscreen } from '../../lib/offscreen-manager';

describe('Offscreen Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create document if it does not exist', async () => {
    mockBrowser.runtime.getContexts.mockResolvedValue([]);

    await ensureOffscreen();

    expect(mockBrowser.offscreen.createDocument).toHaveBeenCalled();
  });

  it('should not create document if it already exists', async () => {
    mockBrowser.runtime.getContexts.mockResolvedValue([{ contextId: '1' }]);

    await ensureOffscreen();

    expect(mockBrowser.offscreen.createDocument).not.toHaveBeenCalled();
  });

  it('should close document if it exists', async () => {
    mockBrowser.runtime.getContexts.mockResolvedValue([{ contextId: '1' }]);
    mockBrowser.offscreen.closeDocument.mockResolvedValue(undefined);

    await closeOffscreen();

    expect(mockBrowser.offscreen.closeDocument).toHaveBeenCalled();
  });

  it('does not call closeDocument when no offscreen context exists', async () => {
    mockBrowser.runtime.getContexts.mockResolvedValue([]);
    await closeOffscreen();
    expect(mockBrowser.offscreen.closeDocument).not.toHaveBeenCalled();
  });
});
