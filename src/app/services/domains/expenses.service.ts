import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type PaymentMethod = 'BANK_TRANSFER' | 'CHECK' | 'CASH' | 'CARD' | 'DIRECT_DEBIT' | 'OTHER';

export interface Expense {
  id: string;
  expenseDate: string;
  category: string;
  description?: string | null;
  amount: number;
  vatAmount?: number | null;
  paymentMethod: PaymentMethod;
  vendorPartnerId?: string | null;
  vendorName?: string | null;
  reference?: string | null;
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
