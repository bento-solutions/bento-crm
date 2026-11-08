import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CrmUser, RoleId } from '../services/crm-state.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { RoleBadgeComponent } from '../shared/role-badge.component';
import { errorMessage } from '../shared/error-message.util';
import { MatIconModule } from '@angular/material/icon';
import { TranslationService } from '../services/translation.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { AuthApiService } from '../core/services/auth-api.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent, RoleBadgeComponent, MatIconModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header
        [title]="isOwnProfile() ? 'My profile' : 'User profile'"
        [subtitle]="isOwnProfile() ? 'Your details, preferences and activity' : 'Account details, role and activity'"
        [backLink]="isOwnProfile() ? null : '/settings/users'"
        backLabel="Users" />

      @if (user(); as u) {
        <!-- PROFILE HEADER CARD -->
        <div class="card p-5 space-y-5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-4 min-w-0">
              <!-- Avatar size 56 -->
              <div class="shrink-0"><app-user-avatar [userId]="u.id" [size]="56"></app-user-avatar></div>

              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  @if (isEditingName()) {
                    <input
                      [(ngModel)]="editName"
                      class="input-field"
                    />
                  } @else {
                    <h2 class="section-title">{{ u.displayName }}</h2>
                  }
                  @if (canEdit()) {
                    <button
                      (click)="toggleEditName()"
                      class="btn-icon btn-sm"
                      [attr.aria-label]="isEditingName() ? 'Save name' : 'Edit name'"
                    >
                      <mat-icon class="icon-sm">
                        {{ isEditingName() ? 'check' : 'edit' }}
                      </mat-icon>
                    </button>
                  }
                </div>

                <div class="flex items-center gap-1 flex-wrap">
                  @if (isEditingJobTitle()) {
                    <input
                      [(ngModel)]="editJobTitle"
                      class="input-field"
                    />
                  } @else {
                    <span class="text-sm text-ink-3">{{ u.jobTitle || 'No job title' }}</span>
                  }
                  @if (canEdit()) {
                    <button
                      (click)="toggleEditJobTitle()"
                      class="btn-icon btn-sm"
                      [attr.aria-label]="isEditingJobTitle() ? 'Save job title' : 'Edit job title'"
                    >
                      <mat-icon class="icon-sm">
                        {{ isEditingJobTitle() ? 'check' : 'edit' }}
                      </mat-icon>
                    </button>
                  }
                </div>

                <div class="t-mono text-ink-3 break-all">ID: {{ u.id }}</div>
              </div>
            </div>

            <!-- Active / Inactive Badge -->
            <span
              [class]="u.isActive ? 'badge-success' : 'badge-neutral'"
              class="badge"
            >
              {{ u.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <!-- Email & Phone info grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-line-soft">
            <div>
              <span class="field-label mb-1">Email (can't be changed)</span>
              <span class="text-sm text-ink break-all">{{ u.email }}</span>
            </div>
            <div>
              <div class="flex items-center gap-1 mb-1 min-h-7">
                <span class="field-label">Phone</span>
                @if (canEdit()) {
                  <button
                    (click)="toggleEditPhone()"
                    class="btn-icon btn-sm"
                    [attr.aria-label]="isEditingPhone() ? 'Save phone' : 'Edit phone'"
                  >
                    <mat-icon class="icon-sm">
                      {{ isEditingPhone() ? 'check' : 'edit' }}
                    </mat-icon>
                  </button>
                }
              </div>
              @if (isEditingPhone()) {
                <input
                  [(ngModel)]="editPhone"
                  class="input-field w-full max-w-xs"
                />
              } @else {
                <span class="text-sm text-ink num">{{ u.phone || '—' }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs" role="tablist">
          @for (tab of visibleTabs(); track tab.id) {
            <button role="tab" class="tab" [class.is-active]="profileTab() === tab.id" [attr.aria-selected]="profileTab() === tab.id" (click)="profileTab.set(tab.id)">
              {{ tab.label }}
            </button>
          }
        </div>

        @if (profileTab() === 'profile') {
        <!-- ROLE & TEAM SECTION -->
        <div class="card p-5 space-y-4">
          <h3 class="card-title">Role and team</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Role -->
            <div class="space-y-2">
              <label for="system_role" class="field-label">System role</label>
              @if (isAdmin()) {
                <div class="space-y-1">
                  <select id="system_role"
                    [value]="u.roleId"
                    (change)="updateUserRole(u.id, $event)"
                    class="input-field max-w-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="salesperson">Sales</option>
                    <option value="support">Support</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  @if (roleError()) {
                    <p class="field-error">{{ roleError() }}</p>
                  }
                </div>
              } @else {
                <div>
                  <app-role-badge [roleId]="u.roleId"></app-role-badge>
                </div>
              }
            </div>

            <!-- Team -->
            <div class="space-y-2">
              <span class="field-label">Team</span>
              <div>
                @if (u.teamId) {
                  <a
                    routerLink="/settings/teams"
                    class="btn-secondary btn-sm"
                  >
                    <mat-icon class="icon-sm">groups</mat-icon>
                    {{ getTeamName(u.teamId) }}
                  </a>
                } @else {
                  <span class="text-sm text-ink-3">Unassigned</span>
                }
              </div>
            </div>
          </div>
        </div>
        }

        @if (profileTab() === 'preferences') {
        <!-- PREFERENCES SECTION -->
        <div class="card p-5 space-y-5">
          <h3 class="card-title">Notification preferences</h3>

          <div class="space-y-4">
            <label class="switch-row" for="pref-lead-assign">
              <button type="button" id="pref-lead-assign" role="switch" class="switch" [attr.aria-checked]="u.preferences.notifyOnLeadAssign"
                      aria-label="Notify on lead assignment" (click)="togglePreference(u, 'notifyOnLeadAssign')"></button>
              <span>
                <span class="row-title">Notify on lead assignment</span>
                <span class="row-hint">Send alerts when a lead is assigned to you</span>
              </span>
            </label>

            <label class="switch-row" for="pref-deal-update">
              <button type="button" id="pref-deal-update" role="switch" class="switch" [attr.aria-checked]="u.preferences.notifyOnDealUpdate"
                      aria-label="Notify on deal updates" (click)="togglePreference(u, 'notifyOnDealUpdate')"></button>
              <span>
                <span class="row-title">Notify on deal updates</span>
                <span class="row-hint">Receive updates when status or stage changes on your deals</span>
              </span>
            </label>

            <label class="switch-row" for="pref-mention">
              <button type="button" id="pref-mention" role="switch" class="switch" [attr.aria-checked]="u.preferences.notifyOnMention"
                      aria-label="Notify on mentions" (click)="togglePreference(u, 'notifyOnMention')"></button>
              <span>
                <span class="row-title">Notify on mentions</span>
                <span class="row-hint">Get notified immediately when mentioned in group chats</span>
              </span>
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-line-soft">
            <label class="field">
              <span class="field-label">Appearance</span>
              <select [value]="u.preferences.theme" (change)="changeTheme(u, $event)" class="input-field">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">Interface language</span>
              <select [value]="u.preferences.language" (change)="changeLanguage(u, $event)" class="input-field">
                @for (lang of translation.availableLanguages; track lang.code) {
                  <option [value]="lang.code">{{ lang.nativeLabel }} ({{ lang.code }})</option>
                }
              </select>
            </label>
          </div>
        </div>
        }

        @if (profileTab() === 'groups') {
        <!-- GROUPS SECTION -->
        <div class="card p-5 space-y-4">
          <div class="flex items-center gap-2">
            <h3 class="card-title">Collaboration groups</h3>
            <span class="badge badge-neutral">
              {{ getUserGroups(u.id).length }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            @for (grp of getUserGroups(u.id); track grp.id) {
              <a
                [routerLink]="['/groups']"
                [queryParams]="{ groupId: grp.id }"
                class="btn-secondary btn-sm"
              >
                {{ grp.name }}
              </a>
            } @empty {
              <span class="text-sm text-ink-3">This user does not belong to any collaboration groups.</span>
            }
          </div>
        </div>
        }

        @if (profileTab() === 'security' && isOwnProfile()) {
        <!-- SECURITY: the account's password and sessions, and this organization's membership -->
        <div class="card p-5 space-y-4">
          <h3 class="card-title">Password</h3>
          <p class="text-sm text-ink-2">One password for every organization you belong to. Changing it signs you out on your other devices.</p>
          @if (passwordMessage()) {
            <div class="alert alert-success" role="status">{{ passwordMessage() }}</div>
          }
          @if (passwordError()) {
            <div class="alert alert-danger" role="alert">{{ passwordError() }}</div>
          }
          <form (ngSubmit)="changePassword()" class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label for="current_password" class="field-label mb-1.5">Current password</label>
              <input id="current_password" [(ngModel)]="currentPassword" name="currentPassword" type="password"
                autocomplete="current-password" required class="input-field w-full" />
            </div>
            <div>
              <label for="new_password" class="field-label mb-1.5">New password</label>
              <input id="new_password" [(ngModel)]="newPassword" name="newPassword" type="password"
                autocomplete="new-password" required minlength="12" class="input-field w-full" />
            </div>
            <div>
              <label for="confirm_new_password" class="field-label mb-1.5">Confirm new password</label>
              <input id="confirm_new_password" [(ngModel)]="confirmNewPassword" name="confirmNewPassword" type="password"
                autocomplete="new-password" required class="input-field w-full" />
            </div>
            <div class="sm:col-span-3 flex justify-end">
              <button type="submit" class="btn-primary btn-sm" [disabled]="busy()">Change password</button>
            </div>
          </form>
        </div>

        <div class="card p-5 space-y-3">
          <h3 class="card-title">Sessions</h3>
          <p class="text-sm text-ink-2">Sign out of Bento on every device and in every organization, this one included. Use it if a device was lost or shared.</p>
          @if (confirmSignOutEverywhere()) {
            <div class="alert alert-danger flex-col items-stretch" role="alert">
              <p>Sign out everywhere now?</p>
              <div class="flex flex-wrap items-center gap-2">
                <button (click)="confirmSignOutEverywhere.set(false)" class="btn-secondary btn-sm">Cancel</button>
                <button (click)="signOutEverywhere()" class="btn-danger btn-sm" [disabled]="busy()">Sign out everywhere</button>
              </div>
            </div>
          } @else {
            <button (click)="confirmSignOutEverywhere.set(true)" class="btn-secondary btn-sm">Sign out everywhere</button>
          }
        </div>

        <div class="card border-danger-line p-5 space-y-3">
          <h3 class="card-title text-danger-ink">Leave {{ state.organization().name || 'this organization' }}</h3>
          <p class="text-sm text-ink-2">You lose access to this organization's data. Your other organizations aren't affected, and an admin can invite you back.</p>
          @if (leaveError()) {
            <div class="alert alert-danger" role="alert">{{ leaveError() }}</div>
          }
          @if (confirmLeave()) {
            <div class="alert alert-danger flex-col items-stretch" role="alert">
              <p>Leave {{ state.organization().name || 'this organization' }}?</p>
              <div class="flex flex-wrap items-center gap-2">
                <button (click)="confirmLeave.set(false)" class="btn-secondary btn-sm">Cancel</button>
                <button (click)="leaveOrganization()" class="btn-danger btn-sm" [disabled]="busy()">Leave</button>
              </div>
            </div>
          } @else {
            <button (click)="confirmLeave.set(true)" class="btn-danger-soft btn-sm">Leave organization</button>
          }
        </div>
        }

        @if (profileTab() === 'activity') {
        <!-- ACTIVITY SECTION -->
        <div class="card p-5 space-y-4">
          <h3 class="card-title">Activity details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-ink">
            <div>
              <span class="field-label mb-1">Member since</span>
              <span>{{ u.createdAt | date: 'dd MMMM yyyy, HH:mm' }}</span>
            </div>
            <div>
              <span class="field-label mb-1">Last active</span>
              <span>{{ getRelativeTime(u.lastActiveAt) }}</span>
            </div>
          </div>
        </div>

        <!-- DANGER ZONE (Admin only & not viewing own profile) -->
        @if (isAdmin() && u.id !== state.currentUserId()) {
          <div class="card border-danger-line p-5 space-y-3">
            <h3 class="card-title text-danger-ink">Danger zone</h3>
            <p class="text-sm text-ink-2">
              Deactivating this user will remove them from all assigned teams. They will not be able to log in or schedule meetings until reactivated.
            </p>

            @if (showDeactivateConfirm()) {
              <div class="alert alert-danger flex-col items-stretch" role="alert">
                <p>Are you absolutely sure you want to deactivate {{ u.displayName }}?</p>
                <div class="flex flex-wrap items-center gap-2">
                  <button (click)="showDeactivateConfirm.set(false)" class="btn-secondary btn-sm">Cancel</button>
                  <button (click)="deactivateAccount(u.id)" class="btn-danger btn-sm">Confirm deactivation</button>
                  @if (deactivateError()) {
                    <span class="field-error">{{ deactivateError() }}</span>
                  }
                </div>
              </div>
            } @else {
              <button (click)="showDeactivateConfirm.set(true)" class="btn-danger-soft btn-sm">Deactivate account</button>
            }
          </div>
        }
        }
      } @else {
        <!-- 404 Empty State -->
        <section class="card">
          <app-empty-state icon="error_outline" title="User profile not found" text="The requested user account does not exist or may have been deleted permanently.">
            <a routerLink="/settings/users" class="btn-secondary btn-sm">Return to list</a>
          </app-empty-state>
        </section>
      }
    </div>
  `
})
export class UserProfileComponent {
  state = inject(CrmStateService);
  translation = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authApi = inject(AuthApiService);

  userId = signal<string | null>(null);
  profileTab = signal('profile');
  readonly profileTabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'groups', label: 'Groups' },
    { id: 'activity', label: 'Activity' },
  ];

  /** The Security tab is about the signed-in person's own account, so it never shows on someone else's profile. */
  visibleTabs = computed(() => this.isOwnProfile()
    ? [...this.profileTabs, { id: 'security', label: 'Security' }]
    : this.profileTabs);

  // Security tab
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  busy = signal(false);
  passwordMessage = signal('');
  passwordError = signal('');
  confirmSignOutEverywhere = signal(false);
  confirmLeave = signal(false);
  leaveError = signal('');

  changePassword(): void {
    this.passwordMessage.set('');
    this.passwordError.set('');
    if (this.newPassword.length < 12) {
      this.passwordError.set('Use at least 12 characters for the new password');
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordError.set('The new passwords do not match');
      return;
    }
    this.busy.set(true);
    this.authApi.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (session) => {
        // The change ended every session, this one included; the answer is this device's new one.
        this.state.startSession(session);
        this.busy.set(false);
        this.currentPassword = this.newPassword = this.confirmNewPassword = '';
        this.passwordMessage.set('Password changed. You are signed out on your other devices.');
      },
      error: (err) => {
        this.busy.set(false);
        this.passwordError.set(errorMessage(err, 'Could not change the password. Please try again.'));
      }
    });
  }

  signOutEverywhere(): void {
    this.busy.set(true);
    this.authApi.signOutEverywhere().subscribe({
      next: () => this.endLocalSession(),
      error: (err) => {
        this.busy.set(false);
        this.confirmSignOutEverywhere.set(false);
        this.passwordError.set(errorMessage(err, 'Could not sign out everywhere. Please try again.'));
      }
    });
  }

  leaveOrganization(): void {
    this.leaveError.set('');
    this.busy.set(true);
    this.authApi.leaveOrganization().subscribe({
      // This organization's session is over; signing in again opens one of the others.
      next: () => this.endLocalSession(),
      error: (err) => {
        this.busy.set(false);
        this.confirmLeave.set(false);
        this.leaveError.set(errorMessage(err, 'Could not leave the organization. Please try again.'));
      }
    });
  }

  private endLocalSession(): void {
    this.busy.set(false);
    this.state.logout();
    this.router.navigate(['/']);
  }

  // Edit fields
  isEditingName = signal(false);
  isEditingJobTitle = signal(false);
  isEditingPhone = signal(false);

  editName = '';
  editJobTitle = '';
  editPhone = '';

  roleError = signal<string | null>(null);
  showDeactivateConfirm = signal(false);
  deactivateError = signal<string | null>(null);

  constructor() {
    this.route.paramMap.subscribe(params => {
      // The /profile route has no :userId param — it always shows the logged-in user.
      this.userId.set(params.get('userId') || this.state.currentUserId());
      const u = this.user();
      if (u) {
        this.editName = u.displayName;
        this.editJobTitle = u.jobTitle || '';
        this.editPhone = u.phone || '';
        this.isEditingName.set(false);
        this.isEditingJobTitle.set(false);
        this.isEditingPhone.set(false);
        this.roleError.set(null);
        this.showDeactivateConfirm.set(false);
        this.deactivateError.set(null);
      }
    });
  }

  isOwnProfile = computed(() => this.state.currentUserId() === this.userId());

  user = computed(() => {
    const id = this.userId();
    if (!id) return null;
    return this.state.users().find(u => u.id === id) || null;
  });

  canEdit(): boolean {
    const meId = this.state.currentUserId();
    const targetUser = this.user();
    if (!targetUser) return false;
    
    // Admin can edit anyone, users can edit their own profiles
    return meId === targetUser.id || this.isAdmin();
  }

  isAdmin(): boolean {
    const meId = this.state.currentUserId();
    const meUser = this.state.users().find(u => u.id === meId);
    return meUser?.roleId === 'admin';
  }

  isSelf(): boolean {
    return this.state.currentUserId() === this.userId();
  }

  /** Self-edits go through the self-service endpoint (no USERS_WRITE needed); admins editing someone else use the admin endpoint. */
  private saveUserPatch(userId: string, patch: { displayName?: string; jobTitle?: string; phone?: string }) {
    if (this.isSelf()) {
      this.state.updateOwnProfile(patch);
    } else {
      this.state.updateUser(userId, patch);
    }
  }

  // Toggles & Saves
  toggleEditName() {
    if (this.isEditingName()) {
      if (this.editName.trim()) {
        const u = this.user();
        if (u) {
          this.saveUserPatch(u.id, { displayName: this.editName });
        }
      }
      this.isEditingName.set(false);
    } else {
      this.editName = this.user()?.displayName || '';
      this.isEditingName.set(true);
    }
  }

  toggleEditJobTitle() {
    if (this.isEditingJobTitle()) {
      const u = this.user();
      if (u) {
        this.saveUserPatch(u.id, { jobTitle: this.editJobTitle });
      }
      this.isEditingJobTitle.set(false);
    } else {
      this.editJobTitle = this.user()?.jobTitle || '';
      this.isEditingJobTitle.set(true);
    }
  }

  toggleEditPhone() {
    if (this.isEditingPhone()) {
      const u = this.user();
      if (u) {
        this.saveUserPatch(u.id, { phone: this.editPhone });
      }
      this.isEditingPhone.set(false);
    } else {
      this.editPhone = this.user()?.phone || '';
      this.isEditingPhone.set(true);
    }
  }

  togglePreference(user: CrmUser, key: 'notifyOnLeadAssign' | 'notifyOnDealUpdate' | 'notifyOnMention') {
    const currentVal = user.preferences[key];
    if (this.isSelf()) {
      this.state.updateOwnProfile({ language: user.preferences.language });
      return;
    }
    this.state.updateUser(user.id, {
      preferences: {
        ...user.preferences,
        [key]: !currentVal
      }
    });
  }

  changeTheme(user: CrmUser, event: Event) {
    const val = (event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system';
    if (this.isSelf()) {
      this.state.updateOwnProfile({ theme: val });
      // updateOwnProfile persists + applies via CrmStateService.setTheme;
      // re-assert here so the switch feels instant even if state has no user yet.
      this.applyTheme(val);
      return;
    }
    this.state.updateUser(user.id, {
      preferences: {
        ...user.preferences,
        theme: val
      }
    });
  }

  changeLanguage(user: CrmUser, event: Event) {
    const val = (event.target as HTMLSelectElement).value as 'en' | 'fr' | 'ar';
    if (this.isSelf()) {
      this.state.updateOwnProfile({ language: val });
      return;
    }
    this.state.updateUser(user.id, {
      preferences: {
        ...user.preferences,
        language: val
      }
    });
  }

  private applyTheme(theme: 'light' | 'dark' | 'system') {
    // Single source of truth lives in CrmStateService (persist + DOM + signal);
    // keep this thin wrapper so the template path never drifts from boot logic.
    this.state.setTheme(theme);
  }

  updateUserRole(userId: string, event: Event) {
    const val = (event.target as HTMLSelectElement).value as RoleId;
    try {
      this.state.updateUserRole(userId, val);
      this.roleError.set(null);
    } catch (err: unknown) {
      this.roleError.set(errorMessage(err, 'Operation failed'));
      // Reset select element visual state
      event.preventDefault();
    }
  }

  deactivateAccount(userId: string) {
    try {
      this.state.deactivateUser(userId);
      this.showDeactivateConfirm.set(false);
      this.deactivateError.set(null);
      this.router.navigate(['/settings/users']);
    } catch (err: unknown) {
      this.deactivateError.set(errorMessage(err, 'Operation failed'));
    }
  }

  // Getters
  getTeamName(teamId: string): string {
    return this.state.teams().find(t => t.id === teamId)?.name || '';
  }

  getUserGroups(userId: string) {
    return this.state.groupsByUser(userId);
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHrs = Math.floor(diffMs / (3600000));
    
    if (diffHrs < 1) {
      const mins = Math.floor(diffMs / 60000);
      return mins <= 1 ? 'Just active' : `Active ${mins} minutes ago`;
    }
    if (diffHrs < 24) {
      return `Active ${diffHrs} hours ago`;
    }
    const days = Math.floor(diffHrs / 24);
    return days === 1 ? 'Active yesterday' : `Active ${days} days ago`;
  }
}
