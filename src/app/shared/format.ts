/**
 * Money formatting for the Moroccan market (MAD, French locale).
 *
 * Several page components carry their own private copy of this; new code should import this
 * one so the ledger, the customer card and the supplier card cannot disagree about how an
 * amount is rendered.
 */
export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })
    .format(value ?? 0);
}

/** Same as {@link formatCurrency} but keeps an explicit sign, for signed ledger movements. */
export function formatSignedCurrency(value: number | null | undefined): string {
  const amount = value ?? 0;
  const formatted = formatCurrency(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

/** Renders an ISO date (or date-time) as a short local date, blank when absent. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-MA');
}
