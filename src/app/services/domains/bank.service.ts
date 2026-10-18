import { Injectable } from '@angular/core';
import { Observable, catchError, timeout } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import type { PageResponse } from '../api.service';

export type BankCode = 'ATTIJARIWAFA' | 'BANK_OF_AFRICA' | 'CIH' | 'BANQUE_POPULAIRE' | 'SOCIETE_GENERALE' | 'BMCI'
  | 'CREDIT_AGRICOLE' | 'CREDIT_DU_MAROC' | 'AL_BARID' | 'OTHER';
export type BankTxStatus = 'UNMATCHED' | 'MATCHED' | 'IGNORED';
export type CategorySource = 'RULE' | 'KEYWORD' | 'AI' | 'MANUAL' | 'MATCH';
export type RuleDirection = 'IN' | 'OUT' | 'ANY';
export type CandidateKind = 'INVOICE' | 'PAYMENT' | 'EXPENSE';
export type ForecastKind = 'RECEIVABLE' | 'PAYABLE' | 'RECURRING_INVOICE' | 'RECURRING_COST';

export const BANK_CODES: BankCode[] = ['ATTIJARIWAFA', 'BANK_OF_AFRICA', 'CIH', 'BANQUE_POPULAIRE', 'SOCIETE_GENERALE',
  'BMCI', 'CREDIT_AGRICOLE', 'CREDIT_DU_MAROC', 'AL_BARID', 'OTHER'];

/** The JSON API omits null fields, so every nullable field is optional here. */
export interface BankAccount {
  id: string;
  name: string;
  bank?: BankCode | null;
  accountNumber: string;
  currency?: string | null;
  openingBalance?: number | null;
  openingDate?: string | null;
  active: boolean;
  balance?: number | null;
  lastTransactionDate?: string | null;
  unmatched?: number | null;
}

export interface BankAccountRequest {
  name: string;
  bank?: BankCode | null;
  accountNumber: string;
  currency?: string | null;
  openingBalance?: number | null;
  openingDate?: string | null;
  active?: boolean | null;
}

export interface BankImport {
  id: string;
  bankAccountId: string;
  fileId?: string | null;
  inboundDocumentId?: string | null;
  format?: string | null;
  parser?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  rowsImported: number;
  rowsSkipped: number;
  balanceMismatch: boolean;
  createdAt?: string | null;
}

export interface ImportResult {
  importSummary: BankImport;
  detectedBank?: BankCode | null;
  detectedAccountNumber?: string | null;
  autoMatched: number;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  bookingDate: string;
  valueDate?: string | null;
  description?: string | null;
  reference?: string | null;
  amount: number;
  balanceAfter?: number | null;
  category?: string | null;
  categorySource?: CategorySource | null;
  status: BankTxStatus;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  paymentId?: string | null;
  expenseId?: string | null;
  paymentCreated?: boolean | null;
  matchLabel?: string | null;
}

export interface MatchCandidate {
  kind: CandidateKind;
  id: string;
  label?: string | null;
  partnerName?: string | null;
  date?: string | null;
  amount?: number | null;
  outstanding?: number | null;
  score?: number | null;
  reason?: string | null;
}

export interface BankRule {
  id: string;
  containsText: string;
  direction: RuleDirection;
  category: string;
}

export interface CategoryTotal { category: string; amount: number }
export interface CashMonth { month: string; inflow: number; outflow: number }
export interface ForecastHorizon { days: number; inflow: number; outflow: number; endBalance: number }
export interface ForecastWeek { weekStart: string; inflow: number; outflow: number; balance: number }
export interface ForecastItem { date: string; kind: ForecastKind; label?: string | null; amount: number; invoiceId?: string | null }

export interface CashForecast {
  from?: string | null;
  startBalance?: number | null;
  horizons?: ForecastHorizon[] | null;
  weeks?: ForecastWeek[] | null;
  lowestBalance?: number | null;
  lowestWeek?: string | null;
  items?: ForecastItem[] | null;
  recurringMonthly?: CategoryTotal[] | null;
}

