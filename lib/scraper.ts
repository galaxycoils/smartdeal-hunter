import type { ProductData } from './types';

export function extractAsinFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    // Patterns: /dp/([A-Z0-9]{10}), /gp/product/([A-Z0-9]{10}), /product/([A-Z0-9]{10})
    const match = path.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function extractFromJsonLd(doc: Document): Partial<ProductData> | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data && data['@type'] === 'Product') {
        return {
          title: data.name || null,
          imageUrl: data.image || null,
          rating: data.aggregateRating?.ratingValue
            ? parseFloat(data.aggregateRating.ratingValue)
            : null,
          reviewCount: data.aggregateRating?.reviewCount
            ? parseInt(data.aggregateRating.reviewCount, 10)
            : null,
          price: data.offers?.price ? parseFloat(data.offers.price) : null,
          currency: data.offers?.priceCurrency || 'USD',
          jsonLd: data,
        };
      }
    } catch {
      // Ignore parse errors, try next script
    }
  }
  return null;
}

export function extractFromDom(doc: Document, url: string = ''): Partial<ProductData> | null {
  const titleEl = doc.getElementById('productTitle');
  const title = titleEl ? titleEl.textContent?.trim() || '' : '';

  const priceEl = doc.querySelector('.a-price .a-offscreen');
  let price: number | null = null;
  let currency = 'USD';

  // Basic TLD-based currency detection
  if (url.includes('.co.uk')) currency = 'GBP';
  else if (url.includes('.de') || url.includes('.fr') || url.includes('.it') || url.includes('.es'))
    currency = 'EUR';
  else if (url.includes('.co.jp')) currency = 'JPY';
  else if (url.includes('.ca')) currency = 'CAD';

  if (priceEl && priceEl.textContent) {
    const priceStr = priceEl.textContent;

    // Normalize: remove currency symbols
    // Handle specific European formats (1.234,56 -> 1234.56 or 42,99 -> 42.99)
    // Strategy: find all digits and separators, decide if last separator is decimal
    const matches = priceStr.match(/[\d.,]+/);
    if (matches) {
      let cleaned = matches[0];
      const lastDot = cleaned.lastIndexOf('.');
      const lastComma = cleaned.lastIndexOf(',');

      if (lastComma > lastDot) {
        // Assume comma is decimal separator: 1.234,56 -> 1234.56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > lastComma) {
        // Assume dot is decimal separator: 1,234.56 -> 1234.56
        cleaned = cleaned.replace(/,/g, '');
      }
      price = parseFloat(cleaned);
    }
  }

  const ratingEl = doc.querySelector('#acrPopover');
  let rating: number | null = null;
  if (ratingEl && ratingEl.getAttribute('title')) {
    const title = ratingEl.getAttribute('title') || '';
    // Handle international ratings: "4.5 out of 5", "4,5 von 5", "5つ星のうち4.5"
    // Extract decimal number
    const match = title.match(/(\d+[,.]\d+)/) || title.match(/(\d+)/);
    if (match) {
      const val = match[1].replace(',', '.');
      rating = parseFloat(val);
    }
  }

  const reviewEl = doc.getElementById('acrCustomerReviewText');
  let reviewCount: number | null = null;
  if (reviewEl && reviewEl.textContent) {
    // Remove all non-digits to be safe
    const match = reviewEl.textContent.replace(/[^\d]/g, '').match(/(\d+)/);
    if (match) reviewCount = parseInt(match[1], 10);
  }

  const imgEl = doc.getElementById('landingImage');
  const imageUrl = imgEl ? imgEl.getAttribute('src') || null : null;

  return {
    title,
    price,
    currency,
    rating,
    reviewCount,
    imageUrl,
  };
}

export function scrapeProduct(url: string, doc: Document, now = Date.now): ProductData | null {
  const asin = extractAsinFromUrl(url);
  if (!asin) return null;

  const ldData = extractFromJsonLd(doc);
  const domData = extractFromDom(doc, url);

  const merged: ProductData = {
    asin,
    title: ldData?.title || domData?.title || '',
    price: ldData?.price || domData?.price || null,
    currency: ldData?.currency || domData?.currency || 'USD',
    rating: ldData?.rating || domData?.rating || null,
    reviewCount: ldData?.reviewCount || domData?.reviewCount || null,
    imageUrl: ldData?.imageUrl || domData?.imageUrl || null,
    jsonLd: ldData?.jsonLd || null,
    url,
    scrapedAt: now(),
    source: 'url', // fallback
    listPrice: null,
    unitPrice: null,
    quantity: null,
  };

  if (ldData && (ldData.title || ldData.price)) {
    merged.source = 'jsonld';
  } else if (domData && (domData.title || domData.price)) {
    merged.source = 'dom';
  }

  return merged;
}
