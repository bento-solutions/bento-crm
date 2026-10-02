import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService } from '../core/services/auth-api.service';
import { OrganizationApiService } from '../core/services/organization-api.service';
import { InvitationApiService, InvitationPreview } from '../core/services/invitation-api.service';
import { IDENTITY_PALETTE } from '../shared/ui/identity-color';

const INDUSTRIES = ['Technology', 'Finance', 'Consulting', 'Logistics', 'Retail', 'Education', 'Healthcare', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'CAD', 'AUD'];
const LOGO_COLORS = IDENTITY_PALETTE;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-canvas p-6">
      <div class="card w-full max-w-[460px] px-8 pt-10 pb-8">

        <div class="flex items-center justify-center gap-2.5 mb-6">
          <img src="logo.webp" alt="Bento Logo" class="w-8 h-8 rounded-lg object-contain" />
          <span class="font-semibold text-xl tracking-tight text-ink">Bento</span>
        </div>

        <!-- Mode switcher: Create vs Join -->
        <div class="flex bg-muted p-1 rounded-xl mb-6 border border-line">
          <button
            type="button"
            (click)="setMode('create')"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer"
            [class]="mode() === 'create' ? 'bg-surface text-ink shadow-xs' : 'text-ink-3 hover:text-ink'"
          >
            Create Organization
          </button>
          <button
            type="button"
            (click)="setMode('join')"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer"
            [class]="mode() === 'join' ? 'bg-surface text-ink shadow-xs' : 'text-ink-3 hover:text-ink'"
          >
            Join Organization
          </button>
        </div>

        @if (mode() === 'create') {
          <!-- Step indicator -->
          <div class="flex items-center justify-center gap-2 mb-7">
            @for (s of [1, 2]; track s) {
              <div
                class="h-1.5 rounded-full transition-all duration-200"
                [class.w-8]="step() === s"
                [class.bg-primary]="step() >= s"
                [class.w-4]="step() !== s"
                [class.bg-muted-strong]="step() < s"
              ></div>
            }
          </div>

          <!-- Step 1: account -->
          @if (step() === 1) {
            <div class="text-center mb-6">
              <h1 class="t-title">Create your account</h1>
              <p class="text-body text-ink-3 mt-1">Let's start with who you are</p>
            </div>

            <form (ngSubmit)="goToStep2()" class="space-y-4">
              <div>
                <label for="full_name" class="field-label mb-1.5">Full name</label>
                <input id="full_name"
                  [(ngModel)]="adminName"
                  name="adminName"
                  type="text"
                  placeholder="Jane Doe"
                  autocomplete="name"
                  required
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="work_email" class="field-label mb-1.5">Work email</label>
                <input id="work_email"
                  [(ngModel)]="adminEmail"
                  name="adminEmail"
                  type="email"
                  placeholder="you@company.com"
                  autocomplete="email"
                  required
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="password" class="field-label mb-1.5">Password</label>
                <input id="password"
                  [(ngModel)]="adminPassword"
                  name="adminPassword"
                  type="password"
                  placeholder="At least 12 characters with letters & numbers"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  class="input-field w-full"
                />
                <p class="text-meta text-ink-3 mt-1">Minimum 12 characters, including at least one letter and one number</p>
              </div>

              <div>
                <label for="confirm_password" class="field-label mb-1.5">Confirm password</label>
                <input id="confirm_password"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  required
                  class="input-field w-full"
                />
              </div>

              <button
                type="submit"
                class="btn-primary w-full mt-2"
              >
                Continue
              </button>
            </form>
          }

          <!-- Step 2: organization -->
          @if (step() === 2) {
            <div class="text-center mb-6">
              <h1 class="t-title">Set up your organization</h1>
              <p class="text-body text-ink-3 mt-1">Tell us a bit about your company</p>
            </div>

            <form (ngSubmit)="submit()" class="space-y-4">
              <div>
                <label for="organization_name" class="field-label mb-1.5">Organization name</label>
                <input id="organization_name"
                  [(ngModel)]="orgName"
                  name="orgName"
                  type="text"
                  placeholder="Acme Inc."
                  autocomplete="organization"
                  required
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="industry" class="field-label mb-1.5">Industry</label>
                <select id="industry"
                  [(ngModel)]="orgIndustry"
                  name="orgIndustry"
                  class="input-field w-full cursor-pointer"
                >
                  @for (i of industries; track i) {
                    <option [value]="i">{{ i }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="timezone" class="field-label mb-1.5">Timezone</label>
                  <input id="timezone"
                    [(ngModel)]="orgTimezone"
                    name="orgTimezone"
                    type="text"
                    placeholder="e.g. Africa/Casablanca"
                    class="input-field w-full"
                  />
                </div>
                <div>
                  <label for="currency" class="field-label mb-1.5">Currency</label>
                  <select id="currency"
                    [(ngModel)]="orgCurrency"
                    name="orgCurrency"
                    class="input-field w-full cursor-pointer"
                  >
                    @for (c of currencies; track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  (click)="step.set(1)"
                  [disabled]="loading()"
                  class="btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  type="submit"
                  [disabled]="loading()"
                  class="btn-primary"
                >
                  {{ loading() ? 'Creating workspace...' : 'Create workspace' }}
                </button>
              </div>
            </form>
          }
        } @else {
          <!-- MODE: JOIN EXISTING ORGANIZATION -->
          @if (!invitePreview()) {
            <div class="text-center mb-6">
              <h1 class="t-title">Join an organization</h1>
              <p class="text-body text-ink-3 mt-1">Paste your invitation link or token</p>
            </div>

            <form (ngSubmit)="loadInvitePreview()" class="space-y-4">
              <div>
                <label for="invite_input" class="field-label mb-1.5">Invitation link or token *</label>
                <div class="relative">
                  <input id="invite_input"
                    [(ngModel)]="inviteInput"
                    name="inviteInput"
                    type="text"
                    placeholder="https://... or paste token code"
                    required
                    class="input-field w-full pl-9 pr-3 font-mono"
                  />
                  <mat-icon class="absolute left-2.5 top-2.5 text-ink-4 icon-md">link</mat-icon>
                </div>
                <p class="text-meta text-ink-3 mt-1">
                  You can paste the entire invitation URL or just the token.
                </p>
              </div>

              <button
                type="submit"
                [disabled]="loadingInvite() || !inviteInput().trim()"
                class="btn-primary w-full mt-2"
              >
                @if (loadingInvite()) {
                  <div class="w-4 h-4 border-2 border-line-soft border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying invitation…</span>
                } @else {
                  <span>Find Invitation</span>
                }
              </button>
            </form>
          } @else {
            <div class="text-center mb-4">
              <h1 class="t-title">Join {{ invitePreview()!.organization_name }}</h1>
              <p class="text-body text-ink-3 mt-1">
                @if (invitePreview()!.invited_by_name) {
                  {{ invitePreview()!.invited_by_name }} invited you. Complete your profile to join.
                } @else {
                  You've been invited. Complete your profile to join.
                }
              </p>
            </div>

            <div class="bg-subtle border border-line rounded-xl p-4 mb-4 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="eyebrow">Workspace</span>
                <span class="text-sm font-semibold text-ink">{{ invitePreview()!.organization_name }}</span>
              </div>
              <div class="flex items-center justify-between gap-2 pt-2 border-t border-line">
                <span class="eyebrow">Role</span>
                <span class="badge badge-neutral">
                  {{ invitePreview()!.role }}
                </span>
              </div>
              @if (invitePreview()!.team_name) {
                <div class="flex items-center justify-between gap-2 pt-2 border-t border-line">
                  <span class="eyebrow">Team</span>
                  <span class="text-xs font-semibold text-ink flex items-center gap-1">
                    <mat-icon class="text-ink-3 icon-xs">groups</mat-icon>
                    {{ invitePreview()!.team_name }}
                  </span>
                </div>
              }
            </div>

            <form (ngSubmit)="submitJoin()" class="space-y-3.5">
              <div>
                <label for="join_email" class="field-label mb-1.5">Work email</label>
                <input id="join_email"
                  [value]="invitePreview()!.email"
                  type="email"
                  disabled
                  class="input-field w-full font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label for="join_name" class="field-label mb-1.5">Full name</label>
                <input id="join_name"
                  [(ngModel)]="joinDisplayName"
                  name="joinDisplayName"
                  type="text"
                  placeholder="Jane Doe"
                  autocomplete="name"
                  required
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="join_phone" class="field-label mb-1.5">
                  Phone <span class="font-normal text-ink-3">(optional)</span>
                </label>
                <input id="join_phone"
                  [(ngModel)]="joinPhone"
                  name="joinPhone"
                  type="tel"
                  placeholder="+212-661-234567"
                  autocomplete="tel"
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="join_password" class="field-label mb-1.5">Password</label>
                <input id="join_password"
                  [(ngModel)]="joinPassword"
                  name="joinPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="join_confirm" class="field-label mb-1.5">Confirm password</label>
                <input id="join_confirm"
                  [(ngModel)]="joinConfirmPassword"
                  name="joinConfirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  required
                  class="input-field w-full"
                />
              </div>

              <div class="flex gap-2 pt-2">
                <button
                  type="button"
                  (click)="resetInvite()"
                  [disabled]="loading()"
                  class="btn-secondary btn-sm"
                >
                  Back
                </button>
                <button
                  type="submit"
                  [disabled]="loading()"
                  class="btn-primary"
                >
                  {{ loading() ? 'Joining…' : 'Join ' + invitePreview()!.organization_name }}
                </button>
              </div>
            </form>
          }
        }

        <p class="text-center text-body text-ink-3 mt-6">
          Already have an account?
          <a routerLink="/" class="text-ink-2 font-semibold hover:text-ink cursor-pointer">Sign in</a>
        </p>
      </div>
    </div>
  `
})
export class OnboardingComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(CrmStateService);
  private authApi = inject(AuthApiService);
  private orgApi = inject(OrganizationApiService);
  private invitationApi = inject(InvitationApiService);

  industries = INDUSTRIES;
  currencies = CURRENCIES;

  mode = signal<'create' | 'join'>('create');
  step = signal<1 | 2>(1);
  loading = signal(false);
  error = signal('');

  // Create organization form signals
  adminName = signal('');
  adminEmail = signal('');
  adminPassword = signal('');
  confirmPassword = signal('');

  orgName = signal('');
  orgIndustry = signal(INDUSTRIES[0]);
  orgTimezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  orgCurrency = signal(CURRENCIES[0]);

  // Join organization signals
  inviteInput = signal('');
  loadingInvite = signal(false);
  invitePreview = signal<InvitationPreview | null>(null);
  joinDisplayName = signal('');
  joinPhone = signal('');
  joinPassword = signal('');
  joinConfirmPassword = signal('');

  constructor() {
    const queryToken = this.route.snapshot.queryParamMap.get('token');
    if (queryToken) {
      this.mode.set('join');
      this.inviteInput.set(queryToken);
      this.loadInvitePreview(queryToken);
    }
  }

  setMode(newMode: 'create' | 'join'): void {
    this.mode.set(newMode);
    this.error.set('');
  }

  extractToken(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.includes('token=')) {
      try {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          const url = new URL(trimmed);
          const t = url.searchParams.get('token');
          if (t) return t;
        }
        const match = trimmed.match(/[?&]token=([^&]+)/);
        if (match) return decodeURIComponent(match[1]);
      } catch {
        const match = trimmed.match(/token=([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
      }
    }
    return trimmed;
  }

  loadInvitePreview(rawInput?: string): void {
    const token = this.extractToken(rawInput ?? this.inviteInput());
    if (!token) {
      this.error.set('Please enter a valid invitation link or token');
      return;
    }

    this.error.set('');
    this.loadingInvite.set(true);

    this.invitationApi.preview(token).subscribe({
      next: (preview) => {
        this.invitePreview.set(preview);
        this.joinDisplayName.set(preview.display_name || '');
        this.loadingInvite.set(false);
      },
      error: (err) => {
        this.loadingInvite.set(false);
        const detail = err?.error?.detail || err?.error?.message || 'This invitation link is not valid or has expired.';
        this.error.set(detail);
      }
    });
  }

  resetInvite(): void {
    this.invitePreview.set(null);
    this.error.set('');
  }

  submitJoin(): void {
    this.error.set('');
    const token = this.extractToken(this.inviteInput());

    if (!this.joinDisplayName().trim()) {
      this.error.set('Please enter your full name');
      return;
    }
    if (this.joinPassword().length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }
    if (this.joinPassword() !== this.joinConfirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);

    this.invitationApi.accept({
      token,
      display_name: this.joinDisplayName().trim(),
      password: this.joinPassword(),
      phone: this.joinPhone().trim() || undefined
    }).subscribe({
      next: (response) => {
        localStorage.setItem('accessToken', response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('refreshToken', response.refresh_token);
        }
        this.loading.set(false);
        this.state.setCurrentUser(response.user.id);
        window.location.href = '/';
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail || err?.error?.message || 'We could not accept your invitation. Please try again.';
        this.error.set(detail);
      }
    });
  }

  goToStep2(): void {
    this.error.set('');

    if (!this.adminName().trim() || !this.adminEmail().trim() || !this.adminPassword()) {
      this.error.set('Please fill in all fields');
      return;
    }
    if (this.adminPassword().length < 12) {
      this.error.set('Password must be at least 12 characters');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(this.adminPassword())) {
      this.error.set('Password must contain at least one letter and one number');
      return;
    }
    if (this.adminPassword() !== this.confirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    this.step.set(2);
  }

  submit(): void {
    this.error.set('');

    if (!this.orgName().trim()) {
      this.error.set('Please enter your organization name');
      return;
    }

    this.loading.set(true);

    this.orgApi.create({
      name: this.orgName().trim(),
      industry: this.orgIndustry(),
      timezone: this.orgTimezone().trim() || 'UTC',
      default_currency: this.orgCurrency(),
      admin_name: this.adminName().trim(),
      admin_email: this.adminEmail().trim(),
      admin_password: this.adminPassword(),
    }).subscribe({
      next: (org) => {
        const initials = org.name
          .split(/\s+/)
          .map(w => w[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();

        this.state.organization.set({
          id: org.id,
          name: org.name,
          logoInitials: initials || 'ORG',
          logoColor: LOGO_COLORS[Math.floor(Math.random() * LOGO_COLORS.length)],
          industry: org.industry || this.orgIndustry(),
          timezone: org.timezone || this.orgTimezone(),
          fiscalYearStart: org.fiscalYearStartMonth || 1,
          createdAt: org.createdAt ? new Date(org.createdAt) : new Date(),
        });

        this.authApi.login({ email: this.adminEmail().trim(), password: this.adminPassword() }).subscribe({
          next: (response) => {
            localStorage.setItem('accessToken', response.access_token);
            if (response.refresh_token) {
              localStorage.setItem('refreshToken', response.refresh_token);
            }
            this.loading.set(false);
            this.state.setCurrentUser(response.user.id);
            this.router.navigate(['/']);
          },
          error: (err) => {
            console.error('Auto-login after onboarding failed:', err);
            this.loading.set(false);
            this.error.set('Your workspace was created. Please sign in to continue.');
            this.router.navigate(['/']);
          }
        });
      },
      error: (err) => {
        console.error('Organization creation failed:', err);
        this.loading.set(false);
        const errorData = err?.error;
        let serverMsg = '';
        if (typeof errorData === 'string') {
          serverMsg = errorData;
        } else if (errorData?.detail) {
          serverMsg = errorData.detail;
        } else if (errorData?.message) {
          serverMsg = errorData.message;
        } else if (errorData?.error) {
          serverMsg = errorData.error;
        } else if (Array.isArray(errorData?.validation_errors) && errorData.validation_errors.length > 0) {
          serverMsg = errorData.validation_errors[0]?.message || errorData.validation_errors[0];
        } else if (Array.isArray(errorData?.errors) && errorData.errors.length > 0) {
          serverMsg = errorData.errors[0]?.defaultMessage || errorData.errors[0];
        }
        this.error.set(serverMsg || 'Could not create your workspace. Please check your details and try again.');
      }
    });
  }
}
