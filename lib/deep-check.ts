import { AmazonOAuth, type AmazonOAuthTokens } from './amazon-oauth';
import { appendAuditLog } from './audit-log';
import { DeepCheckCache } from './deep-check-cache';
import {
  DeepCheckAuthError,
  DeepCheckOptedOutError,
  DeepCheckRateLimitedError,
} from './errors/deep-check-errors';
import { loadOAuthTokens, saveOAuthTokens } from './oauth-token-store';

export { DeepCheckAuthError, DeepCheckOptedOutError, DeepCheckRateLimitedError };

const IN_FLIGHT_KEY = 'sdh:in-flight';
const RATE_WINDOW_KEY = 'sdh:deep-check-rate-window';
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const STALE_IN_FLIGHT_MS = 60_000;
const BACKOFF_MS = [250, 500, 1_000] as const;

type DeepCheckFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type DeepCheckFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<DeepCheckFetchResponse>;

export interface DeepCheckResult {
  asin: string;
  title: string | null;
  price: number | null;
  fetchedAt: number;
  source: 'network' | 'cache';
}

let refreshInFlight: Promise<AmazonOAuthTokens> | null = null;

async function isDeepCheckOptedIn(): Promise<boolean> {
  const result = await chrome.storage.local.get({ optInDeepCheck: false });
  return Boolean(result.optInDeepCheck);
}

async function recordRateWindow(now: number): Promise<void> {
  const existing = await chrome.storage.local.get({ [RATE_WINDOW_KEY]: [] as number[] });
  const nextWindow = [...(existing[RATE_WINDOW_KEY] as number[]), now].filter(
    (entry) => now - entry < RATE_WINDOW_MS,
  );
  await chrome.storage.local.set({ [RATE_WINDOW_KEY]: nextWindow });
}

async function getRateLimitState(now: number): Promise<{ limited: boolean; retryAfterMs: number }> {
  const existing = await chrome.storage.local.get({ [RATE_WINDOW_KEY]: [] as number[] });
  const window = (existing[RATE_WINDOW_KEY] as number[]).filter(
    (entry) => now - entry < RATE_WINDOW_MS,
  );
  await chrome.storage.local.set({ [RATE_WINDOW_KEY]: window });

  if (window.length < RATE_LIMIT) {
    return { limited: false, retryAfterMs: 0 };
  }

  const oldest = Math.min(...window);
  return {
    limited: true,
    retryAfterMs: Math.max(0, RATE_WINDOW_MS - (now - oldest)),
  };
}

async function refreshTokensSingleFlight(
  refreshToken: string,
  key: CryptoKey,
): Promise<AmazonOAuthTokens> {
  if (!refreshInFlight) {
    refreshInFlight = AmazonOAuth.refreshTokens(refreshToken)
      .then(async (tokens) => {
        await saveOAuthTokens(tokens, key);
        return tokens;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

async function fetchWithRetries(
  asin: string,
  tokens: AmazonOAuthTokens,
  fetchImpl: DeepCheckFetch,
  sleep: (ms: number) => Promise<void>,
): Promise<DeepCheckFetchResponse> {
  const request = () =>
    fetchImpl(`https://creators.amazon.com/api/items/${asin}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

  let response = await request();
  for (
    let index = 0;
    index < BACKOFF_MS.length && (response.status >= 500 || response.status === 429);
    index += 1
  ) {
    await sleep(BACKOFF_MS[index]);
    response = await request();
  }
  return response;
}

async function readCache(
  asin: string,
  key: CryptoKey,
  cacheTtlMs?: number,
): Promise<DeepCheckResult | undefined> {
  const cache = new DeepCheckCache(key, cacheTtlMs);
  return cache.get<DeepCheckResult>(asin);
}

export async function deepCheck(
  asin: string,
  key: CryptoKey,
  options?: {
    fetchImpl?: DeepCheckFetch;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    cacheTtlMs?: number;
  },
): Promise<DeepCheckResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const now = options?.now ?? Date.now;
  const sleep =
    options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const cache = new DeepCheckCache(key, options?.cacheTtlMs);

  const log = async (summary: string) => {
    await appendAuditLog({ kind: 'deep-check', summary });
  };

  try {
    if (!(await isDeepCheckOptedIn())) {
      throw new DeepCheckOptedOutError();
    }

    const staleState = await chrome.storage.local.get(IN_FLIGHT_KEY);
    const staleTs = staleState[IN_FLIGHT_KEY];
    if (typeof staleTs === 'number' && now() - staleTs > STALE_IN_FLIGHT_MS) {
      await chrome.storage.local.remove(IN_FLIGHT_KEY);
    }

    const cached = await readCache(asin, key, options?.cacheTtlMs);
    if (cached) {
      const result = { ...cached, source: 'cache' as const };
      await log(`asin=${asin} source=cache`);
      return result;
    }

    const rateLimitState = await getRateLimitState(now());
    if (rateLimitState.limited) {
      throw new DeepCheckRateLimitedError(rateLimitState.retryAfterMs);
    }

    await chrome.storage.local.set({ [IN_FLIGHT_KEY]: now() });

    let tokens = await loadOAuthTokens(key);
    if (!tokens) {
      throw new DeepCheckAuthError('Missing OAuth tokens');
    }

    try {
      let response = await fetchWithRetries(asin, tokens, fetchImpl, sleep);
      if (response.status === 401) {
        tokens = await refreshTokensSingleFlight(tokens.refreshToken, key);
        response = await fetchWithRetries(asin, tokens, fetchImpl, sleep);
        if (response.status === 401) {
          throw new DeepCheckAuthError();
        }
      }

      if (!response.ok) {
        throw new Error(`Deep Check request failed with status ${response.status}`);
      }

      await recordRateWindow(now());
      const payload = (await response.json()) as {
        asin?: string;
        title?: string | null;
        price?: number | null;
      };

      const result: DeepCheckResult = {
        asin: payload.asin ?? asin,
        title: payload.title ?? null,
        price: payload.price ?? null,
        fetchedAt: now(),
        source: 'network',
      };

      await cache.set(asin, result);
      await chrome.storage.local.set({
        'sdh:deep-check-status': 'Idle',
        'sdh:deep-check-last-fetched': result.fetchedAt,
      });
      await log(`asin=${asin} source=network`);
      return result;
    } finally {
      await chrome.storage.local.remove(IN_FLIGHT_KEY);
    }
  } catch (error) {
    const status =
      error instanceof DeepCheckRateLimitedError
        ? 'RateLimited'
        : error instanceof DeepCheckOptedOutError
          ? 'OptedOut'
          : error instanceof DeepCheckAuthError
            ? 'AuthError'
            : 'AuthError';
    await chrome.storage.local.set({ 'sdh:deep-check-status': status });
    await log(`asin=${asin} error=${error instanceof Error ? error.name : 'unknown'}`);
    throw error;
  }
}
