// Vitest setup. WxtVitest plugin auto-mocks the WebExtension APIs (browser/chrome).
// Add project-wide test wiring here as the suite grows.

import { vi } from 'vitest';

const mockBrowser = {
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
      DOM_PARSER: 'DOM_PARSER',
    },
  },
};

vi.stubGlobal('browser', mockBrowser);
vi.stubGlobal('chrome', mockBrowser); // Chrome alias
