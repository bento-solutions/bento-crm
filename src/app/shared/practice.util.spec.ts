import { describe, expect, it } from 'vitest';
import {
  addDays, daysBetween, daysLeft, deadlineRange, groupByMonth, isoDate, monthLabel, progressPercent, totalWithVat, vatPercent,
} from './practice.util';

describe('practice helpers', () => {
  it('counts calendar days across month and year ends', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-10-18', 14)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-18', '2026-11-02')).toBe(15);
    expect(daysBetween('2026-10-18', '2026-10-12')).toBe(-6);
    // Across the end of summer time: still whole days.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('reads a due date as days left, today, tomorrow or late', () => {
    expect(daysLeft('2026-11-02', '2026-10-18')).toEqual({ key: 'tax.days.in', n: 15 });
    expect(daysLeft('2026-10-19', '2026-10-18')).toEqual({ key: 'tax.days.tomorrow', n: 1 });
    expect(daysLeft('2026-10-18', '2026-10-18')).toEqual({ key: 'tax.days.today', n: 0 });
    expect(daysLeft('2026-10-12', '2026-10-18')).toEqual({ key: 'tax.days.late', n: 6 });
  });

  it('builds the default and twelve-month windows', () => {
    expect(deadlineRange('default', '2026-10-18')).toEqual({ from: '2026-09-18', to: '2027-01-16' });
    expect(deadlineRange('next12', '2026-10-18')).toEqual({ from: '2026-10-18', to: '2027-10-17' });
  });

  it('groups by month in date order', () => {
    const rows = [
      { id: 'c', due: '2026-11-02' },
      { id: 'a', due: '2026-10-12' },
      { id: 'b', due: '2026-10-31' },
      { id: 'd', due: '2027-01-02' },
    ];
    const g = groupByMonth(rows, r => r.due);
    expect(g.map(x => x.month)).toEqual(['2026-10', '2026-11', '2027-01']);
    expect(g[0].items.map(x => x.id)).toEqual(['a', 'b']);
    expect(groupByMonth([], (r: { due: string }) => r.due)).toEqual([]);
  });

  it('labels a month in the interface language', () => {
    expect(monthLabel('2026-10', 'en')).toBe('October 2026');
    expect(monthLabel('2026-10', 'fr')).toBe('Octobre 2026');
    expect(monthLabel('nope', 'en')).toBe('nope');
  });

  it('computes progress, VAT percents and rebilled totals', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 2)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
    expect(vatPercent(0.2)).toBe(20);
    expect(vatPercent(0.07)).toBe(7);
    expect(vatPercent(null)).toBe(0);
    // The backend test: 450 without VAT and 100 at 20 % make 570.
    expect(totalWithVat([{ amount: 450 }, { amount: 100, vatRate: 0.2 }])).toBe(570);
  });
});
