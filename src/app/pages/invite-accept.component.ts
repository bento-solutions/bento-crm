import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { AuthApiService, CurrentUser } from '../core/services/auth-api.service';
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
    <div class="min-h-screen flex items-center justify-center bg-canvas p-6">
      <div class="card w-full max-w-[440px] px-8 pt-10 pb-8">

        <div class="flex items-center justify-center gap-2.5 mb-8">
          <img src="logo.webp" alt="Bento Logo" class="w-8 h-8 rounded-lg object-contain" />
          <span class="font-semibold text-xl tracking-tight text-ink">Bento</span>
        </div>

        <!-- Resolving the token -->
        @if (loadingPreview()) {
          <div class="py-10 text-center space-y-3">
            <div class="w-8 h-8 mx-auto border-2 border-line border-t-accent rounded-full animate-spin"></div>
            <p class="text-body text-ink-3">Checking your invitation…</p>
          </div>
        }

        <!-- Token missing, expired, revoked or already used -->
        @if (!loadingPreview() && invalid()) {
          <div class="py-4 text-center space-y-4">
            <div class="w-12 h-12 mx-auto bg-muted text-ink-3 rounded-full flex items-center justify-center">
              <mat-icon class="icon-lg">link_off</mat-icon>
            </div>
            <div class="space-y-1.5">
              <h1 class="t-title">This invitation isn't valid</h1>
              <p class="text-body text-ink-3 leading-relaxed">
                The link may have expired, been revoked, or already been used. Ask whoever invited
                you to send a new one.
              </p>
            </div>
            <button
              (click)="goToSignIn()"
              class="btn-secondary w-full"
            >
              Go to sign in
            </button>
          </div>
        }

        <!-- The acceptance form -->
        @if (!loadingPreview() && preview(); as invite) {
          <div class="text-center mb-6">
            <h1 class="t-title">Join {{ invite.organization_name }}</h1>
            <p class="text-body text-ink-3 mt-1">
              @if (invite.invited_by_name) {
                {{ invite.invited_by_name }} invited you. Set a password to get started.
              } @else {
                You've been invited. Set a password to get started.
              }
            </p>
          </div>

          <!-- The role was pre-assigned by the admin and is not the invitee's to change,
               so it is shown as a fact rather than as a form control. -->
          <div class="bg-subtle border border-line rounded-xl px-4 py-3 mb-5 space-y-2">
            <div class="flex items-center justify-between gap-3">
              <span class="eyebrow">Your role</span>
              <span class="badge badge-neutral">
                {{ roleLabel() }}
              </span>
            </div>
            @if (preview()?.team_name) {
              <div class="flex items-center justify-between gap-3 pt-1 border-t border-line">
                <span class="eyebrow">Team</span>
                <span class="text-xs font-semibold text-ink flex items-center gap-1">
                  <mat-icon class="text-ink-3 icon-xs">groups</mat-icon>
                  {{ preview()?.team_name }}
                </span>
              </div>
            }
            <p class="text-meta text-ink-3 leading-relaxed">{{ roleBlurb() }}</p>
          </div>

          <!-- Single Workspace Notice -->
          <div class="alert alert-warning mb-4">
            <mat-icon class="text-warning-ink shrink-0 mt-0.5 icon-sm">info</mat-icon>
            <div>
              <strong class="font-semibold">Single Organization Notice:</strong>
              Joining <strong>{{ invite.organization_name }}</strong> will leave any current workspace. Bento accounts are associated with one organization at a time.
            </div>
          </div>

          @if (error()) {
            <div class="alert alert-danger mb-4 justify-center text-center" role="alert">
              {{ error() }}
            </div>
          }

          <!-- Option 1: 1-Click Accept for Logged-in user -->
          @if (canAcceptDirectly() && !showPasswordForm()) {
            <div class="bg-accent-soft/70 border border-accent-line/80 rounded-xl p-5 text-center space-y-3 mb-4">
              <div class="w-10 h-10 mx-auto bg-accent-soft text-accent-ink rounded-full flex items-center justify-center">
                <mat-icon class="icon-md">how_to_reg</mat-icon>
              </div>
              <div>
                <p class="text-xs font-medium text-accent-ink">You are signed in as</p>
                <p class="text-xs font-semibold text-ink font-mono mt-0.5">{{ loggedInUser()?.email }}</p>
              </div>
              <p class="text-xs text-ink-2 leading-relaxed">
                Accept this invitation to join <strong>{{ invite.organization_name }}</strong>. You will automatically switch to your new workspace.
              </p>
              <button
                type="button"
                (click)="acceptAsLoggedIn()"
                [disabled]="loading()"
                class="btn-primary w-full"
              >
                @if (loading()) {
                  <div class="w-4 h-4 border-2 border-line-soft border-t-transparent rounded-full animate-spin"></div>
                  <span>Joining workspace…</span>
                } @else {
                  <span>Accept & Join {{ invite.organization_name }}</span>
                }
              </button>
            </div>
            <div class="text-center">
              <button
                type="button"
                (click)="showPasswordForm.set(true)"
                class="text-xs text-ink-3 hover:text-ink underline cursor-pointer"
              >
                Or set a new password for this workspace
              </button>
            </div>
          } @else {
            <form (ngSubmit)="submit()" class="space-y-4">
              <div>
                <label for="invite_email" class="field-label mb-1.5">Work email</label>
                <!-- Fixed by the invitation: accepting on a different address would sidestep
                     whatever vetting the admin did before inviting. -->
                <input id="invite_email"
                  [value]="invite.email"
                  type="email"
                  disabled
                  class="input-field w-full cursor-not-allowed"
                />
              </div>

              <div>
                <label for="invite_name" class="field-label mb-1.5">Full name</label>
                <input id="invite_name"
                  [(ngModel)]="displayName"
                  name="displayName"
                  type="text"
                  placeholder="Jane Doe"
                  autocomplete="name"
                  required
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="invite_phone" class="field-label mb-1.5">
                  Phone <span class="font-normal text-ink-3">(optional)</span>
                </label>
                <input id="invite_phone"
                  [(ngModel)]="phone"
                  name="phone"
                  type="tel"
                  placeholder="+212-661-234567"
                  autocomplete="tel"
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="invite_password" class="field-label mb-1.5">Password</label>
                <input id="invite_password"
                  [(ngModel)]="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  class="input-field w-full"
                />
              </div>

              <div>
                <label for="invite_confirm" class="field-label mb-1.5">Confirm password</label>
                <input id="invite_confirm"
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
                [disabled]="loading()"
                class="btn-primary w-full mt-2"
              >
                {{ loading() ? 'Joining…' : 'Join ' + invite.organization_name }}
              </button>
            </form>

            @if (canAcceptDirectly() && showPasswordForm()) {
              <div class="text-center mt-3">
                <button
                  type="button"
                  (click)="showPasswordForm.set(false)"
                  class="text-xs text-ink-3 hover:text-ink underline cursor-pointer"
                >
                  Return to 1-click join
                </button>
              </div>
            }
          }

          <p class="text-center text-body text-ink-3 mt-6">
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
  private authApi = inject(AuthApiService);
  private invitationApi = inject(InvitationApiService);

  loadingPreview = signal(true);
  preview = signal<InvitationPreview | null>(null);
  invalid = signal(false);
  loading = signal(false);
  error = signal('');
  loggedInUser = signal<CurrentUser | null>(null);
  showPasswordForm = signal(false);

  displayName = '';
  phone = '';
  password = '';
  confirmPassword = '';

  private token = '';
  private invitationId = '';

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

  canAcceptDirectly = computed(() => {
    const p = this.preview();
    const u = this.loggedInUser();
    if (!p || !u) return false;
    return p.email.trim().toLowerCase() === u.email.trim().toLowerCase();
  });

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.invitationId = this.route.snapshot.queryParamMap.get('invitationId') ?? '';

    const hasAccessToken = !!localStorage.getItem('accessToken');
    if (hasAccessToken) {
      this.authApi.me().subscribe({
        next: (me) => {
          this.loggedInUser.set(me);
          this.loadInvitation();
        },
        error: () => {
          this.loadInvitation();
        }
      });
    } else {
      this.loadInvitation();
    }
  }

  private loadInvitation(): void {
    if (this.token) {
      this.invitationApi.preview(this.token).subscribe({
        next: (invite) => {
          this.preview.set(invite);
          this.displayName = invite.display_name ?? '';
          this.loadingPreview.set(false);
        },
        error: () => {
          this.loadingPreview.set(false);
          this.invalid.set(true);
        }
      });
    } else if (this.invitationId) {
      // Arriving via in-app notification with invitationId
      this.invitationApi.getMyPendingInvitations().subscribe({
        next: (list) => {
          const found = list.find(i => i.id === this.invitationId) || list[0];
          if (found) {
            this.preview.set({
              id: found.id,
              email: found.email,
              organization_name: found.organization_name || 'Organization',
              role: found.role,
              team_id: found.team_id,
              team_name: found.team_name,
              display_name: found.display_name,
              job_title: found.job_title,
              invited_by_name: found.invited_by_name,
              expires_at: found.expires_at
            });
            this.displayName = found.display_name ?? '';
            this.loadingPreview.set(false);
          } else {
            this.loadingPreview.set(false);
            this.invalid.set(true);
          }
        },
        error: () => {
          this.loadingPreview.set(false);
          this.invalid.set(true);
        }
      });
    } else if (localStorage.getItem('accessToken')) {
      // Logged-in user navigated to /invite/accept directly: check for any pending invites
      this.invitationApi.getMyPendingInvitations().subscribe({
        next: (list) => {
          if (list && list.length > 0) {
            const first = list[0];
            this.invitationId = first.id;
            this.preview.set({
              id: first.id,
              email: first.email,
              organization_name: first.organization_name || 'Organization',
              role: first.role,
              team_id: first.team_id,
              team_name: first.team_name,
              display_name: first.display_name,
              job_title: first.job_title,
              invited_by_name: first.invited_by_name,
              expires_at: first.expires_at
            });
            this.displayName = first.display_name ?? '';
            this.loadingPreview.set(false);
          } else {
            this.loadingPreview.set(false);
            this.invalid.set(true);
          }
        },
        error: () => {
          this.loadingPreview.set(false);
          this.invalid.set(true);
        }
      });
    } else {
      this.loadingPreview.set(false);
      this.invalid.set(true);
    }
  }

  acceptAsLoggedIn(): void {
    const targetId = this.invitationId || this.preview()?.id;
    if (!targetId) {
      this.error.set('Could not identify the invitation to accept. Please enter your details below.');
      this.showPasswordForm.set(true);
      return;
    }

    this.error.set('');
    this.loading.set(true);

    this.invitationApi.acceptLoggedIn(targetId).subscribe({
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
        const detail = err?.error?.detail || err?.error?.message || 'Could not join workspace. Please try again.';
        this.error.set(detail);
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
