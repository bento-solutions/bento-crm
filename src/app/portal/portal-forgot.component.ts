import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { errorDetail } from '../pages/bank/bank-labels';
import { PortalAuthService } from './portal-auth.service';
import { PortalAuthFrameComponent } from './portal-auth-frame.component';

/**
 * Forgotten password: asks for a reset link. The answer never says whether an account exists for
 * the email, so the page shows the same neutral message either way.
 */
@Component({
  selector: 'app-portal-forgot',
  imports: [FormsModule, RouterLink, TranslatePipe, PortalAuthFrameComponent],
  template: `
    <app-portal-auth-frame [heading]="'portal.forgot.title' | translate" [subheading]="'portal.forgot.subtitle' | translate">
      @if (sent()) {
        <div class="alert alert-success text-sm" role="status">{{ 'portal.forgot.sent' | translate }}</div>
      } @else {
        <form class="space-y-4" (ngSubmit)="submit()">
          <label class="block"><span class="field-label">{{ 'portal.email' | translate }}</span>
            <input class="input-field" type="email" name="email" autocomplete="username" required [(ngModel)]="email" /></label>
          @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn-primary btn-block" [disabled]="busy() || !email.trim()">{{ 'portal.forgot.submit' | translate }}</button>
        </form>
      }
      <a routerLink="/portal/login" class="btn-link text-sm">{{ 'portal.toLogin' | translate }}</a>
    </app-portal-auth-frame>
  `,
})
export class PortalForgotComponent {
  private auth = inject(PortalAuthService);
  private i18n = inject(TranslationService);

  email = '';
  busy = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);

  submit(): void {
    if (this.busy() || !this.email.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.forgot(this.email).subscribe({
      next: () => { this.busy.set(false); this.sent.set(true); },
      error: e => {
        this.busy.set(false);
        this.error.set(errorDetail(e) || this.i18n.t('portal.error'));
      },
    });
  }
}
