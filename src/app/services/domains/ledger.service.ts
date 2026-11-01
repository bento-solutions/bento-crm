import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import type { PageResponse } from '../api.service';

export type AccountKind = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type JournalKind = 'SALES' | 'PURCHASES' | 'BANK' | 'CASH' | 'MISC' | 'OPENING';

/** The JSON API omits null fields, so every nullable field is optional here. */
export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  /** 1..8, the first digit of the code. */
  accountClass: number;
  kind: AccountKind;
  active: boolean;
  /** A seeded PCGE account: it cannot be deleted. */
  system: boolean;
  /** Some entry line uses it: it can be deactivated but not deleted. */
  used: boolean;
  /** Debit minus credit, all time. */
  balance: number;
}

export interface Journal {
  id: string;
  code: string;
  name: string;
  kind: JournalKind;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  active: boolean;
  missionId?: string | null;
  missionName?: string | null;
}

export interface EntryLine {
  id: string;
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  partnerId?: string | null;
  partnerName?: string | null;
  costCenterId?: string | null;
  costCenterCode?: string | null;
  label?: string | null;
  debit: number;
  credit: number;
}

export interface Entry {
  id: string;
  /** e.g. "OD-2026-0001", numbered per journal and year. */
  number: string;
  journalId: string;
  journalCode: string;
  entryDate: string;
  description?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  reversalOfId?: string | null;
  reversedById?: string | null;
  totalDebit: number;
  totalCredit: number;
  postedBy?: string | null;
  createdAt?: string | null;
  lines?: EntryLine[] | null;
}

export interface EntryLineRequest {
  accountId: string;
  partnerId?: string | null;
  costCenterId?: string | null;
  label?: string | null;
  debit: number;
  credit: number;
}

export interface EntryRequest {
  journalId?: string | null;
  entryDate: string;
  description: string;
  lines: EntryLineRequest[];
}

export interface EntryFilter {
  journalId?: string | null;
  from?: string | null;
  to?: string | null;
  accountId?: string | null;
  partnerId?: string | null;
  costCenterId?: string | null;
  q?: string | null;
}

export interface GeneralLedgerFilter {
  from?: string | null;
  to?: string | null;
  accountId?: string | null;
  accountFrom?: string | null;
  accountTo?: string | null;
  partnerId?: string | null;
  costCenterId?: string | null;
}

export interface GeneralLedgerLine {
  entryId: string;
  entryNumber: string;
  journalCode: string;
  entryDate: string;
  label?: string | null;
  partnerName?: string | null;
  costCenterCode?: string | null;
  debit: number;
  credit: number;
  /** Running balance, debit minus credit. */
  balance: number;
}

export interface GeneralLedgerAccount {
  accountId: string;
  code: string;
  name: string;
  openingBalance: number;
  lines?: GeneralLedgerLine[] | null;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface GeneralLedger {
  from: string;
  to: string;
  accounts?: GeneralLedgerAccount[] | null;
}

export interface TrialBalanceAmounts {
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceRow extends TrialBalanceAmounts {
  accountId: string;
  code: string;
  name: string;
  accountClass: number;
}

export interface TrialBalance {
  from: string;
  to: string;
  rows?: TrialBalanceRow[] | null;
  totals?: TrialBalanceAmounts | null;
}

/** Copies the set, non-blank values of a filter into query parameters. */
function params(f: object, extra: Record<string, string | number | boolean> = {}): Record<string, string | number | boolean> {
  const out = { ...extra };
  for (const [k, v] of Object.entries(f)) {
    if (v !== null && v !== undefined && String(v).trim() !== '') out[k] = String(v).trim();
  }
  return out;
}

/** The general ledger: chart of accounts, journals, entries, cost centers and reports (backend: LedgerController). */
@Injectable({ providedIn: 'root' })
export class LedgerApi extends BaseApiService {
  // Accounts
  accounts(includeInactive = false): Observable<LedgerAccount[]> {
    return this.get('/ledger/accounts', { includeInactive });
  }

  createAccount(body: { code: string; name: string }): Observable<LedgerAccount> {
    return this.post('/ledger/accounts', body);
  }

  updateAccount(id: string, body: { name?: string; active?: boolean }): Observable<LedgerAccount> {
    return this.put(`/ledger/accounts/${id}`, body);
  }

  deleteAccount(id: string): Observable<void> {
    return this.delete(`/ledger/accounts/${id}`);
  }

  // Journals
  journals(): Observable<Journal[]> {
    return this.get('/ledger/journals');
  }

  // Cost centers
  costCenters(includeInactive = false): Observable<CostCenter[]> {
    return this.get('/ledger/cost-centers', { includeInactive });
  }

  createCostCenter(body: { code: string; name: string; missionId?: string | null }): Observable<CostCenter> {
    return this.post('/ledger/cost-centers', body);
  }

  updateCostCenter(id: string, body: { name?: string; active?: boolean; missionId?: string | null }): Observable<CostCenter> {
    return this.put(`/ledger/cost-centers/${id}`, body);
  }

  deleteCostCenter(id: string): Observable<void> {
    return this.delete(`/ledger/cost-centers/${id}`);
  }

  // Entries
  entries(f: EntryFilter, page = 0, size = 50): Observable<PageResponse<Entry>> {
    return this.get('/ledger/entries', params(f, { page, size }));
  }

  entry(id: string): Observable<Entry> {
    return this.get(`/ledger/entries/${id}`);
  }

  createEntry(body: EntryRequest): Observable<Entry> {
    return this.post('/ledger/entries', body);
  }

  reverseEntry(id: string, body: { entryDate?: string | null; description?: string | null }): Observable<Entry> {
    return this.post(`/ledger/entries/${id}/reverse`, body);
  }

  // Reports
  generalLedger(f: GeneralLedgerFilter): Observable<GeneralLedger> {
    return this.get('/ledger/general-ledger', params(f));
  }

  trialBalance(f: { from?: string | null; to?: string | null; accountClass?: number | null }): Observable<TrialBalance> {
    return this.get('/ledger/trial-balance', params(f));
  }
}
