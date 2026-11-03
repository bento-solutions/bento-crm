import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, switchMap, timeout } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { HTTP_CONFIG } from '../../core/config/api-config';
import type { FiscalYear } from './closing.service';

// General ledger phase 4 (read-only reports): the bilan and the CPC in the CGNC format, the
// customer and supplier balances and statements, and the export for the accountant.
// Rubric labels come from the API in French and are shown as they are in every language.
// The JSON API omits null fields, so every nullable field is optional here.

// ── 1. Financial statements ───────────────────────────────────────────────

/** A rubric row of the bilan. Liability rows carry only `net` (and `netPrior`). */
export interface BilanRow {
  code?: string | null;
  label: string;
  gross?: number | null;
  amortProv?: number | null;
  net: number;
  netPrior?: number | null;
}

export interface BilanTotals {
  gross?: number | null;
  amortProv?: number | null;
  net: number;
  netPrior?: number | null;
}

/** A section of one side (e.g. "Immobilisations corporelles"), with its rows and its total. */
export interface BilanSection {
  code?: string | null;
  label: string;
  rows?: BilanRow[] | null;
  /** Section totals; also read from totalGross / totalAmortProv / totalNet / totalNetPrior, or computed from the rows. */
  total?: BilanTotals | null;
  totalGross?: number | null;
  totalAmortProv?: number | null;
  totalNet?: number | null;
  totalNetPrior?: number | null;
}

export interface StatementWarning {
  accountCode: string;
  accountName?: string | null;
  balance: number;
  message: string;
}

export interface Bilan {
  asOf: string;
  priorAsOf?: string | null;
  actif?: BilanSection[] | null;
  passif?: BilanSection[] | null;
  totalActif: number;
  totalPassif: number;
  totalActifPrior?: number | null;
  totalPassifPrior?: number | null;
  balanced: boolean;
  warnings?: StatementWarning[] | null;
}

export interface CpcRow {
  code?: string | null;
  label: string;
  current: number;
  prior?: number | null;
  /** On a flat list: ROW (a rubric), SECTION (a heading with its total) or RESULT (III, VI, VII, X, XI, XIII). */
  kind?: string | null;
}

/**
 * A CPC section: I, II, IV, V, VIII, IX and XII hold rubric rows and a total; the results
 * (III, VI, VII, X, XI, XIII) have no rows, just their amount.
 */
export interface CpcSection {
  code?: string | null;
  label: string;
  rows?: CpcRow[] | null;
  total?: number | null;
  totalPrior?: number | null;
  current?: number | null;
  prior?: number | null;
  /** True for a result line (III, VI, VII, X, XI, XIII). */
  result?: boolean | null;
}

export interface Cpc {
  from: string;
  to: string;
  priorFrom?: string | null;
  priorTo?: string | null;
  sections?: CpcSection[] | null;
  /** Alternative flat shape: one list of rows, with `kind`. */
  rows?: CpcRow[] | null;
  resultatNet?: number | null;
  resultatNetPrior?: number | null;
}

// ── 2. Partner balances and statements ────────────────────────────────────

export type PartnerSide = 'CUSTOMER' | 'SUPPLIER';

export interface Aging {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  over90: number;
}

export interface PartnerBalance {
  partnerId: string;
  partnerName: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  advances: number;
  overdue: number;
  aging?: Aging | null;
}

export interface PartnerBalanceTotals {
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  advances: number;
  overdue: number;
}

export interface PartnerBalances {
  items?: PartnerBalance[] | null;
  /** PageResponse spelling, read when `items` is absent. */
  content?: PartnerBalance[] | null;
  totals?: PartnerBalanceTotals | null;
  page?: number;
  size?: number;
  total_elements?: number;
  total_pages?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface PartnerBalanceFilter {
  type: PartnerSide;
  from?: string | null;
  to?: string | null;
  search?: string | null;
  onlyOpen?: boolean;
}

export interface StatementLine {
  date: string;
  entryId?: string | null;
  entryNumber?: string | null;
  journalCode?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  documentNumber?: string | null;
  label?: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface OpenDocument {
  type: string;
  id: string;
  number?: string | null;
  date?: string | null;
  dueDate?: string | null;
  total: number;
  due: number;
  daysOverdue: number;
}

export interface PartnerStatement {
  partner: { id: string; name: string; ice?: string | null; address?: string | null };
  from: string;
  to: string;
  opening: number;
  lines?: StatementLine[] | null;
  closing: number;
  advances?: { opening: number; lines?: StatementLine[] | null; closing: number } | null;
  openDocuments?: OpenDocument[] | null;
}

// ── 3. Export ─────────────────────────────────────────────────────────────

export type ExportFormat = 'xlsx' | 'csv';

/** Copies the set, non-blank values into query parameters. */
function clean(p: Record<string, string | number | boolean | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== null && v !== undefined && String(v).trim() !== '') out[k] = String(v).trim();
  }
  return out;
}

/** Large exports are streamed by the API and may take a while. */
const EXPORT_TIMEOUT = 5 * 60_000;

