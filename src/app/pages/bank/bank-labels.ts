import { TranslationService } from '../../services/translation.service';

/** "NONE" (or no category) reads "Uncategorized"; an unknown code falls back to a readable form. */
export function categoryLabel(i18n: TranslationService, c: string | null | undefined): string {
  const code = c || 'NONE';
  const key = `bank.cat.${code}`;
  const label = i18n.t(key);
  return label === key ? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ') : label;
}

export function bankLabel(i18n: TranslationService, b: string | null | undefined): string {
  if (!b) return '—';
  const key = `bank.bankName.${b}`;
  const label = i18n.t(key);
  return label === key ? b : label;
}

/** The toast text for a failed call: the API's own detail when it sent one. */
export function errorDetail(e: unknown): string | null {
  const err = e as { detail?: string; error?: { detail?: string } } | null;
  return err?.detail || err?.error?.detail || null;
}
