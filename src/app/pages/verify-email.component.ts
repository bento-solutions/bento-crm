import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BrandMarkComponent } from '../shared/ui/brand-mark.component';
import { AuthApiService } from '../core/services/auth-api.service';
import { TranslatePipe } from '../pipes/translate.pipe';

/**
 * Opened from the "Confirm your email address" link. Public: the person has no session until
 * their address is confirmed, so the token in the link is the only credential.
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [BrandMarkComponent, MatIconModule, TranslatePipe],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-canvas p-6">
      <div class="card w-full max-w-[440px] px-8 pt-10 pb-8 text-center">
        <div class="flex items-center justify-center gap-2.5 mb-8">
          <app-brand-mark [size]="28" />
          <span class="font-semibold text-xl tracking-tight text-ink">Bento</span>
        </div>

        @switch (state()) {
          @case ('checking') {
            <div class="py-6 space-y-3" role="status">
              <div class="w-8 h-8 mx-auto border-2 border-line border-t-accent rounded-full animate-spin"></div>
              <p class="text-body text-ink-3">{{ 'verify.checking' | translate }}</p>
            </div>
          }
          @case ('done') {
            <div class="space-y-4" role="status">
              <div class="w-12 h-12 mx-auto bg-accent-soft text-accent-ink rounded-full flex items-center justify-center">
                <mat-icon class="icon-lg">verified</mat-icon>
              </div>
              <p class="text-sm font-semibold text-ink">{{ 'verify.done' | translate }}</p>
              <a href="/" class="btn-primary w-full">{{ 'verify.signIn' | translate }}</a>
            </div>
          }
          @default {
            <div class="space-y-4" role="alert">
              <div class="w-12 h-12 mx-auto bg-muted text-ink-3 rounded-full flex items-center justify-center">
                <mat-icon class="icon-lg">link_off</mat-icon>
              </div>
              <p class="text-sm font-semibold text-ink">{{ 'verify.failed' | translate }}</p>
              <p class="text-xs text-ink-2 leading-relaxed">{{ 'verify.failedHelp' | translate }}</p>
              <a href="/" class="btn-primary w-full">{{ 'verify.signIn' | translate }}</a>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class VerifyEmailComponent {
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApiService);

  state = signal<'checking' | 'done' | 'failed'>('checking');

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.state.set('failed');
      return;
    }
    this.authApi.verifyEmail(token).subscribe({
      next: () => this.state.set('done'),
      error: () => this.state.set('failed'),
    });
  }
}
