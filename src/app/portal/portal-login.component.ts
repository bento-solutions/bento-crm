import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { errorDetail } from '../pages/bank/bank-labels';
import { PortalAuthService, PortalFirmChoice } from './portal-auth.service';
import { PortalAuthFrameComponent } from './portal-auth-frame.component';

/**
 * Client portal sign-in. When the email is a client of several firms, the API answers with the
 * firms instead of a session: the client picks one and is signed in to that firm's portal.
 */
@Component({
  selector: 'app-portal-login',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, PortalAuthFrameComponent],
  template: `
    <app-portal-auth-frame [heading]="'portal.login.title' | translate" [subheading]="(firms() ? 'portal.login.chooseFirm' : 'portal.login.subtitle') | translate">
      @if (firms(); as list) {
        <div class="space-y-2">
          @for (f of list; track f.organizationId) {
            <button type="button" class="option-card option-card--row w-full text-start" [disabled]="busy()" (click)="submit(f.organizationId)">
              <mat-icon class="text-ink-3">business</mat-icon>
              <span class="text-sm font-medium text-ink flex-1 min-w-0 truncate">{{ f.firmName }}</span>
              <mat-icon class="text-ink-3 rtl:rotate-180">chevron_right</mat-icon>
            </button>
          }
        </div>
        <button type="button" class="btn-link text-sm" (click)="firms.set(null)">{{ 'portal.login.back' | translate }}</button>
      } @else {
        <form class="space-y-4" (ngSubmit)="submit()">
          <label class="block"><span class="field-label">{{ 'portal.email' | translate }}</span>
            <input class="input-field" type="email" name="email" autocomplete="username" required [(ngModel)]="email" /></label>
          <label class="block"><span class="field-label">{{ 'portal.password' | translate }}</span>
            <input class="input-field" type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" /></label>
          @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn-primary btn-block" [disabled]="busy() || !email.trim() || !password">
            {{ (busy() ? 'portal.login.signingIn' : 'portal.login.submit') | translate }}
          </button>
        </form>
        <a routerLink="/portal/forgot" class="btn-link text-sm">{{ 'portal.login.forgot' | translate }}</a>
      }
    </app-portal-auth-frame>
  `,
})
export class PortalLoginComponent {
  private auth = inject(PortalAuthService);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  email = '';
  password = '';
  busy = signal(false);
  error = signal<string | null>(null);
  firms = signal<PortalFirmChoice[] | null>(null);

  submit(organizationId?: string): void {
    if (this.busy() || !this.email.trim() || !this.password) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.email, this.password, organizationId).subscribe({
      next: r => {
        this.busy.set(false);
        if (r.kind === 'session') {
          void this.router.navigateByUrl('/portal');
        } else {
          this.firms.set(r.firms);
        }
      },
      error: e => {
        this.busy.set(false);
        this.firms.set(null);
        this.error.set(errorDetail(e) || this.i18n.t('portal.login.failed'));
      },
    });
  }
}
