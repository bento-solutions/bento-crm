import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { BaseApiService } from '../../core/services/base-api.service';
import { HTTP_CONFIG } from '../../core/config/api-config';
import { ToastService } from '../toast.service';

export type InboxFilter = 'all' | 'unread' | 'unanswered' | 'mine';
export type MessageStatus =
  | 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED' | 'CANCELLED';
export type MessageSource = 'CONTACT' | 'HUMAN' | 'AGENT' | 'CAMPAIGN' | 'PHONE';
export type SendMode = 'AUTO' | 'DRAFT';

export interface WaConversation {
  id: string;
  phone: string;
  displayName?: string;
  partnerId?: string;
  partnerName?: string;
  partnerType?: string;
  assignedToUserId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageDirection?: 'IN' | 'OUT';
  unreadCount: number;
  windowOpen: boolean;
  windowExpiresAt?: string;
  optedOut: boolean;
  lastReadAt?: string;
}

export interface WaMessage {
  id: string;
  conversationId: string;
  direction: 'IN' | 'OUT';
  source?: MessageSource;
  status: MessageStatus;
  messageType: string;
  body?: string;
  occurredAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string;
  errorTitle?: string;
  sentByUserId?: string;
  apiTokenId?: string;
  approvedByUserId?: string;
  campaignId?: string;
  clientRef?: string;
  quotedWamid?: string;
  mediaType?: string;
  fileName?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface UnreadSummary {
  conversations: number;
  messages: number;
}

export interface BlockedNumber {
  id: string;
  phone: string;
  reason?: string;
  createdAt: string;
}

interface ChangeHint {
  type: 'MESSAGE_CREATED' | 'MESSAGE_UPDATED' | 'CONVERSATION_UPDATED' | 'CONVERSATION_REMOVED' | 'SESSION_UPDATED';
  conversationId?: string;
  messageId?: string;
}

/** HTTP calls for the WhatsApp inbox (backend: WaInboxController). */
@Injectable({ providedIn: 'root' })
export class WhatsAppInboxApi extends BaseApiService {
  listConversations(filter: InboxFilter, q?: string, cursor?: string, limit = 30): Observable<Page<WaConversation>> {
    const params: Record<string, string | number> = { filter, limit };
    if (q) params['q'] = q;
    if (cursor) params['cursor'] = cursor;
    return this.get('/whatsapp/conversations', params);
  }

  getConversation(id: string): Observable<WaConversation> {
    return this.get(`/whatsapp/conversations/${id}`);
  }

  getConversationByPartner(partnerId: string): Observable<WaConversation> {
    return this.get(`/whatsapp/conversations/by-partner/${partnerId}`);
  }

  listMessages(conversationId: string, before?: string, limit = 40): Observable<Page<WaMessage>> {
    const params: Record<string, string | number> = { limit };
    if (before) params['before'] = before;
    return this.get(`/whatsapp/conversations/${conversationId}/messages`, params);
  }

  send(conversationId: string, text: string, mode: SendMode, clientRef: string): Observable<WaMessage> {
    return this.post(`/whatsapp/conversations/${conversationId}/messages`, { text, mode, clientRef });
  }

  startWithPartner(partnerId: string, text: string, mode: SendMode, clientRef: string): Observable<WaMessage> {
    return this.post('/whatsapp/messages', { partnerId, text, mode, clientRef });
  }

  approve(messageId: string, text?: string): Observable<WaMessage> {
    return this.post(`/whatsapp/messages/${messageId}/approve`, text ? { text } : {});
  }

  cancel(messageId: string): Observable<WaMessage> {
    return this.delete(`/whatsapp/messages/${messageId}`);
  }

  markRead(conversationId: string): Observable<WaConversation> {
    return this.post(`/whatsapp/conversations/${conversationId}/read`, {});
  }

  linkPartner(conversationId: string, partnerId: string | null): Observable<WaConversation> {
    return this.http.put<WaConversation>(this.buildUrl(`/whatsapp/conversations/${conversationId}/partner`), { partnerId })
      .pipe(timeout(HTTP_CONFIG.timeout), catchError(e => this.handleError(e)));
  }

  createLead(conversationId: string, name?: string): Observable<WaConversation> {
    return this.post(`/whatsapp/conversations/${conversationId}/create-lead`, name ? { name } : {});
  }

  ignore(conversationId: string): Observable<void> {
    return this.post(`/whatsapp/conversations/${conversationId}/ignore`, {});
  }

