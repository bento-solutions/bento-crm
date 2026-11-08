import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BrandMarkComponent } from '../shared/ui/brand-mark.component';
import { AuthApiService } from '../core/services/auth-api.service';
import { ApiClientError } from '../core/services/base-api.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

/**
 * Opened from the "Choose a new password" link. Public: the person can't sign in, which is why
 * they asked. Saving signs the account out everywhere, so it ends on the sign-in page.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [BrandMarkComponent, FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-canvas p-6">
      <div class="card w-full max-w-[440px] px-8 pt-10 pb-8">
        <div class="flex items-center justify-center gap-2.5 mb-8">
          <app-brand-mark [size]="28" />
          <span class="font-semibold text-xl tracking-tight text-ink">Bento</span>
        </div>

        @if (done()) {
          <div class="text-center space-y-4" role="status">
            <div class="w-12 h-12 mx-auto bg-accent-soft text-accent-ink rounded-full flex items-center justify-center">
              <mat-icon class="icon-lg">lock_reset</mat-icon>
            </div>
            <p class="text-sm font-semibold text-ink">{{ 'reset.done' | translate }}</p>
            <a href="/" class="btn-primary w-full">{{ 'verify.signIn' | translate }}</a>
          </div>
        } @else if (!token) {
          <div class="text-center space-y-4" role="alert">
            <p class="text-sm text-ink-2">{{ 'reset.invalid' | translate }}</p>
            <a href="/" class="btn-primary w-full">{{ 'verify.signIn' | translate }}</a>
          </div>
        } @else {
          <div class="text-center mb-6">
            <h1 class="text-lg font-semibold text-ink">{{ 'reset.title' | translate }}</h1>
            <p class="text-xs text-ink-2 mt-1 leading-relaxed">{{ 'reset.subtitle' | translate }}</p>
          </div>

          @if (error()) {
            <div class="alert alert-danger mb-4 justify-center text-center" role="alert">{{ error() }}</div>
          }

          <form (ngSubmit)="save()" class="space-y-4">
            <div>
              <label for="reset_password" class="field-label mb-1.5">{{ 'reset.password' | translate }}</label>
              <input id="reset_password" [(ngModel)]="password" name="password" type="password"
                autocomplete="new-password" required minlength="12" class="input-field w-full" />
            </div>
            <div>
              <label for="reset_confirm" class="field-label mb-1.5">{{ 'reset.confirm' | translate }}</label>
              <input id="reset_confirm" [(ngModel)]="confirmPassword" name="confirmPassword" type="password"
                autocomplete="new-password" required class="input-field w-full" />
            </div>
            <button type="submit" [disabled]="saving()" class="btn-primary w-full mt-2">
              {{ (saving() ? 'reset.saving' : 'reset.save') | translate }}
            </button>
          </form>
        }
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApiService);
  private translation = inject(TranslationService);

  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  password = '';
  confirmPassword = '';
  saving = signal(false);
  done = signal(false);
  error = signal('');

  save(): void {
    this.error.set('');
    if (this.password.length < 12) {
      this.error.set(this.translation.t('reset.tooShort'));
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set(this.translation.t('reset.mismatch'));
      return;
    }
    this.saving.set(true);
    this.authApi.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.saving.set(false);
        this.done.set(true);
      },
      error: (err: ApiClientError) => {
        this.saving.set(false);
        this.error.set(err?.status === 404
          ? this.translation.t('reset.invalid')
          : err?.detail || this.translation.t('login.errorServer'));
      }
    });
  }
}
