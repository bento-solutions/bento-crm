import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService } from '../core/services/auth-api.service';
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
  `],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo">
          <img src="logo.webp" alt="Bento Logo" />
          <span>Bento</span>
        </div>

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
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              class="form-input"
              [placeholder]="'login.passwordPlaceholder' | translate"
              autocomplete="current-password"
              required
            />
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
  loading = signal(false);
  error = signal('');

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
        localStorage.setItem('accessToken', response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('refreshToken', response.refresh_token);
        }
        localStorage.setItem('bento_auth', 'true');
        this.loading.set(false);
        this.state.setCurrentUser(response.user.id);
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Login failed:', err);
        if (err.status === 429) {
          this.error.set(this.translation.t('login.errorRateLimit'));
        } else if (err.status === 0 || err.status >= 500) {
          this.error.set(this.translation.t('login.errorServer'));
        } else {
          this.error.set(this.translation.t('login.errorInvalid'));
        }
        this.loading.set(false);
      }
    });
  }

}
