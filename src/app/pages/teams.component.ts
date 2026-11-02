import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CrmTeam, CrmUser } from '../services/crm-state.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { AvatarStackComponent } from '../shared/avatar-stack.component';
import { errorMessage } from '../shared/error-message.util';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { IDENTITY_PALETTE } from '../shared/ui/identity-color';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAvatarComponent, AvatarStackComponent, MatIconModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header size="section" title="Teams" subtitle="Group people into departments for assignments and reporting">
        @if (canCreate()) {
          <button actions (click)="toggleCreateForm()" class="btn-primary">
            <mat-icon>add</mat-icon>
            New team
          </button>
        }
      </app-page-header>

      <!-- Create Team Form (Inline) -->
      @if (showCreateForm()) {
      <section class="card">
        <div class="card-header">
          <h3 class="card-title">New team</h3>
        </div>

        <div class="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="field">
            <span class="field-label">Team name *</span>
            <input [(ngModel)]="newTeamName" type="text" placeholder="e.g. Casablanca Sales" class="input-field" />
          </label>

          <label class="field">
            <span class="field-label">Department</span>
            <select [(ngModel)]="newTeamDept" class="input-field">
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Finance">Finance</option>
              <option value="Support">Support</option>
              <option value="Custom">Custom</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">Team lead *</span>
            <select [(ngModel)]="newTeamLeadId" class="input-field">
              <option value="">Select a team lead</option>
              @for (mgr of getAvailableLeads(); track mgr.id) {
                <option [value]="mgr.id">{{ mgr.displayName }} ({{ mgr.jobTitle || 'Manager' }})</option>
              }
            </select>
          </label>

          <div class="field">
            <span class="field-label">Team color</span>
            <div class="flex flex-wrap items-center gap-2 min-h-9" role="radiogroup" aria-label="Team color">
              @for (c of presetColors; track c) {
                <button
                  type="button"
                  role="radio"
                  (click)="selectedColor.set(c)"
                  [style.background-color]="c"
                  [class.ring-2]="selectedColor() === c"
                  [attr.aria-checked]="selectedColor() === c"
                  [attr.aria-label]="'Select color ' + c"
                  class="w-6 h-6 rounded-full cursor-pointer ring-offset-2 ring-ink-2 transition"
                ></button>
              }
            </div>
          </div>

          <label class="field md:col-span-2">
            <span class="field-label">Description (optional)</span>
            <textarea [(ngModel)]="newTeamDesc" rows="2" placeholder="Brief summary of the team responsibilities…" class="input-field"></textarea>
          </label>
        </div>

        <div class="card-footer">
          <button (click)="closeCreateForm()" class="btn-secondary">Cancel</button>
          <button (click)="saveTeam()" [disabled]="!newTeamName.trim() || !newTeamLeadId" class="btn-primary">Create team</button>
        </div>
      </section>
      }

      <!-- Team Cards Grid -->
      <div class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] items-start">
        @for (team of state.teams(); track team.id) {
          <section class="card">
            <div class="card-body space-y-4">
              <!-- Top Row -->
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="card-title">{{ team.name }}</h3>
                  <div class="flex items-center gap-1.5 mt-1 text-xs text-ink-3">
                    <span [style.background-color]="team.color" class="w-2 h-2 rounded-full shrink-0" aria-hidden="true"></span>
                    <span>{{ team.department }}</span>
                    <span aria-hidden="true">·</span>
                    <span class="num">{{ team.memberUserIds.length }} member{{ team.memberUserIds.length === 1 ? '' : 's' }}</span>
                  </div>
                </div>
                @if (canDelete()) {
                  <button
                    (click)="openDeleteModal(team)"
                    class="btn-icon btn-sm btn-danger-hover shrink-0"
                    title="Delete team"
                    [attr.aria-label]="'Delete ' + team.name"
                  >
                    <mat-icon class="icon-sm">delete</mat-icon>
                  </button>
                }
              </div>

              <!-- Description -->
              @if (team.description) {
                <p class="text-sm text-ink-2">{{ team.description }}</p>
              }

              <!-- Lead Row -->
              <div class="flex items-center gap-3">
                <app-user-avatar [userId]="team.leadUserId" [size]="32"></app-user-avatar>
                <div class="flex-1 min-w-0">
                  <span class="row-title truncate">{{ getLeadName(team.leadUserId) }}</span>
                  <span class="row-hint">Team lead</span>
                </div>
              </div>

              <!-- Members Avatar Stack -->
              <div class="flex items-center justify-between gap-2 pt-3 border-t border-line-soft">
                <app-avatar-stack [userIds]="team.memberUserIds" [size]="28" [maxVisible]="4"></app-avatar-stack>
                <button
                  (click)="toggleAccordion(team.id)"
                  class="btn-ghost btn-sm"
                  [attr.aria-expanded]="isExpanded(team.id)"
                >
                  <span>{{ isExpanded(team.id) ? 'Hide' : 'View' }} members</span>
                  <mat-icon class="icon-sm" [class.rotate-180]="isExpanded(team.id)">expand_more</mat-icon>
                </button>
              </div>

              <!-- MEMBER ACCORDION -->
              @if (isExpanded(team.id)) {
              <div class="space-y-3 pt-3 border-t border-line-soft">
                <h4 class="eyebrow">Member list</h4>

                <div class="space-y-1 max-h-48 overflow-y-auto">
                  @for (userId of team.memberUserIds; track userId) {
                    @let user = getUser(userId);
                    @if (user) {
                      <div class="flex items-center justify-between gap-2 py-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                          <app-user-avatar [userId]="user.id" [size]="28"></app-user-avatar>
                          <div class="min-w-0">
                            <span class="row-title truncate">{{ user.displayName }}</span>
                            <span class="row-hint truncate">{{ user.jobTitle || 'No title' }}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                          @if (user.id === team.leadUserId) {
                            @if (canWrite()) {
                              <button (click)="startTransferLead(team.id)" class="btn-ghost btn-sm">Transfer lead</button>
                            } @else {
                              <span class="badge badge-neutral">Lead</span>
                            }
                          } @else if (canWrite()) {
                            <button
                              (click)="removeMember(team.id, user.id)"
                              class="btn-icon btn-sm"
                              title="Remove member"
                              [attr.aria-label]="'Remove ' + user.displayName"
                            >
                              <mat-icon class="icon-sm">close</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>

                <!-- Inline lead transfer panel -->
                @if (transferLeadTeamId() === team.id) {
                  <div class="bg-subtle border border-line rounded-lg p-3 space-y-2">
                    <label class="field">
                      <span class="field-label">Transfer lead to</span>
                      <div class="flex items-center gap-2">
                        <select (change)="executeLeadTransfer(team.id, $event)" class="input-field flex-1">
                          <option value="">Select member</option>
                          @for (mid of team.memberUserIds; track mid) {
                            @if (mid !== team.leadUserId) {
                              <option [value]="mid">{{ getLeadName(mid) }}</option>
                            }
                          }
                        </select>
                        <button (click)="cancelTransferLead()" class="btn-ghost btn-sm">Cancel</button>
                      </div>
                    </label>
                    @if (leadTransferError()) {
                      <p class="field-error">{{ leadTransferError() }}</p>
                    }
                  </div>
                }

                <!-- Remove member errors -->
                @if (memberErrorTeamId() === team.id) {
                  <div class="alert alert-danger" role="alert">
                    <mat-icon>error</mat-icon>
                    <span>{{ memberErrorMessage() }}</span>
                  </div>
                }

                <!-- Add member row -->
                @if (canWrite()) {
                  <div class="relative">
                    <input
                      #searchBox
                      type="text"
                      placeholder="Add team member…"
                      aria-label="Add team member"
                      (input)="searchUsersToAdd(team.id, searchBox.value)"
                      (focus)="searchUsersToAdd(team.id, searchBox.value)"
                      (blur)="clearSearchDelay()"
                      class="input-field"
                    />

                    <!-- Add matches dropdown -->
                    @if (activeTeamSearchId() === team.id && searchMatches().length > 0) {
                      <div class="card absolute left-0 right-0 mt-1 z-10 overflow-hidden max-h-36 overflow-y-auto">
                        @for (match of searchMatches(); track match.id) {
                          <button
                            (click)="addMember(team.id, match.id)"
                            class="menu-item"
                          >
                            <app-user-avatar [userId]="match.id" [size]="20"></app-user-avatar>
                            <span>{{ match.displayName }}</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              }
            </div>
          </section>
        } @empty {
          <section class="card col-span-full">
            <app-empty-state icon="groups" title="No teams yet" text="Teams group people into departments for assignments and reporting." />
          </section>
        }
      </div>
    </div>

    <!-- Delete Team Confirmation Modal -->
    @if (deleteModalOpen() && teamToDelete()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title">Delete team</h3>
            <button (click)="cancelDelete()" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-ink-2">
            Are you sure you want to delete <span class="font-medium text-ink">{{ teamToDelete()?.name }}</span>? Members will be unassigned.
          </p>
          <div class="modal-footer">
            <button (click)="cancelDelete()" class="btn-secondary">
              Cancel
            </button>
            <button (click)="deleteConfirm()" class="btn-danger">
              <mat-icon class="icon-sm">delete</mat-icon>
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TeamsComponent {
  state = inject(CrmStateService);

  // Signals
  showCreateForm = signal<boolean>(false);
  selectedColor = signal<string>(IDENTITY_PALETTE[1]);

  newTeamName = '';
  newTeamDept: 'Sales' | 'Operations' | 'Finance' | 'Support' | 'Custom' = 'Sales';
  newTeamLeadId = '';
  newTeamDesc = '';

  expandedTeamIds = signal<Record<string, boolean>>({});
  transferLeadTeamId = signal<string | null>(null);
  leadTransferError = signal<string | null>(null);

  memberErrorTeamId = signal<string | null>(null);
  memberErrorMessage = signal<string | null>(null);

  activeTeamSearchId = signal<string | null>(null);
  searchMatches = signal<CrmUser[]>([]);

  presetColors = [...IDENTITY_PALETTE];

  // Filters leads
  getAvailableLeads(): CrmUser[] {
    // A lead must be a Manager or an Admin. A fresh organization only has its Admin, and
    // restricting leads to Managers meant it could not create its first team at all.
    return this.state.users().filter(u => u.isActive && (u.roleId === 'manager' || u.roleId === 'admin'));
  }

  canCreate(): boolean {
    return this.state.hasAuthority('TEAMS_CREATE');
  }

  canWrite(): boolean {
    return this.state.hasAuthority('TEAMS_WRITE');
  }

  canDelete(): boolean {
    return this.state.hasAuthority('TEAMS_DELETE');
  }

  // Delete confirmation
  deleteModalOpen = signal(false);
  teamToDelete = signal<CrmTeam | null>(null);

  openDeleteModal(team: CrmTeam) {
    if (!this.canDelete()) return;
    this.teamToDelete.set(team);
    this.deleteModalOpen.set(true);
  }

  cancelDelete() {
    this.deleteModalOpen.set(false);
    this.teamToDelete.set(null);
  }

  deleteConfirm() {
    if (!this.canDelete()) return;
    const team = this.teamToDelete();
    if (team) {
      this.state.deleteTeam(team.id);
    }
    this.deleteModalOpen.set(false);
    this.teamToDelete.set(null);
  }

  toggleCreateForm() {
    if (!this.canCreate()) return;
    this.showCreateForm.set(!this.showCreateForm());
    if (this.showCreateForm()) {
      this.newTeamName = '';
      this.newTeamLeadId = '';
      this.newTeamDesc = '';
      this.newTeamDept = 'Sales';
      this.selectedColor.set(IDENTITY_PALETTE[1]);
    }
  }

  closeCreateForm() {
    this.showCreateForm.set(false);
  }

  saveTeam() {
    if (!this.canCreate() || !this.newTeamName.trim() || !this.newTeamLeadId) return;

    this.state.addTeam({
      name: this.newTeamName,
      department: this.newTeamDept,
      description: this.newTeamDesc,
      leadUserId: this.newTeamLeadId,
      memberUserIds: [this.newTeamLeadId],
      color: this.selectedColor()
    });

    this.showCreateForm.set(false);
  }

  // Accordion details
  isExpanded(teamId: string): boolean {
    return !!this.expandedTeamIds()[teamId];
  }

  toggleAccordion(teamId: string) {
    this.expandedTeamIds.update(v => ({ ...v, [teamId]: !v[teamId] }));
    this.memberErrorTeamId.set(null);
    this.memberErrorMessage.set(null);
  }

  // Lead Transfer
  startTransferLead(teamId: string) {
    if (!this.canWrite()) return;
    this.transferLeadTeamId.set(teamId);
    this.leadTransferError.set(null);
  }

  executeLeadTransfer(teamId: string, event: Event) {
    if (!this.canWrite()) return;
    const selectedUserId = (event.target as HTMLSelectElement).value;
    if (!selectedUserId) return;

    try {
      this.state.updateTeam(teamId, { leadUserId: selectedUserId });
      this.cancelTransferLead();
    } catch (err: unknown) {
      this.leadTransferError.set(errorMessage(err, 'Lead transfer failed.'));
    }
  }

  cancelTransferLead() {
    this.transferLeadTeamId.set(null);
    this.leadTransferError.set(null);
  }

  // Member Management
  removeMember(teamId: string, userId: string) {
    if (!this.canWrite()) return;
    try {
      this.state.removeTeamMember(teamId, userId);
      this.memberErrorTeamId.set(null);
      this.memberErrorMessage.set(null);
    } catch (err: unknown) {
      this.memberErrorTeamId.set(teamId);
      this.memberErrorMessage.set(errorMessage(err, 'Failed to remove member.'));
    }
  }

  // Add Member search
  searchUsersToAdd(teamId: string, query: string) {
    this.activeTeamSearchId.set(teamId);
    const cleaned = query.toLowerCase().trim();
    if (!cleaned) {
      this.searchMatches.set([]);
      return;
    }

    const team = this.state.teams().find(t => t.id === teamId);
    if (!team) return;

    // Users not in this team who are active
    const candidates = this.state.users().filter(u => 
      u.isActive && 
      !team.memberUserIds.includes(u.id) &&
      u.displayName.toLowerCase().includes(cleaned)
    );

    this.searchMatches.set(candidates);
  }

  clearSearchDelay() {
    // Timeout to allow clicking the dropdown item before it disappears
    setTimeout(() => {
      this.activeTeamSearchId.set(null);
      this.searchMatches.set([]);
    }, 200);
  }

  addMember(teamId: string, userId: string) {
    if (!this.canWrite()) return;
    this.state.addTeamMember(teamId, userId);
    this.activeTeamSearchId.set(null);
    this.searchMatches.set([]);
  }

  // Helpers
  getLeadName(userId: string): string {
    return this.state.users().find(u => u.id === userId)?.displayName || 'Unknown';
  }

  getUser(userId: string): CrmUser | undefined {
    return this.state.users().find(u => u.id === userId);
  }
}
