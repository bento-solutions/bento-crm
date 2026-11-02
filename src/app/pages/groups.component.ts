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
import { EmptyStateComponent } from '../shared/ui/empty-state.component';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAvatarComponent, AvatarStackComponent, MatIconModule, PageHeaderComponent, EmptyStateComponent],
  styles: [`
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
    <app-page-header [size]="embedded ? 'section' : 'page'" title="Groups" subtitle="Team chat, meetings and shared files">
      @if (canCreateGroup()) {
        <button actions (click)="toggleCreateGroupForm()" class="btn-primary">
          <mat-icon>add</mat-icon>
          New group
        </button>
      }
    </app-page-header>

    <div class="flex card overflow-hidden h-[calc(100dvh-14rem)] min-h-[480px]">

      <!-- LEFT PANEL: Group list. On phones the list and the open group take turns on screen. -->
      <aside
        class="w-full lg:w-72 lg:border-e border-line flex-col shrink-0 min-h-0 lg:flex"
        [class.flex]="!phoneShowsGroup()"
        [class.hidden]="phoneShowsGroup()"
      >
        <div class="card-header">
          <h2 class="card-title">Collaboration groups</h2>
          <span class="count-pill">{{ state.groups().length }}</span>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <!-- Inline Create Group Form -->
          @if (showCreateForm()) {
          <div class="p-4 space-y-3 border-b border-line">
            <h3 class="card-title">New group</h3>

            <input
              [(ngModel)]="newGroupName"
              placeholder="Group name (e.g. Finance sync)"
              aria-label="Group name"
              class="input-field"
            />

            <textarea
              [(ngModel)]="newGroupDesc"
              placeholder="Description (optional)"
              aria-label="Description"
              rows="2"
              class="input-field"
            ></textarea>

            <!-- Search members -->
            <div class="relative">
              <input
                #searchBox
                type="text"
                placeholder="Search active users…"
                aria-label="Search active users"
                (input)="searchUsers(searchBox.value)"
                (focus)="searchUsers(searchBox.value)"
                (blur)="clearSearchDelay()"
                class="input-field"
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
            @if (selectedMemberChips().length > 0) {
              <div class="flex flex-wrap gap-1.5">
                @for (chip of selectedMemberChips(); track chip.id) {
                  <span class="chip">
                    {{ chip.displayName.split(' ')[0] }}
                    <button type="button" (click)="removeMemberChip(chip.id)" class="inline-flex items-center text-ink-3 hover:text-ink" [attr.aria-label]="'Remove ' + chip.displayName">
                      <mat-icon class="icon-xs">close</mat-icon>
                    </button>
                  </span>
                }
              </div>
            }

            <div class="flex justify-end gap-2">
              <button (click)="closeCreateGroupForm()" class="btn-secondary btn-sm">Cancel</button>
              <button
                (click)="saveGroup()"
                [disabled]="!newGroupName.trim() || selectedMemberChips().length === 0"
                class="btn-primary btn-sm"
              >
                Create
              </button>
            </div>
          </div>
          }

          <!-- Groups scroll list -->
          @for (grp of state.groups(); track grp.id) {
            @let lastMsg = getGroupLastMessage(grp.id);
            <button
              type="button"
              (click)="openGroup(grp.id)"
              [class.bg-accent-soft]="selectedGroupId() === grp.id"
              [attr.aria-current]="selectedGroupId() === grp.id ? 'true' : null"
              class="w-full text-start px-4 py-3 border-b border-line-soft cursor-pointer hover:bg-muted transition-colors flex items-start justify-between gap-2"
            >
              <span class="min-w-0 flex-1">
                <span class="row-title truncate">{{ grp.name }}</span>
                <span class="row-hint truncate">{{ lastMsg ? lastMsg.content : 'No messages yet' }}</span>
                @if (lastMsg) {
                  <span class="block text-meta text-ink-3 font-mono mt-0.5">{{ getRelativeTime(lastMsg.sentAt) }}</span>
                }
              </span>

              <!-- Unread badge -->
              @let unreadCount = getUnreadCount(grp.id);
              @if (unreadCount > 0) {
                <span class="badge badge-accent num">{{ unreadCount }}</span>
              }
            </button>
          } @empty {
            <app-empty-state icon="forum" title="No groups yet" [text]="canCreateGroup() ? 'Create one to start a shared chat.' : 'You have not been added to a group.'" />
          }
        </div>
      </aside>

      <!-- RIGHT PANEL: Group workspace -->
      <section
        class="flex-1 flex-col min-h-0 min-w-0 bg-subtle lg:flex"
        [class.flex]="phoneShowsGroup()"
        [class.hidden]="!phoneShowsGroup()"
      >
        @if (selectedGroup(); as grp) {
          <!-- Header -->
          <div class="px-4 py-3 bg-surface border-b border-line flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div class="flex items-center gap-2 min-w-0">
              <button type="button" class="btn-icon btn-sm lg:hidden shrink-0" (click)="closeGroupOnPhone()" aria-label="Back to groups">
                <mat-icon class="icon-sm rtl:rotate-180">arrow_back</mat-icon>
              </button>
              <div class="min-w-0">
                <h2 class="card-title truncate">{{ grp.name }}</h2>
                @if (grp.memberUserIds.length > 0) {
                  <p class="row-hint num">{{ grp.memberUserIds.length }} member{{ grp.memberUserIds.length === 1 ? '' : 's' }}</p>
                }
              </div>
            </div>

            <div class="flex items-center gap-1 ms-auto">
              @if (canWriteGroup()) {
                <button (click)="toggleEditGroupForm(grp)" class="btn-icon btn-sm" title="Edit group" aria-label="Edit group">
                  <mat-icon class="icon-sm">edit</mat-icon>
                </button>
              }
              @if (canDeleteGroup()) {
                <button (click)="openDeleteGroupModal(grp)" class="btn-icon btn-sm btn-danger-hover" title="Delete group" aria-label="Delete group">
                  <mat-icon class="icon-sm">delete</mat-icon>
                </button>
              }
              <div class="segmented ms-1" role="group" aria-label="Group sections">
                <button (click)="activeTab.set('chat')" [class.is-active]="activeTab() === 'chat'" class="segmented__item">Chat</button>
                <button (click)="activeTab.set('meetings')" [class.is-active]="activeTab() === 'meetings'" class="segmented__item">Meetings</button>
              </div>
            </div>
          </div>

          <!-- Inline Edit Group Form -->
          @if (showEditGroupForm()) {
          <div class="p-4 space-y-3 bg-surface border-b border-line">
            <h3 class="card-title">Edit group</h3>
            <input [(ngModel)]="editGroupName" placeholder="Group name" aria-label="Group name" class="input-field" />
            <textarea [(ngModel)]="editGroupDesc" placeholder="Description (optional)" aria-label="Description" rows="2" class="input-field"></textarea>
            <div class="flex justify-end gap-2">
              <button (click)="closeEditGroupForm()" class="btn-secondary btn-sm">Cancel</button>
              <button (click)="saveGroupEdit(grp)" [disabled]="!editGroupName.trim()" class="btn-primary btn-sm">Save</button>
            </div>
          </div>
          }

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
                    class="flex flex-col max-w-[85%] md:max-w-[70%]"
                    [class.ml-auto]="isMe"
                    [class.items-end]="isMe"
                    [class.items-start]="!isMe"
                  >
                    <!-- Username / Avatar -->
                    <div class="flex items-center gap-1.5 mb-1 text-xs text-ink-3">
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
                      class="px-3 py-2 rounded-xl text-sm break-words whitespace-pre-wrap"
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
                <div class="p-3 bg-surface border-t border-line flex gap-2 shrink-0">
                  <input
                    [(ngModel)]="chatInputValue"
                    (keydown.enter)="sendMessage(grp.id)"
                    type="text"
                    placeholder="Type your message…"
                    aria-label="Message"
                    class="input-field flex-1"
                  />
                  <button
                    (click)="sendMessage(grp.id)"
                    [disabled]="!chatInputValue.trim()"
                    class="btn-primary"
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
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="card-title">Meetings <span class="count-pill ms-1">{{ getMeetingsList(grp.id).length }}</span></h3>
                @if (canWriteGroup()) {
                  <button (click)="toggleScheduleForm()" class="btn-secondary btn-sm">
                    <mat-icon class="icon-sm">event</mat-icon>
                    Schedule meeting
                  </button>
                }
              </div>

              <!-- Inline Schedule form -->
              @if (canWriteGroup() && showScheduleForm()) {
              <section class="card">
                <div class="card-header">
                  <h4 class="card-title">New meeting</h4>
                </div>
                <div class="card-body space-y-3">
                  <label class="field">
                    <span class="field-label">Title *</span>
                    <input [(ngModel)]="meetTitle" placeholder="e.g. Post-mortem briefing" class="input-field" />
                  </label>

                  <label class="field">
                    <span class="field-label">Date and time *</span>
                    <input [(ngModel)]="meetDateStr" type="datetime-local" class="input-field num" />
                  </label>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label class="field">
                      <span class="field-label">Duration</span>
                      <select [(ngModel)]="meetDuration" class="input-field">
                        <option value="30">30 min</option>
                        <option value="60">60 min</option>
                        <option value="90">90 min</option>
                        <option value="120">120 min</option>
                      </select>
                    </label>

                    <label class="field">
                      <span class="field-label">Description</span>
                      <input [(ngModel)]="meetDesc" placeholder="Agenda details…" class="input-field" />
                    </label>
                  </div>

                  <!-- Attendees checkboxes with avatars -->
                  <fieldset class="field">
                    <legend class="field-label mb-1.5">Attendees</legend>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-36 overflow-y-auto border border-line rounded-lg p-2">
                      @for (uid of grp.memberUserIds; track uid) {
                        <label class="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-muted select-none">
                          <input
                            type="checkbox"
                            [checked]="meetAttendeeIds().includes(uid)"
                            (change)="toggleMeetingAttendee(uid)"
                          />
                          <app-user-avatar [userId]="uid" [size]="24"></app-user-avatar>
                          <span class="text-sm text-ink-2 truncate">{{ getSenderName(uid) }}</span>
                        </label>
                      }
                    </div>
                  </fieldset>
                </div>

                <div class="card-footer">
                  <button (click)="closeScheduleForm()" class="btn-secondary">Cancel</button>
                  <button
                    (click)="saveMeeting(grp.id)"
                    [disabled]="!meetTitle.trim() || !meetDateStr || meetAttendeeIds().length === 0"
                    class="btn-primary"
                  >
                    Schedule meeting
                  </button>
                </div>
              </section>
              }

              <!-- Meetings Cards -->
              <div class="space-y-4">
                @for (meet of getMeetingsList(grp.id); track meet.id) {
                  <div class="card p-5 flex flex-col justify-between gap-4">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <h4 class="card-title">{{ meet.title }}</h4>
                        @if (meet.description) {
                          <p class="row-hint">{{ meet.description }}</p>
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
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-ink-2 border-t border-line-soft pt-3">
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
                  <section class="card">
                    <app-empty-state icon="event" title="No scheduled meetings" text="Schedule one to align with group members." />
                  </section>
                }
              </div>
            </div>
          }
        } @else {
          <!-- Empty select group state -->
          <div class="flex-1 flex flex-col items-center justify-center">
            <app-empty-state icon="forum" title="Select a group" text="Pick a group from the list to open its chat and meetings." />
          </div>
        }
      </section>
    </div>

    <!-- Delete Group Confirmation Modal -->
    @if (deleteGroupModalOpen() && groupToDelete()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title">Delete group</h3>
            <button (click)="cancelDeleteGroup()" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-ink-2">
            Are you sure you want to delete <span class="font-medium text-ink">{{ groupToDelete()?.name }}</span>? Its chat history and meetings will be removed.
          </p>
          <div class="modal-footer">
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

  /** True on the Settings route, where this page sits under the Settings header. */
  readonly embedded = !!this.route.snapshot.data['embedded'];

  selectedGroupId = signal<string | null>(null);
  /**
   * On phones the list and the open group take turns on screen; large screens show both. The list
   * comes back on its own when the selection is gone, or a phone would be left with nothing to go back from.
   */
  private phoneOpenedGroup = signal(false);
  phoneShowsGroup = computed(() => this.phoneOpenedGroup() && !!this.selectedGroup());
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
        this.openGroup(params['groupId']);
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

  openGroup(groupId: string) {
    this.selectGroup(groupId);
    this.phoneOpenedGroup.set(true);
  }

  closeGroupOnPhone() {
    this.phoneOpenedGroup.set(false);
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
      this.closeGroupOnPhone();
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
    this.openGroup(grp.id);
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
