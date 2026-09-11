import { Observable } from 'rxjs';
import { LanguageCode } from './language';

export type TranslationDictionary = Record<string, string>;

/** Abstraction over where translation strings come from (DIP), so the
 *  delivery mechanism (HTTP today, bundled JSON or a translation API
 *  tomorrow) can change without touching TranslationService or its
 *  consumers. */
export abstract class TranslationLoader {
  abstract load(lang: LanguageCode): Observable<TranslationDictionary>;
}
