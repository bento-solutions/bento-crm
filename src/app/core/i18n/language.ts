/** Supported interface languages. Extending localization to a new language
 *  means adding one entry here plus one JSON file under public/i18n/ --
 *  no other file in the app needs to change (open/closed). */
export type LanguageCode = 'en' | 'fr' | 'ar';

export type TextDirection = 'ltr' | 'rtl';

export interface LanguageDefinition {
  code: LanguageCode;
  /** Name of the language written in that language, for use inside pickers. */
  nativeLabel: string;
  englishLabel: string;
  dir: TextDirection;
}

export const LANGUAGES: readonly LanguageDefinition[] = [
  { code: 'en', nativeLabel: 'English', englishLabel: 'English', dir: 'ltr' },
  { code: 'fr', nativeLabel: 'Français', englishLabel: 'French', dir: 'ltr' },
  { code: 'ar', nativeLabel: 'العربية', englishLabel: 'Arabic', dir: 'rtl' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(value: string | null | undefined): value is LanguageCode {
  return !!value && LANGUAGES.some(l => l.code === value);
}

export function getLanguageDefinition(code: LanguageCode): LanguageDefinition {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
}
