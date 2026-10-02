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
          <div class="w-screen max-w-lg bg-surface shadow-2xl flex flex-col h-full duration-300 relative">
            <!-- Floating tab switcher -->
            <div class="absolute -left-10 top-6 z-20 flex flex-col gap-1.5">
              <button
                (click)="switchTo('notifications')"
                class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all duration-200 relative"
                [class]="drawerType() === 'notifications' 
                  ? 'bg-primary text-on-primary border-primary shadow-lg' 
                  : 'bg-surface text-ink-3 border-line hover:text-ink-2 hover:border-line-strong hover:shadow-xl'"
                title="Notifications"
              >
                <mat-icon class="icon-md">notifications</mat-icon>
                @if (notifUnreadCount() > 0) {
                  <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary border-2 border-surface rounded-full flex items-center justify-center text-meta font-semibold text-on-primary px-0.5">
                    {{ notifUnreadCount() > 9 ? '9+' : notifUnreadCount() }}
                  </span>
                }
              </button>
              <button
                (click)="switchTo('inbox')"
                class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all duration-200 relative"
                [class]="drawerType() === 'inbox' 
                  ? 'bg-primary text-on-primary border-primary shadow-lg' 
                  : 'bg-surface text-ink-3 border-line hover:text-ink-2 hover:border-line-strong hover:shadow-xl'"
                title="Mail"
              >
                <mat-icon class="icon-md">mail</mat-icon>
                @if (inboxUnreadCount() > 0) {
                  <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary border-2 border-surface rounded-full flex items-center justify-center text-meta font-semibold text-on-primary px-0.5">
                    {{ inboxUnreadCount() > 9 ? '9+' : inboxUnreadCount() }}
                  </span>
                }
              </button>
            </div>
            <!-- Header -->
            <div class="pl-10 pr-5 py-4 border-b border-line flex items-center justify-between shrink-0">
              <div class="flex items-center gap-2.5">
                <mat-icon class="text-ink-2 icon-lg">{{ drawerType() === 'notifications' ? 'notifications' : 'mail' }}</mat-icon>
                <h2 class="section-title" id="drawer-title">
                  {{ drawerType() === 'notifications' ? 'Notifications' : 'Inbox' }}
                </h2>
                @if (unreadCount() > 0) {
                  <span class="badge badge-neutral">{{ unreadCount() }} new</span>
                }
              </div>
              <div class="flex items-center gap-1">
                @if (unreadCount() > 0) {
                  <button (click)="markAllRead()" class="text-xs font-semibold text-ink hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors">
                    Mark all read
                  </button>
                }
                <button (click)="closeDrawer()" title="Close" class="btn-icon btn-sm">
                  <mat-icon class="icon-sm">close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto">
              @if (drawerType() === 'notifications') {
                <!-- Notifications List -->
                @if (loading()) {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <p class="text-sm font-semibold text-ink-3">Loading notifications…</p>
                  </div>
                } @else if (loadError()) {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <mat-icon class="text-ink-4 mb-3 icon-xl">cloud_off</mat-icon>
                    <p class="text-sm font-semibold text-ink-3">Couldn't load notifications</p>
                    <button (click)="retry()" class="mt-2 text-xs font-semibold text-ink hover:underline">Retry</button>
                  </div>
                }
                @for (notif of notifications(); track notif.id) {
                  <button
                    (click)="openNotification(notif.id)"
                    class="w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors hover:bg-subtle border-b border-line-soft last:border-b-0 cursor-pointer"
                    [class]="notif.read ? '' : 'bg-muted'"
                  >
                    <div class="shrink-0 mt-0.5">
                      <div class="w-9 h-9 rounded-full flex items-center justify-center" [class]="notifIconBg(notif.type)">
                        <mat-icon class="icon-sm" [class]="notifIconColor(notif.type)">{{ notifIcon(notif.type) }}</mat-icon>
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold" [class.text-ink]="!notif.read" [class.text-ink-2]="notif.read">{{ notif.title }}</span>
                        <span class="text-meta text-ink-3 shrink-0 font-medium">{{ formatTime(notif.timestamp) }}</span>
                      </div>
                      <p class="text-xs mt-0.5 leading-relaxed" [class.text-ink-2]="!notif.read" [class.text-ink-3]="notif.read">{{ notif.message }}</p>
                    </div>
                    @if (!notif.read) {
                      <span class="w-2 h-2 rounded-full bg-ink-2 shrink-0 mt-2"></span>
                    }
                  </button>
                } @empty {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <mat-icon class="text-ink-4 mb-3 icon-xl">notifications_off</mat-icon>
                    <p class="text-sm font-semibold text-ink-3">No notifications</p>
                    <p class="text-xs text-ink-3 mt-1">You're all caught up!</p>
                  </div>
                }
              } @else {
                <!-- Inbox Messages -->
                @for (msg of inboxMessages(); track msg.id) {
                  <button
                    (click)="markInboxRead(msg.id)"
                    class="w-full text-left px-5 py-4 flex items-start gap-3 transition-colors hover:bg-subtle border-b border-line-soft last:border-b-0 cursor-pointer"
                    [class]="msg.read ? '' : 'bg-muted'"
                  >
                    <!-- Avatar -->
                    <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-semibold shrink-0 mt-0.5">
                      {{ getInitials(msg.sender) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold truncate" [class.text-ink]="!msg.read" [class.text-ink-2]="msg.read">{{ msg.sender }}</span>
                        <span class="text-meta text-ink-3 shrink-0 font-medium">{{ formatTime(msg.timestamp) }}</span>
                      </div>
                      <p class="text-xs font-medium mt-0.5 truncate" [class.text-ink]="!msg.read" [class.text-ink-3]="msg.read">{{ msg.subject }}</p>
                      <p class="text-xs mt-0.5 leading-relaxed text-ink-3 truncate max-w-full">{{ msg.preview }}</p>
                      <div class="flex items-center gap-2 mt-1.5">
                        @if (!msg.read) {
                          <span class="text-meta font-semibold text-ink">New</span>
                        }
                        @if (msg.hasAttachments) {
                          <span class="text-meta text-ink-3 flex items-center gap-0.5">
                            <mat-icon class="icon-xs">attach_file</mat-icon> Attachment
                          </span>
                        }
                      </div>
                    </div>
                  </button>
                } @empty {
                  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <mat-icon class="text-ink-4 mb-3 icon-xl">mail_outline</mat-icon>
                    <p class="text-sm font-semibold text-ink-3">No messages</p>
                    <p class="text-xs text-ink-3 mt-1">Your inbox is empty</p>
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
      case 'deal': return 'bg-muted';
      case 'lead': return 'bg-muted';
      case 'task': return 'bg-muted';
      case 'ticket': return 'bg-muted';
      case 'mention': return 'bg-muted';
      case 'whatsapp': return 'bg-muted';
      case 'invitation': return 'bg-accent-soft';
      default: return 'bg-subtle';
    }
  }

  notifIconColor(type: string): string {
    switch (type) {
      case 'deal': return 'text-ink';
      case 'lead': return 'text-ink';
      case 'task': return 'text-ink';
      case 'ticket': return 'text-ink';
      case 'mention': return 'text-ink';
      case 'whatsapp': return 'text-ink';
      case 'invitation': return 'text-accent-ink';
      default: return 'text-ink-3';
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
