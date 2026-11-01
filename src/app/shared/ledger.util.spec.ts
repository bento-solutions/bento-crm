import { describe, expect, it } from 'vitest';
import {
  canPostEntry, csvText, defaultPeriod, entryTotals, isValidAccountCode, lineError, matchesAccount, toAmount, trialBalanced,
} from './ledger.util';

describe('ledger helpers', () => {
  it('reads typed amounts, with a comma or blank', () => {
    expect(toAmount('1 200,50')).toBe(1200.5);
    expect(toAmount('')).toBe(0);
    expect(toAmount(null)).toBe(0);
    expect(toAmount('abc')).toBe(0);
    expect(toAmount(10.005)).toBe(10.01);
  });

  it('totals an entry in cents and gives the difference', () => {
    expect(entryTotals([{ debit: 0.1, credit: '' }, { debit: 0.2, credit: null }, { debit: '', credit: '0.3' }]))
      .toEqual({ debit: 0.3, credit: 0.3, difference: 0 });
    expect(entryTotals([{ debit: 100, credit: 0 }, { debit: 0, credit: 60 }]))
      .toEqual({ debit: 100, credit: 60, difference: 40 });
    expect(entryTotals([])).toEqual({ debit: 0, credit: 0, difference: 0 });
  });

  it('flags a line with both, neither or a negative amount', () => {
    expect(lineError({ debit: 10, credit: 0 })).toBeNull();
    expect(lineError({ debit: '', credit: 5 })).toBeNull();
    expect(lineError({ debit: 10, credit: 5 })).toBe('both');
    expect(lineError({ debit: 0, credit: '' })).toBe('none');
    expect(lineError({ debit: -1, credit: 0 })).toBe('negative');
  });

  it('allows posting only a balanced entry of two or more complete lines', () => {
    const a = { accountId: 'a', debit: 100, credit: 0 };
    const b = { accountId: 'b', debit: 0, credit: 100 };
    expect(canPostEntry([a, b])).toBe(true);
    expect(canPostEntry([a])).toBe(false);
    expect(canPostEntry([a, { ...b, credit: 99.99 }])).toBe(false);
    expect(canPostEntry([a, { ...b, accountId: '' }])).toBe(false);
    expect(canPostEntry([{ ...a, debit: 0 }, { ...b, credit: 0 }])).toBe(false);
  });

  it('defaults the period to the start of the year through today', () => {
    expect(defaultPeriod(new Date(2026, 10, 1))).toEqual({ from: '2026-01-01', to: '2026-11-01' });
  });

  it('finds an account by code prefix or by name without accents', () => {
    const a = { code: '4455', name: 'État, TVA facturée' };
    expect(matchesAccount(a, '44')).toBe(true);
    expect(matchesAccount(a, 'etat')).toBe(true);
    expect(matchesAccount(a, 'facturee')).toBe(true);
    expect(matchesAccount(a, '55')).toBe(false);
    expect(matchesAccount(a, ' ')).toBe(true);
  });

  it('checks account codes', () => {
    expect(isValidAccountCode('6111')).toBe(true);
    expect(isValidAccountCode('34552')).toBe(true);
    expect(isValidAccountCode('911')).toBe(false);
    expect(isValidAccountCode('9111')).toBe(false);
    expect(isValidAccountCode('61a1')).toBe(false);
    expect(isValidAccountCode('12345678901')).toBe(false);
  });

  it('tells whether trial balance totals balance', () => {
    const t = { openingDebit: 10, openingCredit: 10, periodDebit: 5.1, periodCredit: 5.1, closingDebit: 3, closingCredit: 3 };
    expect(trialBalanced(t)).toBe(true);
    expect(trialBalanced({ ...t, periodCredit: 5.09 })).toBe(false);
    expect(trialBalanced(null)).toBe(true);
  });

  it('writes CSV rows with neutralised formulas', () => {
    expect(csvText([['Code', 'Name'], ['6111', '=SUM(A1)'], [1.5, null]])).toBe('"Code","Name"\n"6111","\'=SUM(A1)"\n"1.5",""');
  });
});
