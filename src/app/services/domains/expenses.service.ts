import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { DimensionValues, Dimensions, dimensionsFromApi, dimensionsToApi } from './dimensions';

/** EMPLOYEE: paid by an employee and owed back through an expense report (note de frais). */
export type PaymentMethod = 'BANK_TRANSFER' | 'CHECK' | 'CASH' | 'CARD' | 'DIRECT_DEBIT' | 'OTHER' | 'EMPLOYEE';

export interface Expense {
  id: string;
  expenseDate: string;
  category: string;
  description?: string | null;
  amount: number;
  vatAmount?: number | null;
  /** Phase 3: the VAT code whose recoverable account the VAT posts to; null with VAT = TVA20. */
  vatCode?: string | null;
  paymentMethod: PaymentMethod;
  vendorPartnerId?: string | null;
  vendorName?: string | null;
  reference?: string | null;
  /** Cost center (general ledger), put on the expense's posting line. */
  costCenterId?: string | null;
  /** The expense report (note de frais) the expense is a line of; such an expense is edited there only. */
  expenseReportId?: string | null;
  /** Its number (NF-…), when the API sends it; null while the report is a draft. */
  expenseReportNumber?: string | null;
  paidByEmployee?: boolean | null;
  createdAt: string;
  /** Analytic dimensions (mission, deal, customer, vendor), normalised by expenseFromApi. */
  dims: DimensionValues;
}

/** The fields POST and PUT /expenses take. */
export type ExpenseInput = Partial<Omit<Expense, 'dims'>> & { dims?: Dimensions | null };

/** An expense (or an expense-report line) as the API sends it: the dimensions are read in dimensions.ts. */
export function expenseFromApi<T extends object>(r: T): T & { dims: DimensionValues } {
  return { ...r, dims: dimensionsFromApi(r as Record<string, unknown>) };
}

/** A request body with its dimensions flattened the way the API takes them. */
export function expenseToApi<T extends { dims?: Dimensions | null }>(body: T): Omit<T, 'dims'> & Record<string, unknown> {
  const { dims, ...rest } = body;
  return { ...rest, ...dimensionsToApi(dims, { expense: true }) };
}

export interface ExpenseSummary {
  total: number;
  vat: number;
  count: number;
  byCategory: { category: string; amount: number; vat: number; count: number }[];
  categories: string[];
}

/** Expenses (backend: ExpenseController). */
@Injectable({ providedIn: 'root' })
export class ExpensesApi extends BaseApiService {
  list(from: string, to: string, category?: string | null): Observable<{ content: Expense[] }> {
    const params: Record<string, string | number> = { from, to, size: 500 };
    if (category) params['category'] = category;
    return this.get<{ content: Record<string, unknown>[] }>('/expenses', params).pipe(
      map(page => ({ ...page, content: (page?.content ?? []).map(e => expenseFromApi(e) as unknown as Expense) })));
  }

  summary(from: string, to: string): Observable<ExpenseSummary> {
    return this.get('/expenses/summary', { from, to });
  }

  save(e: ExpenseInput, id?: string): Observable<Expense> {
    const body = expenseToApi(e);
    return (id ? this.put<Record<string, unknown>>(`/expenses/${id}`, body) : this.post<Record<string, unknown>>('/expenses', body))
      .pipe(map(r => expenseFromApi(r ?? {}) as unknown as Expense));
  }

  remove(id: string): Observable<void> {
    return this.delete(`/expenses/${id}`);
  }
}
