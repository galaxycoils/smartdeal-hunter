import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { savePrice, getPriceHistory } from '../../lib/price-history';
import { wipeAllData } from '../../lib/storage';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';

describe('Price History', () => {
  beforeAll(() => {
    installIndexedDbMock();
  });

  beforeEach(async () => {
    resetIndexedDbMock();
    await wipeAllData();
  });

  it('saves and retrieves price records for an ASIN', async () => {
    await savePrice('B001', 10.0);
    await savePrice('B001', 15.0);
    await savePrice('B002', 20.0);

    const history = await getPriceHistory('B001');
    expect(history).toHaveLength(2);
    expect(history[0].price).toBe(10.0);
    expect(history[1].price).toBe(15.0);
    expect(history[0].date).toBeLessThan(history[1].date);
  });

  it('returns empty array for non-existent ASIN', async () => {
    const history = await getPriceHistory('B009');
    expect(history).toEqual([]);
  });
});
