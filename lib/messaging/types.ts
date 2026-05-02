import type { ProductData, Genome } from '../types';

export interface ExecuteScraperRequest {
  type: 'EXECUTE_SCRAPER';
}
export interface ProductDataResponse {
  type: 'PRODUCT_DATA';
  payload: ProductData | null;
}

export interface ScrapeRequest {
  type: 'SCRAPE_REQUEST';
  tabId?: number;
}

export interface RenderPanelMessage {
  type: 'RENDER_PANEL';
  payload: {
    asin: string;
    trueValue: number;
    personalFit: number;
  };
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

export interface UpdateGenomeRequest {
  type: 'UPDATE_GENOME';
  payload: {
    asin: string;
    feedbackType: 'not_interested' | 'saved' | 'purchased';
  };
}

export interface DataWipedMessage {
  type: 'DATA_WIPED';
}

export type ContentMessage =
  | ExecuteScraperRequest
  | ProductDataResponse
  | ComputeScoresRequest
  | ScoreResultResponse
  | ComputeScoresError
  | RenderPanelMessage
  | UpdateGenomeRequest
  | DataWipedMessage;
export type OffscreenMessage =
  | ComputeScoresRequest
  | ScoreResultResponse
  | ComputeScoresError
  | DataWipedMessage;
export type PopupMessage = ScrapeRequest | DataWipedMessage;
