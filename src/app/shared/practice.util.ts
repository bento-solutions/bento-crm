/** Pure helpers for the Tax calendar and Missions screens, kept apart so they can be unit-tested. */

/** A local calendar date as "YYYY-MM-DD" (not toISOString, which shifts to UTC). */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-10-18" plus n days, across month and year ends. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

/** Whole days from `from` to `to` (negative when `to` is earlier); daylight saving does not matter. */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** How a due date reads against today: the translation key and the number of days it needs. */
export interface DaysLeft { key: string; n: number }

export function daysLeft(dueDate: string, today: string): DaysLeft {
  const n = daysBetween(today, dueDate);
  if (n < 0) return { key: 'tax.days.late', n: -n };
  if (n === 0) return { key: 'tax.days.today', n: 0 };
  if (n === 1) return { key: 'tax.days.tomorrow', n: 1 };
  return { key: 'tax.days.in', n };
}

export type RangePreset = 'default' | 'next12';

/** The deadline window: 30 days back to 90 ahead by default, or the next twelve months. */
export function deadlineRange(preset: RangePreset, today: string): { from: string; to: string } {
  if (preset === 'next12') {
    const [y, m, d] = today.split('-').map(Number);
    return { from: today, to: addDays(isoDate(new Date(y + 1, m - 1, d)), -1) };
  }
  return { from: addDays(today, -30), to: addDays(today, 90) };
}

export interface MonthGroup<T> { month: string; items: T[] }

/** Items grouped by the "YYYY-MM" of their date, months in date order, items kept in date order within. */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string | null | undefined): MonthGroup<T>[] {
  const sorted = [...items].sort((a, b) => (dateOf(a) ?? '').localeCompare(dateOf(b) ?? ''));
  const groups: MonthGroup<T>[] = [];
  for (const it of sorted) {
    const month = (dateOf(it) ?? '').slice(0, 7) || '—';
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(it);
    else groups.push({ month, items: [it] });
  }
  return groups;
}

/** "2026-10" → "October 2026" in the given locale. */
export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

/** Share of deliverables delivered, 0–100; 0 when the mission has none. */
export function progressPercent(done: number | null | undefined, total: number | null | undefined): number {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.round(((Number(done) || 0) / t) * 100));
}

/** A VAT fraction (0.2) as a whole percent (20). */
export function vatPercent(rate: number | null | undefined): number {
  return Math.round((Number(rate) || 0) * 1000) / 10;
}

/** What rebilling the costs comes to, VAT included, as the invoice will show it. */
export function totalWithVat(costs: { amount: number; vatRate?: number | null }[]): number {
  const cents = costs.reduce((s, c) => s + Math.round((Number(c.amount) || 0) * (1 + (Number(c.vatRate) || 0)) * 100), 0);
  return cents / 100;
}
