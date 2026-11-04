import type { ExpenseReportStatus } from '../../services/domains/expense-reports.service';

/** The status chip of an expense report. */
export function expenseReportBadge(s: ExpenseReportStatus | string | null | undefined): string {
  switch (s) {
    case 'POSTED': return 'badge-info';
    case 'REIMBURSED': return 'badge-success';
    case 'CANCELLED': return 'badge-neutral';
    default: return 'badge-warning';
  }
}

/** A period as "01/10/2026 – 31/10/2026", or one end, or a dash. */
export function periodText(from: string | null | undefined, to: string | null | undefined, fmt: (iso: string) => string): string {
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return fmt(from);
  if (to) return fmt(to);
  return '—';
}
