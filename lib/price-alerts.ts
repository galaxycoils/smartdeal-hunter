import {
  setEncryptedItem,
  getEncryptedItem,
  getAllEncryptedItems,
  deleteItem,
  STORE_PRICE_ALERTS,
} from './storage';
import { get30DayPriceHistory } from './price-history';
import { getCachedProduct } from './cache';
import { appendAuditLog } from './audit-log';

export const ALARM_NAME = 'sdh:price-check';
const ALARM_PERIOD_MIN = 30;
const NOTIFICATION_ID_PREFIX = 'sdh:price-alert:';
const TITLE_MAX = 60;

export interface AlertEnrollment {
  asin: string;
  enrolledAt: number;
  lastDedupKey: string | null;
  lastFiredAt: number | null;
}

function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function dedupKey(asin: string, watermark: number, ts: number): string {
  return `${asin}:${utcDay(ts)}:${watermark.toFixed(2)}`;
}

function formatPrice(price: number, currency: string): string {
  return `${price.toFixed(2)} ${currency}`;
}

async function readEnrollment(asin: string, key: CryptoKey): Promise<AlertEnrollment | undefined> {
  return getEncryptedItem<AlertEnrollment>(STORE_PRICE_ALERTS, asin, key);
}

async function writeEnrollment(record: AlertEnrollment, key: CryptoKey): Promise<void> {
  await setEncryptedItem(STORE_PRICE_ALERTS, record.asin, record, key);
}

export async function listEnrolledAlerts(key: CryptoKey): Promise<string[]> {
  const all = await getAllEncryptedItems<AlertEnrollment>(STORE_PRICE_ALERTS, key);
  return all.map((r) => r.asin);
}

export async function enrollAlert(asin: string, key: CryptoKey): Promise<void> {
  const existing = await readEnrollment(asin, key);
  if (existing) return;

  const priorCount = (await listEnrolledAlerts(key)).length;
  const record: AlertEnrollment = {
    asin,
    enrolledAt: Date.now(),
    lastDedupKey: null,
    lastFiredAt: null,
  };
  await writeEnrollment(record, key);
  await appendAuditLog({ kind: 'price-alert-enroll', summary: `asin=${asin}` });

  if (priorCount === 0) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MIN });
  }
}

export async function disenrollAlert(asin: string, key: CryptoKey): Promise<void> {
  const existing = await readEnrollment(asin, key);
  if (!existing) return;

  await deleteItem(STORE_PRICE_ALERTS, asin);
  await appendAuditLog({ kind: 'price-alert-disenroll', summary: `asin=${asin}` });

  const remaining = (await listEnrolledAlerts(key)).length;
  if (remaining === 0) {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

export async function triggerNotification(
  asin: string,
  title: string,
  oldLow: number,
  newPrice: number,
  currency: string,
): Promise<void> {
  const truncatedTitle = title.slice(0, TITLE_MAX);
  await chrome.notifications.create(`${NOTIFICATION_ID_PREFIX}${asin}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: truncatedTitle,
    message: `New price ${formatPrice(newPrice, currency)} beats your 30-day low ${formatPrice(oldLow, currency)}`,
  });
  await appendAuditLog({
    kind: 'price-alert-fired',
    summary: `asin=${asin} new=${newPrice.toFixed(2)} low=${oldLow.toFixed(2)}`,
  });
}

export async function checkAllAlerts(key: CryptoKey): Promise<void> {
  const enrollments = await getAllEncryptedItems<AlertEnrollment>(STORE_PRICE_ALERTS, key);
  if (enrollments.length === 0) return;

  const permission = await chrome.notifications.getPermissionLevel();
  const now = Date.now();

  for (const enrollment of enrollments) {
    const { asin } = enrollment;

    const history = await get30DayPriceHistory(asin);
    if (history.length < 2) continue;

    const cached = await getCachedProduct(asin, key);
    if (!cached || cached.price == null) continue;

    const sorted = [...history].sort((a, b) => a.date - b.date);
    const prior = sorted.slice(0, -1);
    const oldLow = Math.min(...prior.map((r) => r.price));
    const currentPrice = cached.price;

    if (currentPrice >= oldLow) continue;

    const newDedupKey = dedupKey(asin, currentPrice, now);
    if (enrollment.lastDedupKey === newDedupKey) continue;

    if (permission === 'granted') {
      await triggerNotification(asin, cached.title, oldLow, currentPrice, cached.currency);
    }

    const updated: AlertEnrollment = {
      ...enrollment,
      lastDedupKey: newDedupKey,
      lastFiredAt: permission === 'granted' ? now : enrollment.lastFiredAt,
    };
    await writeEnrollment(updated, key);
  }
}
