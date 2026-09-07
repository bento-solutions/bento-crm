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

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent, RoleBadgeComponent, MatIconModule],
  template: `
    <div class="space-y-8 font-sans">
      <!-- Back button -->
      <a routerLink="/settings/users" class="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">
        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">arrow_back</mat-icon>
        Back to Users List
      </a>

      @if (user(); as u) {
        <!-- PROFILE HEADER CARD -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div class="flex items-start justify-between">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <!-- Avatar size 56 -->
              <app-user-avatar [userId]="u.id" [size]="56"></app-user-avatar>
              
              <div class="text-center sm:text-left space-y-1">
                <div class="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  @if (isEditingName()) {
                    <input
                      [(ngModel)]="editName"
                      class="border border-zinc-200 rounded-xl px-2.5 py-1 text-sm font-bold text-zinc-800 focus:outline-blue-600"
                    />
                  } @else {
                    <h2 class="text-lg font-bold text-zinc-900">{{ u.displayName }}</h2>
                  }
                  @if (canEdit()) {
                    <button
                      (click)="toggleEditName()"
                      class="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">
                        {{ isEditingName() ? 'check' : 'edit' }}
                      </mat-icon>
                    </button>
                  }
                </div>

                <div class="flex items-center justify-center sm:justify-start gap-1">
                  @if (isEditingJobTitle()) {
                    <input
                      [(ngModel)]="editJobTitle"
                      class="border border-zinc-200 rounded-xl px-2.5 py-0.5 text-xs text-zinc-700 focus:outline-blue-600"
                    />
                  } @else {
                    <span class="text-xs text-zinc-500 font-semibold">{{ u.jobTitle || 'No job title' }}</span>
                  }
                  @if (canEdit()) {
                    <button
                      (click)="toggleEditJobTitle()"
                      class="text-zinc-400 hover:text-zinc-700 p-0.5 rounded transition-colors cursor-pointer"
                    >
                      <mat-icon class="text-xs w-3.5 h-3.5 flex items-center justify-center">
                        {{ isEditingJobTitle() ? 'check' : 'edit' }}
                      </mat-icon>
                    </button>
                  }
                </div>

                <div class="text-xs text-zinc-400 font-sans pt-1">ID: {{ u.id }}</div>
              </div>
            </div>

            <!-- Active / Inactive Badge -->
            <span
              [class]="u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'"
              class="inline-flex px-2.5 py-0.5 rounded-full text-meta font-bold border uppercase tracking-wider"
            >
              {{ u.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <!-- Email & Phone info grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
            <div>
              <span class="block text-meta font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Email (Immutable)</span>
              <span class="text-sm font-semibold text-zinc-800 font-sans">{{ u.email }}</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-0.5">
                <span class="block text-meta font-bold text-zinc-400 uppercase tracking-wider">Phone</span>
                @if (canEdit()) {
                  <button
                    (click)="toggleEditPhone()"
                    class="text-zinc-400 hover:text-zinc-700 p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <mat-icon class="text-xs w-3.5 h-3.5 flex items-center justify-center">
                      {{ isEditingPhone() ? 'check' : 'edit' }}
                    </mat-icon>
                  </button>
                }
              </div>
              @if (isEditingPhone()) {
                <input
                  [(ngModel)]="editPhone"
                  class="border border-zinc-200 rounded-xl px-2.5 py-0.5 text-xs text-zinc-700 focus:outline-blue-600 w-full max-w-xs"
                />
              } @else {
                <span class="text-sm font-semibold text-zinc-800 font-sans">{{ u.phone || '—' }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
          <button (click)="profileTab.set('profile')" [class]="profileTab() === 'profile' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
            Profile
          </button>
          <button (click)="profileTab.set('preferences')" [class]="profileTab() === 'preferences' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
            Preferences
          </button>
          <button (click)="profileTab.set('groups')" [class]="profileTab() === 'groups' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
            Groups
          </button>
          <button (click)="profileTab.set('activity')" [class]="profileTab() === 'activity' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
            Activity
          </button>
        </div>

        @if (profileTab() === 'profile') {
        <!-- ROLE & TEAM SECTION -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 class="font-bold text-zinc-800 text-sm">Role & Team Assignment</h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Role -->
            <div class="space-y-2">
              <label for="system_role" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">System Role</label>
              @if (isAdmin()) {
                <div class="space-y-1">
                  <select id="system_role"
                    [value]="u.roleId"
                    (change)="updateUserRole(u.id, $event)"
                    class="border border-zinc-200 rounded-xl px-3 py-2 text-xs bg-white text-zinc-700 focus:outline-blue-600 focus:ring-zinc-700 font-semibold cursor-pointer w-full max-w-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="salesperson">Sales</option>
                    <option value="support">Support</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  @if (roleError()) {
                    <p class="text-meta text-zinc-900 font-semibold mt-1">{{ roleError() }}</p>
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
              <label for="team_link" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Team Link</label>
              <div>
                @if (u.teamId) {
                  <a
                    routerLink="/settings/teams"
                    class="inline-flex items-center gap-1 bg-zinc-100 text-zinc-950 border border-zinc-200 hover:bg-zinc-200 px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <mat-icon class="text-xs w-4 h-4 flex items-center justify-center">groups</mat-icon>
                    {{ getTeamName(u.teamId) }}
                  </a>
                } @else {
                  <span class="text-xs text-zinc-400 font-semibold">— Unassigned</span>
                }
              </div>
            </div>
          </div>
        </div>
        }

        @if (profileTab() === 'preferences') {
        <!-- PREFERENCES SECTION -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <h3 class="font-bold text-zinc-800 text-sm">Notification Preferences</h3>

          <div class="space-y-3 max-w-md">
            <!-- Toggle 1 -->
            <label for="label_2" class="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 hover:bg-zinc-50/50 cursor-pointer select-none transition-colors">
              <div>
                <span class="text-xs font-bold text-zinc-800 block">Notify on lead assignment</span>
                <span class="text-meta text-zinc-400 block mt-0.5">Send alerts when a lead is assigned to you</span>
              </div>
              <input
                type="checkbox"
                [checked]="u.preferences.notifyOnLeadAssign"
                (change)="togglePreference(u, 'notifyOnLeadAssign')"
                class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-700 h-4 w-4"
              />
            </label>

            <!-- Toggle 2 -->
            <label for="label_3" class="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 hover:bg-zinc-50/50 cursor-pointer select-none transition-colors">
              <div>
                <span class="text-xs font-bold text-zinc-800 block">Notify on deal updates</span>
                <span class="text-meta text-zinc-400 block mt-0.5">Receive updates when status/stage changes on your deals</span>
              </div>
              <input
                type="checkbox"
                [checked]="u.preferences.notifyOnDealUpdate"
                (change)="togglePreference(u, 'notifyOnDealUpdate')"
                class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-700 h-4 w-4"
              />
            </label>

            <!-- Toggle 3 -->
            <label for="label_4" class="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 hover:bg-zinc-50/50 cursor-pointer select-none transition-colors">
              <div>
                <span class="text-xs font-bold text-zinc-800 block">Notify on mentions</span>
                <span class="text-meta text-zinc-400 block mt-0.5">Get notified immediately when mentioned in group chats</span>
              </div>
              <input
                type="checkbox"
                [checked]="u.preferences.notifyOnMention"
                (change)="togglePreference(u, 'notifyOnMention')"
                class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-700 h-4 w-4"
              />
            </label>
          </div>

          <div class="pt-4 border-t border-zinc-100 space-y-2">
            <label for="appearance" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Appearance</label>
            <select id="appearance"
              [value]="u.preferences.theme"
              (change)="changeTheme(u, $event)"
              class="border border-zinc-200 rounded-xl px-3 py-2 text-xs bg-white text-zinc-700 font-semibold cursor-pointer w-full max-w-xs focus:outline-blue-600 focus:ring-zinc-700"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div class="pt-4 border-t border-zinc-100 space-y-2">
            <label for="interface_language" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Interface Language</label>
            <select id="interface_language"
              [value]="u.preferences.language"
              (change)="changeLanguage(u, $event)"
              class="border border-zinc-200 rounded-xl px-3 py-2 text-xs bg-white text-zinc-700 font-semibold cursor-pointer w-full max-w-xs focus:outline-blue-600 focus:ring-zinc-700"
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
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-zinc-800 text-sm">Collaboration Groups</h3>
            <span class="bg-zinc-100 text-zinc-600 text-meta font-bold px-2 py-0.5 rounded-full">
              {{ getUserGroups(u.id).length }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            @for (grp of getUserGroups(u.id); track grp.id) {
              <a
                [routerLink]="['/groups']"
                [queryParams]="{ groupId: grp.id }"
                class="bg-zinc-50 border border-zinc-200/80 hover:bg-zinc-100 hover:text-zinc-950 hover:border-blue-300 px-3 py-1 rounded-xl text-xs font-semibold text-zinc-650 transition-colors shadow-2xs block"
              >
                # {{ grp.name }}
              </a>
            } @empty {
              <span class="text-xs text-zinc-400 italic">This user does not belong to any collaboration groups.</span>
            }
          </div>
        </div>
        }

        @if (profileTab() === 'activity') {
        <!-- ACTIVITY SECTION -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 class="font-bold text-zinc-800 text-sm">Activity Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-zinc-600">
            <div>
              <span class="text-meta font-bold text-zinc-400 uppercase block mb-0.5">Member since</span>
              <span>{{ u.createdAt | date: 'dd MMMM yyyy, HH:mm' }}</span>
            </div>
            <div>
              <span class="text-meta font-bold text-zinc-400 uppercase block mb-0.5">Last active</span>
              <span>{{ getRelativeTime(u.lastActiveAt) }}</span>
            </div>
          </div>
        </div>

        <!-- DANGER ZONE (Admin only & not viewing own profile) -->
        @if (isAdmin() && u.id !== state.currentUserId()) {
          <div class="bg-zinc-100 border border-zinc-300 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 class="font-bold text-zinc-950 text-base">Danger Zone</h3>
            <p class="text-xs text-zinc-900/90 leading-normal">
              Deactivating this user will remove them from all assigned teams. They will not be able to log in or schedule meetings until reactivated.
            </p>

            @if (showDeactivateConfirm()) {
              <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                <p class="text-xs text-zinc-950 font-bold">Are you absolutely sure you want to deactivate {{ u.displayName }}?</p>
                <div class="flex items-center gap-2">
                  <button
                    (click)="showDeactivateConfirm.set(false)"
                    class="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    (click)="deactivateAccount(u.id)"
                    class="bg-zinc-900 hover:bg-zinc-950 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    Confirm Deactivation
                  </button>
                  @if (deactivateError()) {
                    <span class="text-meta text-zinc-950 font-bold ml-2">{{ deactivateError() }}</span>
                  }
                </div>
              </div>
            } @else {
              <button
                (click)="showDeactivateConfirm.set(true)"
                class="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-2xs"
              >
                Deactivate Account
              </button>
            }
          </div>
        }
        }
      } @else {
        <!-- 404 Empty State -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-16 text-center space-y-3">
          <div class="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto">
            <mat-icon style="font-size:32px;width:32px;height:32px">error_outline</mat-icon>
          </div>
          <h2 class="text-base font-bold text-zinc-900 font-sans">User profile not found</h2>
          <p class="text-xs text-zinc-500 max-w-xs mx-auto">
            The requested user account does not exist or may have been deleted permanently.
          </p>
          <a
            routerLink="/settings/users"
            class="inline-block bg-zinc-100 text-zinc-950 border border-zinc-200/50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
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
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
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
