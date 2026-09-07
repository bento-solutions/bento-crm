import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrmStateService, CrmUser, RoleId } from '../services/crm-state.service';
import { InvitationDto, InvitationRole, InvitationStatus } from '../core/services/invitation-api.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { RoleBadgeComponent } from '../shared/role-badge.component';
import { errorMessage } from '../shared/error-message.util';
import { MatIconModule } from '@angular/material/icon';
import { PaginatorComponent } from '../shared/paginator.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent, RoleBadgeComponent, MatIconModule, PaginatorComponent],
  styles: [`
    .panel {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-height 0.25s ease, opacity 0.25s ease;
    }
    .panel.open {
      max-height: 800px;
      opacity: 1;
    }
  `],
  template: `
    <div class="space-y-6 font-sans">
      <!-- Header -->
      @if (canWrite()) {
      <div class="flex justify-end">
        <button
          (click)="openAddPanel()"
          class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-base w-4 h-4 flex items-center justify-center">mail</mat-icon>
          Invite User
        </button>
      </div>
      }

      <!-- Add/Edit User Panel (Inline) -->
      <div [class.open]="showAddPanel()" class="panel bg-zinc-50 border border-zinc-200/80 rounded-2xl p-0 shadow-xs">
        <div class="p-6 space-y-4">
          <h3 class="font-bold text-zinc-800 text-sm">
            {{ panelTitle() }}
          </h3>
          @if (!editingUser() && !editingInvitation()) {
            <p class="text-meta text-zinc-500 -mt-2 leading-relaxed">
              We'll email an invitation link. The role and team you pick here are applied the
              moment they accept — they set their own password and never receive one from us.
            </p>
          }
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Display Name -->
            <div>
              <label for="display_name" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">
                Display Name{{ isInviteMode() ? '' : ' *' }}
              </label>
              <input id="display_name"
                [(ngModel)]="formDisplayName"
                type="text"
                placeholder="e.g. Amina Alaoui"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-800"
              />
            </div>

            <!-- Email -->
            <div>
              <label for="email_address" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Email address *</label>
              <input id="email_address"
                [(ngModel)]="formEmail"
                [disabled]="!!editingUser() || !!editingInvitation()"
                type="email"
                placeholder="e.g. a.alaoui@acg.ma"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
              />
            </div>

            <!-- Job Title -->
            <div>
              <label for="job_title" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Job Title</label>
              <input id="job_title"
                [(ngModel)]="formJobTitle"
                type="text"
                placeholder="e.g. Accountant Specialist"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-800"
              />
            </div>

            <!-- Phone. Hidden when inviting: an invitation carries no phone number -- the
                 invitee supplies their own on the acceptance form -- so a value typed here
                 would be silently discarded. -->
            <div [hidden]="isInviteMode()">
              <label for="phone_number" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Phone number</label>
              <input id="phone_number"
                [(ngModel)]="formPhone"
                type="text"
                placeholder="e.g. +212-661-234567"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-800"
              />
            </div>

            <!-- Role Dropdown -->
            <div>
              <label for="system_role" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">System Role</label>
              <select id="system_role"
                [(ngModel)]="formRoleId"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-700 cursor-pointer font-semibold"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="salesperson">Sales (Salesperson)</option>
                <option value="support">Support</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <!-- Team Dropdown -->
            <div>
              <label for="team_assignment" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Team Assignment</label>
              <select id="team_assignment"
                [(ngModel)]="formTeamId"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-700 cursor-pointer font-semibold"
              >
                <option value="">Unassigned</option>
                @for (team of state.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }} ({{ team.department }})</option>
                }
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              (click)="closeAddPanel()"
              class="px-4 py-2 border border-zinc-200 text-zinc-600 text-xs font-semibold rounded-xl hover:bg-zinc-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              (click)="saveUser()"
              [disabled]="!canSubmit()"
              class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {{ submitLabel() }}
            </button>
          </div>
        </div>
      </div>

      <!-- Pending invitations. Only rendered when there are any, so an organization that
           never invites anyone doesn't carry a permanently empty table. -->
      @if (canRead() && visibleInvitations().length > 0) {
        <div class="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <mat-icon class="text-zinc-400 text-base w-4 h-4 flex items-center justify-center">mail</mat-icon>
              <h3 class="font-bold text-zinc-800 text-sm">Invitations</h3>
              <span class="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full text-meta font-bold">
                {{ pendingCount() }} pending
              </span>
            </div>
            <label for="show_resolved_invites" class="inline-flex items-center gap-2 cursor-pointer select-none">
              <input id="show_resolved_invites"
                type="checkbox"
                [(ngModel)]="showResolvedInvitations"
                class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-700 h-4 w-4"
              />
              <span class="text-xs font-semibold text-zinc-600">Show accepted &amp; revoked</span>
            </label>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-zinc-50">
                <tr>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Pre-assigned role</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Team</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Invited by</th>
                  <th class="px-6 py-3.5 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (invite of visibleInvitations(); track invite.id) {
                  <tr class="hover:bg-zinc-50/40 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="text-xs text-zinc-800 font-medium font-mono block">{{ invite.email }}</span>
                      @if (invite.display_name) {
                        <span class="text-meta text-zinc-400 block font-medium mt-0.5">{{ invite.display_name }}</span>
                      }
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-xs">
                      <app-role-badge [roleId]="roleIdOf(invite)"></app-role-badge>
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-xs font-semibold text-zinc-700">
                      {{ getTeamName(invite.team_id) }}
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-xs">
                      <div class="flex flex-col gap-1">
                        <span [class]="invitationStatusClass(invite.status)"
                          class="inline-flex w-fit px-2 py-0.5 rounded-full text-meta font-bold border">
                          {{ invitationStatusLabel(invite.status) }}
                        </span>
                        <span class="text-meta text-zinc-400 font-medium">{{ invitationSubtext(invite) }}</span>
                      </div>
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-xs font-medium text-zinc-600">
                      {{ invite.invited_by_name || '—' }}
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-right text-xs">
                      @if (canWrite() && isOutstanding(invite)) {
                        <div class="flex items-center justify-end gap-2">
                          <button
                            (click)="editInvitation(invite)"
                            class="bg-white border border-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-meta font-bold hover:bg-zinc-50 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            (click)="resendInvitation(invite.id)"
                            class="bg-white border border-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-meta font-bold hover:bg-zinc-50 cursor-pointer"
                          >
                            Resend
                          </button>
                          @if (revokeConfirmId() === invite.id) {
                            <button
                              (click)="executeRevoke(invite.id)"
                              class="bg-zinc-900 text-white px-3 py-1 rounded-lg text-meta font-bold cursor-pointer shadow-xs"
                            >
                              Confirm revoke
                            </button>
                            <button
                              (click)="revokeConfirmId.set(null)"
                              class="text-zinc-500 hover:text-zinc-700 px-1 text-meta font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          } @else {
                            <button
                              (click)="revokeConfirmId.set(invite.id)"
                              class="bg-white border border-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-meta font-bold hover:bg-zinc-50 cursor-pointer"
                            >
                              Revoke
                            </button>
                          }
                        </div>
                      } @else {
                        <span class="text-meta text-zinc-300 font-bold">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Filter Bar -->
      <div class="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div class="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <!-- Search input -->
          <div class="relative flex-1 max-w-xs">
            <input
              [(ngModel)]="searchTerm"
              type="text"
              placeholder="Search by name or email..."
              class="w-full border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-blue-600 text-zinc-800"
            />
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">search</mat-icon>
            </div>
          </div>

          <!-- Role Select -->
          <select
            [(ngModel)]="selectedRole"
            class="border border-zinc-200 rounded-xl px-3 py-2 text-xs bg-white text-zinc-600 cursor-pointer font-semibold focus:outline-blue-600"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="salesperson">Sales</option>
            <option value="support">Support</option>
            <option value="viewer">Viewer</option>
          </select>

          <!-- Team Select -->
          <select
            [(ngModel)]="selectedTeam"
            class="border border-zinc-200 rounded-xl px-3 py-2 text-xs bg-white text-zinc-600 cursor-pointer font-semibold focus:outline-blue-600"
          >
            <option value="all">All Teams</option>
            <option value="unassigned">Unassigned</option>
            @for (t of state.teams(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
        </div>

        <!-- Status Toggle toggleInactive -->
        <label for="label_6" class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input id="label_6"
            type="checkbox"
            [(ngModel)]="showInactive"
            class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-700 h-4 w-4"
          />
          <span class="text-xs font-semibold text-zinc-600">Show Inactive accounts</span>
        </label>
      </div>

      <!-- Table / User List -->
      <div class="bg-white border border-zinc-200/80 rounded-2xl overflow-x-auto shadow-xs">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-zinc-50">
            <tr>
              <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">User details</th>
              <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Email</th>
              <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">System Role</th>
              <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Team</th>
              <th class="px-6 py-3.5 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3.5 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            @for (user of paginatedUsers(); track user.id) {
              <!-- Standard row -->
              <tr class="hover:bg-zinc-50/40 transition-colors">
                <!-- Avatar + Name -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <a [routerLink]="['/settings/users', user.id]" class="hover:opacity-85 transition-opacity">
                      <app-user-avatar [userId]="user.id" [size]="36"></app-user-avatar>
                    </a>
                    <div>
                      <a [routerLink]="['/settings/users', user.id]" class="font-bold text-xs text-zinc-800 hover:text-zinc-900 block transition-colors">
                        {{ user.displayName }}
                      </a>
                      <span class="text-meta text-zinc-400 block font-medium mt-0.5">{{ user.jobTitle || 'No title' }}</span>
                    </div>
                  </div>
                </td>

                <!-- Email -->
                <td class="px-6 py-4 whitespace-nowrap text-xs text-zinc-600 font-medium font-mono">
                  {{ user.email }}
                </td>

                <!-- Role badge -->
                <td class="px-6 py-4 whitespace-nowrap text-xs">
                  @if (editingRoleIdUserId() === user.id) {
                    <div class="space-y-1">
                      <select
                        [value]="user.roleId"
                        (change)="changeUserRole(user.id, $event)"
                        (blur)="cancelRoleEdit()"
                        (keydown.esc)="cancelRoleEdit()"
                        class="border border-zinc-200 rounded-lg px-2 py-1 text-xs bg-white text-zinc-700 focus:outline-blue-600 focus:ring-1 focus:ring-zinc-700"
                       
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="salesperson">Sales</option>
                        <option value="support">Support</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      @if (roleErrorUserId() === user.id) {
                        <p class="text-meta text-zinc-900 leading-tight font-medium">{{ roleErrorMessage() }}</p>
                      }
                    </div>
                  } @else {
                    <app-role-badge [roleId]="user.roleId"></app-role-badge>
                  }
                </td>

                <!-- Team -->
                <td class="px-6 py-4 whitespace-nowrap text-xs font-semibold text-zinc-700">
                  {{ getTeamName(user.teamId) }}
                </td>

                <!-- Status -->
                <td class="px-6 py-4 whitespace-nowrap text-xs">
                  <span
                    [class]="user.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'"
                    class="inline-flex px-2 py-0.5 rounded-full text-meta font-bold border"
                  >
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <!-- Actions Menu -->
                <td class="px-6 py-4 whitespace-nowrap text-right text-xs relative">
                  @if (canWrite()) {
                  <button
                    (click)="toggleMenu(user.id, $event)"
                    class="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg transition-colors flex items-center ml-auto cursor-pointer"
                  >
                    <mat-icon class="text-base w-5 h-5 flex items-center justify-center">more_vert</mat-icon>
                  </button>
                  }

                  <!-- Actions Dropdown panel -->
                  @if (activeMenuUserId() === user.id && canWrite()) {
                    <div class="absolute right-6 top-11 bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5 z-10 w-36 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                      <button
                        (click)="editUser(user)"
                        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer"
                      >
                        <mat-icon class="text-zinc-400 text-sm w-4 h-4 flex items-center justify-center">edit</mat-icon>
                        Edit Details
                      </button>
                      <button
                        (click)="startRoleEdit(user.id)"
                        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer"
                      >
                        <mat-icon class="text-zinc-400 text-sm w-4 h-4 flex items-center justify-center">swap_horiz</mat-icon>
                        Change Role
                      </button>
                      @if (user.isActive && user.id !== state.currentUserId()) {
                        <button
                          (click)="confirmDeactivate(user.id)"
                          class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-900 hover:bg-zinc-100 font-medium cursor-pointer"
                        >
                          <mat-icon class="text-zinc-500 text-sm w-4 h-4 flex items-center justify-center">block</mat-icon>
                          Deactivate
                        </button>
                      }
                    </div>
                  }
                </td>
              </tr>

              <!-- Inline Deactivation Confirmation row -->
              @if (deactivateConfirmUserId() === user.id) {
                <tr class="bg-zinc-100/40">
                  <td colspan="6" class="px-6 py-3 border-t border-zinc-200">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2 text-zinc-950 text-xs font-semibold">
                        <mat-icon class="text-zinc-700 text-sm w-4 h-4 flex items-center justify-center">warning</mat-icon>
                        <span>Deactivate {{ user.displayName }}? This cannot be undone.</span>
                      </div>
                      <div class="flex items-center gap-2">
                        @if (deactivateErrorMessage()) {
                          <span class="text-meta text-zinc-950 font-bold mr-2">{{ deactivateErrorMessage() }}</span>
                        }
                        <button
                          (click)="cancelDeactivate()"
                          class="bg-white border border-zinc-200 text-zinc-600 px-3 py-1 rounded-lg text-meta font-bold hover:bg-zinc-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          (click)="executeDeactivate(user.id)"
                          class="bg-zinc-900 text-white px-3 py-1 rounded-lg text-meta font-bold hover:bg-rose-750 cursor-pointer shadow-xs"
                        >
                          Confirm Deactivation
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <!-- Empty state row -->
              <tr>
                <td colspan="6" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                    <div class="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center">
                      <i class="ti ti-users-off text-2xl leading-none"></i>
                    </div>
                    <p class="text-xs font-bold text-zinc-800 font-sans">No users match your filters</p>
                    <p class="text-meta text-zinc-500">Try adjusting your filters, query string or toggle settings to locate the user.</p>
                    <button
                      (click)="clearFilters()"
                      class="bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border border-zinc-200/50 px-3 py-1.5 rounded-lg text-meta font-bold tracking-wide transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (filteredUsers().length > 0) {
          <app-paginator
            [currentPage]="usersPage()"
            [totalPages]="usersTotalPages()"
            [pageSize]="usersPageSize()"
            (pageChange)="usersPage.set($event)"
            (pageSizeChange)="usersPageSize.set($event)" />
        }
      </div>
    </div>
  `
})
export class UsersComponent {
  state = inject(CrmStateService);