export interface CashDashboard {
  totalBalance?: number | null;
  accounts?: BankAccount[] | null;
  unmatched?: number | null;
  uncategorized?: number | null;
  months?: CashMonth[] | null;
  outflowByCategory?: CategoryTotal[] | null;
  forecast?: CashForecast | null;
}

export interface TransactionFilter {
  accountId?: string | null;
  status?: BankTxStatus | null;
  /** A category, or "NONE" for lines without one. */
  category?: string | null;
  direction?: 'IN' | 'OUT' | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
}

/** Bank accounts, statements, reconciliation and the cash dashboard (backend: BankController). */
@Injectable({ providedIn: 'root' })
export class BankApi extends BaseApiService {
  dashboard(): Observable<CashDashboard> {
    return this.get('/bank/dashboard');
  }

  categories(): Observable<string[]> {
    return this.get('/bank/categories');
  }

  // Accounts
  accounts(): Observable<BankAccount[]> {
    return this.get('/bank/accounts');
  }

  saveAccount(body: BankAccountRequest, id?: string): Observable<BankAccount> {
    return id ? this.put(`/bank/accounts/${id}`, body) : this.post('/bank/accounts', body);
  }

  deleteAccount(id: string): Observable<void> {
    return this.delete(`/bank/accounts/${id}`);
  }

  // Statements
  uploadStatement(accountId: string, file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.slowPost(`/bank/accounts/${accountId}/statements`, form);
  }

  importDocument(documentId: string, accountId: string): Observable<ImportResult> {
    return this.slowPost(`/bank/statements/from-document/${documentId}?accountId=${encodeURIComponent(accountId)}`, {});
  }

  statements(accountId?: string | null): Observable<BankImport[]> {
    return this.get('/bank/statements', accountId ? { accountId } : undefined);
  }

  deleteStatement(id: string): Observable<void> {
    return this.delete(`/bank/statements/${id}`);
  }

  // Lines
  transactions(f: TransactionFilter, page = 0, size = 50): Observable<PageResponse<BankTransaction>> {
    const params: Record<string, string | number> = { page, size };
    for (const [k, v] of Object.entries(f)) {
      if (v !== null && v !== undefined && String(v).trim() !== '') params[k] = String(v).trim();
    }
    return this.get('/bank/transactions', params);
  }

  candidates(id: string): Observable<MatchCandidate[]> {
    return this.get(`/bank/transactions/${id}/candidates`);
  }

  match(id: string, kind: CandidateKind, targetId: string): Observable<BankTransaction> {
    return this.post(`/bank/transactions/${id}/match`, { kind, id: targetId });
  }

  unmatch(id: string): Observable<BankTransaction> {
    return this.post(`/bank/transactions/${id}/unmatch`, {});
  }

  ignore(id: string): Observable<BankTransaction> {
    return this.post(`/bank/transactions/${id}/ignore`, {});
  }

  restore(id: string): Observable<BankTransaction> {
    return this.post(`/bank/transactions/${id}/restore`, {});
  }

  setCategory(id: string, category: string | null, remember = false, containsText?: string | null): Observable<BankTransaction> {
    return this.put(`/bank/transactions/${id}/category`, { category, remember, containsText: containsText ?? null });
  }

  categorize(): Observable<{ categorized: number }> {
    return this.slowPost('/bank/transactions/categorize', {});
  }

  // Rules
  rules(): Observable<BankRule[]> {
    return this.get('/bank/rules');
  }

  createRule(body: { containsText: string; direction: RuleDirection; category: string }): Observable<BankRule> {
    return this.post('/bank/rules', body);
  }

  deleteRule(id: string): Observable<void> {
    return this.delete(`/bank/rules/${id}`);
  }

  /** Reading a statement (or categorizing with the AI) can outlast the usual timeout; never retried. */
  private slowPost<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.buildUrl(endpoint), body).pipe(
      timeout(120_000),
      catchError(e => this.handleError(e)),
    );
  }
}
