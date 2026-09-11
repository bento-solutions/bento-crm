import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { TranslationLoader, TranslationDictionary } from '../core/i18n/translation-loader';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LanguageCode,
  LanguageDefinition,
  getLanguageDefinition,
  isSupportedLanguage,
} from '../core/i18n/language';

const STORAGE_KEY = 'bento_lang';

/** Single source of truth for the active interface language.
 *
 *  Responsibilities are deliberately narrow (SRP): track the current
 *  language, load/cache its dictionary via an injected TranslationLoader
 *  (DIP -- the loader is swappable), and reflect the choice onto
 *  `<html dir/lang>` and localStorage. It knows nothing about user
 *  profiles or backend persistence; CrmStateService is responsible for
 *  keeping the authenticated user's saved preference in sync with this
 *  service, so the two concerns stay decoupled. */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private loader = inject(TranslationLoader);
  private cache = new Map<LanguageCode, TranslationDictionary>();

  readonly availableLanguages: readonly LanguageDefinition[] = LANGUAGES;

  private readonly langSignal = signal<LanguageCode>(this.readStoredLanguage());
  private readonly dictionarySignal = signal<TranslationDictionary>({});
  readonly isLoading = signal(false);

  readonly currentLang = this.langSignal.asReadonly();
  readonly currentLanguageDefinition = computed(() => getLanguageDefinition(this.langSignal()));
  readonly dir = computed(() => this.currentLanguageDefinition().dir);
  readonly isRtl = computed(() => this.dir() === 'rtl');

  /** Resolves the language to boot with, in priority order: a previously
   *  chosen language in localStorage, then the browser's language, then
   *  the app default. The authenticated user's saved preference (if any)
   *  takes over once CrmStateService loads it. */
  private readStoredLanguage(): LanguageCode {
    if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : undefined;
    return isSupportedLanguage(browserLang) ? browserLang : DEFAULT_LANGUAGE;
  }

  /** Loads (or reuses the cached) dictionary for `lang`, applies it, and
   *  reflects the choice on `<html>` and localStorage. Call once at
   *  bootstrap via an app initializer, and again whenever the user
   *  changes their language. */
  setLanguage(lang: LanguageCode): Observable<TranslationDictionary> {
    const cached = this.cache.get(lang);
    if (cached) {
      this.applyLanguage(lang, cached);
      return of(cached);
    }

    this.isLoading.set(true);
    return this.loader.load(lang).pipe(
      tap({
        next: (dict) => {
          this.cache.set(lang, dict);
          this.applyLanguage(lang, dict);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      })
    );
  }

  /** Boot-time entry point for the app initializer. */
  init(): Observable<TranslationDictionary> {
    return this.setLanguage(this.langSignal());
  }

  private applyLanguage(lang: LanguageCode, dict: TranslationDictionary): void {
    this.langSignal.set(lang);
    this.dictionarySignal.set(dict);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = getLanguageDefinition(lang).dir;
      document.documentElement.lang = lang;
    }
  }

  /** Translates `key`, optionally interpolating `{{token}}` placeholders
   *  from `params`. Falls back to the default language, then the raw key,
   *  so missing translations never render blank. */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = this.dictionarySignal();
    const fallback = this.cache.get(DEFAULT_LANGUAGE);
    const raw = dict[key] ?? fallback?.[key] ?? key;
    return params ? this.interpolate(raw, params) : raw;
  }

  private interpolate(text: string, params: Record<string, string | number>): string {
    return text.replace(/{{\s*(\w+)\s*}}/g, (_match, token) =>
      token in params ? String(params[token]) : _match
    );
  }
}
