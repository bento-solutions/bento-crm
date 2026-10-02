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

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent, RoleBadgeComponent, MatIconModule, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header
        [title]="isOwnProfile() ? 'My Profile' : 'User Profile'"
        [subtitle]="isOwnProfile() ? 'Your details, preferences and activity' : 'Account details, role and activity'"
        [backLink]="isOwnProfile() ? null : '/settings/users'"
        backLabel="Users" />

      @if (user(); as u) {
        <!-- PROFILE HEADER CARD -->
        <div class="card p-5 space-y-6">
          <div class="flex items-start justify-between">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <!-- Avatar size 56 -->
              <app-user-avatar [userId]="u.id" [size]="56"></app-user-avatar>
              
              <div class="text-center sm:text-left space-y-1">
                <div class="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
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
                    >
                      <mat-icon class="icon-sm">
                        {{ isEditingName() ? 'check' : 'edit' }}
                      </mat-icon>
                    </button>
                  }
                </div>

                <div class="flex items-center justify-center sm:justify-start gap-1">
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
                    >
                      <mat-icon class="icon-sm">
                        {{ isEditingJobTitle() ? 'check' : 'edit' }}
                      </mat-icon>
                    </button>
                  }
                </div>

                <div class="text-xs text-ink-3 pt-1 font-mono">ID: {{ u.id }}</div>
              </div>
            </div>

            <!-- Active / Inactive Badge -->
            <span
              [class]="u.isActive ? 'badge-success' : 'bg-muted text-ink-3 border-line'"
              class="badge"
            >
              {{ u.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <!-- Email & Phone info grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-line-soft">
            <div>
              <span class="eyebrow block mb-0.5">Email (Immutable)</span>
              <span class="text-sm font-semibold text-ink">{{ u.email }}</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-0.5">
                <span class="eyebrow block">Phone</span>
                @if (canEdit()) {
                  <button
                    (click)="toggleEditPhone()"
                    class="btn-icon btn-sm"
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
                <span class="text-sm font-semibold text-ink">{{ u.phone || '—' }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs" role="tablist">
          @for (tab of profileTabs; track tab.id) {
            <button role="tab" class="tab" [class.is-active]="profileTab() === tab.id" [attr.aria-selected]="profileTab() === tab.id" (click)="profileTab.set(tab.id)">
              {{ tab.label }}
            </button>
          }
        </div>

        @if (profileTab() === 'profile') {
        <!-- ROLE & TEAM SECTION -->
        <div class="card p-5 space-y-4">
          <h3 class="card-title">Role & Team Assignment</h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Role -->
            <div class="space-y-2">
              <label for="system_role" class="field-label">System Role</label>
              @if (isAdmin()) {
                <div class="space-y-1">
                  <select id="system_role"
                    [value]="u.roleId"
                    (change)="updateUserRole(u.id, $event)"
                    class="input-field cursor-pointer w-full max-w-xs font-semibold"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="salesperson">Sales</option>
                    <option value="support">Support</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  @if (roleError()) {
                    <p class="text-meta text-ink font-semibold mt-1">{{ roleError() }}</p>
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
              <label for="team_link" class="field-label">Team Link</label>
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
                  <span class="text-xs text-ink-3 font-semibold">— Unassigned</span>
                }
              </div>
            </div>
          </div>
        </div>
        }

        @if (profileTab() === 'preferences') {
        <!-- PREFERENCES SECTION -->
        <div class="card p-5 space-y-6">
          <h3 class="card-title">Notification Preferences</h3>

          <div class="space-y-3 max-w-md">
            <!-- Toggle 1 -->
            <label for="label_2" class="flex items-center justify-between p-2.5 rounded-xl border border-line-soft hover:bg-subtle cursor-pointer select-none transition-colors">
              <div>
                <span class="text-xs font-semibold text-ink block">Notify on lead assignment</span>
                <span class="text-meta text-ink-3 block mt-0.5">Send alerts when a lead is assigned to you</span>
              </div>
              <input
        type="checkbox"
        [checked]="u.preferences.notifyOnLeadAssign"
        (change)="togglePreference(u, 'notifyOnLeadAssign')"
        
       />
            </label>

            <!-- Toggle 2 -->
            <label for="label_3" class="flex items-center justify-between p-2.5 rounded-xl border border-line-soft hover:bg-subtle cursor-pointer select-none transition-colors">
              <div>
                <span class="text-xs font-semibold text-ink block">Notify on deal updates</span>
                <span class="text-meta text-ink-3 block mt-0.5">Receive updates when status/stage changes on your deals</span>
              </div>
              <input
        type="checkbox"
        [checked]="u.preferences.notifyOnDealUpdate"
        (change)="togglePreference(u, 'notifyOnDealUpdate')"
        
       />
            </label>

            <!-- Toggle 3 -->
            <label for="label_4" class="flex items-center justify-between p-2.5 rounded-xl border border-line-soft hover:bg-subtle cursor-pointer select-none transition-colors">
              <div>
                <span class="text-xs font-semibold text-ink block">Notify on mentions</span>
                <span class="text-meta text-ink-3 block mt-0.5">Get notified immediately when mentioned in group chats</span>
              </div>
              <input
        type="checkbox"
        [checked]="u.preferences.notifyOnMention"
        (change)="togglePreference(u, 'notifyOnMention')"
        
       />
            </label>
          </div>

          <div class="pt-4 border-t border-line-soft space-y-2">
            <label for="appearance" class="field-label">Appearance</label>
            <select id="appearance"
              [value]="u.preferences.theme"
              (change)="changeTheme(u, $event)"
              class="input-field cursor-pointer w-full max-w-xs font-semibold"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div class="pt-4 border-t border-line-soft space-y-2">
            <label for="interface_language" class="field-label">Interface Language</label>
            <select id="interface_language"
              [value]="u.preferences.language"
              (change)="changeLanguage(u, $event)"
              class="input-field cursor-pointer w-full max-w-xs font-semibold"
            >
              @for (lang of translation.availableLanguages; track lang.code) {
                <option [value]="lang.code">{{ lang.nativeLabel }} ({{ lang.code }})</option>
              }
            </select>
          </div>
        </div>
        }

        @if (profileTab() === 'groups') {
        <!-- GROUPS SECTION -->
        <div class="card p-5 space-y-4">
          <div class="flex items-center gap-2">
            <h3 class="card-title">Collaboration Groups</h3>
            <span class="badge badge-neutral">
              {{ getUserGroups(u.id).length }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            @for (grp of getUserGroups(u.id); track grp.id) {
              <a
                [routerLink]="['/groups']"
                [queryParams]="{ groupId: grp.id }"
                class="bg-subtle border border-line hover:bg-muted hover:text-ink hover:border-accent-line px-3 py-1 rounded-xl text-xs font-semibold text-ink-2 transition-colors shadow-2xs block"
              >
                # {{ grp.name }}
              </a>
            } @empty {
              <span class="text-xs text-ink-3 italic">This user does not belong to any collaboration groups.</span>
            }
          </div>
        </div>
        }

        @if (profileTab() === 'activity') {
        <!-- ACTIVITY SECTION -->
        <div class="card p-5 space-y-4">
          <h3 class="card-title">Activity Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-ink-2">
            <div>
              <span class="eyebrow block mb-0.5">Member since</span>
              <span>{{ u.createdAt | date: 'dd MMMM yyyy, HH:mm' }}</span>
            </div>
            <div>
              <span class="eyebrow block mb-0.5">Last active</span>
              <span>{{ getRelativeTime(u.lastActiveAt) }}</span>
            </div>
          </div>
        </div>

        <!-- DANGER ZONE (Admin only & not viewing own profile) -->
        @if (isAdmin() && u.id !== state.currentUserId()) {
          <div class="bg-muted border border-line-strong rounded-2xl p-6 shadow-xs space-y-4">
            <h3 class="card-title">Danger Zone</h3>
            <p class="text-xs text-ink/90 leading-normal">
              Deactivating this user will remove them from all assigned teams. They will not be able to log in or schedule meetings until reactivated.
            </p>

            @if (showDeactivateConfirm()) {
              <div class="card p-4 space-y-3">
                <p class="text-xs text-ink font-semibold">Are you absolutely sure you want to deactivate {{ u.displayName }}?</p>
                <div class="flex items-center gap-2">
                  <button
                    (click)="showDeactivateConfirm.set(false)"
                    class="bg-muted hover:bg-muted-strong text-ink-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    (click)="deactivateAccount(u.id)"
                    class="btn-primary btn-sm"
                  >
                    Confirm Deactivation
                  </button>
                  @if (deactivateError()) {
                    <span class="text-meta text-ink font-semibold ml-2">{{ deactivateError() }}</span>
                  }
                </div>
              </div>
            } @else {
              <button
                (click)="showDeactivateConfirm.set(true)"
                class="btn-secondary btn-sm"
              >
                Deactivate Account
              </button>
            }
          </div>
        }
        }
      } @else {
        <!-- 404 Empty State -->
        <div class="bg-surface border border-line rounded-2xl p-16 text-center space-y-3">
          <div class="w-16 h-16 bg-muted text-ink-3 rounded-full flex items-center justify-center mx-auto">
            <mat-icon>error_outline</mat-icon>
          </div>
          <h2 class="card-title">User profile not found</h2>
          <p class="text-xs text-ink-3 max-w-xs mx-auto">
            The requested user account does not exist or may have been deleted permanently.
          </p>
          <a
            routerLink="/settings/users"
            class="inline-block bg-muted text-ink border border-line px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            Return to list
          </a>
        </div>
      }
    </div>
  `
})
export class UserProfileComponent {
  state = inject(CrmStateService);
  translation = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  userId = signal<string | null>(null);
  profileTab = signal('profile');
  readonly profileTabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'groups', label: 'Groups' },
    { id: 'activity', label: 'Activity' },
  ];

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
