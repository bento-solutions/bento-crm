import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

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
    return this.get('/expenses', params);
  }

  summary(from: string, to: string): Observable<ExpenseSummary> {
    return this.get('/expenses/summary', { from, to });
  }

  save(e: Partial<Expense>, id?: string): Observable<Expense> {
    return id ? this.put(`/expenses/${id}`, e) : this.post('/expenses', e);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/expenses/${id}`);
  }
}
