import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { Expense, expenseFromApi, expenseToApi } from './expenses.service';
import { Dimensions } from './dimensions';

/** A note de frais: DRAFT until posted (number allocated), then POSTED, then REIMBURSED; CANCELLED from DRAFT only. */
export type ExpenseReportStatus = 'DRAFT' | 'POSTED' | 'REIMBURSED' | 'CANCELLED';
export const EXPENSE_REPORT_STATUSES: ExpenseReportStatus[] = ['DRAFT', 'POSTED', 'REIMBURSED', 'CANCELLED'];

export type ReimbursementMethod = 'BANK_TRANSFER' | 'CASH';

export interface ExpenseReportTotals {
  ht: number;
  vat: number;
  ttc: number;
}

/** A line of a report: an expense that belongs to it, with the number of receipts attached to it. */
export interface ExpenseReportLine extends Expense {
  attachmentCount: number;
}

export interface ExpenseReport {
  id: string;
  /** NF-YYYY-NNNN, allocated at posting; null on a draft never posted. */
  number: string | null;
  employeeUserId: string | null;
  employeeName: string;
  title: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  notes: string | null;
  status: ExpenseReportStatus;
  postedAt: string | null;
  reimbursedAt: string | null;
  reimbursementMethod: ReimbursementMethod | null;
  reimbursementBankAccountId: string | null;
  /** The default cost center of its lines. */
  costCenterId: string | null;
  /** Present on GET /expense-reports/{id}; the list may leave it out. */
  lines: ExpenseReportLine[];
  totals: ExpenseReportTotals;
  lineCount: number;
}

/** The header fields POST and PUT /expense-reports take. */
export interface ExpenseReportInput {
  employeeUserId: string | null;
  employeeName: string;
  title: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  notes: string | null;
  costCenterId: string | null;
}

/** The fields of a line (an expense) POST and PUT /expense-reports/{id}/lines take. */
export interface ExpenseReportLineInput {
  expenseDate: string;
  category: string;
  description: string | null;
  amount: number;
  vatAmount: number | null;
  vatCode: string | null;
  vendorName: string | null;
  reference: string | null;
  costCenterId: string | null;
  /** Mission, deal, customer, vendor: all optional. */
  dims: Dimensions;
}

export interface ReimburseInput {
  date: string;
  method: ReimbursementMethod;
  bankAccountId?: string | null;
}

export interface ExpenseReportQuery {
  status?: ExpenseReportStatus | null;
  employee?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  size?: number;
}

export interface ExpenseReportPage {
  content: ExpenseReport[];
  totalPages: number;
  totalElements: number;
}

// ---------------------------------------------------------------------------------------------
// Response normalising. The API was built alongside these screens, so every shape it answers with
// goes through the few functions below and nowhere else: a renamed field is fixed here only.
// ---------------------------------------------------------------------------------------------

type Raw = Record<string, unknown> | null | undefined;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v);
}