  unreadSummary(): Observable<UnreadSummary> {
    return this.get('/whatsapp/unread-summary', new HttpParams());
  }

  listBlocked(): Observable<BlockedNumber[]> {
    return this.get('/whatsapp/blocked');
  }

  unblock(id: string): Observable<void> {
    return this.delete(`/whatsapp/blocked/${id}`);
  }

  streamUrl(accessToken: string): string {
    return this.buildUrl(`/whatsapp/stream?token=${encodeURIComponent(accessToken)}`);
  }
}

/**
 * Inbox state: the conversation list, the open thread, the unread badge, and the live stream.
 *
 * The stream only carries hints ({type, conversationId, messageId}); on a hint the store refetches
 * through the normal endpoints, so what a user sees always passes the backend's permission and
 * visibility checks.
 *
 * Reconnect is manual on purpose. A browser EventSource retries forever with the URL it was
 * created with, and that URL carries a 15-minute access token: after expiry every retry is a 401.
 * Here an error closes the stream, one ordinary API call lets the auth interceptor refresh the
 * token, and the stream reopens with whatever token is current.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppInboxStore {
  private api = inject(WhatsAppInboxApi);
  private toast = inject(ToastService);

  readonly conversations = signal<WaConversation[]>([]);
  readonly conversationsCursor = signal<string | undefined>(undefined);
  readonly loadingConversations = signal(false);
  readonly filter = signal<InboxFilter>('all');
  readonly query = signal('');

  readonly selectedId = signal<string | null>(null);
  readonly selected = signal<WaConversation | null>(null);
  readonly messages = signal<WaMessage[]>([]);
  readonly olderCursor = signal<string | undefined>(undefined);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);

  readonly unread = signal<UnreadSummary>({ conversations: 0, messages: 0 });
  readonly connected = signal(false);
  /** Bumped when the linked number's session changes, so the settings page can refetch it. */
  readonly sessionVersion = signal(0);

  readonly drafts = computed(() => this.messages().filter(m => m.status === 'DRAFT'));

  private source: EventSource | null = null;
  private running = false;
  private reconnectDelay = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private threadRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Stream lifecycle ─────────────────────────────────────────────

  /** Opens the live stream and loads the unread badge. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.refreshUnread();
    this.open();
  }

  /** Closes the stream (on logout) and forgets all inbox state. */
  stop(): void {
    this.running = false;
    this.closeSource();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.conversations.set([]);
    this.selectedId.set(null);
    this.selected.set(null);
    this.messages.set([]);
    this.unread.set({ conversations: 0, messages: 0 });
  }