@Injectable({ providedIn: 'root' })
export class StatementsApi extends BaseApiService {
  bilan(year: number, date: string | null, comparative: boolean): Observable<Bilan> {
    return this.get('/ledger/statements/bilan', clean({ year, date, comparative }));
  }

  cpc(year: number, from: string | null, to: string | null, comparative: boolean): Observable<Cpc> {
    return this.get('/ledger/statements/cpc', clean({ year, from, to, comparative }));
  }

  bilanXlsx(year: number, date: string | null, comparative: boolean): Observable<Blob> {
    return this.blob('/ledger/statements/bilan.xlsx', { year, date, comparative });
  }

  cpcXlsx(year: number, from: string | null, to: string | null, comparative: boolean): Observable<Blob> {
    return this.blob('/ledger/statements/cpc.xlsx', { year, from, to, comparative });
  }

  partnerBalances(f: PartnerBalanceFilter, page: number, size: number): Observable<PartnerBalances> {
    return this.get('/ledger/partners/balances', clean({ ...f, page, size }));
  }

  partnerBalancesXlsx(f: PartnerBalanceFilter): Observable<Blob> {
    return this.blob('/ledger/partners/balances.xlsx', { type: f.type, from: f.from, to: f.to });
  }

  statement(partnerId: string, type: PartnerSide, from: string | null, to: string | null): Observable<PartnerStatement> {
    return this.get(`/ledger/partners/${encodeURIComponent(partnerId)}/statement`, clean({ type, from, to }));
  }

  statementPdf(partnerId: string, type: PartnerSide, from: string | null, to: string | null): Observable<Blob> {
    return this.blob(`/ledger/partners/${encodeURIComponent(partnerId)}/statement.pdf`, { type, from, to });
  }

  exportForAccountant(from: string, to: string, format: ExportFormat): Observable<Blob> {
    return this.blob('/ledger/export', { from, to, format }, EXPORT_TIMEOUT);
  }

  /** A file download; an error body (JSON in a Blob) is read so the toast shows the server's detail. */
  private blob(path: string, params: Record<string, string | number | boolean | null | undefined>, ms: number = HTTP_CONFIG.timeout): Observable<Blob> {
    return this.http.get(this.buildUrl(path), { params: clean(params), responseType: 'blob' }).pipe(
      timeout(ms),
      catchError((e: HttpErrorResponse) => e?.error instanceof Blob
        ? from(e.error.text()).pipe(switchMap(text =>
            this.handleError(new HttpErrorResponse({ error: text, status: e.status, statusText: e.statusText, url: e.url ?? undefined }))))
        : this.handleError(e)),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function iso(y: number, m: number, d: number): string {
  const dt = new Date(y, m, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** First and last day of a fiscal year (named by its start year), from the ledger year when known. */
export function fiscalYearRange(year: number, startMonth = 1, fy?: FiscalYear | null): { from: string; to: string } {
  if (fy?.startDate && fy?.endDate) return { from: fy.startDate.slice(0, 10), to: fy.endDate.slice(0, 10) };
  const m = Math.min(Math.max(startMonth || 1, 1), 12) - 1;
  return { from: iso(year, m, 1), to: iso(year + 1, m, 0) };
}

/** The fiscal year (start year) that holds a date. */
export function fiscalYearOf(isoDate: string, startMonth = 1, years: FiscalYear[] = []): number {
  const day = isoDate.slice(0, 10);
  const known = years.find(y => y.startDate && y.endDate && y.startDate.slice(0, 10) <= day && day <= y.endDate.slice(0, 10));
  if (known) return known.year;
  const [y, m] = day.split('-').map(Number);
  return m >= (startMonth || 1) ? y : y - 1;
}

/** The ledger years, plus the current and previous ones, newest first. */
export function yearChoices(list: FiscalYear[] | null | undefined, current: number): FiscalYear[] {
  const rows = [...(list ?? [])];
  for (const y of [current, current - 1]) {
    if (!rows.some(r => r.year === y)) rows.push({ year: y, status: 'OPEN' });
  }
  return rows.sort((a, b) => b.year - a.year);
}

/** The account-code range a rubric code stands for ("23" → 23..23, "24-25" or "24/25" → 24..25), or null. */
export function rubricRange(code: string | null | undefined): { from: string; to: string } | null {
  const c = (code ?? '').trim();
  if (/^[1-8]\d*$/.test(c)) return { from: c, to: c };
  const m = /^([1-8]\d*)\s*(?:-|\/|à|to|–|,)\s*([1-8]\d*)$/.exec(c);
  return m ? { from: m[1], to: m[2] } : null;
}

/** The aging bucket of an open document from its days overdue. */
export function agingBucket(daysOverdue: number | null | undefined): keyof Aging {
  const d = Number(daysOverdue) || 0;
  if (d <= 0) return 'current';
  if (d <= 30) return 'd30';
  if (d <= 60) return 'd60';
  if (d <= 90) return 'd90';
  return 'over90';
}

export const AGING_KEYS: (keyof Aging)[] = ['current', 'd30', 'd60', 'd90', 'over90'];

const PLAIN = new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** An amount without the currency, as statements print them ("12 500,00"); a dash at zero, blank when absent. */
export function plainAmount(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return n === 0 ? '—' : PLAIN.format(n);
}
