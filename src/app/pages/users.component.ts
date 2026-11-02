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
import { EmptyStateComponent } from '../shared/ui/empty-state.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent, RoleBadgeComponent, MatIconModule, PaginatorComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header size="section" title="Users" subtitle="Invite teammates, assign roles and manage account access">
        @if (canWrite()) {
          <button actions (click)="openAddPanel()" class="btn-primary">
            <mat-icon>mail</mat-icon>
            Invite user
          </button>
        }
      </app-page-header>

      <!-- Add/Edit User Panel (Inline) -->
      @if (showAddPanel()) {
      <section class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">{{ panelTitle() }}</h3>
            @if (!editingUser() && !editingInvitation()) {
              <p class="row-hint">
                We'll email an invitation link. The role and team you pick here are applied the
                moment they accept — they set their own password and never receive one from us.
              </p>
            }
          </div>
        </div>

        <div class="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="field">
            <span class="field-label">Display name{{ isInviteMode() ? '' : ' *' }}</span>
            <input [(ngModel)]="formDisplayName" type="text" placeholder="e.g. Amina Alaoui" class="input-field" />
          </label>

          <label class="field">
            <span class="field-label">Email address *</span>
            <input
              [(ngModel)]="formEmail"
              [disabled]="!!editingUser() || !!editingInvitation()"
              type="email"
              placeholder="e.g. a.alaoui@acg.ma"
              class="input-field"
            />
          </label>

          <label class="field">
            <span class="field-label">Job title</span>
            <input [(ngModel)]="formJobTitle" type="text" placeholder="e.g. Accountant specialist" class="input-field" />
          </label>

          <!-- Phone. Hidden when inviting: an invitation carries no phone number -- the
               invitee supplies their own on the acceptance form -- so a value typed here
               would be silently discarded. -->
          @if (!isInviteMode()) {
            <label class="field">
              <span class="field-label">Phone number</span>
              <input [(ngModel)]="formPhone" type="text" placeholder="e.g. +212-661-234567" class="input-field" />
            </label>
          }

          <label class="field">
            <span class="field-label">System role</span>
            <select [(ngModel)]="formRoleId" class="input-field">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="salesperson">Sales (Salesperson)</option>
              <option value="support">Support</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">Team assignment</span>
            <select [(ngModel)]="formTeamId" class="input-field">
              <option value="">Unassigned</option>
              @for (team of state.teams(); track team.id) {
                <option [value]="team.id">{{ team.name }} ({{ team.department }})</option>
              }
            </select>
          </label>
        </div>

        <div class="card-footer">
          <button (click)="closeAddPanel()" class="btn-secondary">Cancel</button>
          <button (click)="saveUser()" [disabled]="!canSubmit()" class="btn-primary">{{ submitLabel() }}</button>
        </div>
      </section>
      }

      <!-- Pending invitations. Only rendered when there are any, so an organization that
           never invites anyone doesn't carry a permanently empty table. -->
      @if (canRead() && visibleInvitations().length > 0) {
        <div class="card overflow-hidden">
          <div class="card-header flex-wrap">
            <div class="flex items-center gap-2">
              <h3 class="card-title">Invitations</h3>
              <span class="badge badge-neutral">
                {{ pendingCount() }} pending
              </span>
            </div>
            <label for="show_resolved_invites" class="inline-flex items-center gap-2 cursor-pointer select-none">
              <input id="show_resolved_invites" type="checkbox" [(ngModel)]="showResolvedInvitations" />
              <span class="text-xs text-ink-2">Show accepted and revoked</span>
            </label>
          </div>

          @for (invite of visibleInvitations(); track invite.id) {
            <div class="list-row">
              <div class="list-row__main">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="row-title t-mono break-all">{{ invite.email }}</span>
                  <app-role-badge [roleId]="roleIdOf(invite)"></app-role-badge>
                  <span [class]="invitationStatusClass(invite.status)" class="badge">
                    {{ invitationStatusLabel(invite.status) }}
                  </span>
                </div>
                <span class="row-hint">
                  @if (invite.display_name) { {{ invite.display_name }} · }
                  @if (invite.team_id) { {{ getTeamName(invite.team_id) }} · }
                  {{ invitationSubtext(invite) }}
                  @if (invite.invited_by_name) { · Invited by {{ invite.invited_by_name }} }
                </span>
              </div>

              @if (canWrite() && isOutstanding(invite)) {
                <div class="list-row__actions">
                  <button
                    (click)="copyInvitationLink(invite)"
                    title="Copy invitation link"
                    class="btn-secondary btn-sm"
                  >
                    <mat-icon class="icon-xs">content_copy</mat-icon>
                    {{ copiedInviteId() === invite.id ? 'Copied' : 'Copy link' }}
                  </button>
                  <button (click)="editInvitation(invite)" class="btn-ghost btn-sm">Edit</button>
                  <button (click)="resendInvitation(invite.id)" class="btn-ghost btn-sm">Resend</button>
                  @if (revokeConfirmId() === invite.id) {
                    <button (click)="executeRevoke(invite.id)" class="btn-danger btn-sm">Confirm revoke</button>
                    <button (click)="revokeConfirmId.set(null)" class="btn-ghost btn-sm">Cancel</button>
                  } @else {
                    <button (click)="revokeConfirmId.set(invite.id)" class="btn-ghost btn-sm">Revoke</button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Filter Bar -->
      <div class="toolbar">
        <label class="search-field">
          <mat-icon>search</mat-icon>
          <input [(ngModel)]="searchTerm" type="search" placeholder="Search by name or email…" aria-label="Search users" class="input-field" />
        </label>
        <select [(ngModel)]="selectedRole" class="input-field" aria-label="Filter by role">
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="salesperson">Sales</option>
          <option value="support">Support</option>
          <option value="viewer">Viewer</option>
        </select>
        <select [(ngModel)]="selectedTeam" class="input-field" aria-label="Filter by team">
          <option value="all">All teams</option>
          <option value="unassigned">Unassigned</option>
          @for (t of state.teams(); track t.id) {
            <option [value]="t.id">{{ t.name }}</option>
          }
        </select>
        <label for="label_6" class="inline-flex items-center gap-2 cursor-pointer select-none toolbar__spacer">
          <input id="label_6" type="checkbox" [(ngModel)]="showInactive" />
          <span class="text-xs text-ink-2">Show inactive accounts</span>
        </label>
      </div>

      <!-- Table / User List -->
      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th class="hidden lg:table-cell">Email</th>
              <th>Role</th>
              <th class="hidden md:table-cell">Team</th>
              <th class="hidden sm:table-cell">Status</th>
              <th class="col-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (user of paginatedUsers(); track user.id) {
              <!-- Standard row -->
              <tr>
                <!-- Avatar + Name -->
                <td>
                  <div class="flex items-center gap-3 min-w-0">
                    <a [routerLink]="['/settings/users', user.id]" class="shrink-0 hover:opacity-85 transition-opacity" tabindex="-1" aria-hidden="true">
                      <app-user-avatar [userId]="user.id" [size]="32"></app-user-avatar>
                    </a>
                    <div class="min-w-0">
                      <a [routerLink]="['/settings/users', user.id]" class="table-name-link cell-title block">
                        {{ user.displayName }}
                      </a>
                      <div class="cell-sub lg:hidden break-all">{{ user.email }}</div>
                      <div class="cell-sub hidden lg:block">{{ user.jobTitle || 'No title' }}</div>
                    </div>
                  </div>
                </td>

                <!-- Email -->
                <td class="hidden lg:table-cell whitespace-nowrap cell-muted t-mono">
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
                        <p class="field-error">{{ roleErrorMessage() }}</p>
                      }
                    </div>
                  } @else {
                    <app-role-badge [roleId]="user.roleId"></app-role-badge>
                  }
                </td>

                <!-- Team -->
                <td class="hidden md:table-cell whitespace-nowrap cell-muted">
                  {{ getTeamName(user.teamId) }}
                </td>

                <!-- Status -->
                <td class="hidden sm:table-cell whitespace-nowrap">
                  <span
                    [class]="user.isActive ? 'badge-success' : 'badge-neutral'"
                    class="badge"
                  >
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <!-- Actions Menu -->
                <td class="col-actions relative">
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
                        Edit details
                      </button>
                      <button
                        (click)="startRoleEdit(user.id)"
                        class="menu-item"
                      >
                        <mat-icon class="text-ink-4 icon-sm">swap_horiz</mat-icon>
                        Change role
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
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div class="flex items-center gap-2 text-sm text-ink">
                        <mat-icon class="text-danger icon-sm">warning</mat-icon>
                        <span>Deactivate {{ user.displayName }}? This cannot be undone.</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        @if (deactivateErrorMessage()) {
                          <span class="field-error">{{ deactivateErrorMessage() }}</span>
                        }
                        <button
                          (click)="cancelDeactivate()"
                          class="btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                        <button
                          (click)="executeDeactivate(user.id)"
                          class="btn-danger btn-sm"
                        >
                          Confirm deactivation
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <!-- Empty state row -->
              <tr>
                <td colspan="6" class="row-empty">
                  <app-empty-state icon="group_off" title="No users match your filters" text="Try adjusting your filters or search to locate the user.">
                    <button (click)="clearFilters()" class="btn-secondary btn-sm">Clear filters</button>
                  </app-empty-state>
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
    if (this.editingUser()) return 'Edit user details';
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
