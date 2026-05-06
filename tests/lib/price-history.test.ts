import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as priceHistory from '../../lib/price-history';
import * as storage from '../../lib/storage';

vi.mock('../../lib/storage', () => ({
  setItem: vi.fn(),
  getAllItems: vi.fn(),
  STORE_HISTORY_EVENTS: 'history_events',
}));

const STORE = 'history_events';

const setStoreContents = <T>(items: T[]): void => {
  vi.mocked(storage.getAllItems).mockResolvedValue(items as never);
};

const captureSetCalls = (): Array<[string, string, unknown]> => {
  return vi.mocked(storage.setItem).mock.calls.map((c) => [c[0] as string, c[1] as string, c[2]]);
};

describe('price-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('savePrice writes one record then getPriceHistory roundtrips it', async () => {
    vi.setSystemTime(1_000_000);
    const records: Array<{ asin: string; date: number; price: number }> = [];
    vi.mocked(storage.setItem).mockImplementation(async (_store, _key, value) => {
      records.push(value as { asin: string; date: number; price: number });
    });
    vi.mocked(storage.getAllItems).mockImplementation(async () => records as never);

    await priceHistory.savePrice('B001', 19.99);
    const out = await priceHistory.getPriceHistory('B001');

    expect(out).toEqual([{ date: 1_000_000, price: 19.99 }]);
  });

  it('two savePrice calls in the same ms produce distinct stored keys (counter increment)', async () => {
    vi.setSystemTime(2_000_000);
    await priceHistory.savePrice('B002', 10);
    await priceHistory.savePrice('B002', 11);

    const calls = captureSetCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).not.toBe(calls[1][1]);
    expect(calls[0][1]).toBe('B002:2000000');
    expect(calls[1][1]).toBe('B002:2000001');
  });

  it('counter resets to 0 in the else branch when next call falls in a new ms', async () => {
    vi.setSystemTime(3_000_000);
    await priceHistory.savePrice('B003', 1);
    await priceHistory.savePrice('B003', 2);
    vi.setSystemTime(3_000_500);
    await priceHistory.savePrice('B003', 3);

    const calls = captureSetCalls();
    expect(calls).toHaveLength(3);
    expect(calls[2][1]).toBe('B003:3000500');
  });

  it('ASIN containing `:` round-trips via getPriceHistory (asin field used for filter, not key parse)', async () => {
    vi.setSystemTime(4_000_000);
    const records: Array<{ asin: string; date: number; price: number }> = [];
    vi.mocked(storage.setItem).mockImplementation(async (_store, _key, value) => {
      records.push(value as { asin: string; date: number; price: number });
    });
    vi.mocked(storage.getAllItems).mockImplementation(async () => records as never);

    await priceHistory.savePrice('B00:WEIRD', 42);
    const out = await priceHistory.getPriceHistory('B00:WEIRD');

    expect(out).toEqual([{ date: 4_000_000, price: 42 }]);
  });

  it('savePrice(asin, NaN) stores NaN verbatim (no validation at this layer)', async () => {
    vi.setSystemTime(5_000_000);
    await priceHistory.savePrice('B005', NaN);

    const calls = captureSetCalls();
    expect(calls).toHaveLength(1);
    const value = calls[0][2] as { price: number };
    expect(Number.isNaN(value.price)).toBe(true);
  });

  it('savePrice(asin, -5) stores negative price verbatim', async () => {
    vi.setSystemTime(6_000_000);
    await priceHistory.savePrice('B006', -5);

    const calls = captureSetCalls();
    expect(calls[0][2]).toMatchObject({ asin: 'B006', price: -5, date: 6_000_000 });
  });

  it('getPriceHistory returns ascending-by-date when records inserted out of order', async () => {
    setStoreContents([
      { asin: 'B007', date: 7_000_300, price: 30 },
      { asin: 'B007', date: 7_000_100, price: 10 },
      { asin: 'B007', date: 7_000_200, price: 20 },
    ]);

    const out = await priceHistory.getPriceHistory('B007');
    expect(out.map((r) => r.price)).toEqual([10, 20, 30]);
  });

  it('get30DayPriceHistory filters records older than 30 days', async () => {
    const now = 30_000_000_000;
    vi.setSystemTime(now);
    const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
    const twentyNineDaysAgo = now - 29 * 24 * 60 * 60 * 1000;

    setStoreContents([
      { asin: 'B008', date: twentyNineDaysAgo, price: 20 },
      { asin: 'B008', date: thirtyOneDaysAgo, price: 10 },
    ]);

    const out = await priceHistory.get30DayPriceHistory('B008');
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(20);
  });

  it('get30DayPriceHistory includes the boundary record (>= comparison)', async () => {
    const now = 40_000_000_000;
    vi.setSystemTime(now);
    const exactly30DaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    setStoreContents([{ asin: 'B009', date: exactly30DaysAgo, price: 99 }]);

    const out = await priceHistory.get30DayPriceHistory('B009');
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(99);
  });

  it('empty store returns [] for both getPriceHistory and get30DayPriceHistory', async () => {
    setStoreContents([]);

    const a = await priceHistory.getPriceHistory('B010');
    const b = await priceHistory.get30DayPriceHistory('B010');
    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });

  it('getPriceHistory filters by ASIN (mixed-asin store)', async () => {
    setStoreContents([
      { asin: 'B011', date: 1, price: 10 },
      { asin: 'B012', date: 2, price: 20 },
      { asin: 'B011', date: 3, price: 30 },
    ]);

    const out = await priceHistory.getPriceHistory('B011');
    expect(out).toEqual([
      { date: 1, price: 10 },
      { date: 3, price: 30 },
    ]);
  });

  it('savePrice writes to STORE_HISTORY_EVENTS store', async () => {
    vi.setSystemTime(50_000_000);
    await priceHistory.savePrice('B013', 1);

    const calls = captureSetCalls();
    expect(calls[0][0]).toBe(STORE);
  });
});