function pick(r: Raw, ...keys: string[]): unknown {
  if (!r) return undefined;
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** A line: the expense DTO, with `attachments` as a count (or a list, or `attachmentCount`). */
export function lineFromApi(r: Raw): ExpenseReportLine {
  const a = pick(r, 'attachments', 'attachmentCount', 'attachmentsCount', 'receiptCount');
  const e = expenseFromApi(r ?? {}) as unknown as Expense;
  return {
    ...e,
    amount: num(e.amount),
    vatAmount: e.vatAmount === null || e.vatAmount === undefined ? null : num(e.vatAmount),
    attachmentCount: Array.isArray(a) ? a.length : num(a),
  };
}

export function reportFromApi(r: Raw): ExpenseReport {
  const lines = (pick(r, 'lines', 'expenses') as Raw[] | undefined ?? []).map(lineFromApi);
  const t = pick(r, 'totals') as Raw;
  // Totals from the API when it sends them, else from the lines.
  const ttcFromLines = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vatFromLines = round2(lines.reduce((s, l) => s + (l.vatAmount ?? 0), 0));
  const ttc = num(pick(t, 'ttc', 'totalTtc') ?? pick(r, 'totalTtc', 'total', 'amount') ?? ttcFromLines);
  const vat = num(pick(t, 'vat', 'tva', 'totalVat') ?? pick(r, 'totalVat', 'vatAmount') ?? vatFromLines);
  const ht = num(pick(t, 'ht', 'totalHt') ?? pick(r, 'totalHt') ?? round2(ttc - vat));
  return {
    id: String(pick(r, 'id') ?? ''),
    number: str(pick(r, 'number', 'reportNumber')),
    employeeUserId: str(pick(r, 'employeeUserId', 'employeeId')),
    employeeName: String(pick(r, 'employeeName', 'employee') ?? ''),
    title: str(pick(r, 'title')),
    periodFrom: str(pick(r, 'periodFrom', 'from')),
    periodTo: str(pick(r, 'periodTo', 'to')),
    notes: str(pick(r, 'notes')),
    status: (str(pick(r, 'status')) ?? 'DRAFT') as ExpenseReportStatus,
    postedAt: str(pick(r, 'postedAt')),
    reimbursedAt: str(pick(r, 'reimbursedAt')),
    reimbursementMethod: str(pick(r, 'reimbursementMethod')) as ReimbursementMethod | null,
    reimbursementBankAccountId: str(pick(r, 'reimbursementBankAccountId', 'bankAccountId')),
    costCenterId: str(pick(r, 'costCenterId')),
    lines,
    totals: { ht, vat, ttc },
    lineCount: num(pick(r, 'lineCount', 'linesCount') ?? lines.length),
  };
}

function pageFromApi(r: Raw): ExpenseReportPage {
  const content = (pick(r, 'content') as Raw[] | undefined ?? []).map(reportFromApi);
  return {
    content,
    totalPages: num(pick(r, 'totalPages', 'total_pages') ?? 1),
    totalElements: num(pick(r, 'totalElements', 'total_elements') ?? content.length),
  };
}

/** Expense reports, notes de frais (backend: ExpenseReportController). */
@Injectable({ providedIn: 'root' })
export class ExpenseReportsApi extends BaseApiService {
  list(q: ExpenseReportQuery = {}): Observable<ExpenseReportPage> {
    const params: Record<string, string | number> = { page: q.page ?? 0, size: q.size ?? 20 };
    if (q.status) params['status'] = q.status;
    if (q.employee?.trim()) params['employee'] = q.employee.trim();
    if (q.from) params['from'] = q.from;
    if (q.to) params['to'] = q.to;
    return this.get<Raw>('/expense-reports', params).pipe(map(pageFromApi));
  }

  getOne(id: string): Observable<ExpenseReport> {
    return this.get<Raw>(`/expense-reports/${id}`).pipe(map(reportFromApi));
  }

  save(body: ExpenseReportInput, id?: string | null): Observable<ExpenseReport> {
    return (id ? this.put<Raw>(`/expense-reports/${id}`, body) : this.post<Raw>('/expense-reports', body)).pipe(map(reportFromApi));
  }

  remove(id: string): Observable<void> {
    return this.delete(`/expense-reports/${id}`);
  }

  /** Answers with the line (an expense); callers reload the report for its totals. */
  /** Adds or updates a line. The API answers with the whole report, lines included. */
  saveLine(reportId: string, body: ExpenseReportLineInput, expenseId?: string | null): Observable<ExpenseReport> {
    const payload = expenseToApi(body);
    return (expenseId
      ? this.put<Raw>(`/expense-reports/${reportId}/lines/${expenseId}`, payload)
      : this.post<Raw>(`/expense-reports/${reportId}/lines`, payload)).pipe(map(reportFromApi));
  }

  removeLine(reportId: string, expenseId: string): Observable<void> {
    return this.delete(`/expense-reports/${reportId}/lines/${expenseId}`);
  }

  postReport(id: string): Observable<ExpenseReport> {
    return this.post<Raw>(`/expense-reports/${id}/post`, {}).pipe(map(reportFromApi));
  }

  unpost(id: string): Observable<ExpenseReport> {
    return this.post<Raw>(`/expense-reports/${id}/unpost`, {}).pipe(map(reportFromApi));
  }

  reimburse(id: string, body: ReimburseInput): Observable<ExpenseReport> {
    return this.post<Raw>(`/expense-reports/${id}/reimburse`, body).pipe(map(reportFromApi));
  }

  cancel(id: string): Observable<ExpenseReport> {
    return this.post<Raw>(`/expense-reports/${id}/cancel`, {}).pipe(map(reportFromApi));
  }

  pdf(id: string): Observable<Blob> {
    return this.getBlob(`/expense-reports/${id}/pdf`);
  }
}
