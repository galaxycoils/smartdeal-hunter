import type { ProductData, Genome, ReviewSample, AuthenticityResult } from '../types';

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

export type ScrapeResponse =
  | {
      success: true;
      payload: {
        asin: string;
        trueValue: number;
        personalFit: number;
        price: number | null;
        currency: string;
        region: string;
      };
    }
  | { success: false; error: string };

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

export interface EnrollAlertRequest {
  type: 'ENROLL_ALERT';
  payload: { asin: string };
}

export interface DisenrollAlertRequest {
  type: 'DISENROLL_ALERT';
  payload: { asin: string };
}

export interface ListEnrolledAlertsRequest {
  type: 'LIST_ENROLLED_ALERTS';
}

export interface ListEnrolledAlertsResponse {
  type: 'ENROLLED_ALERTS';
  payload: { asins: string[] };
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
export interface ComputeAuthenticityRequest {
  type: 'COMPUTE_AUTHENTICITY';
  payload: { samples: ReviewSample[] };
}

export interface AuthenticityResultMessage {
  type: 'AUTHENTICITY_RESULT';
  payload: AuthenticityResult;
}

export type PopupMessage =
  | ScrapeRequest
  | DataWipedMessage
  | EnrollAlertRequest
  | DisenrollAlertRequest
  | ListEnrolledAlertsRequest
  | ListEnrolledAlertsResponse
  | ComputeAuthenticityRequest
  | AuthenticityResultMessage;
