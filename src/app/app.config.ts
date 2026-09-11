import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { TranslationLoader } from './core/i18n/translation-loader';
import { HttpTranslationLoader } from './core/i18n/http-translation-loader';
import { TranslationService } from './services/translation.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: TranslationLoader, useClass: HttpTranslationLoader },
    // Loads and applies the initial language (dir/lang attrs included)
    // before the app renders, so there's no flash of the wrong language.
    provideAppInitializer(() => {
      const translation = inject(TranslationService);
      return translation.init();
    }),
  ],
};
