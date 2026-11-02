import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

// Fixed assets (immobilisations), general ledger phase 3 section 9. The JSON API omits null fields.

export type DepreciationMethod = 'LINEAR' | 'DECLINING';
export type AssetStatus = 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
export type AssetPaidFrom = 'BANK' | 'SUSPENSE' | 'SUPPLIER_BILL';

export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  startDate?: string | null;
  acquisitionCost: number;
  residualValue?: number | null;
  method: DepreciationMethod;
  usefulLifeMonths: number;
  coefficient?: number | null;
  assetAccountCode?: string | null;
  depreciationAccountCode?: string | null;
  expenseAccountCode?: string | null;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: AssetStatus;
  disposedAt?: string | null;
  disposalPrice?: number | null;
  supplierInvoiceId?: string | null;
  supplierInvoiceLineIndex?: number | null;
  costCenterId?: string | null;
}

export interface AssetCategory {
  code: string;
  name: string;
  assetAccountCode?: string | null;
  depreciationAccountCode?: string | null;
  expenseAccountCode?: string | null;
  defaultLifeMonths?: number | null;
}

export interface AssetRequest {
  code?: string | null;
  name: string;
  category: string;
  acquisitionDate: string;
  startDate?: string | null;
  acquisitionCost: number;
  residualValue?: number | null;
  method?: DepreciationMethod | null;
  usefulLifeMonths?: number | null;
  supplierInvoiceId?: string | null;
  supplierInvoiceLineIndex?: number | null;
  paidFrom?: AssetPaidFrom | null;
  costCenterId?: string | null;
}

export interface ScheduleRow {
  year: number;
  month: number;
  amount: number;
  cumulated: number;
  netBookValue: number;
  entryId?: string | null;
}

export interface DepreciationResult {
  months: number;
  entries: number;
  total: number;
}

export interface RegisterDisposal {
  date?: string | null;
  price?: number | null;
  netBookValue?: number | null;
  gainOrLoss?: number | null;
}

export interface RegisterRow {
  id?: string | null;
  code: string;
  name: string;
  category?: string | null;
  acquisitionDate: string;
  cost: number;
  method: DepreciationMethod;
  /** Yearly rate, a percentage. */
  rate: number;
  accumulatedStart: number;
  depreciationYear: number;
  accumulatedEnd: number;
  netBookValue: number;
  disposal?: RegisterDisposal | null;
}

export interface RegisterTotals {
  category?: string | null;
  cost: number;
  accumulatedStart: number;
  depreciationYear: number;
  accumulatedEnd: number;
  netBookValue: number;
}

export interface AssetRegister {
  year: number;
  assets?: RegisterRow[] | null;
  categories?: RegisterTotals[] | null;
  totals?: RegisterTotals | null;
}

/** The seeded categories, for when GET /assets/categories cannot be read. */
export const FALLBACK_ASSET_CATEGORIES: AssetCategory[] = [
  { code: 'IT_EQUIPMENT', name: 'Matériel informatique', assetAccountCode: '2355', depreciationAccountCode: '28355', expenseAccountCode: '6193', defaultLifeMonths: 60 },
  { code: 'OFFICE_EQUIPMENT', name: 'Matériel de bureau', assetAccountCode: '2352', depreciationAccountCode: '28352', expenseAccountCode: '6193', defaultLifeMonths: 60 },
  { code: 'OFFICE_FURNITURE', name: 'Mobilier de bureau', assetAccountCode: '2351', depreciationAccountCode: '28351', expenseAccountCode: '6193', defaultLifeMonths: 120 },
  { code: 'VEHICLES', name: 'Matériel de transport', assetAccountCode: '2340', depreciationAccountCode: '28340', expenseAccountCode: '6193', defaultLifeMonths: 60 },
  { code: 'TOOLS', name: 'Matériel et outillage', assetAccountCode: '2332', depreciationAccountCode: '28332', expenseAccountCode: '6193', defaultLifeMonths: 120 },
  { code: 'FITTINGS', name: 'Agencements et installations', assetAccountCode: '2356', depreciationAccountCode: '28356', expenseAccountCode: '6193', defaultLifeMonths: 120 },
  { code: 'SOFTWARE', name: 'Logiciels', assetAccountCode: '2220', depreciationAccountCode: '2822', expenseAccountCode: '6192', defaultLifeMonths: 36 },
];

@Injectable({ providedIn: 'root' })
export class AssetsApi extends BaseApiService {
  list(): Observable<FixedAsset[]> {
    return this.get('/assets');
  }

  categories(): Observable<AssetCategory[]> {
    return this.get('/assets/categories');
  }

  create(body: AssetRequest): Observable<FixedAsset> {
    return this.post('/assets', body);
  }

  update(id: string, body: AssetRequest): Observable<FixedAsset> {
    return this.put(`/assets/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/assets/${id}`);
  }

  schedule(id: string): Observable<ScheduleRow[]> {
    return this.get(`/assets/${id}/schedule`);
  }

  depreciate(upTo: string): Observable<DepreciationResult> {
    return this.post('/assets/depreciate', { upTo });
  }

  dispose(id: string, body: { date: string; price: number; paidTo?: 'BANK' | 'SUSPENSE' }): Observable<FixedAsset> {
    return this.post(`/assets/${id}/dispose`, body);
  }

  register(year: number): Observable<AssetRegister> {
    return this.get('/assets/register', { year });
  }
}
