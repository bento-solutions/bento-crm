import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService, OrganizationChoice } from '../core/services/auth-api.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, RouterLink, TranslatePipe],
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg, #FAFAFA);
    }

    .login-container {
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: #FFFFFF;
      border: 1px solid #E4E4E7;
      border-radius: 16px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      padding: 40px 32px 32px;
    }

    .login-logo {
      display: flex;
      align-items: center;
      justify-content: center;
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
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -0.02em;
      color: #09090B;
    }

    .login-title {
      text-align: center;
      margin-bottom: 6px;
    }

    .login-title h1 {
      font-size: 18px;
      font-weight: 700;
      color: #09090B;
      margin: 0;
    }

    .login-title p {
      font-size: 13px;
      color: #71717A;
      margin: 4px 0 0;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #09090B;
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 9px 12px;
      background: #FAFAFA;
      border: 1px solid #E4E4E7;
      border-radius: 8px;
      font-size: 13px;
      color: #09090B;
      outline: none;
      transition: all 150ms ease;
      box-sizing: border-box;
    }

    .form-input::placeholder {
      color: #A1A1AA;
    }

    .form-input:focus {
      background: #FFFFFF;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
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
      color: #71717A;
      border-radius: 6px;
      transition: color 150ms ease, background-color 150ms ease;
    }

    .password-toggle-btn:hover {
      color: #09090B;
      background-color: #F4F4F5;
    }

    .toggle-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .login-btn {
      width: 100%;
      padding: 10px 16px;
      background: var(--color-text-primary);
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease;
      margin-top: 8px;
    }

    .login-btn:hover {
      background: #27272A;
    }

    .login-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-msg {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: #991B1B;
      margin-bottom: 16px;
      text-align: center;
    }

    .forgot-link {
      display: block;
      text-align: right;
      font-size: 11px;
      font-weight: 500;
      color: #71717A;
      margin-top: 4px;
      cursor: pointer;
      text-decoration: none;
    }

    .forgot-link:hover {
      color: #09090B;
    }

    .signup-link {
      text-align: center;
      font-size: 12px;
      color: #71717A;
      margin: 20px 0 0;
    }

    .signup-link a {
      color: #09090B;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    .signup-link a:hover {
      color: var(--color-accent);
    }

    .org-selection-header {
      text-align: center;
      margin-bottom: 20px;
    }

    .org-selection-header h2 {
      font-size: 18px;
      font-weight: 700;
      color: #09090B;
      margin: 0;
    }

    .org-selection-header p {
      font-size: 13px;
      color: #71717A;
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
      background: #FAFAFA;
      border: 1px solid #E4E4E7;
      border-radius: 10px;
      cursor: pointer;
      text-align: start;
      transition: all 150ms ease;
    }

    .org-item-card:hover:not(:disabled) {
      background: #F4F4F5;
      border-color: #D4D4D8;
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
      background: #09090B;
      color: #FFFFFF;
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
      color: #09090B;
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
      color: #52525B;
      background: #E4E4E7;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .org-item-arrow {
      color: #A1A1AA;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid #E4E4E7;
      border-top-color: #09090B;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .org-item-date {
      font-size: 11px;
      color: #71717A;
    }

    .org-warning-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 12px;
      color: #92400E;
      line-height: 1.4;
      text-align: start;
    }

    .org-warning-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #D97706;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .org-warning-text {
      flex: 1;
    }

    .org-warning-title {
      font-weight: 700;
      margin-inline-end: 4px;
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 9px 14px;
      background: transparent;
      border: 1px solid #E4E4E7;
      border-radius: 8px;
      color: #71717A;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .back-btn:hover:not(:disabled) {
      background: #FAFAFA;
      color: #09090B;
    }

    .back-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo">
          <img src="logo.webp" alt="Bento Logo" />
          <span>Bento</span>
        </div>

        @if (availableOrgs().length > 0) {
          <div class="org-selection-header">
            <h2>{{ 'login.selectWorkspace' | translate }}</h2>
            <p>{{ 'login.multipleWorkspacesDesc' | translate }}</p>
          </div>

          <div class="org-warning-box">
            <mat-icon class="org-warning-icon">info</mat-icon>
            <div class="org-warning-text">
              <span class="org-warning-title">{{ 'login.singleOrgTitle' | translate }}:</span>
              {{ 'login.singleOrgNotice' | translate }}
            </div>
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
        } @else {
          <div class="login-title">
            <h1>{{ 'login.title' | translate }}</h1>
            <p>{{ 'login.subtitle' | translate }}</p>
          </div>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }

          <form (ngSubmit)="onLogin()">
            <div class="form-group">
              <label for="email">{{ 'login.email' | translate }}</label>
              <input
                id="email"
                type="email"
                [(ngModel)]="email"
                name="email"
                class="form-input"
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
                  class="form-input password-input"
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
              <a class="forgot-link">{{ 'login.forgotPassword' | translate }}</a>
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

        if (err.status === 429) {
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

  private handleLoginSuccess(response: any): void {
    localStorage.setItem('accessToken', response.access_token);
    if (response.refresh_token) {
      localStorage.setItem('refreshToken', response.refresh_token);
    }
    localStorage.setItem('bento_auth', 'true');
    this.loading.set(false);
    this.state.setCurrentUser(response.user.id);
    this.router.navigate(['/']);
  }

}
