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

export function extractFromDom(doc: Document): Partial<ProductData> | null {
  const titleEl = doc.getElementById('productTitle');
  const title = titleEl ? titleEl.textContent?.trim() || '' : '';

  const priceEl = doc.querySelector('.a-price .a-offscreen');
  let price: number | null = null;
  if (priceEl && priceEl.textContent) {
    const match = priceEl.textContent.match(/[\d.]+/);
    if (match) {
      price = parseFloat(match[0]);
    }
  }

  const ratingEl = doc.querySelector('#acrPopover');
  let rating: number | null = null;
  if (ratingEl && ratingEl.getAttribute('title')) {
    const match = ratingEl.getAttribute('title')?.match(/([\d.]+)\s*out of/);
    if (match) rating = parseFloat(match[1]);
  }

  const reviewEl = doc.getElementById('acrCustomerReviewText');
  let reviewCount: number | null = null;
  if (reviewEl && reviewEl.textContent) {
    const match = reviewEl.textContent.replace(/,/g, '').match(/(\d+)/);
    if (match) reviewCount = parseInt(match[1], 10);
  }

  const imgEl = doc.getElementById('landingImage');
  const imageUrl = imgEl ? imgEl.getAttribute('src') || null : null;

  return {
    title,
    price,
    currency: 'USD',
    rating,
    reviewCount,
    imageUrl,
  };
}

export function scrapeProduct(url: string, doc: Document, now = Date.now): ProductData | null {
  const asin = extractAsinFromUrl(url);
  if (!asin) return null;

  const ldData = extractFromJsonLd(doc);
  const domData = extractFromDom(doc);

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
