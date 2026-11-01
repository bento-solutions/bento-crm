/** Pure helpers for the General Ledger screens, kept apart so they can be unit-tested. */
import { csvCell } from './csv.util';

/** One line of an entry being typed: amounts as the user entered them (blank, a number, or text). */
export interface DraftAmounts {
  debit: number | string | null | undefined;
  credit: number | string | null | undefined;
}

export interface EntryTotals {
  debit: number;
  credit: number;
  /** Debit minus credit; zero when the entry balances. */
  difference: number;
}

/** An amount typed in a field, as a number rounded to cents; blank, invalid or negative input is 0 (negatives are rejected by lineError). */
export function toAmount(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? round2(n) : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Totals of an entry's lines, computed in cents so 0.1 + 0.2 still balances 0.3. */
export function entryTotals(lines: DraftAmounts[]): EntryTotals {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += Math.round(toAmount(l.debit) * 100);
    credit += Math.round(toAmount(l.credit) * 100);
  }
  return { debit: debit / 100, credit: credit / 100, difference: (debit - credit) / 100 };
}

/** What is wrong with one line, or null: exactly one of debit / credit must be above zero, and none negative. */
export function lineError(l: DraftAmounts): 'negative' | 'both' | 'none' | null {
  const d = toAmount(l.debit);
  const c = toAmount(l.credit);
  if (d < 0 || c < 0) return 'negative';
  if (d > 0 && c > 0) return 'both';
  if (d === 0 && c === 0) return 'none';
  return null;
}

/** A manual entry can be saved: at least two lines, each valid and with an account, and debit equal to credit. */
export function canPostEntry(lines: (DraftAmounts & { accountId?: string | null })[]): boolean {
  if (lines.length < 2) return false;
  if (lines.some(l => !l.accountId || lineError(l) !== null)) return false;
  const t = entryTotals(lines);
  return t.debit > 0 && t.difference === 0;
}

/** "YYYY-MM-DD" of a date, in local time. */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The screens' default period: the first of January of the current year to today. */
export function defaultPeriod(today = new Date()): { from: string; to: string } {
  return { from: `${today.getFullYear()}-01-01`, to: isoDate(today) };
}

/** An account matches a search when its code starts with the text or its name contains it (accents and case ignored). */
export function matchesAccount(a: { code: string; name: string }, q: string): boolean {
  const s = fold(q.trim());
  if (!s) return true;
  return a.code.startsWith(s) || fold(a.name).includes(s);
}

/** Lower case without accents, for searching names such as "État" by "etat". */
export function fold(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A ledger account code: 4 to 10 digits, the first one 1..8 (its class). */
export function isValidAccountCode(code: string): boolean {
  return /^[1-8]\d{3,9}$/.test(code.trim());
}

/** A trial balance balances when each pair of debit and credit totals is equal to the cent. */
export function trialBalanced(t: {
  openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number;
} | null | undefined): boolean {
  if (!t) return true;
  const eq = (a: number, b: number) => Math.round((Number(a) || 0) * 100) === Math.round((Number(b) || 0) * 100);
  return eq(t.openingDebit, t.openingCredit) && eq(t.periodDebit, t.periodCredit) && eq(t.closingDebit, t.closingCredit);
}

/** A number for CSV: two decimals with a dot, so spreadsheets read it as a number. */
export function csvAmount(v: number | null | undefined): number {
  return round2(Number(v) || 0);
}

/** The CSV text of a table, one row per array, every cell quoted (and formulas neutralised) by csvCell. */
export function csvText(rows: unknown[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

/** Saves a CSV file in the browser, with a BOM so Excel reads the accents. */
export function downloadCsv(filename: string, rows: unknown[][]): void {
  const blob = new Blob(['﻿' + csvText(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
