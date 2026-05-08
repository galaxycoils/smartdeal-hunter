import type { ReviewSample } from './types';

export const REVIEW_BLOCK_SELECTORS: string[] = [
  '[data-hook="review"]',
  '.review[data-asin]',
  '.review-views .review',
  '[class*="review-container"] [id*="review"]',
];

const MAX_BODY_BYTES = 2048;
const MAX_TITLE_CHARS = 200;
const MAX_REVIEWS = 50;

function simpleHash(s: string): string {
  const n = Array.from(s).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, 0);
  return Math.abs(n).toString(36);
}

function parseRating(el: Element): number | null {
  try {
    const ratingEl =
      el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') ??
      el.querySelector('.a-icon-alt');
    if (!ratingEl) return null;
    const text = ratingEl.textContent?.trim() ?? '';
    const match = text.match(/^(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const val = Math.round(parseFloat(match[1]));
    return val >= 1 && val <= 5 ? val : null;
    /* istanbul ignore next -- defensive catch, not reachable in JSDOM/happy-dom */
  } catch {
    return null;
  }
}

function parseHelpful(el: Element): number {
  const helpfulEl = el.querySelector('[data-hook="helpful-statement"]');
  if (!helpfulEl) return 0;
  const text = helpfulEl.textContent?.trim() ?? '';
  const match = text.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractOne(el: Element): ReviewSample | null {
  const rating = parseRating(el);
  if (rating === null) return null;

  const bodyEl = el.querySelector('[data-hook="review-body"]');
  if (!bodyEl) return null;

  const rawBody = bodyEl.textContent?.trim() ?? '';
  if (!rawBody) return null;

  const titleEl = el.querySelector('[data-hook="review-title"]');
  const rawTitle = (titleEl?.textContent?.trim() ?? '').slice(0, MAX_TITLE_CHARS);

  const dateEl = el.querySelector('[data-hook="review-date"]');
  const date = dateEl?.textContent?.trim() ?? '';

  const body = rawBody.slice(0, MAX_BODY_BYTES);
  const id = el.id || simpleHash(rawTitle + rawBody);
  const verified =
    el.querySelector('[data-hook="avp-badge"]') !== null &&
    (el.querySelector('[data-hook="avp-badge"]')?.textContent ?? '').includes('Verified Purchase');
  const helpful = parseHelpful(el);

  return { id, title: rawTitle, body, rating, date, helpful, verified };
}

export function extractReviews(doc: Document): ReviewSample[] {
  for (const selector of REVIEW_BLOCK_SELECTORS) {
    const elements = Array.from(doc.querySelectorAll(selector));
    if (elements.length === 0) continue;

    const results: ReviewSample[] = [];
    for (const el of elements.slice(0, MAX_REVIEWS)) {
      const sample = extractOne(el);
      if (sample !== null) results.push(sample);
    }
    return results;
  }
  return [];
}
