import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService } from '../core/services/auth-api.service';
import { OrganizationApiService } from '../core/services/organization-api.service';
import { InvitationApiService, InvitationPreview } from '../core/services/invitation-api.service';

const INDUSTRIES = ['Technology', 'Finance', 'Consulting', 'Logistics', 'Retail', 'Education', 'Healthcare', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'CAD', 'AUD'];
const LOGO_COLORS = ['#7F77DD', '#2563EB', '#059669', '#DC2626', '#D97706', '#7C3AED'];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg,#FAFAFA)] p-6 font-sans">
      <div class="w-full max-w-[460px] bg-white border border-zinc-200 rounded-2xl shadow-xs px-8 pt-10 pb-8">

        <div class="flex items-center justify-center gap-2.5 mb-6">
          <img src="logo.webp" alt="Bento Logo" class="w-8 h-8 rounded-lg object-contain" />
          <span class="font-bold text-xl tracking-tight text-zinc-950">Bento</span>
        </div>

        <!-- Mode switcher: Create vs Join -->
        <div class="flex bg-zinc-100 p-1 rounded-xl mb-6 border border-zinc-200/60">
          <button
            type="button"
            (click)="setMode('create')"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer"
            [class]="mode() === 'create' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'"
          >
            Create Organization
          </button>
          <button
            type="button"
            (click)="setMode('join')"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer"
            [class]="mode() === 'join' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'"
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
                [class.bg-zinc-900]="step() >= s"
                [class.w-4]="step() !== s"
                [class.bg-zinc-200]="step() < s"
              ></div>
            }
          </div>

          <!-- Step 1: account -->
          @if (step() === 1) {
            <div class="text-center mb-6">
              <h1 class="text-lg font-bold text-zinc-950">Create your account</h1>
              <p class="text-body text-zinc-500 mt-1">Let's start with who you are</p>
            </div>

            <form (ngSubmit)="goToStep2()" class="space-y-4">
              <div>
                <label for="full_name" class="block text-xs font-semibold text-zinc-700 mb-1.5">Full name</label>
                <input id="full_name"
                  [(ngModel)]="adminName"
                  name="adminName"
                  type="text"
                  placeholder="Jane Doe"
                  autocomplete="name"
                  required
                  class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div>
                <label for="work_email" class="block text-xs font-semibold text-zinc-700 mb-1.5">Work email</label>
                <input id="work_email"
                  [(ngModel)]="adminEmail"
                  name="adminEmail"
                  type="email"
                  placeholder="you@company.com"
                  autocomplete="email"
                  required
                  class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div>
                <label for="password" class="block text-xs font-semibold text-zinc-700 mb-1.5">Password</label>
                <input id="password"
                  [(ngModel)]="adminPassword"
                  name="adminPassword"
                  type="password"
                  placeholder="At least 12 characters with letters & numbers"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
                <p class="text-[11px] text-zinc-400 mt-1">Minimum 12 characters, including at least one letter and one number</p>
              </div>

              <div>
                <label for="confirm_password" class="block text-xs font-semibold text-zinc-700 mb-1.5">Confirm password</label>
                <input id="confirm_password"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  required
                  class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <button
                type="submit"
                class="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white text-body font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Continue
              </button>
            </form>
          }

          <!-- Step 2: organization -->
          @if (step() === 2) {
            <div class="text-center mb-6">
              <h1 class="text-lg font-bold text-zinc-950">Set up your organization</h1>
              <p class="text-body text-zinc-500 mt-1">Tell us a bit about your company</p>
            </div>

            <form (ngSubmit)="submit()" class="space-y-4">
              <div>
                <label for="organization_name" class="block text-xs font-semibold text-zinc-700 mb-1.5">Organization name</label>
                <input id="organization_name"
                  [(ngModel)]="orgName"
                  name="orgName"
                  type="text"
                  placeholder="Acme Inc."
                  autocomplete="organization"
                  required
                  class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div>
                <label for="industry" class="block text-xs font-semibold text-zinc-700 mb-1.5">Industry</label>
                <select id="industry"
                  [(ngModel)]="orgIndustry"
                  name="orgIndustry"
                  class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 cursor-pointer"
                >
                  @for (i of industries; track i) {
                    <option [value]="i">{{ i }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="timezone" class="block text-xs font-semibold text-zinc-700 mb-1.5">Timezone</label>
                  <input id="timezone"
                    [(ngModel)]="orgTimezone"
                    name="orgTimezone"
                    type="text"
                    placeholder="e.g. Africa/Casablanca"
                    class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                  />
                </div>
                <div>
                  <label for="currency" class="block text-xs font-semibold text-zinc-700 mb-1.5">Currency</label>
                  <select id="currency"
                    [(ngModel)]="orgCurrency"
                    name="orgCurrency"
                    class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 cursor-pointer"
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
                  class="flex-1 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-body font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  type="submit"
                  [disabled]="loading()"
                  class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-body font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h1 class="text-lg font-bold text-zinc-950">Join an organization</h1>
              <p class="text-body text-zinc-500 mt-1">Paste your invitation link or token</p>
            </div>

            <form (ngSubmit)="loadInvitePreview()" class="space-y-4">
              <div>
                <label for="invite_input" class="block text-xs font-semibold text-zinc-700 mb-1.5">Invitation link or token *</label>
                <div class="relative">
                  <input id="invite_input"
                    [(ngModel)]="inviteInput"
                    name="inviteInput"
                    type="text"
                    placeholder="https://... or paste token code"
                    required
                    class="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-xs font-mono"
                  />
                  <mat-icon class="absolute left-2.5 top-2.5 text-zinc-400 text-[18px] w-4.5 h-4.5">link</mat-icon>
                </div>
                <p class="text-[11px] text-zinc-400 mt-1">
                  You can paste the entire invitation URL or just the token.
                </p>
              </div>

              <button
                type="submit"
                [disabled]="loadingInvite() || !inviteInput().trim()"
                class="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white text-body font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                @if (loadingInvite()) {
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying invitation…</span>
                } @else {
                  <span>Find Invitation</span>
                }
              </button>
            </form>
          } @else {
            <div class="text-center mb-4">
              <h1 class="text-lg font-bold text-zinc-950">Join {{ invitePreview()!.organization_name }}</h1>
              <p class="text-body text-zinc-500 mt-1">
                @if (invitePreview()!.invited_by_name) {
                  {{ invitePreview()!.invited_by_name }} invited you. Complete your profile to join.
                } @else {
                  You've been invited. Complete your profile to join.
                }
              </p>
            </div>

            <div class="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 mb-4 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Workspace</span>
                <span class="text-sm font-bold text-zinc-900">{{ invitePreview()!.organization_name }}</span>
              </div>
              <div class="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200/60">
                <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Role</span>
                <span class="inline-flex px-2 py-0.5 rounded-full text-meta font-bold border bg-white border-zinc-200 text-zinc-800">
                  {{ invitePreview()!.role }}
                </span>
              </div>
              @if (invitePreview()!.team_name) {
                <div class="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200/60">
                  <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Team</span>
                  <span class="text-xs font-bold text-zinc-800 flex items-center gap-1">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 text-zinc-500">groups</mat-icon>
                    {{ invitePreview()!.team_name }}
                  </span>
                </div>
              }
            </div>

            <form (ngSubmit)="submitJoin()" class="space-y-3.5">
              <div>
                <label for="join_email" class="block text-xs font-semibold text-zinc-700 mb-1">Work email</label>
                <input id="join_email"
                  [value]="invitePreview()!.email"
                  type="email"
                  disabled
                  class="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label for="join_name" class="block text-xs font-semibold text-zinc-700 mb-1">Full name</label>
                <input id="join_name"
                  [(ngModel)]="joinDisplayName"
                  name="joinDisplayName"
                  type="text"
                  placeholder="Jane Doe"
                  autocomplete="name"
                  required
                  class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div>
                <label for="join_phone" class="block text-xs font-semibold text-zinc-700 mb-1">
                  Phone <span class="font-normal text-zinc-400">(optional)</span>
                </label>
                <input id="join_phone"
                  [(ngModel)]="joinPhone"
                  name="joinPhone"
                  type="tel"
                  placeholder="+212-661-234567"
                  autocomplete="tel"
                  class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div>
                <label for="join_password" class="block text-xs font-semibold text-zinc-700 mb-1">Password</label>
                <input id="join_password"
                  [(ngModel)]="joinPassword"
                  name="joinPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div>
                <label for="join_confirm" class="block text-xs font-semibold text-zinc-700 mb-1">Confirm password</label>
                <input id="join_confirm"
                  [(ngModel)]="joinConfirmPassword"
                  name="joinConfirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  required
                  class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                />
              </div>

              <div class="flex gap-2 pt-2">
                <button
                  type="button"
                  (click)="resetInvite()"
                  [disabled]="loading()"
                  class="px-3 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  [disabled]="loading()"
                  class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-body font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ loading() ? 'Joining…' : 'Join ' + invitePreview()!.organization_name }}
                </button>
              </div>
            </form>
          }
        }

        <p class="text-center text-body text-zinc-400 mt-6">
          Already have an account?
          <a routerLink="/" class="text-zinc-700 font-semibold hover:text-zinc-900 cursor-pointer">Sign in</a>
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
