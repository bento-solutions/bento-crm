import { TranslationService } from '../../services/translation.service';
import { formatMoney } from '../../shared/bank.util';

export { errorDetail } from '../bank/bank-labels';

/** A debit or credit cell: blank at zero, so the side that carries the amount stands out. */
export function sideAmount(v: number | null | undefined): string {
  const n = Number(v) || 0;
  return n === 0 ? '' : formatMoney(n);
}

/** A balance (debit minus credit) as an amount and its side: "1 200,00 MAD D" or "… C". */
export function balanceText(i18n: TranslationService, v: number | null | undefined): string {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  if (n === 0) return formatMoney(0);
  return `${formatMoney(Math.abs(n))} ${i18n.t(n > 0 ? 'ledger.dr' : 'ledger.cr')}`;
}

/** What posted an entry (MANUAL, later INVOICE, PAYMENT…), with a readable fallback for codes not translated yet. */
export function sourceLabel(i18n: TranslationService, s: string | null | undefined): string {
  if (!s) return '—';
  const key = `ledger.source.${s}`;
  const label = i18n.t(key);
  return label === key ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : label;
}

export const ACCOUNT_CLASSES = [1, 2, 3, 4, 5, 6, 7, 8];
