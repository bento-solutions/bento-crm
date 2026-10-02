import { Component, computed, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CrmGroup, GroupMessage, GroupMeeting, CrmUser } from '../services/crm-state.service';
import { ApiService } from '../services/api.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { AvatarStackComponent } from '../shared/avatar-stack.component';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../shared/ui/page-header.component';

@Component({
  selector: 'app-groups',
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
    .chat-bubble-other {
      background-color: var(--color-surface-hover);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
    }
    .chat-bubble-me {
      background-color: var(--color-primary);
      color: var(--color-on-primary);
    }
  `],
  template: `
    <div class="page">
    <app-page-header title="Groups" subtitle="Team chat, meetings and shared files" />

    <div class="flex flex-col md:flex-row card overflow-hidden h-[calc(100vh-14rem)] min-h-[420px]">
      
      <!-- LEFT PANEL: Group list -->
      <aside class="w-full md:w-[300px] border-r border-line flex flex-col h-full shrink-0">
        <!-- Panel Header -->
        <div class="p-4 border-b border-line-soft flex items-center justify-between">
          <h2 class="eyebrow">Collaboration Groups</h2>
          @if (canCreateGroup()) {
            <button
              (click)="toggleCreateGroupForm()"
              class="text-accent-ink hover:bg-muted p-1.5 rounded-lg transition-colors cursor-pointer flex items-center"
              title="Create Group"
            >
              <mat-icon class="icon-md">add_circle</mat-icon>
            </button>
          }
        </div>

        <!-- Inline Create Group Form -->
        <div [class.open]="showCreateForm()" class="panel bg-surface border border-line border-b border-line-soft">
          <div class="p-4 space-y-3">
            <h3 class="card-title">Create Group</h3>
            
            <input
              [(ngModel)]="newGroupName"
              placeholder="Group name (e.g. Finance Sync)"
              class="input-field w-full"
            />
            
            <textarea
              [(ngModel)]="newGroupDesc"
              placeholder="Description (Optional)"
              rows="2"
              class="input-field w-full"
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
                class="input-field w-full"
              />
              @if (userSearchMatches().length > 0) {
                <div class="card absolute left-0 right-0 mt-1 z-20 overflow-hidden max-h-36 overflow-y-auto">
                  @for (match of userSearchMatches(); track match.id) {
                    <button
                      (click)="addMemberChip(match)"
                      class="menu-item"
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
                <span class="badge badge-neutral">
                  {{ chip.displayName.split(' ')[0] }}
                  <button (click)="removeMemberChip(chip.id)" title="Remove" class="btn-icon btn-sm">×</button>
                </span>
              }
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
              <button
                (click)="closeCreateGroupForm()"
                class="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                (click)="saveGroup()"
                [disabled]="!newGroupName.trim() || selectedMemberChips().length === 0"
                class="btn-primary btn-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>

        <!-- Groups scroll list -->
        <div class="flex-1 overflow-y-auto divide-y divide-line-soft">
          @for (grp of state.groups(); track grp.id) {
            @let lastMsg = getGroupLastMessage(grp.id);
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
            <div
              (click)="selectGroup(grp.id)"
              [class.bg-subtle]="selectedGroupId() === grp.id"
              [class.border-l-4]="selectedGroupId() === grp.id"
              [style.border-left-color]="selectedGroupId() === grp.id ? 'var(--color-primary)' : 'transparent'"
              class="p-4 cursor-pointer hover:bg-subtle transition-colors flex items-start justify-between gap-2"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <h4 class="card-title truncate">{{ grp.name }}</h4>
                <p class="text-meta text-ink-3 truncate leading-relaxed">
                  {{ lastMsg ? lastMsg.content : 'No messages yet' }}
                </p>
                @if (lastMsg) {
                  <span class="text-meta text-ink-3 font-mono block">
                    {{ getRelativeTime(lastMsg.sentAt) }}
                  </span>
                }
              </div>

              <!-- Unread badge -->
              @let unreadCount = getUnreadCount(grp.id);
              @if (unreadCount > 0) {
                <span class="badge shrink-0 bg-ink-2">
                  {{ unreadCount }}
                </span>
              }
            </div>
          } @empty {
            <div class="p-8 text-center text-ink-3 text-xs italic">No groups. Click "+" to start.</div>
          }
        </div>
      </aside>

      <!-- RIGHT PANEL: Group workspace -->
      <main class="flex-1 flex flex-col h-full min-w-0 bg-subtle">
        @if (selectedGroup(); as grp) {
          <!-- Header -->
          <div class="p-4 card flex items-center justify-between">
            <div>
              <h2 class="card-title">{{ grp.name }}</h2>
              <p class="text-meta text-ink-3 font-medium mt-0.5">{{ grp.memberUserIds.length }} members in sync</p>
            </div>

            <div class="flex items-center gap-2">
              @if (canWriteGroup()) {
                <button
                  (click)="toggleEditGroupForm(grp)"
                  class="text-ink-3 hover:text-ink hover:bg-muted p-1.5 rounded-lg transition-colors cursor-pointer flex items-center"
                  title="Edit Group"
                >
                  <mat-icon class="icon-md">edit</mat-icon>
                </button>
              }
              @if (canDeleteGroup()) {
                <button
                  (click)="openDeleteGroupModal(grp)"
                  class="text-ink-3 hover:text-danger-ink hover:bg-danger-soft p-1.5 rounded-lg transition-colors cursor-pointer flex items-center"
                  title="Delete Group"
                >
                  <mat-icon class="icon-md">delete</mat-icon>
                </button>
              }
              <div class="flex items-center gap-1 bg-surface border border-line p-0.5 rounded-lg">
                <button
                  (click)="activeTab.set('chat')"
                  [class.bg-surface]="activeTab() === 'chat'"
                  [class.text-accent-ink]="activeTab() === 'chat'"
                  [class.shadow-xs]="activeTab() === 'chat'"
                  class="px-3 py-1 rounded-md text-meta font-semibold text-ink-2 cursor-pointer transition-all"
                >
                  Chat
                </button>
                <button
                  (click)="activeTab.set('meetings')"
                  [class.bg-surface]="activeTab() === 'meetings'"
                  [class.text-accent-ink]="activeTab() === 'meetings'"
                  [class.shadow-xs]="activeTab() === 'meetings'"
                  class="px-3 py-1 rounded-md text-meta font-semibold text-ink-2 cursor-pointer transition-all"
                >
                  Meetings
                </button>
              </div>
            </div>
          </div>

          <!-- Inline Edit Group Form -->
          <div [class.open]="showEditGroupForm()" class="panel bg-surface border-b border-line-soft">
            <div class="p-4 space-y-3">
              <h3 class="card-title">Edit Group</h3>
              <input
                [(ngModel)]="editGroupName"
                placeholder="Group name"
                class="input-field w-full"
              />
              <textarea
                [(ngModel)]="editGroupDesc"
                placeholder="Description (Optional)"
                rows="2"
                class="input-field w-full"
              ></textarea>
              <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
                <button
                  (click)="closeEditGroupForm()"
                  class="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  (click)="saveGroupEdit(grp)"
                  [disabled]="!editGroupName.trim()"
                  class="btn-primary btn-sm"
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
                    <div class="flex items-center gap-1.5 mb-1 text-meta text-ink-3 font-semibold">
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
                      class="px-3 py-2 rounded-2xl text-xs shadow-2xs break-words whitespace-pre-wrap leading-relaxed"
                      [class.rounded-tr-none]="isMe"
                      [class.rounded-tl-none]="!isMe"
                    >
                      {{ msg.content }}
                    </div>

                    <!-- Timestamp -->
                    <span class="text-meta text-ink-3 font-mono mt-1">
                      {{ msg.sentAt | date: 'HH:mm' }}
                    </span>
                  </div>
                }
              </div>

              <!-- Input row -->
              @if (canWriteGroup()) {
                <div class="p-4 card flex gap-2 shrink-0">
                  <input
                    [(ngModel)]="chatInputValue"
                    (keydown.enter)="sendMessage(grp.id)"
                    type="text"
                    placeholder="Type your message..."
                    class="input-field flex-1"
                  />
                  <button
                    (click)="sendMessage(grp.id)"
                    [disabled]="!chatInputValue.trim()"
                    class="btn-primary btn-sm"
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
                <h3 class="eyebrow">Meetings ({{ getMeetingsList(grp.id).length }})</h3>
                @if (canWriteGroup()) {
                  <button
                    (click)="toggleScheduleForm()"
                    class="bg-muted hover:bg-muted-strong text-ink border border-line px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <mat-icon class="icon-sm">event</mat-icon>
                    Schedule Meeting
                  </button>
                }
              </div>

              <!-- Inline Schedule form -->
              @if (canWriteGroup()) {
              <div [class.open]="showScheduleForm()" class="panel card">
                <div class="p-5 space-y-3">
                  <h4 class="card-title">Schedule New Meeting</h4>
                  
                  <div class="space-y-3">
                    <div>
                      <label for="title" class="field-label mb-1.5">Title *</label>
                      <input id="title"
                        [(ngModel)]="meetTitle"
                        placeholder="e.g. Post-Mortem Briefing"
                        class="input-field w-full"
                      />
                    </div>

                    <div>
                      <label for="date_time" class="field-label mb-1.5">Date & Time *</label>
                      <input id="date_time"
                        [(ngModel)]="meetDateStr"
                        type="datetime-local"
                        class="input-field w-full font-mono"
                      />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label for="duration_minutes" class="field-label mb-1.5">Duration (minutes)</label>
                        <select id="duration_minutes"
                          [(ngModel)]="meetDuration"
                          class="input-field w-full cursor-pointer font-semibold"
                        >
                          <option value="30">30 min</option>
                          <option value="60">60 min</option>
                          <option value="90">90 min</option>
                          <option value="120">120 min</option>
                        </select>
                      </div>

                      <div>
                        <label for="description" class="field-label mb-1.5">Description</label>
                        <input id="description"
                          [(ngModel)]="meetDesc"
                          placeholder="Agenda details..."
                          class="input-field w-full"
                        />
                      </div>
                    </div>

                    <!-- Attendees checkboxes with avatars -->
                    <div>
                      <label for="group_attendees" class="field-label mb-1.5">Group Attendees</label>
                      <div class="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-line-soft rounded-xl p-3 bg-subtle">
                        @for (uid of grp.memberUserIds; track uid) {
                          <label for="label_5" class="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-subtle select-none">
                            <input id="label_5"
                              type="checkbox"
                              [checked]="meetAttendeeIds().includes(uid)"
                              (change)="toggleMeetingAttendee(uid)"
                              class="text-accent-ink"
                            />
                            <app-user-avatar [userId]="uid" [size]="24"></app-user-avatar>
                            <span class="text-meta font-semibold text-ink-2 truncate">{{ getSenderName(uid) }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
                    <button
                      (click)="closeScheduleForm()"
                      class="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      (click)="saveMeeting(grp.id)"
                      [disabled]="!meetTitle.trim() || !meetDateStr || meetAttendeeIds().length === 0"
                      class="btn-primary btn-sm"
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
                  <div class="card p-5 flex flex-col justify-between gap-4">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <h4 class="card-title">{{ meet.title }}</h4>
                        @if (meet.description) {
                          <p class="text-meta text-ink-3 mt-1 leading-normal">{{ meet.description }}</p>
                        }
                      </div>
                      
                      <span
                        [class]="getMeetingStatusClass(meet.status)"
                        class="badge"
                      >
                        {{ meet.status }}
                      </span>
                    </div>

                    <!-- Details -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-meta font-semibold text-ink-3 border-t border-line-soft pt-3">
                      <div class="space-y-1">
                        <span class="eyebrow block">Time</span>
                        <div class="flex items-center gap-1 text-ink-2">
                          <mat-icon class="icon-xs">schedule</mat-icon>
                          <span>{{ meet.scheduledAt | date: 'dd MMM, HH:mm' }} ({{ meet.durationMinutes }} min)</span>
                        </div>
                      </div>

                      <div class="space-y-1">
                        <span class="eyebrow block">Organizer</span>
                        <div class="flex items-center gap-1.5 text-ink-2">
                          <app-user-avatar [userId]="meet.organizerUserId" [size]="20"></app-user-avatar>
                          <span>{{ getSenderName(meet.organizerUserId) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Attendee Stack -->
                    <div class="flex items-center justify-between border-t border-line-soft pt-3">
                      <span class="eyebrow">Attendees</span>
                      <app-avatar-stack [userIds]="meet.attendeeUserIds" [size]="24" [maxVisible]="3"></app-avatar-stack>
                    </div>
                  </div>
                } @empty {
                  <div class="p-8 text-center text-ink-3 text-xs italic card">
                    No scheduled meetings. Schedule one to align with group members.
                  </div>
                }
              </div>
            </div>
          }
        } @else {
          <!-- Empty select group state -->
          <div class="flex-1 flex flex-col items-center justify-center p-16 text-center space-y-4">
            <div class="card w-16 h-16 text-ink-3 flex items-center justify-center">
              <mat-icon class="text-ink-2">forum</mat-icon>
            </div>
            <div>
              <h3 class="card-title">Select a Group</h3>
              <p class="text-xs text-ink-3 max-w-xs mx-auto mt-1">
                Select one of your departments or cross-team sync groups from the left sidebar to access chat threads and schedule team events.
              </p>
            </div>
          </div>
        }
      </main>
    </div>

    <!-- Delete Group Confirmation Modal -->
    @if (deleteGroupModalOpen() && groupToDelete()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="flex justify-between items-center">
            <h3 class="modal-title">Delete Group</h3>
            <button (click)="cancelDeleteGroup()" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-ink-2 leading-relaxed">
            Are you sure you want to delete this group? Its chat history and meetings will be removed.
          </p>
          <div class="bg-subtle border border-line rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-ink">{{ groupToDelete()?.name }}</div>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button (click)="cancelDeleteGroup()" class="btn-secondary">
              Cancel
            </button>
            <button (click)="confirmDeleteGroup()" class="btn-danger">
              <mat-icon class="icon-sm">delete</mat-icon>
              Delete
            </button>
          </div>
        </div>
      </div>
    }
    </div>
  `
})
export class GroupsComponent implements AfterViewChecked, OnDestroy {
  state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private eventSource: EventSource | null = null;

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

  ngOnDestroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  selectGroup(groupId: string) {
    this.selectedGroupId.set(groupId);
    this.markMessagesAsRead(groupId);
    this.closeScheduleForm();
    this.activeTab.set('chat');
    this.loadGroupMessages(groupId);
    this.connectGroupStream(groupId);
    setTimeout(() => this.scrollChatToBottom(true), 50);
  }

  private loadGroupMessages(groupId: string): void {
    this.api.getGroupMessages(groupId).subscribe({
      next: (messages: any[]) => {
        const mapped: GroupMessage[] = messages.map(raw => ({
          id: String(raw.id),
          groupId: String(raw.groupId),
          senderUserId: String(raw.authorUserId || raw.senderUserId),
          content: raw.content,
          sentAt: raw.createdAt ? new Date(raw.createdAt) : (raw.sentAt ? new Date(raw.sentAt) : new Date()),
          readByUserIds: (raw.readByUserIds || []).map((u: any) => String(u))
        }));
        this.state.groupMessages.update(list => {
          const otherGroups = list.filter(m => m.groupId !== groupId);
          return [...otherGroups, ...mapped];
        });
        setTimeout(() => this.scrollChatToBottom(true), 50);
      },
      error: () => console.error('Failed to load group messages')
    });
  }

  private connectGroupStream(groupId: string): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const streamUrl = this.api.getGroupStreamUrl(groupId) + (token ? `?token=${encodeURIComponent(token)}` : '');

    try {
      this.eventSource = new EventSource(streamUrl, { withCredentials: true });
      this.eventSource.addEventListener('message', (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data);
          if (!raw || !raw.id) return;
          const incoming: GroupMessage = {
            id: String(raw.id),
            groupId: String(raw.groupId),
            senderUserId: String(raw.authorUserId || raw.senderUserId),
            content: raw.content,
            sentAt: raw.createdAt ? new Date(raw.createdAt) : (raw.sentAt ? new Date(raw.sentAt) : new Date()),
            readByUserIds: (raw.readByUserIds || []).map((u: any) => String(u))
          };
          this.state.groupMessages.update(list => {
            if (list.some(m => m.id === incoming.id)) {
              return list;
            }
            return [...list, incoming];
          });
          if (this.selectedGroupId() === groupId) {
            setTimeout(() => this.scrollChatToBottom(true), 50);
          }
        } catch (e) {
          console.error('Failed to parse SSE message', e);
        }
      });
      this.eventSource.onerror = (err) => {
        console.debug('Group stream connection error, will reconnect', err);
      };
    } catch (e) {
      console.error('Failed to initialize EventSource', e);
    }
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
      case 'completed': return 'badge-success';
      case 'cancelled': return 'badge-danger';
      case 'scheduled':
      default:
        return 'badge-info';
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
