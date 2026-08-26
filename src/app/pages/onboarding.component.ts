import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService } from '../core/services/auth-api.service';
import { OrganizationApiService } from '../core/services/organization-api.service';

const INDUSTRIES = ['Technology', 'Finance', 'Consulting', 'Logistics', 'Retail', 'Education', 'Healthcare', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'CAD', 'AUD'];
const LOGO_COLORS = ['#7F77DD', '#2563EB', '#059669', '#DC2626', '#D97706', '#7C3AED'];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg,#FAFAFA)] p-6 font-sans">
      <div class="w-full max-w-[440px] bg-white border border-zinc-200 rounded-2xl shadow-xs px-8 pt-10 pb-8">

        <div class="flex items-center justify-center gap-2.5 mb-8">
          <img src="logo.webp" alt="Bento Logo" class="w-8 h-8 rounded-lg object-contain" />
          <span class="font-bold text-xl tracking-tight text-zinc-950">Bento</span>
        </div>

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

        @if (error()) {
          <div class="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2 mb-4 text-center">
            {{ error() }}
          </div>
        }

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
                placeholder="At least 8 characters"
                autocomplete="new-password"
                required
                minlength="8"
                class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
              />
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

        <p class="text-center text-body text-zinc-400 mt-6">
          Already have an account?
          <a routerLink="/" class="text-zinc-700 font-semibold hover:text-zinc-900 cursor-pointer">Sign in</a>
        </p>
      </div>
    </div>
  `
})
export class OnboardingComponent {
  private router = inject(Router);
  private state = inject(CrmStateService);
  private authApi = inject(AuthApiService);
  private orgApi = inject(OrganizationApiService);

  industries = INDUSTRIES;
  currencies = CURRENCIES;

  step = signal<1 | 2>(1);
  loading = signal(false);
  error = signal('');

  adminName = signal('');
  adminEmail = signal('');
  adminPassword = signal('');
  confirmPassword = signal('');

  orgName = signal('');
  orgIndustry = signal(INDUSTRIES[0]);
  orgTimezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  orgCurrency = signal(CURRENCIES[0]);

  goToStep2(): void {
    this.error.set('');

    if (!this.adminName().trim() || !this.adminEmail().trim() || !this.adminPassword()) {
      this.error.set('Please fill in all fields');
      return;
    }
    if (this.adminPassword().length < 8) {
      this.error.set('Password must be at least 8 characters');
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
        this.error.set('Could not create your workspace. Please check your details and try again.');
      }
    });
  }
}
