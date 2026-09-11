import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false   // impure so it re-evaluates on signal change
})
export class TranslatePipe implements PipeTransform {
  private t = inject(TranslationService);

  transform(key: string, params?: Record<string, string | number>): string {
    // Access the signal so Angular tracks dependency
    this.t.currentLang();
    return this.t.t(key, params);
  }
}
