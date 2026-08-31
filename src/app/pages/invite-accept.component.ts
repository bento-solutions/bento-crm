import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { InvitationApiService, InvitationPreview, InvitationRole } from '../core/services/invitation-api.service';

const ROLE_LABELS: Record<InvitationRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALESPERSON: 'Salesperson',
  SUPPORT: 'Support Specialist',
  VIEWER: 'Viewer'
};

const ROLE_BLURBS: Record<InvitationRole, string> = {
  ADMIN: 'Full access, including users, teams and organization settings.',
  MANAGER: 'Manage partners, deals, invoices and campaigns across the team.',
  SALESPERSON: 'Work your own partners, deals, proposals and tasks.',
  SUPPORT: 'Handle tickets and partner records, plus your own tasks.',
  VIEWER: 'Read-only access to partners, deals, tickets and reports.'
};

/**
 * Public counterpart to the onboarding page: onboarding creates an organization, this joins an
 * existing one. Reached from an emailed link and rendered for someone with no account, so it
 * lives outside authGuard and shows the organization and pre-assigned role up front -- an
 * invitee who cannot tell what they are joining is an invitee who does not accept.
 */
@Component({
  selector: 'app-invite-accept',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg,#FAFAFA)] p-6 font-sans">
      <div class="w-full max-w-[440px] bg-white border border-zinc-200 rounded-2xl shadow-xs px-8 pt-10 pb-8">

        <div class="flex items-center justify-center gap-2.5 mb-8">
          <img src="logo.webp" alt="Bento Logo" class="w-8 h-8 rounded-lg object-contain" />
          <span class="font-bold text-xl tracking-tight text-zinc-950">Bento</span>
        </div>

        <!-- Resolving the token -->
        @if (loadingPreview()) {
          <div class="py-10 text-center space-y-3">
            <div class="w-8 h-8 mx-auto border-2 border-zinc-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p class="text-body text-zinc-500">Checking your invitation…</p>
          </div>
        }

        <!-- Token missing, expired, revoked or already used -->
        @if (!loadingPreview() && invalid()) {
          <div class="py-4 text-center space-y-4">
            <div class="w-12 h-12 mx-auto bg-zinc-100 text-zinc-500 rounded-full flex items-center justify-center">
              <mat-icon class="text-xl w-6 h-6 flex items-center justify-center">link_off</mat-icon>
            </div>
            <div class="space-y-1.5">
              <h1 class="text-lg font-bold text-zinc-950">This invitation isn't valid</h1>
              <p class="text-body text-zinc-500 leading-relaxed">
                The link may have expired, been revoked, or already been used. Ask whoever invited
                you to send a new one.
              </p>
            </div>
            <button
              (click)="goToSignIn()"
              class="w-full py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-body font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Go to sign in
            </button>
          </div>
        }

        <!-- The acceptance form -->
        @if (!loadingPreview() && preview(); as invite) {
          <div class="text-center mb-6">
            <h1 class="text-lg font-bold text-zinc-950">Join {{ invite.organization_name }}</h1>
            <p class="text-body text-zinc-500 mt-1">
              @if (invite.invited_by_name) {
                {{ invite.invited_by_name }} invited you. Set a password to get started.
              } @else {
                You've been invited. Set a password to get started.
              }
            </p>
          </div>

          <!-- The role was pre-assigned by the admin and is not the invitee's to change,
               so it is shown as a fact rather than as a form control. -->
          <div class="bg-zinc-50 border border-zinc-200/80 rounded-xl px-4 py-3 mb-5 space-y-2">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Your role</span>
              <span class="inline-flex px-2 py-0.5 rounded-full text-meta font-bold border bg-white border-zinc-200 text-zinc-700">
                {{ roleLabel() }}
              </span>
            </div>
            <p class="text-meta text-zinc-500 leading-relaxed">{{ roleBlurb() }}</p>
          </div>

          @if (error()) {
            <div class="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2 mb-4 text-center">
              {{ error() }}
            </div>
          }

          <form (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label for="invite_email" class="block text-xs font-semibold text-zinc-700 mb-1.5">Work email</label>
              <!-- Fixed by the invitation: accepting on a different address would sidestep
                   whatever vetting the admin did before inviting. -->
              <input id="invite_email"
                [value]="invite.email"
                type="email"
                disabled
                class="w-full px-3 py-2.5 bg-zinc-100 border border-zinc-200 rounded-lg text-body text-zinc-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label for="invite_name" class="block text-xs font-semibold text-zinc-700 mb-1.5">Full name</label>
              <input id="invite_name"
                [(ngModel)]="displayName"
                name="displayName"
                type="text"
                placeholder="Jane Doe"
                autocomplete="name"
                required
                class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
              />
            </div>

            <div>
              <label for="invite_phone" class="block text-xs font-semibold text-zinc-700 mb-1.5">
                Phone <span class="font-normal text-zinc-400">(optional)</span>
              </label>
              <input id="invite_phone"
                [(ngModel)]="phone"
                name="phone"
                type="tel"
                placeholder="+212-661-234567"
                autocomplete="tel"
                class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
              />
            </div>

            <div>
              <label for="invite_password" class="block text-xs font-semibold text-zinc-700 mb-1.5">Password</label>
              <input id="invite_password"
                [(ngModel)]="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                autocomplete="new-password"
                required
                minlength="8"
                class="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body text-zinc-950 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
              />
            </div>

            <div>
              <label for="invite_confirm" class="block text-xs font-semibold text-zinc-700 mb-1.5">Confirm password</label>
              <input id="invite_confirm"
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
              [disabled]="loading()"
              class="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white text-body font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading() ? 'Joining…' : 'Join ' + invite.organization_name }}
            </button>
          </form>

          <p class="text-center text-body text-zinc-400 mt-6">
            This invitation expires {{ expiryLabel() }}.
          </p>
        }
      </div>
    </div>
  `
})
export class InviteAcceptComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(CrmStateService);
  private invitationApi = inject(InvitationApiService);

  loadingPreview = signal(true);
  preview = signal<InvitationPreview | null>(null);
  invalid = signal(false);
  loading = signal(false);
  error = signal('');

  displayName = '';
  phone = '';
  password = '';
  confirmPassword = '';

  private token = '';

  roleLabel = computed(() => {
    const role = this.preview()?.role;
    return role ? ROLE_LABELS[role] ?? role : '';
  });

  roleBlurb = computed(() => {
    const role = this.preview()?.role;
    return role ? ROLE_BLURBS[role] ?? '' : '';
  });

  expiryLabel = computed(() => {
    const expiresAt = this.preview()?.expires_at;
    if (!expiresAt) return 'soon';
    return new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  });

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.loadingPreview.set(false);
      this.invalid.set(true);
      return;
    }

    this.invitationApi.preview(this.token).subscribe({
      next: (invite) => {
        this.preview.set(invite);
        // Pre-fills whatever the admin typed when inviting, still editable: the invitee knows
        // how their own name is spelled better than the person who invited them.
        this.displayName = invite.display_name ?? '';
        this.loadingPreview.set(false);
      },
      error: () => {
        this.loadingPreview.set(false);
        this.invalid.set(true);
      }
    });
  }

  submit(): void {
    this.error.set('');

    if (!this.displayName.trim()) {
      this.error.set('Please enter your full name');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);

    this.invitationApi.accept({
      token: this.token,
      display_name: this.displayName.trim(),
      password: this.password,
      phone: this.phone.trim() || undefined
    }).subscribe({
      next: (response) => {
        // Accepting returns a full session, so the invitee lands inside the app rather than
        // on a login form asking for the password they just chose.
        localStorage.setItem('accessToken', response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('refreshToken', response.refresh_token);
        }
        this.loading.set(false);
        this.state.setCurrentUser(response.user.id);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = (err as { error?: { detail?: string } })?.error?.detail;
        this.error.set(detail || 'We could not complete your registration. Please try again.');
      }
    });
  }

  goToSignIn(): void {
    this.router.navigate(['/']);
  }
}
