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
  sourceType?: string | null;
  sourceId?: string | null;
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

// Posting setup (phase 2): the groups and accounts automatic postings use.
export type PartnerGroupSide = 'CUSTOMER' | 'SUPPLIER';

export interface PartnerGroup {
  id: string;
  code: string;
  name: string;
  side: PartnerGroupSide;
  accountId?: string | null;
  accountCode?: string | null;
  isDefault: boolean;
}

/** A business group (MAROC, EXPORT…) or a product group (GOODS, SERVICES…). */
export interface PostingGroup {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  /** Product groups (phase 3): the VAT code their lines use, a vatSetup code. */
  vatCode?: string | null;
  /** Business groups (phase 3): EXEMPT lines use exemptVatCode instead of the product's code. */
  vatRule?: VatRule | null;
  exemptVatCode?: string | null;
}

export type VatRule = 'STANDARD' | 'EXEMPT';
export type BankPostingMode = 'ON_VALIDATION' | 'ON_IMPORT';

/** One cell of the general setup: a business group × product group pair. */
export interface GeneralSetupRow {
  id: string;
  businessGroupId: string;
  productGroupId: string;
  salesAccountId?: string | null;
  salesAccountCode?: string | null;
  purchaseAccountId?: string | null;
  purchaseAccountCode?: string | null;
}

export interface VatSetupRow {
  id: string;
  code: string;
  name: string;
  rate: number;
  collectedAccountId?: string | null;
  collectedAccountCode?: string | null;
  recoverableAccountId?: string | null;
  recoverableAccountCode?: string | null;
  exempt: boolean;
  /** Printed on the invoice PDF under the totals when a line uses this code (phase 3). */
  mention?: string | null;
}

export interface BankAccountSetup {
  bankAccountId: string;
  bankAccountName: string;
  accountId?: string | null;
  accountCode?: string | null;
}

export interface CategorySetup {
  category: string;
  accountId?: string | null;
  accountCode?: string | null;
}

export interface PostingSetup {
  partnerGroups?: PartnerGroup[] | null;
  businessGroups?: PostingGroup[] | null;
  productGroups?: PostingGroup[] | null;
  generalSetup?: GeneralSetupRow[] | null;
  vatSetup?: VatSetupRow[] | null;
  bankAccounts?: BankAccountSetup[] | null;
  cashAccountId?: string | null;
  cashAccountCode?: string | null;
  bankCategories?: CategorySetup[] | null;
  expenseCategories?: CategorySetup[] | null;
  startDate?: string | null;
  /** Phase 3: bank lines post once validated (default) or as soon as they are imported. */
  bankPostingMode?: BankPostingMode | null;
}

/** What posts a document: the source types of automatic entries. */
export type PostingSourceType = 'INVOICE' | 'BILL' | 'PAYMENT' | 'EXPENSE' | 'BANK_LINE';

export interface RepostError {
  sourceType: string;
  sourceId: string;
  label?: string | null;
  message?: string | null;
}

export interface RepostResult {
  posted: number;
  skipped: number;
  errors?: RepostError[] | null;
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

  /** The live entry a document posted; 404 when it has none (not posted yet, or before the posting start date). */
  sourceEntry(sourceType: string, sourceId: string): Observable<Entry> {
    return this.get(`/ledger/source/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`);
  }

  // Posting setup (each write returns the whole setup)
  postingSetup(): Observable<PostingSetup> {
    return this.get('/ledger/posting-setup');
  }

  createPartnerGroup(body: { code: string; name: string; side: PartnerGroupSide; accountId: string }): Observable<PostingSetup> {
    return this.post('/ledger/posting-setup/partner-groups', body);
  }

  updatePartnerGroup(id: string, body: { name?: string; accountId?: string; isDefault?: boolean }): Observable<PostingSetup> {
    return this.put(`/ledger/posting-setup/partner-groups/${id}`, body);
  }

  deletePartnerGroup(id: string): Observable<PostingSetup> {
    return this.delete(`/ledger/posting-setup/partner-groups/${id}`);
  }

  createGroup(kind: 'business-groups' | 'product-groups', body: { code: string; name: string }): Observable<PostingSetup> {
    return this.post(`/ledger/posting-setup/${kind}`, body);
  }

  updateGroup(kind: 'business-groups' | 'product-groups', id: string,
              body: { name?: string; isDefault?: boolean; vatCode?: string | null; vatRule?: VatRule; exemptVatCode?: string | null }): Observable<PostingSetup> {
    return this.put(`/ledger/posting-setup/${kind}/${id}`, body);
  }

  deleteGroup(kind: 'business-groups' | 'product-groups', id: string): Observable<PostingSetup> {
    return this.delete(`/ledger/posting-setup/${kind}/${id}`);
  }

  updateGeneralSetup(id: string, body: { salesAccountId: string | null; purchaseAccountId: string | null }): Observable<PostingSetup> {
    return this.put(`/ledger/posting-setup/general/${id}`, body);
  }

  updateVatSetup(id: string, body: { collectedAccountId: string | null; recoverableAccountId: string | null; mention?: string | null }): Observable<PostingSetup> {
    return this.put(`/ledger/posting-setup/vat/${id}`, body);
  }

  updateBankSetup(bankAccountId: string, accountId: string): Observable<PostingSetup> {
    return this.put(`/ledger/posting-setup/bank/${bankAccountId}`, { accountId });
  }

  updateCashSetup(accountId: string): Observable<PostingSetup> {
    return this.put('/ledger/posting-setup/cash', { accountId });
  }

  updateCategorySetup(kind: 'bank-categories' | 'expense-categories', category: string, accountId: string): Observable<PostingSetup> {
    return this.put(`/ledger/posting-setup/${kind}/${encodeURIComponent(category)}`, { accountId });
  }

  updateStartDate(startDate: string): Observable<PostingSetup> {
    return this.put('/ledger/posting-setup/start-date', { startDate });
  }

  updateBankPostingMode(mode: BankPostingMode): Observable<PostingSetup> {
    return this.put('/ledger/posting-setup/bank-posting-mode', { mode });
  }

  /** Posts every document dated on or after the start date that has no live entry yet (admin). */
  repost(): Observable<RepostResult> {
    return this.post('/ledger/repost', {});
  }

  // Reports
  generalLedger(f: GeneralLedgerFilter): Observable<GeneralLedger> {
    return this.get('/ledger/general-ledger', params(f));
  }

  trialBalance(f: { from?: string | null; to?: string | null; accountClass?: number | null }): Observable<TrialBalance> {
    return this.get('/ledger/trial-balance', params(f));
  }
}
