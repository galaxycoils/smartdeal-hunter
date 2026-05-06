/**
 * lib/sentiment.ts
 *
 * Local-only sentiment analysis with three-tier degradation per CLAUDE.md
 * (Gemini Nano via Chrome on-device Prompt API → pure-JS heuristic fallback).
 *
 * No remote calls. No telemetry. All inputs and outputs stay on device.
 */

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  sentiment: SentimentLabel;
  confidence: number;
  summary?: string;
  error?: string;
}

interface AISummarizer {
  summarize(text: string): Promise<string>;
}

interface AISummarizerNamespace {
  create(): Promise<AISummarizer>;
}

interface ChromeAI {
  summarizer?: AISummarizerNamespace;
}

const POSITIVE = [
  'great',
  'love',
  'excellent',
  'amazing',
  'best',
  'perfect',
  'good',
  'recommend',
  'awesome',
  'fantastic',
];

const NEGATIVE = [
  'bad',
  'terrible',
  'worst',
  'awful',
  'broken',
  'poor',
  'disappointed',
  'hate',
  'waste',
  'returned',
];

const heuristicScore = (text: string): SentimentResult => {
  const lower = text.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE) {
    if (lower.includes(w)) pos++;
  }
  for (const w of NEGATIVE) {
    if (lower.includes(w)) neg++;
  }
  const score = pos - neg;
  const sentiment: SentimentLabel = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  const total = pos + neg;
  const confidence = total === 0 ? 0 : Math.min(1, total / 5);
  return { sentiment, confidence };
};

const getAi = (): ChromeAI | undefined => {
  return (globalThis as unknown as { ai?: ChromeAI }).ai;
};

export const analyzeSentiment = async (text: string): Promise<SentimentResult> => {
  const ai = getAi();
  if (!ai?.summarizer) {
    return heuristicScore(text);
  }
  try {
    const summarizer = await ai.summarizer.create();
    const summary = await summarizer.summarize(text);
    const base = heuristicScore(summary);
    return { ...base, summary };
  } catch (err) {
    const fallback = heuristicScore(text);
    return { ...fallback, error: err instanceof Error ? err.message : String(err) };
  }
};

export const getSentimentSummary = async (text: string): Promise<string> => {
  const r = await analyzeSentiment(text);
  if (r.summary) return r.summary;
  const label = r.sentiment.charAt(0).toUpperCase() + r.sentiment.slice(1);
  return `Sentiment Analysis: ${label}. Summary: ${text.substring(0, 50)}...`;
};
