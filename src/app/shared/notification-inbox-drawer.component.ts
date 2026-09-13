import { Component, input, output, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CrmStateService } from '../services/crm-state.service';

@Component({
  selector: 'app-notification-inbox-drawer',
  imports: [MatIconModule, CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="drawer-title" role="dialog" aria-modal="true">
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
        <div (click)="closeDrawer()" class="absolute inset-0 bg-transparent"></div>

        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right-12 duration-300 relative">
            <!-- Floating tab switcher -->
            <div class="absolute -left-10 top-6 z-20 flex flex-col gap-1.5">
              <button
                (click)="switchTo('notifications')"
                class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all duration-200 relative"
                [class]="drawerType() === 'notifications' 
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-300/50' 
                  : 'bg-white text-zinc-400 border-zinc-200/80 hover:text-zinc-600 hover:border-zinc-300 hover:shadow-xl'"
                title="Notifications"
              >
                <mat-icon class="text-[20px] w-5 h-5">notifications</mat-icon>
                @if (notifUnreadCount() > 0) {
                  <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-zinc-700 border-2 border-white rounded-full flex items-center justify-center text-meta font-bold text-white px-0.5">
                    {{ notifUnreadCount() > 9 ? '9+' : notifUnreadCount() }}
                  </span>
                }
              </button>
              <button
                (click)="switchTo('inbox')"
                class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all duration-200 relative"
                [class]="drawerType() === 'inbox' 
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-300/50' 
                  : 'bg-white text-zinc-400 border-zinc-200/80 hover:text-zinc-600 hover:border-zinc-300 hover:shadow-xl'"
                title="Mail"
              >
                <mat-icon class="text-[20px] w-5 h-5">mail</mat-icon>
                @if (inboxUnreadCount() > 0) {
                  <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-zinc-700 border-2 border-white rounded-full flex items-center justify-center text-meta font-bold text-white px-0.5">
                    {{ inboxUnreadCount() > 9 ? '9+' : inboxUnreadCount() }}
                  </span>
                }
              </button>
            </div>
            <!-- Header -->
            <div class="pl-10 pr-5 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-2.5">
                <mat-icon class="text-zinc-600 text-[22px] w-5.5 h-5.5">{{ drawerType() === 'notifications' ? 'notifications' : 'mail' }}</mat-icon>
                <h2 class="text-lg font-bold text-zinc-900" id="drawer-title">
                  {{ drawerType() === 'notifications' ? 'Notifications' : 'Inbox' }}
                </h2>
                @if (unreadCount() > 0) {
                  <span class="px-2 py-0.5 text-meta font-bold rounded-full bg-zinc-100 text-zinc-950 border border-zinc-200">{{ unreadCount() }} new</span>
                }
              </div>
              <div class="flex items-center gap-1">
                @if (unreadCount() > 0) {
                  <button (click)="markAllRead()" class="text-xs font-semibold text-zinc-900 hover:text-zinc-950 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                    Mark all read
                  </button>
                }
                <button (click)="closeDrawer()" title="Close" class="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                  <mat-icon class="text-[20px] w-5 h-5">close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto">
              @if (drawerType() === 'notifications') {
                <!-- Notifications List -->
                @if (loading()) {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <p class="text-sm font-semibold text-zinc-500">Loading notifications…</p>
                  </div>
                } @else if (loadError()) {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <mat-icon class="text-zinc-300 text-[48px] w-12 h-12 mb-3">cloud_off</mat-icon>
                    <p class="text-sm font-semibold text-zinc-500">Couldn't load notifications</p>
                    <button (click)="retry()" class="mt-2 text-xs font-semibold text-zinc-900 hover:underline">Retry</button>
                  </div>
                }
                @for (notif of notifications(); track notif.id) {
                  <button
                    (click)="openNotification(notif.id)"
                    class="w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 cursor-pointer"
                    [class]="notif.read ? '' : 'bg-zinc-100/40'"
                  >
                    <div class="shrink-0 mt-0.5">
                      <div class="w-9 h-9 rounded-full flex items-center justify-center" [class]="notifIconBg(notif.type)">
                        <mat-icon class="text-[16px] w-4 h-4" [class]="notifIconColor(notif.type)">{{ notifIcon(notif.type) }}</mat-icon>
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold" [class.text-zinc-900]="!notif.read" [class.text-zinc-700]="notif.read">{{ notif.title }}</span>
                        <span class="text-meta text-zinc-400 shrink-0 font-medium">{{ formatTime(notif.timestamp) }}</span>
                      </div>
                      <p class="text-xs mt-0.5 leading-relaxed" [class.text-zinc-700]="!notif.read" [class.text-zinc-500]="notif.read">{{ notif.message }}</p>
                    </div>
                    @if (!notif.read) {
                      <span class="w-2 h-2 rounded-full bg-zinc-700 shrink-0 mt-2"></span>
                    }
                  </button>
                } @empty {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <mat-icon class="text-zinc-300 text-[48px] w-12 h-12 mb-3">notifications_off</mat-icon>
                    <p class="text-sm font-semibold text-zinc-500">No notifications</p>
                    <p class="text-xs text-zinc-400 mt-1">You're all caught up!</p>
                  </div>
                }
              } @else {
                <!-- Inbox Messages -->
                @for (msg of inboxMessages(); track msg.id) {
                  <button
                    (click)="markInboxRead(msg.id)"
                    class="w-full text-left px-5 py-4 flex items-start gap-3 transition-colors hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 cursor-pointer"
                    [class]="msg.read ? '' : 'bg-zinc-100/40'"
                  >
                    <!-- Avatar -->
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-sky-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {{ getInitials(msg.sender) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold truncate" [class.text-zinc-900]="!msg.read" [class.text-zinc-600]="msg.read">{{ msg.sender }}</span>
                        <span class="text-meta text-zinc-400 shrink-0 font-medium">{{ formatTime(msg.timestamp) }}</span>
                      </div>
                      <p class="text-xs font-medium mt-0.5 truncate" [class.text-zinc-800]="!msg.read" [class.text-zinc-500]="msg.read">{{ msg.subject }}</p>
                      <p class="text-xs mt-0.5 leading-relaxed text-zinc-500 truncate max-w-full">{{ msg.preview }}</p>
                      <div class="flex items-center gap-2 mt-1.5">
                        @if (!msg.read) {
                          <span class="text-meta font-semibold text-zinc-900">New</span>
                        }
                        @if (msg.hasAttachments) {
                          <span class="text-meta text-zinc-400 flex items-center gap-0.5">
                            <mat-icon class="text-[10px] w-2.5 h-2.5">attach_file</mat-icon> Attachment
                          </span>
                        }
                      </div>
                    </div>
                  </button>
                } @empty {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <mat-icon class="text-zinc-300 text-[48px] w-12 h-12 mb-3">mail_outline</mat-icon>
                    <p class="text-sm font-semibold text-zinc-500">No messages</p>
                    <p class="text-xs text-zinc-400 mt-1">Your inbox is empty</p>
                  </div>
                }
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class NotificationInboxDrawerComponent {
  private state = inject(CrmStateService);

  drawerType = input<'notifications' | 'inbox'>('notifications');
  open = input(false);
  closed = output<void>();
  switchType = output<'notifications' | 'inbox'>();
  /** Emitted when a notification is opened so the host can close the drawer / navigate. */
  notificationOpened = output<string>();

  notifications = computed(() => this.state.notifications());
  inboxMessages = computed(() => this.state.inboxMessages());
  loading = computed(() => this.state.notificationsLoading());
  loadError = computed(() => this.state.notificationsError());

  unreadCount = computed(() =>
    this.drawerType() === 'notifications'
      ? this.state.unreadNotificationsCount()
      : this.state.unreadInboxCount()
  );

  notifUnreadCount = computed(() => this.state.unreadNotificationsCount());
  inboxUnreadCount = computed(() => this.state.unreadInboxCount());

  closeDrawer() {
    this.closed.emit();
  }

  switchTo(type: 'notifications' | 'inbox') {
    this.switchType.emit(type);
  }

  markAllRead() {
    if (this.drawerType() === 'notifications') {
      this.state.markAllNotificationsRead();
    } else {
      this.state.markAllInboxMessagesRead();
    }
  }

  markNotificationRead(id: string) {
    this.state.markNotificationRead(id);
  }

  openNotification(id: string) {
    const notif = this.state.notifications().find(n => n.id === id);
    if (notif) this.state.openNotification(notif);
    this.notificationOpened.emit(id);
  }

  retry() {
    this.state.refreshNotifications();
  }

  markInboxRead(id: string) {
    this.state.markInboxMessageRead(id);
  }

  notifIcon(type: string): string {
    switch (type) {
      case 'deal': return 'monetization_on';
      case 'lead': return 'person_add';
      case 'task': return 'task_alt';
      case 'ticket': return 'support_agent';
      case 'mention': return 'alternate_email';
      case 'whatsapp': return 'chat';
      case 'invitation': return 'group_add';
      default: return 'circle_notifications';
    }
  }

  notifIconBg(type: string): string {
    switch (type) {
      case 'deal': return 'bg-zinc-100';
      case 'lead': return 'bg-zinc-100';
      case 'task': return 'bg-zinc-100';
      case 'ticket': return 'bg-zinc-100';
      case 'mention': return 'bg-zinc-100';
      case 'whatsapp': return 'bg-zinc-100';
      case 'invitation': return 'bg-blue-50';
      default: return 'bg-zinc-50';
    }
  }

  notifIconColor(type: string): string {
    switch (type) {
      case 'deal': return 'text-zinc-900';
      case 'lead': return 'text-zinc-900';
      case 'task': return 'text-zinc-900';
      case 'ticket': return 'text-zinc-900';
      case 'mention': return 'text-zinc-900';
      case 'whatsapp': return 'text-zinc-900';
      case 'invitation': return 'text-blue-600';
      default: return 'text-zinc-500';
    }
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0] || '?';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