  // Filters signals
  searchTerm = signal<string>('');
  selectedRole = signal<string>('all');
  selectedTeam = signal<string>('all');
  showInactive = signal<boolean>(false);

  // Add / Edit form signals. The panel serves three modes: inviting someone new, editing an
  // existing user, and editing a still-pending invitation.
  showAddPanel = signal<boolean>(false);
  editingUser = signal<CrmUser | null>(null);
  editingInvitation = signal<InvitationDto | null>(null);

  // Invitations
  showResolvedInvitations = signal<boolean>(false);
  revokeConfirmId = signal<string | null>(null);

  formDisplayName = '';
  formEmail = '';
  formJobTitle = '';
  formPhone = '';
  formRoleId: RoleId = 'viewer';
  formTeamId = '';

  // Interactivity signals
  activeMenuUserId = signal<string | null>(null);
  editingRoleIdUserId = signal<string | null>(null);
  roleErrorUserId = signal<string | null>(null);
  roleErrorMessage = signal<string>('');

  deactivateConfirmUserId = signal<string | null>(null);
  deactivateErrorMessage = signal<string>('');

  // Close menus when clicking anywhere
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => {
        this.activeMenuUserId.set(null);
      });
    }

    // Invitations are loaded here rather than eagerly at startup: they are only ever shown on
    // this page, and only to a user who can read them. The effect waits for the authority
    // check to become true, since the current user may still be hydrating when this runs.
    effect(() => {
      if (this.canRead() && !this.state.invitationsLoaded()) {
        this.state.loadInvitations();
      }
    });
  }

  canWrite(): boolean {
    return this.state.hasAuthority('USERS_WRITE');
  }

  canRead(): boolean {
    return this.state.hasAuthority('USERS_READ');
  }

  toggleMenu(userId: string, event: Event) {
    event.stopPropagation();
    if (this.activeMenuUserId() === userId) {
      this.activeMenuUserId.set(null);
    } else {
      this.activeMenuUserId.set(userId);
    }
  }

  // Filter computation
  filteredUsers = computed(() => {
    let list = this.state.users();
    const query = this.searchTerm().toLowerCase().trim();
    const role = this.selectedRole();
    const team = this.selectedTeam();
    const activeOnly = !this.showInactive();

    // 1. Status Filter
    if (activeOnly) {
      list = list.filter(u => u.isActive);
    }

    // 2. Role Filter
    if (role !== 'all') {
      list = list.filter(u => u.roleId === role);
    }

    // 3. Team Filter
    if (team !== 'all') {
      if (team === 'unassigned') {
        list = list.filter(u => !u.teamId);
      } else {
        list = list.filter(u => u.teamId === team);
      }
    }

    // 4. Search Query Filter
    if (query) {
      list = list.filter(u => 
        u.displayName.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
      );
    }

    return list;
  });

  usersPage = signal(1);
  usersPageSize = signal(10);
  usersTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.usersPageSize())));
  paginatedUsers = computed(() => {
    const start = (this.usersPage() - 1) * this.usersPageSize();
    return this.filteredUsers().slice(start, start + this.usersPageSize());
  });

  // Actions
  clearFilters() {
    this.searchTerm.set('');
    this.selectedRole.set('all');
    this.selectedTeam.set('all');
    this.showInactive.set(false);
  }

  openAddPanel() {
    if (!this.canWrite()) return;
    this.editingUser.set(null);
    this.editingInvitation.set(null);
    this.formDisplayName = '';
    this.formEmail = '';
    this.formJobTitle = '';
    this.formPhone = '';
    this.formRoleId = 'viewer';
    this.formTeamId = '';
    this.showAddPanel.set(true);
  }

  editUser(user: CrmUser) {
    if (!this.canWrite()) return;
    this.editingUser.set(user);
    this.editingInvitation.set(null);
    this.formDisplayName = user.displayName;
    this.formEmail = user.email;
    this.formJobTitle = user.jobTitle || '';
    this.formPhone = user.phone || '';
    this.formRoleId = user.roleId;
    this.formTeamId = user.teamId || '';
    this.showAddPanel.set(true);
    this.activeMenuUserId.set(null);
  }

  /** Reuses the same panel so changing a pending invite's role reads like editing a user. */
  editInvitation(invite: InvitationDto) {
    if (!this.canWrite()) return;
    this.editingUser.set(null);
    this.editingInvitation.set(invite);
    this.formDisplayName = invite.display_name || '';
    this.formEmail = invite.email;
    this.formJobTitle = invite.job_title || '';
    this.formPhone = '';
    this.formRoleId = this.roleIdOf(invite);
    this.formTeamId = invite.team_id || '';
    this.showAddPanel.set(true);
    this.revokeConfirmId.set(null);
  }

  closeAddPanel() {
    this.showAddPanel.set(false);
    this.editingUser.set(null);
    this.editingInvitation.set(null);
  }

  isInviteMode(): boolean {
    return !this.editingUser() && !this.editingInvitation();
  }

  panelTitle(): string {
    if (this.editingUser()) return 'Edit User details';
    if (this.editingInvitation()) return 'Edit pending invitation';
    return 'Invite a user by email';
  }

  submitLabel(): string {
    if (this.editingUser()) return 'Save changes';
    if (this.editingInvitation()) return 'Save invitation';
    return 'Send invitation';
  }

  canSubmit(): boolean {
    // Inviting needs only an address -- the display name is a suggestion the invitee can
    // overwrite when they accept, so requiring it would block the common case of inviting
    // someone whose exact spelling you don't know.
    if (this.isInviteMode()) return !!this.formEmail.trim();
    return !!this.formDisplayName.trim() && !!this.formEmail.trim();
  }

  saveUser() {
    if (!this.canWrite()) return;
    const editMode = this.editingUser();
    if (editMode) {
      this.state.updateUser(editMode.id, {
        displayName: this.formDisplayName,
        jobTitle: this.formJobTitle,
        phone: this.formPhone,
        roleId: this.formRoleId,
        teamId: this.formTeamId || null
      });
      // Handle potential team memberships update
      const oldTeamId = editMode.teamId;
      const newTeamId = this.formTeamId;
      if (oldTeamId !== newTeamId) {
        if (oldTeamId) {
          try {
            this.state.removeTeamMember(oldTeamId, editMode.id);
          } catch {
            /* ignore removal errors */
          }
        }
        if (newTeamId) {
          this.state.addTeamMember(newTeamId, editMode.id);
        }
      }
    } else if (this.editingInvitation()) {
      this.state.updateInvitation(this.editingInvitation()!.id, {
        email: this.formEmail,
        roleId: this.formRoleId,
        teamId: this.formTeamId || null,
        displayName: this.formDisplayName,
        jobTitle: this.formJobTitle
      });
    } else {
      // Creating the account outright would mean generating a password nobody ever sees.
      // An invitation defers account creation until the invitee sets their own.
      this.state.inviteUser({
        email: this.formEmail,
        roleId: this.formRoleId,
        teamId: this.formTeamId || null,
        displayName: this.formDisplayName,
        jobTitle: this.formJobTitle
      });
    }
    this.closeAddPanel();
  }

  // ------------------------------------------------------------- invitations

  private static readonly ROLE_ID_BY_INVITATION_ROLE: Record<InvitationRole, RoleId> = {
    ADMIN: 'admin', MANAGER: 'manager', SALESPERSON: 'salesperson', SUPPORT: 'support', VIEWER: 'viewer'
  };

  roleIdOf(invite: InvitationDto): RoleId {
    return UsersComponent.ROLE_ID_BY_INVITATION_ROLE[invite.role] ?? 'viewer';
  }

  visibleInvitations = computed(() => {
    const list = this.state.invitations();
    if (this.showResolvedInvitations()) return list;
    return list.filter(i => i.status === 'PENDING' || i.status === 'EXPIRED');
  });

  pendingCount = computed(() => this.state.invitations().filter(i => i.status === 'PENDING').length);

  /** Only a live invitation can be resent, edited or revoked. */
  isOutstanding(invite: InvitationDto): boolean {
    return invite.status === 'PENDING' || invite.status === 'EXPIRED';
  }

  invitationStatusLabel(status: InvitationStatus): string {
    switch (status) {
      case 'PENDING': return 'Pending';
      case 'ACCEPTED': return 'Accepted';
      case 'REVOKED': return 'Revoked';
      case 'EXPIRED': return 'Expired';
      default: return status;
    }
  }

  invitationStatusClass(status: InvitationStatus): string {
    switch (status) {
      case 'ACCEPTED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'EXPIRED': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'REVOKED': return 'bg-zinc-100 text-zinc-500 border-zinc-200';
      default: return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    }
  }

  /** The line under the badge: whichever date actually explains the current status. */
  invitationSubtext(invite: InvitationDto): string {
    if (invite.status === 'ACCEPTED' && invite.accepted_at) {
      return 'Joined ' + this.formatDate(invite.accepted_at);
    }
    if (invite.status === 'REVOKED' && invite.revoked_at) {
      return 'Revoked ' + this.formatDate(invite.revoked_at);
    }
    if (invite.status === 'EXPIRED') {
      return 'Expired ' + this.formatDate(invite.expires_at);
    }
    const sent = invite.send_count > 1 ? ' · sent ' + invite.send_count + '×' : '';
    return 'Expires ' + this.formatDate(invite.expires_at) + sent;
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  resendInvitation(id: string) {
    if (!this.canWrite()) return;
    this.state.resendInvitation(id);
    this.revokeConfirmId.set(null);
  }

  executeRevoke(id: string) {
    if (!this.canWrite()) return;
    this.state.revokeInvitation(id);
    this.revokeConfirmId.set(null);
  }

  // Inline role editing
  startRoleEdit(userId: string) {
    if (!this.canWrite()) return;
    this.editingRoleIdUserId.set(userId);
    this.roleErrorUserId.set(null);
    this.roleErrorMessage.set('');
    this.activeMenuUserId.set(null);
  }

  changeUserRole(userId: string, event: Event) {
    const val = (event.target as HTMLSelectElement).value as RoleId;
    try {
      this.state.updateUserRole(userId, val);
      this.cancelRoleEdit();
    } catch (err: unknown) {
      this.roleErrorUserId.set(userId);
      this.roleErrorMessage.set(errorMessage(err, 'Operation failed'));
    }
  }

  cancelRoleEdit() {
    this.editingRoleIdUserId.set(null);
  }

  // Deactivation
  confirmDeactivate(userId: string) {
    if (!this.canWrite()) return;
    this.deactivateConfirmUserId.set(userId);
    this.deactivateErrorMessage.set('');
    this.activeMenuUserId.set(null);
  }

  executeDeactivate(userId: string) {
    try {
      this.state.deactivateUser(userId);
      this.cancelDeactivate();
    } catch (err: unknown) {
      this.deactivateErrorMessage.set(errorMessage(err, 'Deactivation failed'));
    }
  }

  cancelDeactivate() {
    this.deactivateConfirmUserId.set(null);
    this.deactivateErrorMessage.set('');
  }

  // Getters
  getTeamName(teamId: string | null): string {
    if (!teamId) return '—';
    return this.state.teams().find(t => t.id === teamId)?.name || '—';
  }
}
