import { TranslationService } from '../../services/translation.service';
import type { AssetCategory } from '../../services/domains/assets.service';

/** A fixed-asset category in the user's language; else the server's name, else the code. */
export function assetCategoryLabel(i18n: TranslationService, code: string | null | undefined, categories: AssetCategory[] = []): string {
  if (!code) return '—';
  const key = `assets.cat.${code}`;
  const label = i18n.t(key);
  if (label !== key) return label;
  return categories.find(c => c.code === code)?.name ?? code;
}
