/** Pure helpers for the Bank screens (masking, chart geometry, money), kept apart so they can be unit-tested. */

/** "•••• 1234": an account number (or RIB) reduced to its last four digits. */
export function maskAccountNumber(n: string | null | undefined): string {
  const digits = (n ?? '').replace(/\s+/g, '');
  if (!digits) return '—';
  if (digits.length <= 4) return digits;
  return '•••• ' + digits.slice(-4);
}

/** Bar length (0–100 %) of a value against the largest one; a non-zero value never vanishes. */
export function barPercent(value: number | null | undefined, max: number): number {
  const v = Math.abs(Number(value) || 0);
  if (!(max > 0) || v === 0) return 0;
  return Math.min(100, Math.max(2, (v / max) * 100));
}

/** The largest absolute value of a list, 0 when empty. */
export function maxAbs(values: (number | null | undefined)[]): number {
  return values.reduce<number>((m, v) => Math.max(m, Math.abs(Number(v) || 0)), 0);
}

/** Vertical range a set of balances is drawn in; always includes zero so the zero line is visible. */
export interface Domain { min: number; max: number }

export function balanceDomain(values: (number | null | undefined)[]): Domain {
  const nums = values.map(v => Number(v) || 0);
  const min = Math.min(0, ...nums);
  const max = Math.max(0, ...nums);
  return min === max ? { min: 0, max: 1 } : { min, max };
}

/** Position of a bar from zero to `value`, as percents from the top of the chart. */
export interface Span { top: number; height: number }

export function spanFor(value: number | null | undefined, d: Domain): Span {
  const range = d.max - d.min;
  const v = Number(value) || 0;
  const y = (x: number) => ((d.max - x) / range) * 100;
  const top = Math.min(y(0), y(v));
  const height = Math.abs(y(v) - y(0));
  return { top: round(top), height: round(v !== 0 ? Math.max(height, 1) : 0) };
}

/** Where the zero line sits, as a percent from the top of the chart. */
export function zeroLine(d: Domain): number {
  return round((d.max / (d.max - d.min)) * 100);
}

/** CSS class for a signed amount: green in, red out, plain at zero. */
export function amountClass(v: number | null | undefined): string {
  const n = Number(v) || 0;
  return n > 0 ? 'text-success-ink' : n < 0 ? 'text-danger-ink' : 'text-ink';
}

export function formatMoney(v: number | null | undefined, currency?: string | null): string {
  try {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency || 'MAD' }).format(Number(v) || 0);
  } catch {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(v) || 0);
  }
}

/** Short form for chart labels: 12 500 → "12,5 k", 1 200 000 → "1,2 M". */
export function compactMoney(v: number | null | undefined): string {
  return new Intl.NumberFormat('fr-MA', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v) || 0);
}

/** "2026-10-15" → "15/10/2026"; "—" when absent. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '—';
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
