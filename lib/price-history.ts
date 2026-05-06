/**
 * lib/price-history.ts
 * Manages local IndexedDB storage for price tracking.
 */
import { setItem, getAllItems, STORE_HISTORY_EVENTS } from './storage';

export interface PriceRecord {
  date: number;
  price: number;
}

let lastTimestamp = 0;
let counter = 0;

export const savePrice = async (asin: string, price: number): Promise<void> => {
  const timestamp = Date.now();
  if (timestamp === lastTimestamp) {
    counter++;
  } else {
    lastTimestamp = timestamp;
    counter = 0;
  }
  const uniqueTimestamp = timestamp + counter;
  const key = `${asin}:${uniqueTimestamp}`;
  const record: PriceRecord & { asin: string } = {
    asin,
    price,
    date: uniqueTimestamp,
  };
  await setItem(STORE_HISTORY_EVENTS, key, record);
};

export const getPriceHistory = async (asin: string): Promise<PriceRecord[]> => {
  const allEvents = await getAllItems<PriceRecord & { asin: string }>(STORE_HISTORY_EVENTS);
  return allEvents
    .filter((record) => record.asin === asin)
    .sort((a, b) => a.date - b.date)
    .map(({ date, price }) => ({ date, price }));
};

export const get30DayPriceHistory = async (asin: string): Promise<PriceRecord[]> => {
  const history = await getPriceHistory(asin);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return history.filter((record) => record.date >= thirtyDaysAgo);
};
