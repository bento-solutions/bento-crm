import { describe, expect, it } from 'vitest';
import { amountClass, balanceDomain, barPercent, maskAccountNumber, maxAbs, shortDate, spanFor, zeroLine } from './bank.util';

describe('bank helpers', () => {
  it('masks an account number down to its last four digits', () => {
    expect(maskAccountNumber('007 780 0001234567890123 45')).toBe('•••• 2345');
    expect(maskAccountNumber('1234')).toBe('1234');
    expect(maskAccountNumber(null)).toBe('—');
    expect(maskAccountNumber('')).toBe('—');
  });

  it('scales bars against the largest value and keeps small ones visible', () => {
    expect(maxAbs([100, -400, null, 250])).toBe(400);
    expect(barPercent(200, 400)).toBe(50);
    expect(barPercent(-400, 400)).toBe(100);
    expect(barPercent(1, 10000)).toBe(2);
    expect(barPercent(0, 400)).toBe(0);
    expect(barPercent(50, 0)).toBe(0);
  });

  it('places balance bars around a zero line that is always in range', () => {
    const d = balanceDomain([500, -500, 250]);
    expect(d).toEqual({ min: -500, max: 500 });
    expect(zeroLine(d)).toBe(50);
    expect(spanFor(500, d)).toEqual({ top: 0, height: 50 });
    expect(spanFor(-250, d)).toEqual({ top: 50, height: 25 });

    const positive = balanceDomain([100, 300]);
    expect(positive).toEqual({ min: 0, max: 300 });
    expect(zeroLine(positive)).toBe(100);
    expect(spanFor(150, positive)).toEqual({ top: 50, height: 50 });

    expect(balanceDomain([])).toEqual({ min: 0, max: 1 });
  });

  it('colours amounts by sign and formats dates', () => {
    expect(amountClass(10)).toBe('text-success-ink');
    expect(amountClass(-10)).toBe('text-danger-ink');
    expect(amountClass(0)).toBe('text-ink');
    expect(shortDate('2026-10-05')).toBe('05/10/2026');
    expect(shortDate(undefined)).toBe('—');
  });
});
