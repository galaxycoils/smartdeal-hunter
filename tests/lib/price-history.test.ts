import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as priceHistory from '../../lib/price-history';
import * as storage from '../../lib/storage';

vi.mock('../../lib/storage', () => ({
  setItem: vi.fn(),
  getAllItems: vi.fn(),
  STORE_HISTORY_EVENTS: 'history_events',
}));

describe('price-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('filters records older than 30 days', async () => {
    const now = Date.now();
    const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
    const twentyNineDaysAgo = now - 29 * 24 * 60 * 60 * 1000;

    const mockData = [
      { asin: 'test', date: twentyNineDaysAgo, price: 20 },
      { asin: 'test', date: thirtyOneDaysAgo, price: 10 },
    ];

    vi.mocked(storage.getAllItems).mockResolvedValue(mockData);

    const history = await priceHistory.get30DayPriceHistory('test');

    expect(history).toHaveLength(1);
    expect(history[0].price).toBe(20);
  });
});
