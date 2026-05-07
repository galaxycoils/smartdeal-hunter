import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  enrollAlert,
  disenrollAlert,
  listEnrolledAlerts,
  checkAllAlerts,
  ALARM_NAME,
} from '../../lib/price-alerts';
import { deriveKey } from '../../lib/crypto';
import { savePrice } from '../../lib/price-history';
import { cacheProduct } from '../../lib/cache';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';
import type { ProductData } from '../../lib/types';

declare const __chromeTestHarness: {
  setNotificationPermissionLevel: (level: 'granted' | 'denied') => void;
};

async function getNotificationIds(): Promise<string[]> {
  const all = await chrome.notifications.getAll();
  return Object.keys(all);
}

function makeProduct(asin: string, overrides: Partial<ProductData> = {}): ProductData {
  return {
    asin,
    title: 'Test Product Title For Alerts',
    price: 19.99,
    currency: 'USD',
    rating: 4.5,
    reviewCount: 100,
    imageUrl: null,
    jsonLd: null,
    url: `https://www.amazon.com/dp/${asin}`,
    scrapedAt: Date.now(),
    source: 'url',
    listPrice: null,
    unitPrice: null,
    quantity: null,
    ...overrides,
  };
}

describe('Price Alerts', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    key = await deriveKey('test-pw', new Uint8Array(16));
  });

  beforeEach(() => {
    resetIndexedDbMock();
    __chromeTestHarness.setNotificationPermissionLevel('granted');
  });

  describe('enrollAlert', () => {
    it('writes encrypted record', async () => {
      await enrollAlert('B07ABC1234', key);
      const list = await listEnrolledAlerts(key);
      expect(list).toEqual(['B07ABC1234']);
    });

    it('is idempotent on re-enroll', async () => {
      await enrollAlert('B07ABC1234', key);
      await enrollAlert('B07ABC1234', key);
      const list = await listEnrolledAlerts(key);
      expect(list).toEqual(['B07ABC1234']);
    });

    it('schedules alarm on first enrollment', async () => {
      await enrollAlert('B07ABC1234', key);
      const alarm = await chrome.alarms.get(ALARM_NAME);
      expect(alarm).toBeDefined();
    });

    it('does not re-create alarm on subsequent enrollments', async () => {
      await enrollAlert('B07A', key);
      const createSpy = vi.spyOn(chrome.alarms, 'create');
      await enrollAlert('B07B', key);
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('disenrollAlert', () => {
    it('removes record', async () => {
      await enrollAlert('B07ABC1234', key);
      await disenrollAlert('B07ABC1234', key);
      const list = await listEnrolledAlerts(key);
      expect(list).toEqual([]);
    });

    it('clears alarm when last enrollment removed', async () => {
      await enrollAlert('B07A', key);
      await disenrollAlert('B07A', key);
      const alarm = await chrome.alarms.get(ALARM_NAME);
      expect(alarm).toBeUndefined();
    });

    it('keeps alarm when other enrollments remain', async () => {
      await enrollAlert('B07A', key);
      await enrollAlert('B07B', key);
      await disenrollAlert('B07A', key);
      const alarm = await chrome.alarms.get(ALARM_NAME);
      expect(alarm).toBeDefined();
    });

    it('is no-op on absent enrollment', async () => {
      await expect(disenrollAlert('NOPE', key)).resolves.toBeUndefined();
    });
  });

  describe('checkAllAlerts', () => {
    it('no-ops on empty enrollment list', async () => {
      await checkAllAlerts(key);
      expect(await getNotificationIds()).toHaveLength(0);
    });

    it('fires notification when current price beats 30-day low', async () => {
      const asin = 'B07A';
      await enrollAlert(asin, key);
      await cacheProduct(makeProduct(asin, { price: 12.0 }), key);
      await savePrice(asin, 20.0);
      await savePrice(asin, 18.0);
      await savePrice(asin, 15.0);
      await savePrice(asin, 12.0); // current = beats 15 low

      await checkAllAlerts(key);

      const ids = await getNotificationIds();
      expect(ids).toEqual([`sdh:price-alert:${asin}`]);
    });

    it('skips when current price is not below 30-day low', async () => {
      const asin = 'B07A';
      await enrollAlert(asin, key);
      await cacheProduct(makeProduct(asin, { price: 20.0 }), key);
      await savePrice(asin, 15.0);
      await savePrice(asin, 20.0);

      await checkAllAlerts(key);
      expect(await getNotificationIds()).toHaveLength(0);
    });

    it('dedups same-day same-watermark fires', async () => {
      const asin = 'B07A';
      await enrollAlert(asin, key);
      await cacheProduct(makeProduct(asin, { price: 10.0 }), key);
      await savePrice(asin, 20.0);
      await savePrice(asin, 15.0);
      await savePrice(asin, 10.0);

      const createSpy = vi.spyOn(chrome.notifications, 'create');
      await checkAllAlerts(key);
      await checkAllAlerts(key);

      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('does not fire when permission denied but updates dedup state', async () => {
      const asin = 'B07A';
      __chromeTestHarness.setNotificationPermissionLevel('denied');
      await enrollAlert(asin, key);
      await cacheProduct(makeProduct(asin, { price: 10.0 }), key);
      await savePrice(asin, 20.0);
      await savePrice(asin, 15.0);
      await savePrice(asin, 10.0);

      await checkAllAlerts(key);
      expect(await getNotificationIds()).toHaveLength(0);

      __chromeTestHarness.setNotificationPermissionLevel('granted');
      await checkAllAlerts(key);
      expect(await getNotificationIds()).toHaveLength(0);
    });

    it('skips ASINs with insufficient history (≤1 record)', async () => {
      const asin = 'B07A';
      await enrollAlert(asin, key);
      await cacheProduct(makeProduct(asin, { price: 10.0 }), key);
      await savePrice(asin, 10.0);

      await checkAllAlerts(key);
      expect(await getNotificationIds()).toHaveLength(0);
    });

    it('skips ASINs without cached product', async () => {
      const asin = 'B07A';
      await enrollAlert(asin, key);
      await savePrice(asin, 20.0);
      await savePrice(asin, 10.0);

      await checkAllAlerts(key);
      expect(await getNotificationIds()).toHaveLength(0);
    });

    it('two consecutive calls produce identical post-state (SW-stateless)', async () => {
      const asin = 'B07A';
      await enrollAlert(asin, key);
      await cacheProduct(makeProduct(asin, { price: 10.0 }), key);
      await savePrice(asin, 20.0);
      await savePrice(asin, 10.0);

      await checkAllAlerts(key);
      const after1 = await listEnrolledAlerts(key);
      await checkAllAlerts(key);
      const after2 = await listEnrolledAlerts(key);
      expect(after1).toEqual(after2);
    });
  });
});
