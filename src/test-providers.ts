import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';
import { TranslationDictionary, TranslationLoader } from './app/core/i18n/translation-loader';

/** Answers every language with an empty dictionary, so the translate pipe shows keys. */
class EmptyTranslationLoader extends TranslationLoader {
  load(): Observable<TranslationDictionary> {
    return of({});
  }
}

/** Providers every spec gets (angular.json → test → providersFile), standing in for the ones
 *  app.config.ts wires up: translations without fetching /i18n/*.json, and an HTTP backend that
 *  never reaches the network. A spec can still override either with its own providers. */
const testProviders: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(),
  provideHttpClientTesting(),
  { provide: TranslationLoader, useClass: EmptyTranslationLoader },
];

export default testProviders;
