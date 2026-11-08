import { BrandMarkComponent } from '../shared/ui/brand-mark.component';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService, LoginResponse, OrganizationChoice, isEmailNotVerified } from '../core/services/auth-api.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [BrandMarkComponent, FormsModule, CommonModule, MatIconModule, RouterLink, TranslatePipe],
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg);
    }

    /* Split screen: a soft, misty brand panel beside the sign-in form. */
    .login-container {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      min-height: 100vh;
      padding: 16px;
      gap: 16px;
      background: var(--color-bg);
    }

    .login-hero {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 48px;
      padding: 44px 48px;
      border-radius: var(--r-overlay);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      overflow: hidden;
    }

    .login-hero__brand { display: flex; align-items: center; gap: 12px; }
    .login-hero__brand span { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }

    .login-hero__eyebrow {
      display: block; font-size: 14px; font-weight: 500; color: var(--color-accent-text);
    }

    .login-hero__title {
      margin: 20px 0 0; max-width: 540px;
      font-size: 40px; line-height: 1.1; font-weight: 500; letter-spacing: -0.02em;
    }
    .login-hero__subtitle { margin: 14px 0 0; max-width: 460px; font-size: 16px; line-height: 1.6; color: var(--color-text-secondary); }

    .login-hero__features { display: flex; flex-direction: column; gap: 0; margin: 32px 0 0; padding: 0; list-style: none; }
    .login-hero__features li {
      display: flex; align-items: baseline; gap: 16px; max-width: 440px;
      padding: 12px 0; border-bottom: 1px solid var(--color-border-light);
      font-size: 15px; font-weight: 400; color: var(--color-text-secondary);
    }
    .login-hero__num {
      flex-shrink: 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-text-tertiary);
    }
    .login-hero__foot { font-size: 12px; color: var(--color-text-secondary); }

    .login-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
    }

    .login-logo {
      display: none;
      align-items: center;
      gap: 10px;
      margin-bottom: 32px;
    }

    .login-logo img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      object-fit: contain;
    }

    .login-logo span {
      font-weight: 600;
      font-size: 20px;
      letter-spacing: -0.01em;
      color: var(--color-text-primary);
    }

    .login-title {
      margin-bottom: 28px;
    }

    .login-title h1 {
      font-size: 32px;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .login-title p {
      font-size: 14px;
      color: var(--color-text-tertiary);
      margin: 6px 0 0;
    }

    @media (max-width: 960px) {
      .login-container { grid-template-columns: 1fr; padding: 0; }
      .login-hero { display: none; }
      .login-logo { display: flex; }
    }

    .login-card .input-field { height: 46px; font-size: 14px; background: var(--color-surface); }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      height: var(--control-height);
      padding: 0 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--r-control);
      font-size: 13px;
      color: var(--color-text-primary);
      outline: none;
      transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
      box-sizing: border-box;
    }

    .form-input::placeholder {
      color: var(--color-text-placeholder);
    }

    .form-input:focus {
      background: var(--color-surface);
      border-color: var(--color-focus);
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }

    .password-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .password-input {
      padding-inline-end: 38px;
    }

    .password-toggle-btn {
      position: absolute;
      inset-inline-end: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      padding: 4px;
      margin: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-tertiary);
      border-radius: 6px;
      transition: color var(--transition-fast), background-color var(--transition-fast);
    }

    .password-toggle-btn:hover {
      color: var(--color-text-primary);
      background-color: var(--color-surface-hover);
    }

    .toggle-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .login-btn {
      width: 100%;
      background: var(--color-primary);
      color: var(--color-on-primary);
      border: none;
      border-radius: var(--r-control);
      height: 48px;
      padding: 0 16px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--transition-fast);
      margin-top: 8px;
    }

    .login-btn:hover {
      background: var(--color-primary-hover);
    }

    .login-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-msg {
      background: var(--color-danger-light);
      border: 1px solid var(--color-danger-border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--color-danger-text);
      margin-bottom: 16px;
      text-align: center;
    }

    .info-msg {
      background: var(--color-accent-soft, var(--color-surface-muted));
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.5;
      color: var(--color-text-secondary);
      margin-bottom: 16px;
      text-align: center;
    }

    .info-msg strong {
      display: block;
      color: var(--color-text-primary);
      margin-bottom: 2px;
    }

    .link-btn {
      background: none;
      border: 0;
      padding: 0;
      font: inherit;
      color: var(--color-text-primary);
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .forgot-link {
      display: block;
      margin-left: auto;
      background: none;
      border: 0;
      padding: 0;
      font-family: inherit;
      text-align: right;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-tertiary);
      margin-top: 4px;
      cursor: pointer;
      text-decoration: none;
    }

    .forgot-link:hover {
      color: var(--color-text-primary);
    }

    .signup-link {
      text-align: center;
      font-size: 12px;
      color: var(--color-text-tertiary);
      margin: 20px 0 0;
    }

    .signup-link a {
      color: var(--color-text-primary);
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    .signup-link a:hover {
      color: var(--color-accent-text);
    }

    .org-selection-header {
      text-align: center;
      margin-bottom: 20px;
    }

    .org-selection-header h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text-primary);
      margin: 0;
    }

    .org-selection-header p {
      font-size: 13px;
      color: var(--color-text-tertiary);
      margin: 6px 0 0;
      line-height: 1.4;
    }

    .org-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }

    .org-item-card {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      background: var(--color-subtle);
      border: 1px solid var(--color-border);
      border-radius: var(--r-card);
      cursor: pointer;
      text-align: start;
      transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .org-item-card:hover:not(:disabled) {
      background: var(--color-surface-hover);
      border-color: var(--color-border-strong);
      transform: translateY(-1px);
    }

    .org-item-card:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .org-item-avatar {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: var(--color-inverse);
      color: var(--color-on-inverse);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
      overflow: hidden;
    }

    .org-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }

    .org-item-content {
      flex: 1;
      min-width: 0;
    }

    .org-item-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .org-item-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }

    .org-item-role {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-secondary);
      background: var(--color-border);
      padding: 1px 6px;
      border-radius: 4px;
      letter-spacing: 0;
    }

    .org-item-arrow {
      color: var(--color-text-placeholder);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-text-primary);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .org-item-date {
      font-size: 11px;
      color: var(--color-text-tertiary);
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 9px 14px;
      background: transparent;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text-tertiary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .back-btn:hover:not(:disabled) {
      background: var(--color-subtle);
      color: var(--color-text-primary);
    }

    .back-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `],
  template: `
    <div class="login-container">
      <aside class="login-hero">
        <div class="login-hero__brand">
          <app-brand-mark [size]="28" />
          <span>Bento</span>
        </div>
        <div>
          <span class="login-hero__eyebrow">{{ 'login.hero.eyebrow' | translate }}</span>
          <h2 class="login-hero__title">{{ 'login.hero.title' | translate }}</h2>
          <p class="login-hero__subtitle">{{ 'login.hero.subtitle' | translate }}</p>
          <ul class="login-hero__features">
            <li><span class="login-hero__num">01</span>{{ 'login.hero.centralize' | translate }}</li>
            <li><span class="login-hero__num">02</span>{{ 'login.hero.automate' | translate }}</li>
            <li><span class="login-hero__num">03</span>{{ 'login.hero.collaborate' | translate }}</li>
          </ul>
        </div>
        <div class="login-hero__foot">© Bento CRM</div>
      </aside>
      <div class="login-panel">
      <div class="login-card">
        <div class="login-logo">
          <app-brand-mark [size]="28" />
          <span>Bento</span>
        </div>

        @if (availableOrgs().length > 0) {
          <div class="org-selection-header">
            <h2>{{ 'login.selectWorkspace' | translate }}</h2>
            <p>{{ 'login.multipleWorkspacesDesc' | translate }}</p>
          </div>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }

          <div class="org-list">
            @for (org of availableOrgs(); track org.organization_id) {
              <button
                type="button"
                class="org-item-card"
                (click)="selectOrganizationAndLogin(org.organization_id)"
                [disabled]="loading()"
              >
                <div class="org-item-avatar">
                  @if (org.logo_url) {
                    <img [src]="resolveLogoUrl(org.logo_url)" [alt]="org.organization_name" class="org-avatar-img" />
                  } @else {
                    {{ (org.organization_name ? org.organization_name.charAt(0) : 'W').toUpperCase() }}
                  }
                </div>
                <div class="org-item-content">
                  <div class="org-item-name">{{ org.organization_name }}</div>
                  <div class="org-item-meta">
                    @if (org.role) {
                      <span class="org-item-role">{{ org.role }}</span>
                    }
                    @if (org.joined_at) {
                      <span class="org-item-date">{{ 'login.joinedDate' | translate }}: {{ org.joined_at | date:'mediumDate' }}</span>
                    }
                    @if (org.last_active_at) {
                      <span class="org-item-date">• {{ 'login.lastActive' | translate }}: {{ org.last_active_at | date:'mediumDate' }}</span>
                    }
                  </div>
                </div>
                @if (loading() && selectedOrgId() === org.organization_id) {
                  <div class="spinner"></div>
                } @else {
                  <mat-icon class="org-item-arrow">chevron_right</mat-icon>
                }
              </button>
            }
          </div>

          <button
            type="button"
            class="back-btn"
            (click)="resetToLoginForm()"
            [disabled]="loading()"
          >
            <mat-icon class="back-icon">arrow_back</mat-icon>
            <span>{{ 'login.backToLogin' | translate }}</span>
          </button>
        } @else if (mode() === 'forgot') {
          <div class="login-title">
            <h1>{{ 'login.forgotTitle' | translate }}</h1>
            <p>{{ 'login.forgotSubtitle' | translate }}</p>
          </div>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          @if (info()) {
            <div class="info-msg" role="status">{{ info() }}</div>
          }

          <form (ngSubmit)="sendResetLink()">
            <div class="form-group">
              <label for="reset-email">{{ 'login.email' | translate }}</label>
              <input
                id="reset-email"
                type="email"
                [(ngModel)]="email"
                name="email"
                class="input-field"
                [placeholder]="'login.emailPlaceholder' | translate"
                autocomplete="email"
                required
              />
            </div>
            <button type="submit" class="login-btn" [disabled]="loading()">
              {{ loading() ? ('login.sending' | translate) : ('login.sendResetLink' | translate) }}
            </button>
          </form>

          <button type="button" class="back-btn" style="margin-top: 12px" (click)="backToSignIn()" [disabled]="loading()">
            <mat-icon class="back-icon">arrow_back</mat-icon>
            <span>{{ 'login.backToLogin' | translate }}</span>
          </button>
        } @else {
          <div class="login-title">
            <h1>{{ 'login.title' | translate }}</h1>
            <p>{{ 'login.subtitle' | translate }}</p>
          </div>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          @if (notVerifiedEmail(); as unverified) {
            <!-- Right password, unconfirmed address: the API has just emailed a link. -->
            <div class="info-msg" role="status">
              <strong>{{ 'login.notVerifiedTitle' | translate }}</strong>
              {{ 'login.notVerified' | translate: { email: unverified } }}
              <div style="margin-top: 6px">
                @if (info()) {
                  {{ info() }}
                } @else {
                  <button type="button" class="link-btn" (click)="resendVerification()" [disabled]="loading()">
                    {{ 'login.resendLink' | translate }}
                  </button>
                }
              </div>
            </div>
          }

          <form (ngSubmit)="onLogin()">
            <div class="form-group">
              <label for="email">{{ 'login.email' | translate }}</label>
              <input
                id="email"
                type="email"
                [(ngModel)]="email"
                name="email"
                class="input-field"
                [placeholder]="'login.emailPlaceholder' | translate"
                autocomplete="email"
                required
              />
            </div>

            <div class="form-group">
              <label for="password">{{ 'login.password' | translate }}</label>
              <div class="password-input-wrapper">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  class="input-field"
                  [placeholder]="'login.passwordPlaceholder' | translate"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  (click)="togglePasswordVisibility()"
                  [attr.aria-label]="(showPassword() ? 'login.hidePassword' : 'login.showPassword') | translate"
                  tabindex="-1"
                >
                  <mat-icon class="toggle-icon">{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
              <button type="button" class="forgot-link" (click)="openForgot()">{{ 'login.forgotPassword' | translate }}</button>
            </div>

            <button
              type="submit"
              class="login-btn"
              [disabled]="loading()"
            >
              {{ loading() ? ('login.signingIn' | translate) : ('login.signIn' | translate) }}
            </button>
          </form>

          <p class="signup-link">
            {{ 'login.newToBento' | translate }}
            <a routerLink="/onboarding">{{ 'login.createOrg' | translate }}</a>
          </p>
        }
      </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private state = inject(CrmStateService);
  private router = inject(Router);
  private authApi = inject(AuthApiService);
  private translation = inject(TranslationService);

  email = signal('');
  password = signal('');
  showPassword = signal(false);
  availableOrgs = signal<OrganizationChoice[]>([]);
  selectedOrgId = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  /** 'forgot' shows the form that emails a link to choose a new password. */
  mode = signal<'signin' | 'forgot'>('signin');
  /** Neutral notices, such as "a link is on its way". */
  info = signal('');
  /** Set when the password was right but the address isn't confirmed yet. */
  notVerifiedEmail = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  resetToLoginForm(): void {
    this.availableOrgs.set([]);
    this.selectedOrgId.set(null);
    this.error.set('');
  }

  resolveLogoUrl(url?: string): string {
    return this.state.resolveLogoUrl(url);
  }

  onLogin(): void {
    const email = this.email().trim();
    // Do not trim the password: leading/trailing spaces are valid characters and
    // silently stripping them locks out anyone whose password uses them.
    const password = this.password();

    if (!email || !password) {
      this.error.set(this.translation.t('login.errorRequired'));
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    this.notVerifiedEmail.set(null);

    this.authApi.login({ email, password }).subscribe({
      next: (response) => {
        this.handleLoginSuccess(response);
      },
      error: (err: any) => {
        console.error('Login failed:', err);

        // Robustly extract organizations whether err is ApiClientError or HttpErrorResponse
        let orgs: OrganizationChoice[] | undefined;
        if (Array.isArray(err?.organizations)) {
          orgs = err.organizations;
        } else if (Array.isArray(err?.body?.organizations)) {
          orgs = err.body.organizations;
        } else if (Array.isArray(err?.error?.organizations)) {
          orgs = err.error.organizations;
        } else if (typeof err?.error === 'string') {
          try {
            const parsed = JSON.parse(err.error);
            if (Array.isArray(parsed?.organizations)) {
              orgs = parsed.organizations;
            }
          } catch {}
        }

        if (Array.isArray(orgs) && orgs.length > 0) {
          this.availableOrgs.set(orgs);
          this.loading.set(false);
          this.error.set('');
          return;
        }

        if (isEmailNotVerified(err)) {
          this.notVerifiedEmail.set(email);
        } else if (err.status === 429) {
          this.error.set(this.translation.t('login.errorRateLimit'));
        } else if (err.status === 0 || err.status >= 500) {
          this.error.set(this.translation.t('login.errorServer'));
        } else {
          const detail = err?.detail || err?.body?.detail || err?.error?.detail;
          this.error.set(detail || this.translation.t('login.errorInvalid'));
        }
        this.loading.set(false);
      }
    });
  }

  selectOrganizationAndLogin(orgId: string): void {
    const email = this.email().trim();
    const password = this.password();

    this.selectedOrgId.set(orgId);
    this.loading.set(true);
    this.error.set('');

    this.authApi.login({ email, password, organization_id: orgId }).subscribe({
      next: (response) => {
        this.handleLoginSuccess(response);
      },
      error: (err: any) => {
        console.error('Organization login failed:', err);
        this.loading.set(false);
        this.selectedOrgId.set(null);
        const detail = err?.detail || err?.body?.detail || err?.error?.detail;
        this.error.set(detail || this.translation.t('login.errorInvalid'));
      }
    });
  }

  openForgot(): void {
    this.mode.set('forgot');
    this.error.set('');
    this.info.set('');
    this.notVerifiedEmail.set(null);
  }

  backToSignIn(): void {
    this.mode.set('signin');
    this.error.set('');
    this.info.set('');
  }

  /** The API answers the same whether or not the address has an account, and so does this screen. */
  sendResetLink(): void {
    const email = this.email().trim();
    if (!email) {
      this.error.set(this.translation.t('login.errorRequired'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    this.authApi.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.info.set(this.translation.t('login.resetSent', { email }));
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        this.error.set(this.translation.t(err?.status === 429 ? 'login.errorRateLimit' : 'login.errorServer'));
      }
    });
  }

  resendVerification(): void {
    const email = this.notVerifiedEmail();
    if (!email) return;
    this.loading.set(true);
    this.authApi.resendVerification(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.info.set(this.translation.t('login.linkResent'));
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        this.error.set(this.translation.t(err?.status === 429 ? 'login.errorRateLimit' : 'login.errorServer'));
      }
    });
  }

  private handleLoginSuccess(response: LoginResponse): void {
    this.loading.set(false);
    this.state.startSession(response);
    // While signed out, authGuard turned the first navigation away, which leaves
    // the router believing it is already at "/" -- so a plain navigate(['/']) was
    // ignored as a same-URL navigation and the shell came up with an empty outlet
    // (a blank dashboard) until a reload. 'reload' makes the router run it anyway.
    this.router.navigate(['/'], { onSameUrlNavigation: 'reload' });
  }

}