  private open(): void {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!this.running || !token || typeof EventSource === 'undefined') return;
    this.closeSource();
    const source = new EventSource(this.api.streamUrl(token));
    this.source = source;
    source.addEventListener('connected', () => {
      this.connected.set(true);
      this.reconnectDelay = 2000;
    });
    source.addEventListener('change', (event: MessageEvent) => {
      try {
        this.onHint(JSON.parse(event.data) as ChangeHint);
      } catch {
        // A malformed hint is not worth tearing the stream down for.
      }
    });
    source.onerror = () => this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.connected.set(false);
    this.closeSource();
    if (!this.running || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        // Refreshes the access token through the interceptor if it expired, and catches up on
        // anything missed while disconnected.
        this.unread.set(await firstValueFrom(this.api.unreadSummary()));
      } catch {
        this.scheduleReconnect();
        return;
      }
      this.open();
      this.scheduleListRefresh();
      if (this.selectedId()) this.scheduleThreadRefresh();
    }, delay);
  }

  private closeSource(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }

  private onHint(hint: ChangeHint): void {
    if (hint.type === 'SESSION_UPDATED') {
      this.sessionVersion.update(v => v + 1);
      return;
    }
    this.refreshUnread();
    if (hint.type === 'CONVERSATION_REMOVED' && hint.conversationId) {
      this.conversations.update(list => list.filter(c => c.id !== hint.conversationId));
      if (this.selectedId() === hint.conversationId) this.select(null);
      return;
    }
    this.scheduleListRefresh();
    if (hint.conversationId && hint.conversationId === this.selectedId()) {
      this.scheduleThreadRefresh();
    }
  }

  /** Bursts of hints (a contact sending five messages) collapse into one refetch. */
  private scheduleListRefresh(): void {
    if (this.listRefreshTimer) return;
    this.listRefreshTimer = setTimeout(() => {
      this.listRefreshTimer = null;
      this.reloadConversations(true);
    }, 300);
  }

  private scheduleThreadRefresh(): void {
    if (this.threadRefreshTimer) return;
    this.threadRefreshTimer = setTimeout(() => {
      this.threadRefreshTimer = null;
      this.refreshThread();
    }, 250);
  }

  refreshUnread(): void {
    this.api.unreadSummary().subscribe({ next: s => this.unread.set(s), error: () => undefined });
  }

  // ── Conversation list ────────────────────────────────────────────

  setFilter(filter: InboxFilter): void {
    this.filter.set(filter);
    this.reloadConversations();
  }

  setQuery(query: string): void {
    this.query.set(query);
    this.reloadConversations();
  }

  /**
   * Loads the first page. A background refresh (from a stream hint) keeps whatever further pages
   * are already shown rather than collapsing the list back to one page.
   */
  reloadConversations(background = false): void {
    if (!background) this.loadingConversations.set(true);
    this.api.listConversations(this.filter(), this.query() || undefined).subscribe({
      next: page => {
        if (background && this.conversations().length > page.items.length) {
          const fresh = new Map(page.items.map(c => [c.id, c]));
          const rest = this.conversations().filter(c => !fresh.has(c.id));
          this.conversations.set(this.sortByActivity([...page.items, ...rest]));
        } else {
          this.conversations.set(page.items);
          this.conversationsCursor.set(page.nextCursor);
        }
        this.syncSelected();
        this.loadingConversations.set(false);
      },
      error: () => this.loadingConversations.set(false)
    });
  }

  loadMoreConversations(): void {
    const cursor = this.conversationsCursor();
    if (!cursor || this.loadingConversations()) return;
    this.loadingConversations.set(true);
    this.api.listConversations(this.filter(), this.query() || undefined, cursor).subscribe({
      next: page => {
        const known = new Set(this.conversations().map(c => c.id));
        this.conversations.update(list => [...list, ...page.items.filter(c => !known.has(c.id))]);
        this.conversationsCursor.set(page.nextCursor);
        this.loadingConversations.set(false);
      },
      error: () => this.loadingConversations.set(false)
    });
  }

  private sortByActivity(list: WaConversation[]): WaConversation[] {
    return [...list].sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  }

  private syncSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    const row = this.conversations().find(c => c.id === id);
    if (row) this.selected.set(row);
  }

  // ── Thread ───────────────────────────────────────────────────────

  select(conversationId: string | null): void {
    if (conversationId === this.selectedId()) return;
    this.selectedId.set(conversationId);
    this.messages.set([]);
    this.olderCursor.set(undefined);
    this.selected.set(conversationId ? this.conversations().find(c => c.id === conversationId) ?? null : null);
    if (!conversationId) return;

    this.api.getConversation(conversationId).subscribe({
      next: c => { if (this.selectedId() === c.id) this.selected.set(c); },
      error: () => {
        this.toast.show('This conversation is not available.', { type: 'error' });
        this.select(null);
      }
    });
    this.loadingMessages.set(true);
    this.api.listMessages(conversationId).subscribe({
      next: page => {
        if (this.selectedId() !== conversationId) return;
        this.messages.set([...page.items].reverse());
        this.olderCursor.set(page.nextCursor);
        this.loadingMessages.set(false);
        this.markSelectedRead();
      },
      error: () => this.loadingMessages.set(false)
    });
  }

  loadOlder(): void {
    const id = this.selectedId();
    const cursor = this.olderCursor();
    if (!id || !cursor || this.loadingMessages()) return;
    this.loadingMessages.set(true);
    this.api.listMessages(id, cursor).subscribe({
      next: page => {
        if (this.selectedId() !== id) return;
        const known = new Set(this.messages().map(m => m.id));
        this.messages.update(list => [...[...page.items].reverse().filter(m => !known.has(m.id)), ...list]);
        this.olderCursor.set(page.nextCursor);
        this.loadingMessages.set(false);
      },
      error: () => this.loadingMessages.set(false)
    });
  }

  /** Merges the newest page into the thread (new messages appended, changed ones replaced). */
  refreshThread(): void {
    const id = this.selectedId();
    if (!id) return;
    this.api.listMessages(id).subscribe({
      next: page => {
        if (this.selectedId() !== id) return;
        this.mergeMessages(page.items);
        if (this.selected()?.unreadCount) this.markSelectedRead();
      },
      error: () => undefined
    });
    this.api.getConversation(id).subscribe({
      next: c => { if (this.selectedId() === c.id) this.selected.set(c); },
      error: () => undefined
    });
  }

  private mergeMessages(incoming: WaMessage[]): void {
    const byId = new Map(this.messages().map(m => [m.id, m]));
    for (const m of incoming) byId.set(m.id, m);
    const merged = [...byId.values()]
      .filter(m => m.status !== 'CANCELLED')
      .sort((a, b) => a.occurredAt === b.occurredAt ? a.id.localeCompare(b.id) : a.occurredAt.localeCompare(b.occurredAt));
    this.messages.set(merged);
  }

  private markSelectedRead(): void {
    const id = this.selectedId();
    const selected = this.selected();
    if (!id || (selected && selected.unreadCount === 0)) return;
    this.api.markRead(id).subscribe({
      next: c => {
        if (this.selectedId() === c.id) this.selected.set(c);
        this.conversations.update(list => list.map(row => row.id === c.id ? c : row));
        this.refreshUnread();
      },
      error: () => undefined
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  async send(text: string, mode: SendMode = 'AUTO'): Promise<boolean> {
    const id = this.selectedId();
    const body = text.trim();
    if (!id || !body) return false;
    this.sending.set(true);
    try {
      const message = await firstValueFrom(this.api.send(id, body, mode, newClientRef()));
      this.mergeMessages([message]);
      this.scheduleListRefresh();
      return true;
    } catch (e) {
      this.toast.show(errorText(e, 'The message could not be sent.'), { type: 'error' });
      return false;
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * Opens the partner's conversation if there is one.
   * @returns whether a conversation exists
   */
  async openForPartner(partnerId: string): Promise<boolean> {
    try {
      const c = await firstValueFrom(this.api.getConversationByPartner(partnerId));
      this.select(c.id);
      return true;
    } catch {
      this.select(null);
      return false;
    }
  }

  /** Sends a first message to a partner, creating the conversation, and opens it. */
  async startWithPartner(partnerId: string, text: string): Promise<boolean> {
    const body = text.trim();
    if (!body) return false;
    this.sending.set(true);
    try {
      const message = await firstValueFrom(this.api.startWithPartner(partnerId, body, 'AUTO', newClientRef()));
      this.select(message.conversationId);
      return true;
    } catch (e) {
      this.toast.show(errorText(e, 'The message could not be sent.'), { type: 'error' });
      return false;
    } finally {
      this.sending.set(false);
    }
  }

  async approve(messageId: string, editedText?: string): Promise<void> {
    try {
      this.mergeMessages([await firstValueFrom(this.api.approve(messageId, editedText))]);
    } catch (e) {
      this.toast.show(errorText(e, 'The draft could not be approved.'), { type: 'error' });
    }
  }

  async discard(messageId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.cancel(messageId));
      this.messages.update(list => list.filter(m => m.id !== messageId));
    } catch (e) {
      this.toast.show(errorText(e, 'The message could not be withdrawn.'), { type: 'error' });
    }
  }

  async linkPartner(partnerId: string | null): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    try {
      this.applyConversation(await firstValueFrom(this.api.linkPartner(id, partnerId)));
    } catch (e) {
      this.toast.show(errorText(e, 'The partner could not be linked.'), { type: 'error' });
    }
  }

  async createLead(name?: string): Promise<WaConversation | null> {
    const id = this.selectedId();
    if (!id) return null;
    try {
      const c = await firstValueFrom(this.api.createLead(id, name));
      this.applyConversation(c);
      return c;
    } catch (e) {
      this.toast.show(errorText(e, 'The lead could not be created.'), { type: 'error' });
      return null;
    }
  }

  async ignore(): Promise<boolean> {
    const id = this.selectedId();
    if (!id) return false;
    try {
      await firstValueFrom(this.api.ignore(id));
      this.conversations.update(list => list.filter(c => c.id !== id));
      this.select(null);
      this.refreshUnread();
      return true;
    } catch (e) {
      this.toast.show(errorText(e, 'The number could not be ignored.'), { type: 'error' });
      return false;
    }
  }

  private applyConversation(c: WaConversation): void {
    if (this.selectedId() === c.id) this.selected.set(c);
    this.conversations.update(list => list.map(row => row.id === c.id ? c : row));
  }
}

function newClientRef(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorText(e: unknown, fallback: string): string {
  const detail = (e as { detail?: string })?.detail;
  return detail || fallback;
}
