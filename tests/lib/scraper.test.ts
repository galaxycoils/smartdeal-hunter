import { describe, it, expect } from 'vitest';
import {
  extractAsinFromUrl,
  extractFromJsonLd,
  extractFromDom,
  scrapeProduct,
} from '../../lib/scraper';

// Simple helper to create a mock Document
function createDocument(html: string): Document {
  // In happy-dom environment, standard DOM APIs are available globally
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html;
  return doc;
}

describe('Amazon Scraper', () => {
  describe('extractAsinFromUrl', () => {
    it('extracts ASIN from /dp/ pattern', () => {
      expect(extractAsinFromUrl('https://www.amazon.com/dp/B07XJ8C8F5')).toBe('B07XJ8C8F5');
      expect(extractAsinFromUrl('https://www.amazon.com/dp/B07XJ8C8F5?th=1')).toBe('B07XJ8C8F5');
    });

    it('extracts ASIN from /gp/product/ pattern', () => {
      expect(extractAsinFromUrl('https://www.amazon.com/gp/product/B0CHX1W1XY/ref=cx_skuctr')).toBe(
        'B0CHX1W1XY',
      );
    });

    it('extracts ASIN from /product/ pattern', () => {
      expect(extractAsinFromUrl('https://amazon.com/product/B00ABCDEFG')).toBe('B00ABCDEFG');
    });

    it('returns null for non-product URLs', () => {
      expect(extractAsinFromUrl('https://www.amazon.com/cart')).toBeNull();
      expect(extractAsinFromUrl('https://www.amazon.com/b?node=123')).toBeNull();
    });

    it('returns null for incomplete ASINs', () => {
      expect(extractAsinFromUrl('https://www.amazon.com/dp/B0CHX1W')).toBeNull(); // 7 chars
    });
  });

  describe('extractFromJsonLd', () => {
    it('extracts fields from valid Product JSON-LD', () => {
      const html =
        '' +
        '<script type="application/ld+json">\n' +
        '  {\n' +
        '    "@context": "https://schema.org/",\n' +
        '    "@type": "Product",\n' +
        '    "name": "Awesome Coffee Maker",\n' +
        '    "image": "https://example.com/image.jpg",\n' +
        '    "aggregateRating": {\n' +
        '      "@type": "AggregateRating",\n' +
        '      "ratingValue": "4.5",\n' +
        '      "reviewCount": "1200"\n' +
        '    },\n' +
        '    "offers": {\n' +
        '      "@type": "Offer",\n' +
        '      "price": "99.99",\n' +
        '      "priceCurrency": "USD"\n' +
        '    }\n' +
        '  }\n' +
        '</script>';
      const doc = createDocument(html);
      const data = extractFromJsonLd(doc);

      expect(data).toEqual({
        title: 'Awesome Coffee Maker',
        imageUrl: 'https://example.com/image.jpg',
        rating: 4.5,
        reviewCount: 1200,
        price: 99.99,
        currency: 'USD',
        jsonLd: expect.any(Object),
      });
    });

    it('returns null for malformed JSON without throwing', () => {
      const html = `<script type="application/ld+json">{ "@type": "Product", "name": "Broken </script>"`;
      const doc = createDocument(html);
      expect(extractFromJsonLd(doc)).toBeNull();
    });

    it('returns null if only BreadcrumbList is present', () => {
      const html = `<script type="application/ld+json">{ "@type": "BreadcrumbList" }</script>`;
      const doc = createDocument(html);
      expect(extractFromJsonLd(doc)).toBeNull();
    });

    it('picks Product block when multiple LD blocks are present', () => {
      const html =
        '' +
        '<script type="application/ld+json">{ "@type": "Organization", "name": "Amazon" }</script>\n' +
        '<script type="application/ld+json">{ "@type": "Product", "name": "Target Product" }</script>';
      const doc = createDocument(html);
      const data = extractFromJsonLd(doc);
      expect(data?.title).toBe('Target Product');
    });
  });

  describe('extractFromDom', () => {
    it('extracts all fields from full DOM fixture', () => {
      const html =
        '' +
        '<span id="productTitle"> DOM Title </span>\n' +
        '<div class="a-price"><span class="a-offscreen">$42.99</span></div>\n' +
        '<div id="acrPopover" title="4.2 out of 5 stars"></div>\n' +
        '<span id="acrCustomerReviewText">845 ratings</span>\n' +
        '<img id="landingImage" src="https://example.com/dom.jpg" />';
      const doc = createDocument(html);
      const data = extractFromDom(doc);

      expect(data).toEqual({
        title: 'DOM Title',
        price: 42.99,
        currency: 'USD',
        rating: 4.2,
        reviewCount: 845,
        imageUrl: 'https://example.com/dom.jpg',
      });
    });

    it('returns title empty string if #productTitle is missing', () => {
      const html = `<div class="a-price"><span class="a-offscreen">$42.99</span></div>`;
      const doc = createDocument(html);
      expect(extractFromDom(doc)?.title).toBe('');
    });

    it('returns price null if price is missing', () => {
      const html = `<span id="productTitle"> DOM Title </span>`;
      const doc = createDocument(html);
      expect(extractFromDom(doc)?.price).toBeNull();
    });
  });

  describe('scrapeProduct', () => {
    it('prioritizes JSON-LD over DOM when both exist', () => {
      const html =
        '' +
        '<script type="application/ld+json">\n' +
        '  { "@type": "Product", "name": "JSON-LD Title", "offers": { "price": "10.00", "priceCurrency": "USD" } }\n' +
        '</script>\n' +
        '<span id="productTitle"> DOM Title </span>\n' +
        '<div class="a-price"><span class="a-offscreen">$20.00</span></div>';
      const doc = createDocument(html);
      const data = scrapeProduct('https://amazon.com/dp/B000000001', doc, () => 1000);

      expect(data).toMatchObject({
        asin: 'B000000001',
        title: 'JSON-LD Title',
        price: 10,
        source: 'jsonld',
        scrapedAt: 1000,
      });
    });

    it('falls back to DOM when JSON-LD is missing', () => {
      const html =
        '' +
        '<span id="productTitle"> DOM Title </span>\n' +
        '<div class="a-price"><span class="a-offscreen">$20.00</span></div>';
      const doc = createDocument(html);
      const data = scrapeProduct('https://amazon.com/dp/B000000001', doc, () => 1000);

      expect(data).toMatchObject({
        asin: 'B000000001',
        title: 'DOM Title',
        price: 20,
        source: 'dom',
      });
    });

    it('returns object with nulls if neither JSON-LD nor DOM provide data', () => {
      const doc = createDocument('');
      const data = scrapeProduct('https://amazon.com/dp/B000000001', doc, () => 1000);

      expect(data).toEqual({
        asin: 'B000000001',
        title: '',
        price: null,
        currency: 'USD',
        rating: null,
        reviewCount: null,
        imageUrl: null,
        jsonLd: null,
        url: 'https://amazon.com/dp/B000000001',
        scrapedAt: 1000,
        source: 'url',
      });
    });

    it('returns null if no ASIN is found in URL', () => {
      const doc = createDocument('<span id="productTitle">Title</span>');
      expect(scrapeProduct('https://amazon.com/cart', doc)).toBeNull();
    });
  });
});
