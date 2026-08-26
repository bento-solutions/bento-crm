import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CrmTeam, CrmUser } from '../services/crm-state.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { AvatarStackComponent } from '../shared/avatar-stack.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAvatarComponent, AvatarStackComponent, MatIconModule],
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
      @if (canCreate()) {
      <div class="flex justify-end">
        <button
          (click)="toggleCreateForm()"
          class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-base w-4 h-4 flex items-center justify-center">add</mat-icon>
          Create Team
        </button>
      </div>
      }

      <!-- Create Team Form (Inline) -->
      <div [class.open]="showCreateForm()" class="panel bg-zinc-50 border border-zinc-200/80 rounded-2xl p-0 shadow-xs">
        <div class="p-6 space-y-4">
          <h3 class="font-bold text-zinc-800 text-sm">Create New Department Team</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Name -->
            <div>
              <label for="team_name" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Team Name *</label>
              <input id="team_name"
                [(ngModel)]="newTeamName"
                type="text"
                placeholder="e.g. Casablanca Sales"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-800"
              />
            </div>

            <!-- Department -->
            <div>
              <label for="department" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Department</label>
              <select id="department"
                [(ngModel)]="newTeamDept"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-700 font-semibold cursor-pointer"
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
              <label for="team_lead" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Team Lead *</label>
              <select id="team_lead"
                [(ngModel)]="newTeamLeadId"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-700 font-semibold cursor-pointer"
              >
                <option value="">-- Select a Manager --</option>
                @for (mgr of getAvailableLeads(); track mgr.id) {
                  <option [value]="mgr.id">{{ mgr.displayName }} ({{ mgr.jobTitle || 'Manager' }})</option>
                }
              </select>
            </div>

            <!-- Color Swatches -->
            <div>
              <label for="team_badge_accent_co" class="block text-xs font-semibold text-zinc-500 uppercase mb-2">Team Badge Accent Color</label>
              <div class="flex items-center gap-3">
                @for (c of presetColors; track c) {
                  <button
                    type="button"
                    (click)="selectedColor.set(c)"
                    [style.background-color]="c"
                    [class.ring-2]="selectedColor() === c"
                    [attr.aria-label]="'Select color ' + c"
                    class="w-6 h-6 rounded-full cursor-pointer ring-offset-2 ring-zinc-900 transition-all"
                  ></button>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="md:col-span-2">
              <label for="description_optional" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Description (Optional)</label>
              <textarea id="description_optional"
                [(ngModel)]="newTeamDesc"
                rows="2"
                placeholder="Brief summary of the team responsibilities..."
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 text-zinc-800"
              ></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              (click)="closeCreateForm()"
              class="px-4 py-2 border border-zinc-200 text-zinc-600 text-xs font-semibold rounded-xl hover:bg-zinc-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              (click)="saveTeam()"
              [disabled]="!newTeamName.trim() || !newTeamLeadId"
              class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer font-sans"
            >
              Create Team
            </button>
          </div>
        </div>
      </div>

      <!-- Team Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @for (team of state.teams(); track team.id) {
          <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
            <!-- Colored accent border at top of card -->
            <div [style.background-color]="team.color" class="absolute top-0 left-0 right-0 h-1.5"></div>

            <div class="space-y-4">
              <!-- Top Row -->
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-base font-bold text-zinc-900 block font-sans">{{ team.name }}</h3>
                  <span
                    [style.background-color]="team.color + '15'"
                    [style.color]="team.color"
                    class="inline-flex px-2 py-0.5 rounded-full text-meta font-bold border border-transparent tracking-wide uppercase mt-1"
                  >
                    {{ team.department }}
                  </span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs font-bold text-zinc-400 font-sans">
                    {{ team.memberUserIds.length }} member{{ team.memberUserIds.length === 1 ? '' : 's' }}
                  </span>
                  @if (canDelete()) {
                    <button
                      (click)="openDeleteModal(team)"
                      class="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors"
                      title="Delete Team"
                    >
                      <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">delete</mat-icon>
                    </button>
                  }
                </div>
              </div>

              <!-- Description -->
              @if (team.description) {
                <p class="text-xs text-zinc-500 leading-normal">{{ team.description }}</p>
              }

              <!-- Lead Row -->
              <div class="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                <app-user-avatar [userId]="team.leadUserId" [size]="36"></app-user-avatar>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold text-zinc-800 flex items-center gap-1">
                    <span>{{ getLeadName(team.leadUserId) }}</span>
                    <mat-icon class="text-zinc-700 text-xs w-4 h-4 flex items-center justify-center" title="Team Lead">star</mat-icon>
                  </div>
                  <span class="text-meta text-zinc-400 block mt-0.5">Team Lead</span>
                </div>
              </div>

              <!-- Members Avatar Stack -->
              <div class="flex items-center justify-between pt-2 border-t border-zinc-100">
                <app-avatar-stack [userIds]="team.memberUserIds" [size]="28" [maxVisible]="4"></app-avatar-stack>
                <button
                  (click)="toggleAccordion(team.id)"
                  class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{{ isExpanded(team.id) ? 'Hide' : 'View' }} members</span>
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center transition-transform duration-200" [class.rotate-180]="isExpanded(team.id)">
                    expand_more
                  </mat-icon>
                </button>
              </div>
            </div>

            <!-- MEMBER ACCORDION -->
            <div [class.open]="isExpanded(team.id)" class="panel border-t border-zinc-100 mt-4 pt-4">
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-wide">Member List</h4>

                <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                  @for (userId of team.memberUserIds; track userId) {
                    @let user = getUser(userId);
                    @if (user) {
                      <div class="flex items-center justify-between p-2 hover:bg-zinc-50/80 rounded-xl transition-colors">
                        <div class="flex items-center gap-2 min-w-0">
                          <app-user-avatar [userId]="user.id" [size]="28"></app-user-avatar>
                          <div class="min-w-0">
                            <span class="text-xs font-bold text-zinc-800 truncate block">{{ user.displayName }}</span>
                            <span class="text-meta text-zinc-400 block">{{ user.jobTitle || 'No title' }}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5">
                          @if (user.id === team.leadUserId) {
                            <i class="ti ti-crown text-zinc-700 text-base leading-none" title="Team Lead"></i>
                            @if (canWrite()) {
                              <button
                                (click)="startTransferLead(team.id)"
                                class="text-meta text-zinc-900 hover:text-zinc-950 font-bold hover:underline cursor-pointer"
                              >
                                Transfer Lead
                              </button>
                            }
                          } @else if (canWrite()) {
                            <button
                              (click)="removeMember(team.id, user.id)"
                              class="text-zinc-400 hover:text-zinc-900 p-1 rounded transition-colors cursor-pointer"
                              title="Remove member"
                            >
                              <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">close</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>

                <!-- Inline lead transfer panel -->
                @if (transferLeadTeamId() === team.id) {
                  <div class="bg-zinc-100/50 border border-zinc-200 rounded-xl p-3 space-y-2">
                    <label for="transfer_lead_to" class="block text-meta font-bold text-zinc-950 uppercase">Transfer Lead to:</label>
                    <div class="flex items-center gap-2">
                      <select
                        (change)="executeLeadTransfer(team.id, $event)"
                        class="border border-zinc-200 rounded-lg px-2 py-1 text-xs bg-white text-zinc-700 focus:outline-blue-600 focus:ring-1 focus:ring-zinc-700 font-semibold flex-1"
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
                        class="text-meta text-zinc-500 hover:text-zinc-700 font-bold hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    @if (leadTransferError()) {
                      <p class="text-meta text-zinc-900 font-semibold mt-1">{{ leadTransferError() }}</p>
                    }
                  </div>
                }

                <!-- Remove member errors -->
                @if (memberErrorTeamId() === team.id) {
                  <div class="text-meta text-zinc-900 font-semibold bg-zinc-100 border border-zinc-200 rounded-lg p-2 flex items-center gap-1.5 animate-in fade-in duration-200">
                    <mat-icon class="text-zinc-700 text-xs w-4 h-4 flex items-center justify-center">error</mat-icon>
                    <span>{{ memberErrorMessage() }}</span>
                  </div>
                }

                <!-- Add member row -->
                @if (canWrite()) {
                <div class="pt-2 border-t border-zinc-100/50">
                  <div class="relative">
                    <input
                      #searchBox
                      type="text"
                      placeholder="+ Add team member..."
                      (input)="searchUsersToAdd(team.id, searchBox.value)"
                      (focus)="searchUsersToAdd(team.id, searchBox.value)"
                      (blur)="clearSearchDelay()"
                      class="w-full border border-zinc-200 rounded-xl px-3 py-1.5 text-xs bg-zinc-50 focus:bg-white focus:outline-blue-600 text-zinc-800"
                    />

                    <!-- Add matches dropdown -->
                    @if (activeTeamSearchId() === team.id && searchMatches().length > 0) {
                      <div class="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-36 overflow-y-auto">
                        @for (match of searchMatches(); track match.id) {
                          <button
                            (click)="addMember(team.id, match.id)"
                            class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors text-xs font-semibold text-zinc-700 cursor-pointer"
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
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-zinc-950">Delete Team</h3>
            <button (click)="cancelDelete()" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-zinc-600 leading-relaxed">
            Are you sure you want to delete this team? Members will be unassigned.
          </p>
          <div class="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-zinc-900">{{ teamToDelete()?.name }}</div>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
            <button (click)="cancelDelete()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="deleteConfirm()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
              <mat-icon class="w-4 h-4 text-[16px]! leading-none!">delete</mat-icon>
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
  selectedColor = signal<string>('#1D9E75');

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

  presetColors = [
    '#1D9E75', // Teal
    '#378ADD', // Blue
    '#BA7517', // Amber
    '#D4537E', // Pink
    '#7F77DD', // Purple
    '#D85A30'  // Coral
  ];

  // Filters leads
  getAvailableLeads(): CrmUser[] {
    // Lead must have manager role
    return this.state.users().filter(u => u.isActive && u.roleId === 'manager');
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
      this.selectedColor.set('#1D9E75');
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
      this.leadTransferError.set(err.message || 'Lead transfer failed.');
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
      this.memberErrorMessage.set(err.message || 'Failed to remove member.');
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
