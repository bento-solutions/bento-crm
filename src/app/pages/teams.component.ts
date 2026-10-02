import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CrmTeam, CrmUser } from '../services/crm-state.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { AvatarStackComponent } from '../shared/avatar-stack.component';
import { errorMessage } from '../shared/error-message.util';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { IDENTITY_PALETTE } from '../shared/ui/identity-color';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAvatarComponent, AvatarStackComponent, MatIconModule, PageHeaderComponent],
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
      <app-page-header size="section" title="Teams" subtitle="Group people into departments for assignments and reporting">
        @if (canCreate()) {
          <button actions (click)="toggleCreateForm()" class="btn-primary">
            <mat-icon>add</mat-icon>
            Create Team
          </button>
        }
      </app-page-header>

      <!-- Create Team Form (Inline) -->
      <div [class.open]="showCreateForm()" class="panel card">
        <div class="p-5 space-y-4">
          <h3 class="card-title">Create New Department Team</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Name -->
            <div>
              <label for="team_name" class="field-label mb-1.5">Team Name *</label>
              <input id="team_name"
                [(ngModel)]="newTeamName"
                type="text"
                placeholder="e.g. Casablanca Sales"
                class="input-field w-full"
              />
            </div>

            <!-- Department -->
            <div>
              <label for="department" class="field-label mb-1.5">Department</label>
              <select id="department"
                [(ngModel)]="newTeamDept"
                class="input-field w-full cursor-pointer font-semibold"
              >
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Support">Support</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <!-- Team Lead -->
            <div>
              <label for="team_lead" class="field-label mb-1.5">Team Lead *</label>
              <select id="team_lead"
                [(ngModel)]="newTeamLeadId"
                class="input-field w-full cursor-pointer font-semibold"
              >
                <option value="">-- Select a team lead --</option>
                @for (mgr of getAvailableLeads(); track mgr.id) {
                  <option [value]="mgr.id">{{ mgr.displayName }} ({{ mgr.jobTitle || 'Manager' }})</option>
                }
              </select>
            </div>

            <!-- Color Swatches -->
            <div>
              <label for="team_badge_accent_co" class="field-label mb-1.5">Team Badge Accent Color</label>
              <div class="flex items-center gap-3">
                @for (c of presetColors; track c) {
                  <button
                    type="button"
                    (click)="selectedColor.set(c)"
                    [style.background-color]="c"
                    [class.ring-2]="selectedColor() === c"
                    [attr.aria-label]="'Select color ' + c"
                    class="w-6 h-6 rounded-full cursor-pointer ring-offset-2 ring-ink-2 transition-all"
                  ></button>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="md:col-span-2">
              <label for="description_optional" class="field-label mb-1.5">Description (Optional)</label>
              <textarea id="description_optional"
                [(ngModel)]="newTeamDesc"
                rows="2"
                placeholder="Brief summary of the team responsibilities..."
                class="input-field w-full"
              ></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button
              (click)="closeCreateForm()"
              class="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              (click)="saveTeam()"
              [disabled]="!newTeamName.trim() || !newTeamLeadId"
              class="btn-primary btn-sm"
            >
              Create Team
            </button>
          </div>
        </div>
      </div>

      <!-- Team Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @for (team of state.teams(); track team.id) {
          <div class="card p-5 flex flex-col justify-between hover:shadow-md relative overflow-hidden">
            <!-- Colored accent border at top of card -->
            <div [style.background-color]="team.color" class="absolute top-0 left-0 right-0 h-1.5"></div>

            <div class="space-y-4">
              <!-- Top Row -->
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="card-title">{{ team.name }}</h3>
                  <span
                    [style.background-color]="team.color + '15'"
                    [style.color]="team.color"
                    class="inline-flex px-2 py-0.5 rounded-full text-meta font-semibold border border-transparent tracking-wide uppercase mt-1"
                  >
                    {{ team.department }}
                  </span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs font-semibold text-ink-3">
                    {{ team.memberUserIds.length }} member{{ team.memberUserIds.length === 1 ? '' : 's' }}
                  </span>
                  @if (canDelete()) {
                    <button
                      (click)="openDeleteModal(team)"
                      class="btn-icon btn-sm btn-danger-hover"
                      title="Delete Team"
                    >
                      <mat-icon class="icon-sm">delete</mat-icon>
                    </button>
                  }
                </div>
              </div>

              <!-- Description -->
              @if (team.description) {
                <p class="text-xs text-ink-3 leading-normal">{{ team.description }}</p>
              }

              <!-- Lead Row -->
              <div class="flex items-center gap-3 bg-subtle border border-line-soft rounded-xl p-3">
                <app-user-avatar [userId]="team.leadUserId" [size]="36"></app-user-avatar>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-ink flex items-center gap-1">
                    <span>{{ getLeadName(team.leadUserId) }}</span>
                    <mat-icon class="text-ink-2 icon-sm" title="Team Lead">star</mat-icon>
                  </div>
                  <span class="text-meta text-ink-3 block mt-0.5">Team Lead</span>
                </div>
              </div>

              <!-- Members Avatar Stack -->
              <div class="flex items-center justify-between pt-2 border-t border-line-soft">
                <app-avatar-stack [userIds]="team.memberUserIds" [size]="28" [maxVisible]="4"></app-avatar-stack>
                <button
                  (click)="toggleAccordion(team.id)"
                  class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{{ isExpanded(team.id) ? 'Hide' : 'View' }} members</span>
                  <mat-icon class="transition-transform duration-200 icon-md" [class.rotate-180]="isExpanded(team.id)">
                    expand_more
                  </mat-icon>
                </button>
              </div>
            </div>

            <!-- MEMBER ACCORDION -->
            <div [class.open]="isExpanded(team.id)" class="panel border-t border-line-soft mt-4 pt-4">
              <div class="space-y-4">
                <h4 class="eyebrow">Member List</h4>

                <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                  @for (userId of team.memberUserIds; track userId) {
                    @let user = getUser(userId);
                    @if (user) {
                      <div class="flex items-center justify-between p-2 hover:bg-subtle rounded-xl transition-colors">
                        <div class="flex items-center gap-2 min-w-0">
                          <app-user-avatar [userId]="user.id" [size]="28"></app-user-avatar>
                          <div class="min-w-0">
                            <span class="text-xs font-semibold text-ink truncate block">{{ user.displayName }}</span>
                            <span class="text-meta text-ink-3 block">{{ user.jobTitle || 'No title' }}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5">
                          @if (user.id === team.leadUserId) {
                            <mat-icon class="icon-sm text-warning" title="Team Lead">workspace_premium</mat-icon>
                            @if (canWrite()) {
                              <button
                                (click)="startTransferLead(team.id)"
                                class="text-meta text-ink hover:text-ink font-semibold hover:underline cursor-pointer"
                              >
                                Transfer Lead
                              </button>
                            }
                          } @else if (canWrite()) {
                            <button
                              (click)="removeMember(team.id, user.id)"
                              class="btn-icon btn-sm"
                              title="Remove member"
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
                  <div class="bg-muted border border-line rounded-xl p-3 space-y-2">
                    <label for="transfer_lead_to" class="field-label">Transfer Lead to:</label>
                    <div class="flex items-center gap-2">
                      <select
                        (change)="executeLeadTransfer(team.id, $event)"
                        class="input-field flex-1 font-semibold"
                      >
                        <option value="">-- Select member --</option>
                        @for (mid of team.memberUserIds; track mid) {
                          @if (mid !== team.leadUserId) {
                            <option [value]="mid">{{ getLeadName(mid) }}</option>
                          }
                        }
                      </select>
                      <button
                        (click)="cancelTransferLead()"
                        class="text-meta text-ink-3 hover:text-ink-2 font-semibold hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    @if (leadTransferError()) {
                      <p class="text-meta text-ink font-semibold mt-1">{{ leadTransferError() }}</p>
                    }
                  </div>
                }

                <!-- Remove member errors -->
                @if (memberErrorTeamId() === team.id) {
                  <div class="text-meta text-ink font-semibold bg-muted border border-line rounded-lg p-2 flex items-center gap-1.5 duration-200">
                    <mat-icon class="text-ink-2 icon-sm">error</mat-icon>
                    <span>{{ memberErrorMessage() }}</span>
                  </div>
                }

                <!-- Add member row -->
                @if (canWrite()) {
                <div class="pt-2 border-t border-line-soft">
                  <div class="relative">
                    <input
                      #searchBox
                      type="text"
                      placeholder="+ Add team member..."
                      (input)="searchUsersToAdd(team.id, searchBox.value)"
                      (focus)="searchUsersToAdd(team.id, searchBox.value)"
                      (blur)="clearSearchDelay()"
                      class="input-field w-full"
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
                </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Delete Team Confirmation Modal -->
    @if (deleteModalOpen() && teamToDelete()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="flex justify-between items-center">
            <h3 class="modal-title">Delete Team</h3>
            <button (click)="cancelDelete()" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-ink-2 leading-relaxed">
            Are you sure you want to delete this team? Members will be unassigned.
          </p>
          <div class="bg-subtle border border-line rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-ink">{{ teamToDelete()?.name }}</div>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
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
