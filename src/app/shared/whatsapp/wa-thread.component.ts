import {
  AfterViewChecked, Component, ElementRef, computed, inject, input, output, signal, viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { WaMessage } from '../../services/domains/whatsapp-inbox.service';
import { bubbleTime, dayKey, isPending } from './wa-format';

interface ThreadItem {
  kind: 'day' | 'message';
  key: string;
  label?: string;
  message?: WaMessage;
}

/**
 * The message thread: day separators, in/out bubbles with delivery ticks, source chips for
 * messages the CRM user did not type themselves (AI agent, phone, campaign), and approve/edit/
 * discard controls on agent drafts.
 */
@Component({
  selector: 'app-wa-thread',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  styles: [`
    :host { display: block; min-height: 0; height: 100%; }
    .wa-scroll { background: var(--color-bg); }
    .wa-in { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .wa-out { background: var(--color-accent-light); border: 1px solid transparent; color: var(--color-text-primary); }
    .wa-draft { background: var(--color-warning-light); border: 1px dashed var(--color-warning); color: var(--color-text-primary); }
    .wa-failed { border-color: var(--color-danger) !important; }
    .wa-day { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-secondary); }
    .wa-meta { color: var(--color-text-tertiary); }
    .wa-chip { background: var(--color-surface-active); color: var(--color-text-secondary); }
    .wa-read { color: var(--color-accent); }
    .wa-edit { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .wa-btn { border: 1px solid var(--color-border); color: var(--color-text-primary); background: var(--color-surface); }
    .wa-btn-primary { background: var(--color-text-primary); color: var(--color-surface); }
  `],
  template: `
    <div #scroller class="wa-scroll h-full overflow-y-auto px-3 sm:px-6 py-4 space-y-1.5" (scroll)="onScroll()">
      @if (hasOlder()) {
        <div class="text-center pb-2">
          <button type="button" class="wa-btn text-xs font-semibold px-3 py-1 rounded-full" [disabled]="loading()" (click)="loadOlder.emit()">
            {{ (loading() ? 'inbox.loading' : 'inbox.loadOlder') | translate }}
          </button>
        </div>
      }
      @if (!loading() && messages().length === 0) {
        <p class="text-center text-sm py-10 wa-meta">{{ 'inbox.noMessages' | translate }}</p>
      }
      @for (item of items(); track item.key) {
        @if (item.kind === 'day') {
          <div class="flex justify-center py-2">
            <span class="wa-day text-meta font-semibold px-3 py-0.5 rounded-full">{{ item.label }}</span>
          </div>
        } @else {
          @let m = item.message!;
          <div class="flex" [class.justify-end]="m.direction === 'OUT'">
            <div
              class="max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-xs"
              [class.wa-in]="m.direction === 'IN'"
              [class.wa-out]="m.direction === 'OUT' && m.status !== 'DRAFT'"
              [class.wa-draft]="m.status === 'DRAFT'"
              [class.wa-failed]="m.status === 'FAILED'"
            >
              @if (m.status === 'DRAFT') {
                <div class="text-meta font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style="color: var(--color-warning)">
                  <mat-icon class="!text-[14px] !w-[14px] !h-[14px]">edit_note</mat-icon>
                  {{ (m.source === 'AGENT' ? 'inbox.draft.agentLabel' : 'inbox.draft.label') | translate }}
                </div>
              } @else if (chip(m); as c) {
                <div class="mb-1">
                  <span class="wa-chip text-meta font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <mat-icon class="!text-[12px] !w-[12px] !h-[12px]">{{ c.icon }}</mat-icon>{{ c.label | translate }}
                  </span>
                </div>
              }

              @if (editingId() === m.id) {
                <textarea
                  class="wa-edit w-full rounded-lg p-2 text-sm"
                  rows="3"
                  dir="auto"
                  [ngModel]="editText()"
                  (ngModelChange)="editText.set($event)"
                  [attr.aria-label]="'inbox.draft.edit' | translate"
                ></textarea>
              } @else if (m.body) {
                <p class="text-sm whitespace-pre-wrap break-words" dir="auto">{{ m.body }}</p>
              } @else {
                <p class="text-sm italic wa-meta">[{{ m.messageType }}]</p>
              }

              @if (m.status === 'FAILED') {
                <p class="text-meta mt-1 flex items-center gap-1" style="color: var(--color-danger)">
                  <mat-icon class="!text-[14px] !w-[14px] !h-[14px]">error_outline</mat-icon>
                  {{ 'inbox.failed' | translate }}{{ m.errorTitle ? ': ' + m.errorTitle : '' }}
                </p>
              }

              <div class="flex items-center justify-end gap-1 mt-0.5 wa-meta text-meta">
                <span>{{ time(m.occurredAt) }}</span>
                @if (m.direction === 'OUT' && m.status !== 'DRAFT') {
                  <mat-icon
                    class="!text-[14px] !w-[14px] !h-[14px]"
                    [class.wa-read]="m.status === 'READ'"
                    [attr.aria-label]="('inbox.status.' + m.status) | translate"
                    [title]="('inbox.status.' + m.status) | translate"
                  >{{ tick(m) }}</mat-icon>
                }
              </div>

              @if (m.status === 'DRAFT' && canApprove()) {
                <div class="flex flex-wrap justify-end gap-1.5 mt-2">
                  @if (editingId() === m.id) {
                    <button type="button" class="wa-btn text-xs px-2.5 py-1 rounded-lg" (click)="editingId.set(null)">{{ 'inbox.cancel' | translate }}</button>
                    <button type="button" class="wa-btn-primary text-xs font-semibold px-2.5 py-1 rounded-lg" [disabled]="!editText().trim()"
                            (click)="approve.emit({ id: m.id, text: editText() }); editingId.set(null)">
                      {{ 'inbox.draft.sendEdited' | translate }}
                    </button>
                  } @else {
                    <button type="button" class="wa-btn text-xs px-2.5 py-1 rounded-lg" (click)="discard.emit(m.id)">{{ 'inbox.draft.discard' | translate }}</button>
                    <button type="button" class="wa-btn text-xs px-2.5 py-1 rounded-lg" (click)="startEdit(m)">{{ 'inbox.draft.edit' | translate }}</button>
                    <button type="button" class="wa-btn-primary text-xs font-semibold px-2.5 py-1 rounded-lg" (click)="approve.emit({ id: m.id })">
                      {{ 'inbox.draft.approve' | translate }}
                    </button>
                  }
                </div>
              } @else if (m.status === 'QUEUED' && canApprove()) {
                <div class="flex justify-end mt-1">
                  <button type="button" class="text-meta underline wa-meta" (click)="discard.emit(m.id)">{{ 'inbox.withdraw' | translate }}</button>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `
})
export class WaThreadComponent implements AfterViewChecked {
  private i18n = inject(TranslationService);

  messages = input.required<WaMessage[]>();
  loading = input(false);
  hasOlder = input(false);
  /** Whether the viewer may approve/withdraw (WHATSAPP_SEND). */
  canApprove = input(false);

  loadOlder = output<void>();
  approve = output<{ id: string; text?: string }>();
  discard = output<string>();

  protected editingId = signal<string | null>(null);
  protected editText = signal('');
  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private stickToBottom = true;
  private lastConversationId: string | undefined;
  private lastNewestId: string | undefined;
  private lastOldestId: string | undefined;
  private lastScrollHeight = 0;

  protected items = computed<ThreadItem[]>(() => {
    const out: ThreadItem[] = [];
    let currentDay = '';
    for (const m of this.messages()) {
      const day = dayKey(m.occurredAt);
      if (day !== currentDay) {
        currentDay = day;
        out.push({ kind: 'day', key: 'day-' + day, label: this.dayLabel(m.occurredAt) });
      }
      out.push({ kind: 'message', key: m.id, message: m });
    }
    return out;
  });

  ngAfterViewChecked(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const list = this.messages();
    const conversation = list[0]?.conversationId;
    const newest = list.at(-1)?.id;
    const oldest = list[0]?.id;
    if (conversation !== this.lastConversationId) {
      this.stickToBottom = true;
      el.scrollTop = el.scrollHeight;
    } else if (newest !== this.lastNewestId) {
      if (this.stickToBottom) el.scrollTop = el.scrollHeight;
    } else if (oldest !== this.lastOldestId && this.lastScrollHeight) {
      // Older messages were prepended: keep the viewport on what the user was reading.
      el.scrollTop += el.scrollHeight - this.lastScrollHeight;
    }
    this.lastConversationId = conversation;
    this.lastNewestId = newest;
    this.lastOldestId = oldest;
    this.lastScrollHeight = el.scrollHeight;
  }

  onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  startEdit(m: WaMessage): void {
    this.editText.set(m.body ?? '');
    this.editingId.set(m.id);
  }

  time(iso: string): string {
    return bubbleTime(iso, this.i18n.currentLang());
  }

  tick(m: WaMessage): string {
    if (isPending(m)) return 'schedule';
    switch (m.status) {
      case 'SENT': return 'done';
      case 'DELIVERED':
      case 'READ': return 'done_all';
      case 'FAILED': return 'error_outline';
      default: return 'done';
    }
  }

  chip(m: WaMessage): { icon: string; label: string } | null {
    switch (m.source) {
      case 'AGENT': return { icon: 'smart_toy', label: 'inbox.source.AGENT' };
      case 'PHONE': return { icon: 'smartphone', label: 'inbox.source.PHONE' };
      case 'CAMPAIGN': return { icon: 'campaign', label: 'inbox.source.CAMPAIGN' };
      default: return null;
    }
  }

  private dayLabel(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (d.toDateString() === today.toDateString()) return this.i18n.t('inbox.today');
    if (d.toDateString() === yesterday.toDateString()) return this.i18n.t('inbox.yesterday');
    return d.toLocaleDateString(this.i18n.currentLang(), { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
