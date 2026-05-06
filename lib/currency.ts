/**
 * Simple currency utilities for SmartDeal Hunter.
 */

export const CURRENCY_MAX_PRICE: Record<string, number> = {
  USD: 200,
  GBP: 150,
  EUR: 180,
  JPY: 30000,
  CAD: 250,
};

export const DEFAULT_MAX_PRICE = 200;

/**
 * Returns the maximum expected price for a given currency to normalize scores.
 */
export function getMaxPrice(currency: string): number {
  return CURRENCY_MAX_PRICE[currency] || DEFAULT_MAX_PRICE;
}
