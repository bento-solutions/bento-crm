import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { errorDetail } from '../pages/bank/bank-labels';
import { PORTAL_MIN_PASSWORD, PortalAuthService } from './portal-auth.service';
import { PortalAuthFrameComponent } from './portal-auth-frame.component';
import { PortalSession } from './portal-session';

type Mode = 'accept' | 'reset';

/**
 * Choosing a password from an emailed link: accepting an invitation (/portal/accept) or
 * resetting a forgotten password (/portal/reset). Either way the client ends up signed in.
 */
@Component({
  selector: 'app-portal-password',
  imports: [FormsModule, RouterLink, TranslatePipe, PortalAuthFrameComponent],
  template: `
    <app-portal-auth-frame [heading]="('portal.' + mode() + '.title') | translate" [subheading]="('portal.' + mode() + '.subtitle') | translate">
      @if (!token) {
        <div class="alert alert-danger text-sm">{{ 'portal.linkInvalid' | translate }}</div>
        <a routerLink="/portal/login" class="btn-link text-sm">{{ 'portal.toLogin' | translate }}</a>
      } @else {
        <form class="space-y-4" (ngSubmit)="submit()">
          @if (mode() === 'accept') {
            <label class="block"><span class="field-label">{{ 'portal.accept.name' | translate }}</span>
              <input class="input-field" name="displayName" autocomplete="name" maxlength="120" [(ngModel)]="displayName" /></label>
          }
          <label class="block"><span class="field-label">{{ 'portal.newPassword' | translate }}</span>
            <input class="input-field" type="password" name="password" autocomplete="new-password" required [(ngModel)]="password" /></label>
          <label class="block"><span class="field-label">{{ 'portal.confirmPassword' | translate }}</span>
            <input class="input-field" type="password" name="confirm" autocomplete="new-password" required [(ngModel)]="confirm" /></label>
          <p class="field-hint">{{ 'portal.passwordHint' | translate: { n: minLength } }}</p>
          @if (password && password.length < minLength) {
            <p class="field-error">{{ 'portal.passwordTooShort' | translate: { n: minLength } }}</p>
          } @else if (confirm && confirm !== password) {
            <p class="field-error">{{ 'portal.passwordMismatch' | translate }}</p>
          }
          @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn-primary btn-block" [disabled]="busy() || !valid()">
            {{ (busy() ? 'portal.saving' : ('portal.' + mode() + '.submit')) | translate }}
          </button>
        </form>
      }
    </app-portal-auth-frame>
  `,
})
export class PortalPasswordComponent implements OnInit {
  private auth = inject(PortalAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  readonly minLength = PORTAL_MIN_PASSWORD;

  mode = signal<Mode>('accept');
  token = '';
  displayName = '';
  password = '';
  confirm = '';
  busy = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.mode.set(this.route.snapshot.data['mode'] === 'reset' ? 'reset' : 'accept');
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  valid(): boolean {
    return this.password.length >= this.minLength && this.password === this.confirm;
  }

  submit(): void {
    if (this.busy() || !this.valid()) return;
    this.busy.set(true);
    this.error.set(null);
    const call: Observable<PortalSession> = this.mode() === 'reset'
      ? this.auth.reset(this.token, this.password)
      : this.auth.accept(this.token, this.password, this.displayName.trim());
    call.subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl('/portal');
      },
      error: e => {
        this.busy.set(false);
        this.error.set(errorDetail(e) || this.i18n.t('portal.linkFailed'));
      },
    });
  }
}
