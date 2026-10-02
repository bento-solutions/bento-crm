import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrmStateService, CrmUser, RoleId } from '../services/crm-state.service';
import { ToastService } from '../services/toast.service';
import { InvitationDto, InvitationRole, InvitationStatus } from '../core/services/invitation-api.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { RoleBadgeComponent } from '../shared/role-badge.component';
import { errorMessage } from '../shared/error-message.util';
import { MatIconModule } from '@angular/material/icon';
import { PaginatorComponent } from '../shared/paginator.component';
import { PageHeaderComponent } from '../shared/ui/page-header.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent, RoleBadgeComponent, MatIconModule, PaginatorComponent, PageHeaderComponent],
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
    <div class="page">
      <app-page-header size="section" title="Users" subtitle="Invite teammates, assign roles and manage account access">
        @if (canWrite()) {
          <button actions (click)="openAddPanel()" class="btn-primary">
            <mat-icon>mail</mat-icon>
            Invite User
          </button>
        }
      </app-page-header>

      <!-- Add/Edit User Panel (Inline) -->
      <div [class.open]="showAddPanel()" class="panel card">
        <div class="p-5 space-y-4">
          <h3 class="card-title">
            {{ panelTitle() }}
          </h3>
          @if (!editingUser() && !editingInvitation()) {
            <p class="text-meta text-ink-3 -mt-2 leading-relaxed">
              We'll email an invitation link. The role and team you pick here are applied the
              moment they accept — they set their own password and never receive one from us.
            </p>
          }
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Display Name -->
            <div>
              <label for="display_name" class="field-label mb-1.5">
                Display Name{{ isInviteMode() ? '' : ' *' }}
              </label>
              <input id="display_name"
                [(ngModel)]="formDisplayName"
                type="text"
                placeholder="e.g. Amina Alaoui"
                class="input-field w-full"
              />
            </div>

            <!-- Email -->
            <div>
              <label for="email_address" class="field-label mb-1.5">Email address *</label>
              <input id="email_address"
                [(ngModel)]="formEmail"
                [disabled]="!!editingUser() || !!editingInvitation()"
                type="email"
                placeholder="e.g. a.alaoui@acg.ma"
                class="input-field w-full"
              />
            </div>

            <!-- Job Title -->
            <div>
              <label for="job_title" class="field-label mb-1.5">Job Title</label>
              <input id="job_title"
                [(ngModel)]="formJobTitle"
                type="text"
                placeholder="e.g. Accountant Specialist"
                class="input-field w-full"
              />
            </div>

            <!-- Phone. Hidden when inviting: an invitation carries no phone number -- the
                 invitee supplies their own on the acceptance form -- so a value typed here
                 would be silently discarded. -->
            <div [hidden]="isInviteMode()">
              <label for="phone_number" class="field-label mb-1.5">Phone number</label>
              <input id="phone_number"
                [(ngModel)]="formPhone"
                type="text"
                placeholder="e.g. +212-661-234567"
                class="input-field w-full"
              />
            </div>

            <!-- Role Dropdown -->
            <div>
              <label for="system_role" class="field-label mb-1.5">System Role</label>
              <select id="system_role"
                [(ngModel)]="formRoleId"
                class="input-field w-full cursor-pointer font-semibold"
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
              <label for="team_assignment" class="field-label mb-1.5">Team Assignment</label>
              <select id="team_assignment"
                [(ngModel)]="formTeamId"
                class="input-field w-full cursor-pointer font-semibold"
              >
                <option value="">Unassigned</option>
                @for (team of state.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }} ({{ team.department }})</option>
                }
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button
              (click)="closeAddPanel()"
              class="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              (click)="saveUser()"
              [disabled]="!canSubmit()"
              class="btn-primary btn-sm"
            >
              {{ submitLabel() }}
            </button>
          </div>
        </div>
      </div>

      <!-- Pending invitations. Only rendered when there are any, so an organization that
           never invites anyone doesn't carry a permanently empty table. -->
      @if (canRead() && visibleInvitations().length > 0) {
        <div class="card overflow-hidden">
          <div class="card-header">
            <div class="flex items-center gap-2">
              <mat-icon class="text-ink-3 icon-sm">mail</mat-icon>
              <h3 class="card-title">Invitations</h3>
              <span class="badge badge-neutral">
                {{ pendingCount() }} pending
              </span>
            </div>
            <label for="show_resolved_invites" class="inline-flex items-center gap-2 cursor-pointer select-none">
              <input id="show_resolved_invites"
        type="checkbox"
        [(ngModel)]="showResolvedInvitations"
        
       />
              <span class="text-xs font-semibold text-ink-2">Show accepted &amp; revoked</span>
            </label>
          </div>

          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Pre-assigned role</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Invited by</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (invite of visibleInvitations(); track invite.id) {
                  <tr>
                    <td class="whitespace-nowrap">
                      <span class="text-xs text-ink font-medium font-mono block">{{ invite.email }}</span>
                      @if (invite.display_name) {
                        <span class="text-meta text-ink-3 block font-medium mt-0.5">{{ invite.display_name }}</span>
                      }
                    </td>

                    <td class="whitespace-nowrap">
                      <app-role-badge [roleId]="roleIdOf(invite)"></app-role-badge>
                    </td>

                    <td class="whitespace-nowrap text-ink-2">
                      {{ getTeamName(invite.team_id) }}
                    </td>

                    <td class="whitespace-nowrap">
                      <div class="flex flex-col gap-1">
                        <span [class]="invitationStatusClass(invite.status)"
                          class="badge w-fit">
                          {{ invitationStatusLabel(invite.status) }}
                        </span>
                        <span class="text-meta text-ink-3 font-medium">{{ invitationSubtext(invite) }}</span>
                      </div>
                    </td>

                    <td class="whitespace-nowrap text-ink-2">
                      {{ invite.invited_by_name || '—' }}
                    </td>

                    <td class="whitespace-nowrap text-right">
                      @if (canWrite() && isOutstanding(invite)) {
                        <div class="flex items-center justify-end gap-2">
                          <button
                            (click)="copyInvitationLink(invite)"
                            title="Copy invitation link"
                            class="btn-secondary btn-sm"
                          >
                            <mat-icon class="icon-xs">content_copy</mat-icon>
                            {{ copiedInviteId() === invite.id ? 'Copied' : 'Copy link' }}
                          </button>
                          <button
                            (click)="editInvitation(invite)"
                            class="btn-secondary btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            (click)="resendInvitation(invite.id)"
                            class="btn-secondary btn-sm"
                          >
                            Resend
                          </button>
                          @if (revokeConfirmId() === invite.id) {
                            <button
                              (click)="executeRevoke(invite.id)"
                              class="btn-primary btn-sm"
                            >
                              Confirm revoke
                            </button>
                            <button
                              (click)="revokeConfirmId.set(null)"
                              class="text-ink-3 hover:text-ink-2 px-1 text-meta font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          } @else {
                            <button
                              (click)="revokeConfirmId.set(invite.id)"
                              class="btn-secondary btn-sm"
                            >
                              Revoke
                            </button>
                          }
                        </div>
                      } @else {
                        <span class="text-meta text-ink-4 font-semibold">—</span>
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
      <div class="toolbar">
        <label class="search-field">
          <mat-icon>search</mat-icon>
          <input [(ngModel)]="searchTerm" type="search" placeholder="Search by name or email…" aria-label="Search users" class="input-field" />
        </label>
        <select [(ngModel)]="selectedRole" class="input-field" aria-label="Filter by role">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="salesperson">Sales</option>
          <option value="support">Support</option>
          <option value="viewer">Viewer</option>
        </select>
        <select [(ngModel)]="selectedTeam" class="input-field" aria-label="Filter by team">
          <option value="all">All Teams</option>
          <option value="unassigned">Unassigned</option>
          @for (t of state.teams(); track t.id) {
            <option [value]="t.id">{{ t.name }}</option>
          }
        </select>
        <label for="label_6" class="inline-flex items-center gap-2 cursor-pointer select-none toolbar__spacer">
          <input id="label_6" type="checkbox" [(ngModel)]="showInactive" />
          <span class="text-xs font-medium text-ink-2">Show inactive accounts</span>
        </label>
      </div>

      <!-- Table / User List -->
      <div class="card overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>User details</th>
              <th>Email</th>
              <th>System Role</th>
              <th>Team</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of paginatedUsers(); track user.id) {
              <!-- Standard row -->
              <tr>
                <!-- Avatar + Name -->
                <td class="whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <a [routerLink]="['/settings/users', user.id]" class="hover:opacity-85 transition-opacity">
                      <app-user-avatar [userId]="user.id" [size]="36"></app-user-avatar>
                    </a>
                    <div>
                      <a [routerLink]="['/settings/users', user.id]" class="table-name-link font-semibold text-xs text-ink hover:text-ink block transition-colors">
                        {{ user.displayName }}
                      </a>
                      <span class="text-meta text-ink-3 block font-medium mt-0.5">{{ user.jobTitle || 'No title' }}</span>
                    </div>
                  </div>
                </td>

                <!-- Email -->
                <td class="whitespace-nowrap text-ink-2 font-mono">
                  {{ user.email }}
                </td>

                <!-- Role badge -->
                <td class="whitespace-nowrap">
                  @if (editingRoleIdUserId() === user.id) {
                    <div class="space-y-1">
                      <select
                        [value]="user.roleId"
                        (change)="changeUserRole(user.id, $event)"
                        (blur)="cancelRoleEdit()"
                        (keydown.esc)="cancelRoleEdit()"
                        class="input-field"
                       
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="salesperson">Sales</option>
                        <option value="support">Support</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      @if (roleErrorUserId() === user.id) {
                        <p class="text-meta text-ink leading-tight font-medium">{{ roleErrorMessage() }}</p>
                      }
                    </div>
                  } @else {
                    <app-role-badge [roleId]="user.roleId"></app-role-badge>
                  }
                </td>

                <!-- Team -->
                <td class="whitespace-nowrap text-ink-2">
                  {{ getTeamName(user.teamId) }}
                </td>

                <!-- Status -->
                <td class="whitespace-nowrap">
                  <span
                    [class]="user.isActive ? 'badge-success' : 'bg-muted text-ink-3 border-line'"
                    class="badge"
                  >
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <!-- Actions Menu -->
                <td class="whitespace-nowrap text-right relative">
                  @if (canWrite()) {
                  <button
                    (click)="toggleMenu(user.id, $event)"
                    class="btn-icon btn-sm ml-auto"
                    [attr.aria-label]="'Actions for ' + user.displayName"
                    aria-haspopup="menu"
                  >
                    <mat-icon class="icon-sm">more_vert</mat-icon>
                  </button>
                  }

                  <!-- Actions Dropdown panel -->
                  @if (activeMenuUserId() === user.id && canWrite()) {
                    <div class="menu absolute right-6 top-11 z-10 w-36">
                      <button
                        (click)="editUser(user)"
                        class="menu-item"
                      >
                        <mat-icon class="text-ink-4 icon-sm">edit</mat-icon>
                        Edit Details
                      </button>
                      <button
                        (click)="startRoleEdit(user.id)"
                        class="menu-item"
                      >
                        <mat-icon class="text-ink-4 icon-sm">swap_horiz</mat-icon>
                        Change Role
                      </button>
                      @if (user.isActive && user.id !== state.currentUserId()) {
                        <button
                          (click)="confirmDeactivate(user.id)"
                          class="menu-item"
                        >
                          <mat-icon class="text-ink-3 icon-sm">block</mat-icon>
                          Deactivate
                        </button>
                      }
                    </div>
                  }
                </td>
              </tr>

              <!-- Inline Deactivation Confirmation row -->
              @if (deactivateConfirmUserId() === user.id) {
                <tr>
                  <td colspan="6" class="border-t border-line">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2 text-ink text-xs font-semibold">
                        <mat-icon class="text-ink-2 icon-sm">warning</mat-icon>
                        <span>Deactivate {{ user.displayName }}? This cannot be undone.</span>
                      </div>
                      <div class="flex items-center gap-2">
                        @if (deactivateErrorMessage()) {
                          <span class="text-meta text-ink font-semibold mr-2">{{ deactivateErrorMessage() }}</span>
                        }
                        <button
                          (click)="cancelDeactivate()"
                          class="btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                        <button
                          (click)="executeDeactivate(user.id)"
                          class="btn-primary btn-sm"
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
                <td colspan="6" class="text-center">
                  <div class="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                    <div class="w-12 h-12 bg-muted text-ink-3 rounded-full flex items-center justify-center">
                      <mat-icon class="icon-lg">group_off</mat-icon>
                    </div>
                    <p class="text-xs font-semibold text-ink">No users match your filters</p>
                    <p class="text-meta text-ink-3">Try adjusting your filters, query string or toggle settings to locate the user.</p>
                    <button
                      (click)="clearFilters()"
                      class="bg-muted text-ink hover:bg-muted-strong border border-line px-3 py-1.5 rounded-lg text-meta font-semibold tracking-wide transition-colors cursor-pointer"
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
  private toast = inject(ToastService);

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
  copiedInviteId = signal<string | null>(null);

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
      case 'ACCEPTED': return 'badge-success';
      case 'PENDING': return 'badge-warning';
      case 'EXPIRED': return 'bg-muted text-ink-2 border-line';
      case 'REVOKED': return 'bg-muted text-ink-3 border-line';
      default: return 'bg-muted text-ink-3 border-line';
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

  copyInvitationLink(invite: InvitationDto) {
    const link = invite.invitation_url || (invite.token ? `${window.location.origin}/invite/accept?token=${invite.token}` : null);
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        this.copiedInviteId.set(invite.id);
        this.toast.show('Invitation link copied to clipboard', { type: 'success' });
        setTimeout(() => {
          if (this.copiedInviteId() === invite.id) {
            this.copiedInviteId.set(null);
          }
        }, 2500);
      }).catch(() => {
        this.toast.show('Failed to copy link to clipboard', { type: 'error' });
      });
    } else {
      this.resendInvitation(invite.id);
      this.toast.show('Fresh invitation link generated. You can now copy it.', { type: 'info' });
    }
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
