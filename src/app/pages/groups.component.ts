import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CrmGroup, GroupMessage, GroupMeeting, CrmUser } from '../services/crm-state.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { AvatarStackComponent } from '../shared/avatar-stack.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-groups',
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
    .chat-bubble-other {
      background-color: #f1f5f9;
      border: 0.5px solid #e2e8f0;
      color: #0f172a;
    }
    .chat-bubble-me {
      background-color: #2563EB;
      color: #ffffff;
    }
  `],
  template: `
    <div class="font-sans flex flex-col md:flex-row card rounded-2xl overflow-hidden h-[calc(100vh-10rem)]">
      
      <!-- LEFT PANEL: Group list -->
      <aside class="w-full md:w-[300px] border-r border-zinc-200 flex flex-col h-full shrink-0">
        <!-- Panel Header -->
        <div class="p-4 border-b border-white/30 flex items-center justify-between">
          <h2 class="text-sm font-bold text-zinc-800 uppercase tracking-wide">Collaboration Groups</h2>
          @if (canCreateGroup()) {
            <button
              (click)="toggleCreateGroupForm()"
              class="text-blue-700 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center"
              title="Create Group"
            >
              <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">add_circle</mat-icon>
            </button>
          }
        </div>

        <!-- Inline Create Group Form -->
        <div [class.open]="showCreateForm()" class="panel bg-white border border-zinc-200 border-b border-white/30">
          <div class="p-4 space-y-3">
            <h3 class="font-bold text-zinc-700 text-xs">Create Group</h3>
            
            <input
              [(ngModel)]="newGroupName"
              placeholder="Group name (e.g. Finance Sync)"
              class="w-full input-field rounded-xl px-2.5 py-1.5 text-xs focus:outline-blue-600 text-zinc-850"
            />
            
            <textarea
              [(ngModel)]="newGroupDesc"
              placeholder="Description (Optional)"
              rows="2"
              class="w-full input-field rounded-xl px-2.5 py-1.5 text-xs focus:outline-blue-600 text-zinc-850"
            ></textarea>

            <!-- Search members -->
            <div class="relative">
              <input
                #searchBox
                type="text"
                placeholder="Search active users..."
                (input)="searchUsers(searchBox.value)"
                (focus)="searchUsers(searchBox.value)"
                (blur)="clearSearchDelay()"
                class="w-full input-field rounded-xl px-2.5 py-1.5 text-xs focus:outline-blue-600 text-zinc-850"
              />
              @if (userSearchMatches().length > 0) {
                <div class="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-36 overflow-y-auto">
                  @for (match of userSearchMatches(); track match.id) {
                    <button
                      (click)="addMemberChip(match)"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors text-xs font-semibold text-zinc-700 cursor-pointer"
                    >
                      <app-user-avatar [userId]="match.id" [size]="20"></app-user-avatar>
                      <span>{{ match.displayName }}</span>
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Chips -->
            <div class="flex flex-wrap gap-1.5 pt-1">
              @for (chip of selectedMemberChips(); track chip.id) {
                <span class="inline-flex items-center gap-1 bg-zinc-100 text-zinc-950 font-semibold px-2 py-0.5 rounded-lg text-meta uppercase tracking-wide">
                  {{ chip.displayName.split(' ')[0] }}
                  <button (click)="removeMemberChip(chip.id)" title="Remove" class="text-zinc-500 hover:text-zinc-950 select-none">×</button>
                </span>
              }
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
              <button
                (click)="closeCreateGroupForm()"
                class="px-2.5 py-1 border border-zinc-200 text-zinc-500 text-meta font-bold rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                (click)="saveGroup()"
                [disabled]="!newGroupName.trim() || selectedMemberChips().length === 0"
                class="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-meta font-bold rounded-lg shadow-xs transition-colors cursor-pointer font-sans"
              >
                Create
              </button>
            </div>
          </div>
        </div>

        <!-- Groups scroll list -->
        <div class="flex-1 overflow-y-auto divide-y divide-slate-100">
          @for (grp of state.groups(); track grp.id) {
            @let lastMsg = getGroupLastMessage(grp.id);
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
            <div
              (click)="selectGroup(grp.id)"
              [class.bg-zinc-50]="selectedGroupId() === grp.id"
              [class.border-l-4]="selectedGroupId() === grp.id"
              [style.border-left-color]="selectedGroupId() === grp.id ? '#3B82F6' : 'transparent'"
              class="p-4 cursor-pointer hover:bg-zinc-50/50 transition-colors flex items-start justify-between gap-2"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <h4 class="text-xs font-bold text-zinc-800 truncate">{{ grp.name }}</h4>
                <p class="text-meta text-zinc-400 truncate leading-relaxed">
                  {{ lastMsg ? lastMsg.content : 'No messages yet' }}
                </p>
                @if (lastMsg) {
                  <span class="text-meta text-zinc-400 font-mono block">
                    {{ getRelativeTime(lastMsg.sentAt) }}
                  </span>
                }
              </div>

              <!-- Unread badge -->
              @let unreadCount = getUnreadCount(grp.id);
              @if (unreadCount > 0) {
                <span class="bg-zinc-700 text-white rounded-full text-meta font-bold px-1.5 py-0.5 leading-none shrink-0">
                  {{ unreadCount }}
                </span>
              }
            </div>
          } @empty {
            <div class="p-8 text-center text-zinc-400 text-xs italic">No groups. Click "+" to start.</div>
          }
        </div>
      </aside>

      <!-- RIGHT PANEL: Group workspace -->
      <main class="flex-1 flex flex-col h-full min-w-0 bg-zinc-50/50">
        @if (selectedGroup(); as grp) {
          <!-- Header -->
          <div class="p-4 card border-b border-white/30 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-zinc-900">{{ grp.name }}</h2>
              <p class="text-meta text-zinc-400 font-medium mt-0.5">{{ grp.memberUserIds.length }} members in sync</p>
            </div>

            <div class="flex items-center gap-2">
              @if (canWriteGroup()) {
                <button
                  (click)="toggleEditGroupForm(grp)"
                  class="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center"
                  title="Edit Group"
                >
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">edit</mat-icon>
                </button>
              }
              @if (canDeleteGroup()) {
                <button
                  (click)="openDeleteGroupModal(grp)"
                  class="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center"
                  title="Delete Group"
                >
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">delete</mat-icon>
                </button>
              }
              <div class="flex items-center gap-1 bg-white border border-zinc-200 p-0.5 rounded-lg">
                <button
                  (click)="activeTab.set('chat')"
                  [class.bg-white]="activeTab() === 'chat'"
                  [class.text-blue-700]="activeTab() === 'chat'"
                  [class.shadow-xs]="activeTab() === 'chat'"
                  class="px-3 py-1 rounded-md text-meta font-bold text-zinc-650 cursor-pointer transition-all"
                >
                  Chat
                </button>
                <button
                  (click)="activeTab.set('meetings')"
                  [class.bg-white]="activeTab() === 'meetings'"
                  [class.text-blue-700]="activeTab() === 'meetings'"
                  [class.shadow-xs]="activeTab() === 'meetings'"
                  class="px-3 py-1 rounded-md text-meta font-bold text-zinc-650 cursor-pointer transition-all"
                >
                  Meetings
                </button>
              </div>
            </div>
          </div>

          <!-- Inline Edit Group Form -->
          <div [class.open]="showEditGroupForm()" class="panel bg-white border-b border-white/30">
            <div class="p-4 space-y-3">
              <h3 class="font-bold text-zinc-700 text-xs">Edit Group</h3>
              <input
                [(ngModel)]="editGroupName"
                placeholder="Group name"
                class="w-full input-field rounded-xl px-2.5 py-1.5 text-xs focus:outline-blue-600 text-zinc-850"
              />
              <textarea
                [(ngModel)]="editGroupDesc"
                placeholder="Description (Optional)"
                rows="2"
                class="w-full input-field rounded-xl px-2.5 py-1.5 text-xs focus:outline-blue-600 text-zinc-850"
              ></textarea>
              <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
                <button
                  (click)="closeEditGroupForm()"
                  class="px-2.5 py-1 border border-zinc-200 text-zinc-500 text-meta font-bold rounded-lg hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  (click)="saveGroupEdit(grp)"
                  [disabled]="!editGroupName.trim()"
                  class="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-meta font-bold rounded-lg shadow-xs transition-colors cursor-pointer font-sans"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <!-- TAB CONTENT: Chat -->
          @if (activeTab() === 'chat') {
            <div class="flex-1 flex flex-col min-h-0">
              <!-- Scrollable thread -->
              <div
                #messageThread
                id="message-thread"
                class="flex-1 overflow-y-auto p-4 space-y-4"
              >
                @for (msg of getGroupMessages(grp.id); track msg.id) {
                  @let isMe = msg.senderUserId === state.currentUserId();
                  <div
                    class="flex flex-col max-w-[70%]"
                    [class.ml-auto]="isMe"
                    [class.items-end]="isMe"
                    [class.items-start]="!isMe"
                  >
                    <!-- Username / Avatar -->
                    <div class="flex items-center gap-1.5 mb-1 text-meta text-zinc-500 font-semibold">
                      @if (!isMe) {
                        <app-user-avatar [userId]="msg.senderUserId" [size]="20"></app-user-avatar>
                        <span>{{ getSenderName(msg.senderUserId) }}</span>
                      } @else {
                        <span>You</span>
                      }
                    </div>

                    <!-- Message Bubble -->
                    <div
                      [class]="isMe ? 'chat-bubble-me' : 'chat-bubble-other'"
                      class="px-3 py-2 rounded-2xl text-xs shadow-2xs font-sans break-words whitespace-pre-wrap leading-relaxed"
                      [class.rounded-tr-none]="isMe"
                      [class.rounded-tl-none]="!isMe"
                    >
                      {{ msg.content }}
                    </div>

                    <!-- Timestamp -->
                    <span class="text-meta text-zinc-400 font-mono mt-1">
                      {{ msg.sentAt | date: 'HH:mm' }}
                    </span>
                  </div>
                }
              </div>

              <!-- Input row -->
              @if (canWriteGroup()) {
                <div class="p-4 card border-t border-white/30 flex gap-2 shrink-0">
                  <input
                    [(ngModel)]="chatInputValue"
                    (keydown.enter)="sendMessage(grp.id)"
                    type="text"
                    placeholder="Type your message..."
                    class="flex-1 input-field rounded-xl px-4 py-2 text-xs focus:outline-blue-700"
                  />
                  <button
                    (click)="sendMessage(grp.id)"
                    [disabled]="!chatInputValue.trim()"
                    class="bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer font-sans"
                  >
                    Send
                  </button>
                </div>
              }
            </div>
          }

          <!-- TAB CONTENT: Meetings -->
          @if (activeTab() === 'meetings') {
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Meetings ({{ getMeetingsList(grp.id).length }})</h3>
                @if (canWriteGroup()) {
                  <button
                    (click)="toggleScheduleForm()"
                    class="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 border border-zinc-200/50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer flex items-center gap-1"
                  >
                    <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">event</mat-icon>
                    Schedule Meeting
                  </button>
                }
              </div>

              <!-- Inline Schedule form -->
              @if (canWriteGroup()) {
              <div [class.open]="showScheduleForm()" class="panel card rounded-2xl shadow-3xs">
                <div class="p-5 space-y-3">
                  <h4 class="font-bold text-zinc-800 text-xs">Schedule New Meeting</h4>
                  
                  <div class="space-y-3">
                    <div>
                      <label for="title" class="block text-meta font-bold text-zinc-400 uppercase mb-1">Title *</label>
                      <input id="title"
                        [(ngModel)]="meetTitle"
                        placeholder="e.g. Post-Mortem Briefing"
                        class="w-full input-field rounded-xl px-3 py-1.5 text-xs focus:outline-blue-600 text-zinc-800"
                      />
                    </div>

                    <div>
                      <label for="date_time" class="block text-meta font-bold text-zinc-400 uppercase mb-1">Date & Time *</label>
                      <input id="date_time"
                        [(ngModel)]="meetDateStr"
                        type="datetime-local"
                        class="w-full input-field rounded-xl px-3 py-1.5 text-xs focus:outline-blue-600 text-zinc-800 font-mono"
                      />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label for="duration_minutes" class="block text-meta font-bold text-zinc-400 uppercase mb-1">Duration (minutes)</label>
                        <select id="duration_minutes"
                          [(ngModel)]="meetDuration"
                          class="w-full input-field rounded-xl px-3 py-1.5 text-xs focus:outline-blue-600 text-zinc-700 font-semibold cursor-pointer"
                        >
                          <option value="30">30 min</option>
                          <option value="60">60 min</option>
                          <option value="90">90 min</option>
                          <option value="120">120 min</option>
                        </select>
                      </div>

                      <div>
                        <label for="description" class="block text-meta font-bold text-zinc-400 uppercase mb-1">Description</label>
                        <input id="description"
                          [(ngModel)]="meetDesc"
                          placeholder="Agenda details..."
                          class="w-full input-field rounded-xl px-3 py-1.5 text-xs focus:outline-blue-600 text-zinc-800"
                        />
                      </div>
                    </div>

                    <!-- Attendees checkboxes with avatars -->
                    <div>
                      <label for="group_attendees" class="block text-meta font-bold text-zinc-400 uppercase mb-2">Group Attendees</label>
                      <div class="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-zinc-100 rounded-xl p-3 bg-zinc-50/20">
                        @for (uid of grp.memberUserIds; track uid) {
                          <label for="label_5" class="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-zinc-50/80 select-none">
                            <input id="label_5"
                              type="checkbox"
                              [checked]="meetAttendeeIds().includes(uid)"
                              (change)="toggleMeetingAttendee(uid)"
                              class="rounded border-zinc-350 text-blue-700 h-4.5 w-4.5"
                            />
                            <app-user-avatar [userId]="uid" [size]="24"></app-user-avatar>
                            <span class="text-meta font-semibold text-zinc-750 truncate">{{ getSenderName(uid) }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 pt-2 border-t border-zinc-150">
                    <button
                      (click)="closeScheduleForm()"
                      class="px-3 py-1.5 border border-zinc-200 text-zinc-500 text-meta font-bold rounded-lg hover:bg-zinc-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      (click)="saveMeeting(grp.id)"
                      [disabled]="!meetTitle.trim() || !meetDateStr || meetAttendeeIds().length === 0"
                      class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-meta font-bold rounded-lg shadow-xs transition-colors cursor-pointer font-sans"
                    >
                      Schedule Meeting
                    </button>
                  </div>
                </div>
              </div>
              }

              <!-- Meetings Cards -->
              <div class="space-y-4">
                @for (meet of getMeetingsList(grp.id); track meet.id) {
                  <div class="card rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <h4 class="text-xs font-bold text-zinc-900 block font-sans">{{ meet.title }}</h4>
                        @if (meet.description) {
                          <p class="text-meta text-zinc-400 mt-1 leading-normal">{{ meet.description }}</p>
                        }
                      </div>
                      
                      <span
                        [class]="getMeetingStatusClass(meet.status)"
                        class="inline-flex px-2 py-0.5 rounded-full text-meta font-bold border uppercase tracking-wider"
                      >
                        {{ meet.status }}
                      </span>
                    </div>

                    <!-- Details -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-meta font-semibold text-zinc-500 border-t border-white/30 pt-3">
                      <div class="space-y-1">
                        <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block">Time</span>
                        <div class="flex items-center gap-1 text-zinc-700">
                          <mat-icon class="text-[12px] w-3 h-3 flex items-center justify-center">schedule</mat-icon>
                          <span>{{ meet.scheduledAt | date: 'dd MMM, HH:mm' }} ({{ meet.durationMinutes }} min)</span>
                        </div>
                      </div>

                      <div class="space-y-1">
                        <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block">Organizer</span>
                        <div class="flex items-center gap-1.5 text-zinc-700">
                          <app-user-avatar [userId]="meet.organizerUserId" [size]="20"></app-user-avatar>
                          <span>{{ getSenderName(meet.organizerUserId) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Attendee Stack -->
                    <div class="flex items-center justify-between border-t border-white/30 pt-3">
                      <span class="text-meta text-zinc-400 font-bold uppercase tracking-wider">Attendees</span>
                      <app-avatar-stack [userIds]="meet.attendeeUserIds" [size]="24" [maxVisible]="3"></app-avatar-stack>
                    </div>
                  </div>
                } @empty {
                  <div class="p-8 text-center text-zinc-405 text-xs italic card rounded-2xl">
                    No scheduled meetings. Schedule one to align with group members.
                  </div>
                }
              </div>
            </div>
          }
        } @else {
          <!-- Empty select group state -->
          <div class="flex-1 flex flex-col items-center justify-center p-16 text-center space-y-4">
            <div class="w-16 h-16 bg-white text-zinc-400 rounded-2xl flex items-center justify-center shadow-3xs border border-zinc-100">
              <mat-icon style="font-size:32px;width:32px;height:32px" class="text-zinc-700">forum</mat-icon>
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 font-sans">Select a Group</h3>
              <p class="text-xs text-zinc-500 max-w-xs mx-auto mt-1 font-sans">
                Select one of your departments or cross-team sync groups from the left sidebar to access chat threads and schedule team events.
              </p>
            </div>
          </div>
        }
      </main>
    </div>

    <!-- Delete Group Confirmation Modal -->
    @if (deleteGroupModalOpen() && groupToDelete()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-zinc-950">Delete Group</h3>
            <button (click)="cancelDeleteGroup()" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-zinc-600 leading-relaxed">
            Are you sure you want to delete this group? Its chat history and meetings will be removed.
          </p>
          <div class="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-zinc-900">{{ groupToDelete()?.name }}</div>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
            <button (click)="cancelDeleteGroup()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="confirmDeleteGroup()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
              <mat-icon class="w-4 h-4 text-[16px]! leading-none!">delete</mat-icon>
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class GroupsComponent implements AfterViewChecked {
  state = inject(CrmStateService);
  private route = inject(ActivatedRoute);

  selectedGroupId = signal<string | null>(null);
  activeTab = signal<'chat' | 'meetings'>('chat');

  // Chat signals
  chatInputValue = '';
  @ViewChild('messageThread') messageThreadEl!: ElementRef<HTMLDivElement>;

  // Schedule signals
  showSchedule = signal<boolean>(false);
  meetTitle = '';
  meetDateStr = '';
  meetDuration = 60;
  meetDesc = '';
  meetAttendeeIds = signal<string[]>([]);

  // Create group signals
  showCreateGroup = signal<boolean>(false);
  newGroupName = '';
  newGroupDesc = '';
  selectedMemberChips = signal<CrmUser[]>([]);
  userSearchMatches = signal<CrmUser[]>([]);

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['groupId']) {
        this.selectGroup(params['groupId']);
      } else {
        // Auto-select first group for visual richness on landing
        const first = this.state.groups()[0];
        if (first) {
          this.selectGroup(first.id);
        }
      }
    });
  }

  canCreateGroup(): boolean {
    return this.state.hasAuthority('GROUPS_CREATE');
  }

  canWriteGroup(): boolean {
    return this.state.hasAuthority('GROUPS_WRITE');
  }

  canDeleteGroup(): boolean {
    return this.state.hasAuthority('GROUPS_DELETE');
  }

  // Edit group
  showEditGroupForm = signal(false);
  editGroupName = '';
  editGroupDesc = '';

  toggleEditGroupForm(group: CrmGroup) {
    if (!this.canWriteGroup()) return;
    this.editGroupName = group.name;
    this.editGroupDesc = group.description || '';
    this.showEditGroupForm.set(!this.showEditGroupForm());
  }

  closeEditGroupForm() {
    this.showEditGroupForm.set(false);
  }

  saveGroupEdit(group: CrmGroup) {
    if (!this.canWriteGroup() || !this.editGroupName.trim()) return;
    this.state.updateGroup(group.id, { name: this.editGroupName.trim(), description: this.editGroupDesc.trim() });
    this.showEditGroupForm.set(false);
  }

  // Delete group
  deleteGroupModalOpen = signal(false);
  groupToDelete = signal<CrmGroup | null>(null);

  openDeleteGroupModal(group: CrmGroup) {
    if (!this.canDeleteGroup()) return;
    this.groupToDelete.set(group);
    this.deleteGroupModalOpen.set(true);
  }

  cancelDeleteGroup() {
    this.deleteGroupModalOpen.set(false);
    this.groupToDelete.set(null);
  }

  confirmDeleteGroup() {
    if (!this.canDeleteGroup()) return;
    const group = this.groupToDelete();
    if (group) {
      if (this.selectedGroupId() === group.id) this.selectedGroupId.set(null);
      this.state.deleteGroup(group.id);
    }
    this.deleteGroupModalOpen.set(false);
    this.groupToDelete.set(null);
  }

  ngAfterViewChecked() {
    this.scrollChatToBottom();
  }

  selectGroup(groupId: string) {
    this.selectedGroupId.set(groupId);
    this.markMessagesAsRead(groupId);
    this.closeScheduleForm();
    this.activeTab.set('chat');
    setTimeout(() => this.scrollChatToBottom(true), 50);
  }

  markMessagesAsRead(groupId: string) {
    const meId = this.state.currentUserId();
    this.state.groupMessages.update(list => list.map(m => {
      if (m.groupId === groupId && !m.readByUserIds.includes(meId)) {
        return { ...m, readByUserIds: [...m.readByUserIds, meId] };
      }
      return m;
    }));
  }

  selectedGroup = computed(() => {
    const id = this.selectedGroupId();
    if (!id) return null;
    return this.state.groups().find(g => g.id === id) || null;
  });

  // Group Details
  getGroupMessages(groupId: string): GroupMessage[] {
    return this.state.groupMessages().filter(m => m.groupId === groupId);
  }

  getGroupLastMessage(groupId: string): GroupMessage | undefined {
    const msgs = this.getGroupMessages(groupId);
    return msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
  }

  getMeetingsList(groupId: string): GroupMeeting[] {
    return this.state.groupMeetings()
      .filter(m => m.groupId === groupId)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  getUnreadCount(groupId: string): number {
    const meId = this.state.currentUserId();
    return this.state.groupMessages().filter(m => 
      m.groupId === groupId && !m.readByUserIds.includes(meId)
    ).length;
  }

  // Chat actions
  sendMessage(groupId: string) {
    if (!this.canWriteGroup() || !this.chatInputValue.trim()) return;

    this.state.sendGroupMessage(groupId, this.state.currentUserId(), this.chatInputValue.trim());
    this.chatInputValue = '';
    setTimeout(() => this.scrollChatToBottom(true), 50);
  }

  scrollChatToBottom(force = false) {
    if (this.messageThreadEl) {
      const el = this.messageThreadEl.nativeElement;
      // Scroll if forced or already close to bottom
      if (force || (el.scrollHeight - el.scrollTop - el.clientHeight < 150)) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }

  // Schedule meeting actions
  toggleScheduleForm() {
    if (!this.canWriteGroup()) return;
    this.showSchedule.set(!this.showSchedule());
    if (this.showSchedule()) {
      this.meetTitle = '';
      this.meetDateStr = '';
      this.meetDuration = 60;
      this.meetDesc = '';
      // Default attendees to everyone in group except current user
      const grp = this.selectedGroup();
      if (grp) {
        this.meetAttendeeIds.set(grp.memberUserIds);
      }
    }
  }

  closeScheduleForm() {
    this.showSchedule.set(false);
  }

  showScheduleForm(): boolean {
    return this.showSchedule();
  }

  toggleMeetingAttendee(userId: string) {
    this.meetAttendeeIds.update(list => {
      if (list.includes(userId)) {
        return list.filter(id => id !== userId);
      } else {
        return [...list, userId];
      }
    });
  }

  saveMeeting(groupId: string) {
    if (!this.canWriteGroup() || !this.meetTitle.trim() || !this.meetDateStr) return;

    this.state.scheduleMeeting({
      groupId,
      title: this.meetTitle.trim(),
      description: this.meetDesc.trim() || undefined,
      scheduledAt: new Date(this.meetDateStr),
      durationMinutes: Number(this.meetDuration),
      organizerUserId: this.state.currentUserId(),
      attendeeUserIds: this.meetAttendeeIds()
    });

    this.closeScheduleForm();
  }

  // Create group actions
  toggleCreateGroupForm() {
    if (!this.canCreateGroup()) return;
    this.showCreateGroup.set(!this.showCreateGroup());
    if (this.showCreateGroup()) {
      this.newGroupName = '';
      this.newGroupDesc = '';
      this.selectedMemberChips.set([]);
      this.userSearchMatches.set([]);
    }
  }

  closeCreateGroupForm() {
    this.showCreateGroup.set(false);
  }

  showCreateForm(): boolean {
    return this.showCreateGroup();
  }

  searchUsers(query: string) {
    const cleaned = query.toLowerCase().trim();
    if (!cleaned) {
      this.userSearchMatches.set([]);
      return;
    }
    const currentChips = this.selectedMemberChips().map(c => c.id);
    const candidates = this.state.users().filter(u => 
      u.isActive && 
      u.id !== this.state.currentUserId() &&
      !currentChips.includes(u.id) &&
      u.displayName.toLowerCase().includes(cleaned)
    );
    this.userSearchMatches.set(candidates);
  }

  clearSearchDelay() {
    setTimeout(() => {
      this.userSearchMatches.set([]);
    }, 200);
  }

  addMemberChip(user: CrmUser) {
    this.selectedMemberChips.update(chips => [...chips, user]);
    this.userSearchMatches.set([]);
  }

  removeMemberChip(userId: string) {
    this.selectedMemberChips.update(chips => chips.filter(c => c.id !== userId));
  }

  saveGroup() {
    if (!this.canCreateGroup() || !this.newGroupName.trim()) return;

    const meId = this.state.currentUserId();
    const members = Array.from(new Set([
      meId, 
      ...this.selectedMemberChips().map(c => c.id)
    ]));

    const grp = this.state.createGroup({
      name: this.newGroupName.trim(),
      description: this.newGroupDesc.trim() || undefined,
      createdByUserId: meId,
      memberUserIds: members
    });

    this.showCreateGroup.set(false);
    this.selectGroup(grp.id);
  }

  // Helpers
  getSenderName(userId: string): string {
    return this.state.users().find(u => u.id === userId)?.displayName || 'Unknown';
  }

  getMeetingStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-200';
      case 'scheduled':
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  }

  getRelativeTime(date: Date): string {
    const diffMs = new Date().getTime() - new Date(date).getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    
    if (diffHrs < 1) {
      const mins = Math.floor(diffMs / 60000);
      return mins <= 1 ? 'just now' : `${mins}m ago`;
    }
    if (diffHrs < 24) {
      return `${diffHrs}h ago`;
    }
    const days = Math.floor(diffHrs / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
  }
}
