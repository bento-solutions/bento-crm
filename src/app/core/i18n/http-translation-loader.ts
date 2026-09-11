import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TranslationDictionary, TranslationLoader } from './translation-loader';
import { LanguageCode } from './language';

/** Fetches translation dictionaries from static JSON under /public/i18n/.
 *  Kept separate from TranslationService so the fetch strategy can be
 *  swapped (e.g. a fake loader in tests) without touching consumers. */
@Injectable()
export class HttpTranslationLoader extends TranslationLoader {
  private http = inject(HttpClient);

  load(lang: LanguageCode): Observable<TranslationDictionary> {
    return this.http.get<TranslationDictionary>(`/i18n/${lang}.json`);
  }
}
