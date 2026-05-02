import type { ProductData, Genome } from '../types';

export interface ExecuteScraperRequest {
  type: 'EXECUTE_SCRAPER';
}
export interface ProductDataResponse {
  type: 'PRODUCT_DATA';
  payload: ProductData | null;
}

export interface ComputeScoresRequest {
  type: 'COMPUTE_SCORES';
  payload: { productData: ProductData; genome: Genome };
  target: 'offscreen';
}

export interface ScoreResultResponse {
  type: 'SCORE_RESULT';
  payload: {
    trueValue: number;
    personalFit: number;
    breakdown: Record<string, number>;
  };
}

export interface ComputeScoresError {
  type: 'SCORE_ERROR';
  error: string;
}

export type ContentMessage =
  | ExecuteScraperRequest
  | ProductDataResponse
  | ComputeScoresRequest
  | ScoreResultResponse
  | ComputeScoresError;
export type OffscreenMessage = ComputeScoresRequest | ScoreResultResponse | ComputeScoresError;
