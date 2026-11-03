import { describe, expect, it } from 'vitest';
import { agingBucket, fiscalYearOf, fiscalYearRange, plainAmount, rubricRange, yearChoices } from './statements.service';

describe('financial statement helpers', () => {
  it('reads the account range of a rubric code', () => {
    expect(rubricRange('23')).toEqual({ from: '23', to: '23' });
    expect(rubricRange('342')).toEqual({ from: '342', to: '342' });
    expect(rubricRange('24-25')).toEqual({ from: '24', to: '25' });
    expect(rubricRange('24/25')).toEqual({ from: '24', to: '25' });
    expect(rubricRange('III')).toBeNull();
    expect(rubricRange(null)).toBeNull();
  });

  it('gives the first and last days of a fiscal year', () => {
    expect(fiscalYearRange(2026)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(fiscalYearRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2027-06-30' });
    expect(fiscalYearRange(2026, 1, { year: 2026, status: 'OPEN', startDate: '2026-01-01', endDate: '2026-06-30' }))
      .toEqual({ from: '2026-01-01', to: '2026-06-30' });
  });

  it('finds the fiscal year that holds a date', () => {
    expect(fiscalYearOf('2026-03-15')).toBe(2026);
    expect(fiscalYearOf('2026-03-15', 7)).toBe(2025);
    expect(fiscalYearOf('2026-08-01', 7)).toBe(2026);
  });

  it('always offers the current and previous years, newest first', () => {
    expect(yearChoices([{ year: 2024, status: 'CLOSED' }], 2026).map(y => y.year)).toEqual([2026, 2025, 2024]);
  });

  it('puts open documents in aging buckets', () => {
    expect(agingBucket(-5)).toBe('current');
    expect(agingBucket(0)).toBe('current');
    expect(agingBucket(30)).toBe('d30');
    expect(agingBucket(31)).toBe('d60');
    expect(agingBucket(90)).toBe('d90');
    expect(agingBucket(91)).toBe('over90');
  });

  it('prints statement amounts without the currency', () => {
    expect(plainAmount(undefined)).toBe('');
    expect(plainAmount(0)).toBe('—');
    expect(plainAmount(1234.5)).toMatch(/^1\D?234,50$/);
  });
});
