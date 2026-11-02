import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import type { Entry } from './ledger.service';

// General ledger phase 3, wave B: lock date and year-end, VAT summary and settlement,
// stock change and the cut-off assistant (contract sections 5-8). The JSON API omits null fields.

export type VatRegime = 'ENCAISSEMENT' | 'DEBIT';
export type VatPeriod = 'MONTHLY' | 'QUARTERLY';

export interface LedgerSettings {
  lockDate?: string | null;
  vatRegime: VatRegime;
  vatPeriod: VatPeriod;
  fiscalYearStartMonth: number;
}

/** A partial update: `lockDate: null` removes the lock date. */
export interface LedgerSettingsUpdate {
  lockDate?: string | null;
  vatRegime?: VatRegime;
  vatPeriod?: VatPeriod;
  fiscalYearStartMonth?: number;
}

export interface FiscalYear {
  year: number;
  status: 'OPEN' | 'CLOSED';
  startDate?: string | null;
  endDate?: string | null;
  closedAt?: string | null;
  resultEntryId?: string | null;
  openingEntryId?: string | null;
}

/** `rate` is a percentage (20 for TVA20). */
export interface VatSummaryLine {
  vatCode: string;
  rate: number;
  base: number;
  vat: number;
}

export interface VatSummary {
  from: string;
  to: string;
  regime: VatRegime;
  collected?: VatSummaryLine[] | null;
  recoverable?: VatSummaryLine[] | null;
  totalCollected: number;
  totalRecoverable: number;
  creditCarriedIn: number;
  due: number;
  credit: number;
  settlementEntryId?: string | null;
  taxDeadlineId?: string | null;
}

export interface StockChange {
  date?: string | null;
  opening: number;
  closing: number;
  change: number;
  entryId?: string | null;
}

export type CutoffType = 'FNP' | 'FAE' | 'CCA' | 'PCA';

export interface CutoffItem {
  key: string;
  sourceType?: string | null;
  sourceId?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  label: string;
  base: number;
  vatCode?: string | null;
  vat: number;
  accountId?: string | null;
  accountCode?: string | null;
}

export interface CutoffProposals {
  date: string;
  fnp?: CutoffItem[] | null;
  fae?: CutoffItem[] | null;
  cca?: CutoffItem[] | null;
  pca?: CutoffItem[] | null;
}

export interface CutoffLineRequest {
  type: CutoffType;
  accountId: string;
  partnerId?: string | null;
  base: number;
  vatCode?: string | null;
  label: string;
  sourceType?: string | null;
  sourceId?: string | null;
}

/** The cut-off posted on a date and its reversal on the next day (no entryId when none is posted). */
export interface PostedCutoff {
  date?: string | null;
  entryId?: string | null;
  reversalEntryId?: string | null;
  reversalDate?: string | null;
  entry?: Entry | null;
  reversal?: Entry | null;
}

function q(params: Record<string, string>): string {
  return '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

@Injectable({ providedIn: 'root' })
export class ClosingApi extends BaseApiService {
  // 5. Settings and years
  settings(): Observable<LedgerSettings> {
    return this.get('/ledger/settings');
  }

  updateSettings(body: LedgerSettingsUpdate): Observable<LedgerSettings> {
    return this.put('/ledger/settings', body);
  }

  years(): Observable<FiscalYear[]> {
    return this.get('/ledger/years');
  }

  closeYear(year: number): Observable<unknown> {
    return this.post(`/ledger/years/${year}/close`, {});
  }

  reopenYear(year: number): Observable<unknown> {
    return this.post(`/ledger/years/${year}/reopen`, {});
  }

  // 6. VAT
  vat(from: string, to: string): Observable<VatSummary> {
    return this.get('/ledger/vat', { from, to });
  }

  settleVat(from: string, to: string): Observable<unknown> {
    return this.post('/ledger/vat/settle', { from, to });
  }

  cancelVatSettlement(from: string, to: string): Observable<unknown> {
    return this.delete('/ledger/vat/settle' + q({ from, to }));
  }

  // 7. Stock change
  stockChange(date: string): Observable<StockChange> {
    return this.get('/ledger/stock-change', { date });
  }

  postStockChange(date: string): Observable<unknown> {
    return this.post('/ledger/stock-change', { date });
  }

  deleteStockChange(date: string): Observable<unknown> {
    return this.delete('/ledger/stock-change' + q({ date }));
  }

  // 8. Cut-off
  cutoffProposals(date: string): Observable<CutoffProposals> {
    return this.get('/ledger/cutoff/proposals', { date });
  }

  cutoff(date: string): Observable<PostedCutoff | null> {
    return this.get('/ledger/cutoff', { date });
  }

  postCutoff(date: string, lines: CutoffLineRequest[]): Observable<unknown> {
    return this.post('/ledger/cutoff', { date, lines });
  }

  deleteCutoff(date: string): Observable<unknown> {
    return this.delete('/ledger/cutoff' + q({ date }));
  }
}

/** yyyy-mm-dd of a local date. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The day after an ISO date. */
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + 1));
}

/** The last day of the month before today: the usual closing date. */
export function lastMonthEnd(): string {
  const t = new Date();
  return isoDay(new Date(t.getFullYear(), t.getMonth(), 0));
}

/** The VAT period (month or quarter) holding a date: its first and last days. */
export function vatPeriodOf(iso: string, period: VatPeriod): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number);
  const startMonth = period === 'QUARTERLY' ? Math.floor((m - 1) / 3) * 3 : m - 1;
  const len = period === 'QUARTERLY' ? 3 : 1;
  return { from: isoDay(new Date(y, startMonth, 1)), to: isoDay(new Date(y, startMonth + len, 0)) };
}
