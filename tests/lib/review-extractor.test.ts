import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractReviews, REVIEW_BLOCK_SELECTORS } from '../../lib/review-extractor';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeDocument(html: string): Document {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = html;
  return doc;
}

function loadFixture(name: string): Document {
  const fixturePath = resolve(__dirname, '../fixtures/reviews', name);
  const html = readFileSync(fixturePath, 'utf-8');
  const doc = document.implementation.createHTMLDocument('fixture');
  doc.documentElement.innerHTML = html.replace(/^<!DOCTYPE[^>]*>/i, '').trim();
  return doc;
}

describe('extractReviews', () => {
  // Test 1: empty document returns []
  it('returns [] when doc has no review block', () => {
    const doc = makeDocument('<div>No reviews here</div>');
    expect(extractReviews(doc)).toEqual([]);
  });

  // Test 2: US synthetic fixture returns >= 5 samples
  it('returns >= 5 samples from US synthetic fixture', () => {
    const doc = loadFixture('us-synthetic.html');
    const samples = extractReviews(doc);
    expect(samples.length).toBeGreaterThanOrEqual(5);
  });

  // Test 3: returns at most 50 samples (programmatically clone reviews to 60)
  it('returns at most 50 samples when > 50 reviews present', () => {
    const doc = loadFixture('us-synthetic.html');
    const container = doc.querySelector('#cm_cr-review_list')!;
    const originalReviews = Array.from(container.querySelectorAll('[data-hook="review"]'));
    // Clone reviews to reach 60 total
    for (let i = originalReviews.length; i < 60; i++) {
      const clone = originalReviews[i % originalReviews.length].cloneNode(true) as Element;
      clone.removeAttribute('id');
      container.appendChild(clone);
    }
    const samples = extractReviews(doc);
    expect(samples.length).toBeLessThanOrEqual(50);
  });

  // Test 4: body length <= 2048 chars
  it('truncates body to <= 2048 chars', () => {
    const doc = loadFixture('us-synthetic.html');
    const samples = extractReviews(doc);
    for (const sample of samples) {
      expect(sample.body.length).toBeLessThanOrEqual(2048);
    }
  });

  // Test 5: skips reviews missing rating element
  it('skips reviews missing rating element', () => {
    const html = `
      <div id="cm_cr-review_list">
        <div data-hook="review" id="no-rating-review">
          <span data-hook="review-title">Title without rating</span>
          <div data-hook="review-body"><span>Some body text here</span></div>
          <span data-hook="review-date">January 1, 2025</span>
        </div>
        <div data-hook="review" id="has-rating-review">
          <span data-hook="review-title">Has rating</span>
          <span data-hook="review-star-rating"><span class="a-icon-alt">4.0 out of 5 stars</span></span>
          <div data-hook="review-body"><span>Body text here</span></div>
          <span data-hook="review-date">January 2, 2025</span>
        </div>
      </div>
    `;
    const doc = makeDocument(html);
    const samples = extractReviews(doc);
    expect(samples.length).toBe(1);
    expect(samples[0].title).toBe('Has rating');
  });

  // Test 6: skips reviews missing body element
  it('skips reviews missing body element', () => {
    const html = `
      <div id="cm_cr-review_list">
        <div data-hook="review" id="no-body-review">
          <span data-hook="review-title">No body here</span>
          <span data-hook="review-star-rating"><span class="a-icon-alt">3.0 out of 5 stars</span></span>
          <span data-hook="review-date">January 1, 2025</span>
        </div>
        <div data-hook="review" id="has-body-review">
          <span data-hook="review-title">Has body</span>
          <span data-hook="review-star-rating"><span class="a-icon-alt">5.0 out of 5 stars</span></span>
          <div data-hook="review-body"><span>Body text here</span></div>
          <span data-hook="review-date">January 2, 2025</span>
        </div>
      </div>
    `;
    const doc = makeDocument(html);
    const samples = extractReviews(doc);
    expect(samples.length).toBe(1);
    expect(samples[0].title).toBe('Has body');
  });

  // Test 7: first-selector-wins ordering
  it('uses first matching REVIEW_BLOCK_SELECTORS selector only', () => {
    // Primary selector: [data-hook="review"]
    // Fallback: .review[data-asin]
    // Both match — should only use first selector's results
    const html = `
      <div id="cm_cr-review_list">
        <div data-hook="review" id="primary-review">
          <span data-hook="review-title">Primary selector review</span>
          <span data-hook="review-star-rating"><span class="a-icon-alt">5.0 out of 5 stars</span></span>
          <div data-hook="review-body"><span>Primary body</span></div>
          <span data-hook="review-date">January 1, 2025</span>
        </div>
      </div>
      <div class="review" data-asin="B0001">
        <span data-hook="review-title">Fallback selector review</span>
        <span data-hook="review-star-rating"><span class="a-icon-alt">3.0 out of 5 stars</span></span>
        <div data-hook="review-body"><span>Fallback body</span></div>
        <span data-hook="review-date">January 2, 2025</span>
      </div>
    `;
    const doc = makeDocument(html);
    const samples = extractReviews(doc);
    // Should only get results from first matching selector
    expect(samples.length).toBe(1);
    expect(samples[0].title).toBe('Primary selector review');
  });

  // Test 8: determinism — two calls on same Document return deep-equal results
  it('returns deep-equal results on two calls with same Document', () => {
    const doc = loadFixture('us-synthetic.html');
    const first = extractReviews(doc);
    const second = extractReviews(doc);
    expect(first).toEqual(second);
  });

  // Test 9: verified flag is true only when "Verified Purchase" appears
  it('sets verified=true only when "Verified Purchase" appears', () => {
    const doc = loadFixture('us-synthetic.html');
    const samples = extractReviews(doc);
    // Review 3 (index 2, id review-synth-003) is NOT verified
    const notVerified = samples.find((s) => s.id === 'review-synth-003');
    expect(notVerified).toBeDefined();
    expect(notVerified!.verified).toBe(false);
    // Review 1 (id review-synth-001) IS verified
    const verified = samples.find((s) => s.id === 'review-synth-001');
    expect(verified).toBeDefined();
    expect(verified!.verified).toBe(true);
  });

  // Test 10: body is plain text — no HTML tags survive
  it('body contains no HTML tags (textContent only, no innerHTML)', () => {
    const html = `
      <div id="cm_cr-review_list">
        <div data-hook="review" id="xss-test-review">
          <span data-hook="review-title">XSS test</span>
          <span data-hook="review-star-rating"><span class="a-icon-alt">4.0 out of 5 stars</span></span>
          <div data-hook="review-body"><span>Safe text <script>alert(1)</script> more text</span></div>
          <span data-hook="review-date">January 1, 2025</span>
        </div>
      </div>
    `;
    const doc = makeDocument(html);
    const samples = extractReviews(doc);
    expect(samples.length).toBe(1);
    // textContent of the body element strips tags
    expect(samples[0].body).not.toMatch(/<script/i);
    expect(samples[0].body).not.toMatch(/</);
  });
});

describe('REVIEW_BLOCK_SELECTORS', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(REVIEW_BLOCK_SELECTORS)).toBe(true);
    expect(REVIEW_BLOCK_SELECTORS.length).toBeGreaterThan(0);
    for (const sel of REVIEW_BLOCK_SELECTORS) {
      expect(typeof sel).toBe('string');
    }
  });

  it('has [data-hook="review"] as first selector', () => {
    expect(REVIEW_BLOCK_SELECTORS[0]).toBe('[data-hook="review"]');
  });
});
