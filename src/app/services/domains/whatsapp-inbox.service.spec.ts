import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '../toast.service';
import { WaConversation, WaMessage, WhatsAppInboxApi, WhatsAppInboxStore } from './whatsapp-inbox.service';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (e: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void): void {
    this.listeners.set(type, fn);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: unknown = {}): void {
    this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function conversation(id: string, extra: Partial<WaConversation> = {}): WaConversation {
  return { id, phone: '+212600000001', unreadCount: 0, windowOpen: true, optedOut: false, ...extra };
}

function message(id: string, occurredAt: string, extra: Partial<WaMessage> = {}): WaMessage {
  return { id, conversationId: 'c1', direction: 'IN', status: 'RECEIVED', messageType: 'text', body: id, occurredAt, ...extra };
}

describe('WhatsAppInboxStore', () => {
  let store: WhatsAppInboxStore;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    localStorage.setItem('accessToken', 'token-1');

    api = {
      unreadSummary: vi.fn(() => of({ conversations: 1, messages: 2 })),
      listConversations: vi.fn(() => of({ items: [conversation('c1'), conversation('c2')] })),
      getConversation: vi.fn((id: string) => of(conversation(id))),
      listMessages: vi.fn(() => of({ items: [message('m1', '2026-09-25T10:00:00Z')] })),
      markRead: vi.fn((id: string) => of(conversation(id))),
      streamUrl: vi.fn((token: string) => `/stream?token=${token}`),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: WhatsAppInboxApi, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
      ],
    });
    store = TestBed.inject(WhatsAppInboxStore);
  });

  afterEach(() => {
    store.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('opens the stream with the current access token and loads the badge', () => {
    store.start();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/stream?token=token-1');
    FakeEventSource.instances[0].emit('connected');
    expect(store.connected()).toBe(true);
    expect(store.unread()).toEqual({ conversations: 1, messages: 2 });
  });

  it('coalesces a burst of hints for the open conversation into one thread refetch', () => {
    store.start();
    store.reloadConversations();
    store.select('c1');
    api['listMessages'].mockClear();
    api['listMessages'].mockReturnValue(of({
      items: [message('m2', '2026-09-25T10:01:00Z'), message('m1', '2026-09-25T10:00:00Z')],
    }));

    const source = FakeEventSource.instances[0];
    for (let i = 0; i < 5; i++) {
      source.emit('change', { type: 'MESSAGE_CREATED', conversationId: 'c1', messageId: 'm2' });
    }
    vi.advanceTimersByTime(400);

    expect(api['listMessages']).toHaveBeenCalledTimes(1);
    expect(store.messages().map(m => m.id)).toEqual(['m1', 'm2']);
  });

  it('ignores hints for other conversations in the thread but refreshes the list', () => {
    store.start();
    store.select('c1');
    api['listMessages'].mockClear();
    api['listConversations'].mockClear();

    FakeEventSource.instances[0].emit('change', { type: 'MESSAGE_CREATED', conversationId: 'c2' });
    vi.advanceTimersByTime(400);

    expect(api['listMessages']).not.toHaveBeenCalled();
    expect(api['listConversations']).toHaveBeenCalledTimes(1);
  });

  it('drops a removed conversation and clears it if it was open', () => {
    store.start();
    store.reloadConversations();
    store.select('c1');

    FakeEventSource.instances[0].emit('change', { type: 'CONVERSATION_REMOVED', conversationId: 'c1' });

    expect(store.conversations().map(c => c.id)).toEqual(['c2']);
    expect(store.selectedId()).toBeNull();
  });

  it('reconnects after an error only once an authed call has succeeded, with the fresh token', async () => {
    store.start();
    const first = FakeEventSource.instances[0];
    api['unreadSummary'].mockClear();

    first.onerror?.();
    expect(first.closed).toBe(true);
    expect(store.connected()).toBe(false);

    // The auth interceptor refreshed the token during the authed call.
    localStorage.setItem('accessToken', 'token-2');
    await vi.advanceTimersByTimeAsync(2000);

    expect(api['unreadSummary']).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toBe('/stream?token=token-2');
  });

  it('keeps the thread ordered and hides withdrawn messages', () => {
    store.start();
    store.select('c1');
    api['listMessages'].mockReturnValue(of({
      items: [
        message('m3', '2026-09-25T10:02:00Z', { direction: 'OUT', status: 'CANCELLED' }),
        message('m2', '2026-09-25T10:01:00Z', { direction: 'OUT', status: 'DRAFT' }),
      ],
    }));
    store.refreshThread();

    expect(store.messages().map(m => `${m.id}:${m.status}`)).toEqual(['m1:RECEIVED', 'm2:DRAFT']);
    expect(store.drafts().map(m => m.id)).toEqual(['m2']);
  });
});
