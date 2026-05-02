import type { ProductData } from '../types';

export interface ExecuteScraperRequest {
  type: 'EXECUTE_SCRAPER';
}
export interface ProductDataResponse {
  type: 'PRODUCT_DATA';
  payload: ProductData | null;
}

export type ContentMessage = ExecuteScraperRequest | ProductDataResponse;
