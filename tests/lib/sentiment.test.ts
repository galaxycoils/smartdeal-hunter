import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeSentiment, getSentimentSummary } from '../../lib/sentiment';

type GlobalWithAi = typeof globalThis & {
  ai?: {
    summarizer?: {
      create: () => Promise<{ summarize: (t: string) => Promise<string> }>;
    };
  };
};

const g = globalThis as GlobalWithAi;

describe('lib/sentiment — heuristic (Nano absent)', () => {
  beforeEach(() => {
    delete g.ai;
  });

  it('positive keywords yield positive sentiment with bounded confidence', async () => {
    const r = await analyzeSentiment('Great product, I love it. Excellent value, amazing quality.');
    expect(r.sentiment).toBe('positive');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.summary).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  it('negative keywords yield negative sentiment', async () => {
    const r = await analyzeSentiment('Terrible. Broken on arrival. Worst purchase, returned it.');
    expect(r.sentiment).toBe('negative');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('no keywords yield neutral with zero confidence', async () => {
    const r = await analyzeSentiment('the the the');
    expect(r.sentiment).toBe('neutral');
    expect(r.confidence).toBe(0);
  });

  it('confidence caps at 1.0 even when many keywords present', async () => {
    const text =
      'great love excellent amazing best perfect good recommend awesome fantastic ' +
      'great love excellent';
    const r = await analyzeSentiment(text);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('equal positive and negative score yields neutral', async () => {
    const r = await analyzeSentiment('great but bad');
    expect(r.sentiment).toBe('neutral');
  });
});

describe('lib/sentiment — Nano available', () => {
  beforeEach(() => {
    g.ai = {
      summarizer: {
        create: vi
          .fn()
          .mockResolvedValue({ summarize: vi.fn().mockResolvedValue('Great summary, love it.') }),
      },
    };
  });

  afterEach(() => {
    delete g.ai;
  });

  it('calls Nano summarizer and returns summary plus heuristic on the summary', async () => {
    const r = await analyzeSentiment(
      'Long product description that should be summarized by on-device Nano.',
    );
    expect(g.ai!.summarizer!.create).toHaveBeenCalledTimes(1);
    expect(r.summary).toBe('Great summary, love it.');
    expect(r.sentiment).toBe('positive');
    expect(r.error).toBeUndefined();
  });
});

describe('lib/sentiment — Nano error', () => {
  beforeEach(() => {
    g.ai = {
      summarizer: {
        create: vi.fn().mockRejectedValue(new Error('Nano unavailable in this region')),
      },
    };
  });

  afterEach(() => {
    delete g.ai;
  });

  it('falls back to heuristic on the original text and surfaces the error', async () => {
    const r = await analyzeSentiment('This is a great product I really love.');
    expect(r.sentiment).toBe('positive');
    expect(r.error).toBe('Nano unavailable in this region');
    expect(r.summary).toBeUndefined();
  });

  it('handles non-Error throwables in the catch branch', async () => {
    g.ai = {
      summarizer: {
        create: vi.fn().mockRejectedValue('string-error-not-Error-instance'),
      },
    };
    const r = await analyzeSentiment('terrible product, returned it');
    expect(r.sentiment).toBe('negative');
    expect(r.error).toBe('string-error-not-Error-instance');
  });
});

describe('lib/sentiment — getSentimentSummary string facade', () => {
  beforeEach(() => {
    delete g.ai;
  });

  it('returns Nano summary verbatim when present', async () => {
    g.ai = {
      summarizer: {
        create: vi
          .fn()
          .mockResolvedValue({ summarize: vi.fn().mockResolvedValue('Concise Nano summary.') }),
      },
    };
    const s = await getSentimentSummary('long text');
    expect(s).toBe('Concise Nano summary.');
    delete g.ai;
  });

  it('returns formatted heuristic string when Nano absent', async () => {
    const s = await getSentimentSummary('Great product, I love it!');
    expect(s).toMatch(/^Sentiment Analysis: Positive\. Summary:/);
  });

  it('falls back to neutral label when no keywords match', async () => {
    const s = await getSentimentSummary('the the the');
    expect(s).toMatch(/^Sentiment Analysis: Neutral\./);
  });
});
