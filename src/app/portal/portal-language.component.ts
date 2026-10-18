import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { LanguageCode, isSupportedLanguage } from '../core/i18n/language';

/** Language picker of the client portal (French, English, Arabic). */
@Component({
  selector: 'app-portal-language',
  imports: [TranslatePipe],
  template: `
    <select class="input-field input-sm w-auto" [value]="i18n.currentLang()" (change)="pick($event)" [attr.aria-label]="'portal.language' | translate">
      @for (l of i18n.availableLanguages; track l.code) {
        <option [value]="l.code">{{ l.code.toUpperCase() }}</option>
      }
    </select>
  `,
})
export class PortalLanguageComponent {
  readonly i18n = inject(TranslationService);

  pick(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    if (isSupportedLanguage(code)) this.i18n.setLanguage(code as LanguageCode).subscribe();
  }
}
