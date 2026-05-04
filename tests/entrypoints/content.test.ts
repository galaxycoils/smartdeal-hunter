import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentMessage } from '../../lib/messaging/types';
import { scrapeProduct } from '../../lib/scraper';

const { mockBrowser, createShadowRootUiMock } = vi.hoisted(() => ({
  mockBrowser: {
    runtime: {
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(),
    },
  },
  createShadowRootUiMock: vi.fn(),
}));

vi.mock('wxt/browser', () => ({ browser: mockBrowser }));

vi.mock('wxt/utils/content-script-ui/shadow-root', () => ({
  createShadowRootUi: createShadowRootUiMock,
}));

vi.mock('../../lib/scraper', () => ({ scrapeProduct: vi.fn() }));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: vi.fn().mockReturnValue({ render: vi.fn(), unmount: vi.fn() }),
  },
  createRoot: vi.fn().mockReturnValue({ render: vi.fn(), unmount: vi.fn() }),
}));

import contentScript from '../../entrypoints/content';

type Listener = (
  msg: ContentMessage,
  sender: unknown,
  sendResponse: (r: unknown) => void,
) => boolean | undefined;

const flush = () => new Promise((r) => setTimeout(r, 0));

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

describe('Content Script', () => {
  let listener: Listener;

  beforeEach(() => {
    vi.clearAllMocks();
    contentScript.main({} as never);
    listener = mockBrowser.runtime.onMessage.addListener.mock.calls[0][0] as Listener;
  });

  it('ignores unknown messages', () => {
    // @ts-expect-error invalid type
    const result = listener({ type: 'OTHER' }, {}, vi.fn());
    expect(result).toBeUndefined();
  });

  it('runs scraper on EXECUTE_SCRAPER', () => {
    const sendResponse = vi.fn();
    vi.mocked(scrapeProduct).mockReturnValue(mockProductData);

    const result = listener({ type: 'EXECUTE_SCRAPER' }, {}, sendResponse);

    expect(scrapeProduct).toHaveBeenCalledWith(location.href, document);
    expect(sendResponse).toHaveBeenCalledWith({
      type: 'PRODUCT_DATA',
      payload: mockProductData,
    });
    expect(result).toBe(true);
  });

  describe('RENDER_PANEL', () => {
    function setupShadowRootUi() {
      const ui = { remove: vi.fn(), mount: vi.fn() };
      let captured: { onMount: (c: HTMLElement) => unknown; onRemove: (r: unknown) => void } = {
        onMount: () => undefined,
        onRemove: () => undefined,
      };
      createShadowRootUiMock.mockImplementation((_ctx: unknown, opts: typeof captured) => {
        captured = opts;
        return Promise.resolve(ui);
      });
      return { ui, captured: () => captured };
    }

    it('mounts shadow-root UI and responds success', async () => {
      const { ui, captured } = setupShadowRootUi();
      const sendResponse = vi.fn();

      const result = listener(
        {
          type: 'RENDER_PANEL',
          payload: { asin: 'B0001', trueValue: 80.7, personalFit: 65.2 },
        },
        {},
        sendResponse,
      );
      expect(result).toBe(true);

      await flush();
      await flush();

      expect(createShadowRootUiMock).toHaveBeenCalled();
      // exercise onMount + onRemove callbacks for branch coverage
      const container = document.createElement('div');
      const root = captured().onMount(container) as { unmount: () => void };
      expect(root).toBeTruthy();
      captured().onRemove(root);

      expect(ui.mount).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('removes existing UI before mounting a new one', async () => {
      const { ui: first } = setupShadowRootUi();
      listener(
        { type: 'RENDER_PANEL', payload: { asin: 'A', trueValue: 1, personalFit: 1 } },
        {},
        vi.fn(),
      );
      await flush();
      await flush();

      const { ui: second } = setupShadowRootUi();
      listener(
        { type: 'RENDER_PANEL', payload: { asin: 'B', trueValue: 2, personalFit: 2 } },
        {},
        vi.fn(),
      );
      await flush();
      await flush();

      expect(first.remove).toHaveBeenCalled();
      expect(second.mount).toHaveBeenCalled();
    });

    it('feedback callback dispatches UPDATE_GENOME via runtime.sendMessage', async () => {
      const { captured } = setupShadowRootUi();
      listener(
        {
          type: 'RENDER_PANEL',
          payload: { asin: 'B0001', trueValue: 50, personalFit: 50 },
        },
        {},
        vi.fn(),
      );
      await flush();
      await flush();

      const container = document.createElement('div');
      captured().onMount(container);
      // Grab ScoutPanel render call to invoke onFeedback
      const reactDom = (await import('react-dom/client')).default as unknown as {
        createRoot: ReturnType<typeof vi.fn>;
      };
      const rootMock = reactDom.createRoot.mock.results.at(-1)?.value as
        | { render: ReturnType<typeof vi.fn> }
        | undefined;
      const renderArg = rootMock?.render.mock.calls.at(-1)?.[0] as {
        props: { onFeedback: (t: string) => void; onClose: () => void };
      };

      renderArg.props.onFeedback('saved');
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_GENOME',
        payload: { asin: 'B0001', feedbackType: 'saved' },
      });

      // exercise onClose path (no throw when no instance)
      renderArg.props.onClose();
    });
  });
});
