import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { deriveKey } from '../../lib/crypto';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';
import { saveOAuthTokens } from '../../lib/oauth-token-store';
import {
  deepCheck,
  DeepCheckAuthError,
  DeepCheckOptedOutError,
  DeepCheckRateLimitedError,
} from '../../lib/deep-check';
import { getAuditLogEntries } from '../../lib/audit-log';
import { AmazonOAuth } from '../../lib/amazon-oauth';

vi.mock('../../lib/amazon-oauth', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/amazon-oauth')>('../../lib/amazon-oauth');
  return {
    ...actual,
    AmazonOAuth: {
      ...actual.AmazonOAuth,
      refreshTokens: vi.fn(),
    },
  };
});

describe('deepCheck', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    key = await deriveKey('deep-check-test', new Uint8Array(16));
  });

  beforeEach(async () => {
    resetIndexedDbMock();
    vi.clearAllMocks();
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ optInDeepCheck: true, optInAuditLog: true });
    await saveOAuthTokens(
      { accessToken: 'old-access', refreshToken: 'refresh-token', expiresAt: Date.now() + 60_000 },
      key,
    );
  });

  it('throws DeepCheckOptedOutError before any cache read or network call', async () => {
    await chrome.storage.local.set({ optInDeepCheck: false });
    const fetchMock = vi.fn();

    await expect(deepCheck('B0001', key, { fetchImpl: fetchMock })).rejects.toBeInstanceOf(
      DeepCheckOptedOutError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fills cache, blocks cache reads while opted out, then serves cached value once re-enabled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0001', price: 19.99, title: 'Live Item' }),
      });

    await expect(deepCheck('B0001', key, { fetchImpl: fetchMock })).resolves.toMatchObject({
      asin: 'B0001',
      price: 19.99,
      source: 'network',
    });

    await chrome.storage.local.set({ optInDeepCheck: false });
    await expect(deepCheck('B0001', key, { fetchImpl: fetchMock })).rejects.toBeInstanceOf(
      DeepCheckOptedOutError,
    );

    await chrome.storage.local.set({ optInDeepCheck: true });
    await expect(deepCheck('B0001', key, { fetchImpl: fetchMock })).resolves.toMatchObject({
      asin: 'B0001',
      source: 'cache',
    });
  });

  it('returns cached value when rate-limited and cache is warm', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0001', price: 19.99, title: 'Live Item' }),
      });
    await deepCheck('B0001', key, { fetchImpl: fetchMock });

    const now = Date.now();
    await chrome.storage.local.set({
      'sdh:deep-check-rate-window': Array.from({ length: 10 }, () => now),
    });

    await expect(deepCheck('B0001', key, { fetchImpl: fetchMock })).resolves.toMatchObject({
      source: 'cache',
    });
  });

  it('throws DeepCheckRateLimitedError with retryAfterMs when cold-start rate-limited', async () => {
    const now = Date.now();
    await chrome.storage.local.set({
      'sdh:deep-check-rate-window': Array.from({ length: 10 }, () => now),
    });

    await expect(
      deepCheck('B0002', key, { fetchImpl: vi.fn(), now: () => now }),
    ).rejects.toMatchObject({
      retryAfterMs: expect.any(Number),
    });
    await expect(
      deepCheck('B0002', key, { fetchImpl: vi.fn(), now: () => now }),
    ).rejects.toBeInstanceOf(DeepCheckRateLimitedError);
  });

  it('retries 500 and 429 responses with exponential backoff before succeeding', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0003', price: 24.99, title: 'Recovered Item' }),
      });

    await expect(deepCheck('B0003', key, { fetchImpl: fetchMock, sleep })).resolves.toMatchObject({
      source: 'network',
      price: 24.99,
    });
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it('refreshes tokens once on a 401 and retries successfully', async () => {
    vi.mocked(AmazonOAuth.refreshTokens).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: Date.now() + 120_000,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0004', price: 29.99, title: 'Retried Item' }),
      });

    await expect(deepCheck('B0004', key, { fetchImpl: fetchMock })).resolves.toMatchObject({
      price: 29.99,
    });
    expect(AmazonOAuth.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('throws DeepCheckAuthError after a second 401', async () => {
    vi.mocked(AmazonOAuth.refreshTokens).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: Date.now() + 120_000,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    await expect(deepCheck('B0005', key, { fetchImpl: fetchMock })).rejects.toBeInstanceOf(
      DeepCheckAuthError,
    );
  });

  it('coalesces concurrent 401 refreshes into a single refreshTokens call', async () => {
    vi.mocked(AmazonOAuth.refreshTokens).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: Date.now() + 120_000,
    });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
      if (auth.includes('old-access')) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0006', price: 39.99, title: 'Concurrent Item' }),
      };
    });

    const [first, second] = await Promise.all([
      deepCheck('B0006', key, { fetchImpl: fetchMock }),
      deepCheck('B0006', key, { fetchImpl: fetchMock }),
    ]);

    expect(first.price).toBe(39.99);
    expect(second.price).toBe(39.99);
    expect(AmazonOAuth.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('manages the sdh:in-flight lifecycle and clears stale values', async () => {
    const now = 200_000;
    const removeSpy = vi.spyOn(chrome.storage.local, 'remove');
    await chrome.storage.local.set({ 'sdh:in-flight': now - 61_000 });

    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0007', price: 49.99, title: 'In Flight Item' }),
      });

    await deepCheck('B0007', key, { fetchImpl: fetchMock, now: () => now });

    const stored = await chrome.storage.local.get('sdh:in-flight');
    expect(stored['sdh:in-flight']).toBeUndefined();
    expect(removeSpy).toHaveBeenCalledWith('sdh:in-flight');
  });

  it('appends audit log entries for both success and failure when enabled', async () => {
    const successFetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ asin: 'B0008', price: 59.99, title: 'Logged Item' }),
      });
    const failureFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await deepCheck('B0008', key, { fetchImpl: successFetch, sleep: vi.fn(async () => undefined) });
    await expect(
      deepCheck('B0009', key, { fetchImpl: failureFetch, sleep: vi.fn(async () => undefined) }),
    ).rejects.toThrow();

    await expect(getAuditLogEntries()).resolves.toEqual([
      expect.objectContaining({
        kind: 'deep-check',
        summary: expect.stringContaining('asin=B0008'),
      }),
      expect.objectContaining({
        kind: 'deep-check',
        summary: expect.stringContaining('asin=B0009'),
      }),
    ]);
  });
});
