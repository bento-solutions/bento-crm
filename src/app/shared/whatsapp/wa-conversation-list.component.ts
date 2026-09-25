import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { InboxFilter, WaConversation } from '../../services/domains/whatsapp-inbox.service';
import { conversationTitle, formatPhone, initials, listTime } from './wa-format';

@Component({
  selector: 'app-wa-conversation-list',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 0; height: 100%; }
    .wa-filters button[aria-pressed="true"] { background: var(--color-text-primary); color: var(--color-surface); }
    .wa-row { border-bottom: 1px solid var(--color-border-light); }
    .wa-row:hover { background: var(--color-surface-hover); }
    .wa-row[aria-current="true"] { background: var(--color-accent-light); }
    .wa-avatar { background: var(--color-surface-active); color: var(--color-text-primary); }
    .wa-unread { background: var(--color-success); color: #fff; }
    .wa-muted { color: var(--color-text-secondary); }
    .wa-search { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); }
  `],
  template: `
    <div class="p-3 space-y-2 border-b" style="border-color: var(--color-border)">
      <div class="relative">
        <mat-icon class="absolute start-2 top-1/2 -translate-y-1/2 !text-[18px] !w-[18px] !h-[18px] wa-muted">search</mat-icon>
        <input
          type="search"
          class="wa-search w-full rounded-lg ps-8 pe-2 py-1.5 text-sm"
          [placeholder]="'inbox.search' | translate"
          [ngModel]="query()"
          (ngModelChange)="onQuery($event)"
          [attr.aria-label]="'inbox.search' | translate"
        />
      </div>
      <div class="wa-filters flex gap-1 overflow-x-auto" role="group" [attr.aria-label]="'inbox.filter.label' | translate">
        @for (f of filters; track f) {
          <button
            type="button"
            class="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap wa-muted"
            [attr.aria-pressed]="filter() === f"
            (click)="filterChange.emit(f)"
          >{{ ('inbox.filter.' + f) | translate }}</button>
        }
      </div>
    </div>

    <div class="flex-1 overflow-y-auto" role="list">
      @for (c of conversations(); track c.id) {
        <button
          type="button"
          role="listitem"
          class="wa-row w-full flex items-start gap-3 px-3 py-2.5 text-start"
          [attr.aria-current]="c.id === selectedId()"
          (click)="selectConversation.emit(c.id)"
        >
          <span class="wa-avatar h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
            {{ avatar(c) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="text-sm truncate" [class.font-bold]="c.unreadCount > 0" [class.font-semibold]="c.unreadCount === 0">
                {{ title(c) }}
              </span>
              <span class="text-meta shrink-0" [style.color]="c.unreadCount > 0 ? 'var(--color-success)' : 'var(--color-text-tertiary)'">
                {{ time(c.lastMessageAt) }}
              </span>
            </span>
            <span class="flex items-center justify-between gap-2 mt-0.5">
              <span class="text-xs truncate wa-muted flex items-center gap-1">
                @if (c.lastMessageDirection === 'OUT') {
                  <mat-icon class="!text-[14px] !w-[14px] !h-[14px] shrink-0">done_all</mat-icon>
                }
                <span class="truncate" dir="auto">{{ c.lastMessagePreview }}</span>
              </span>
              @if (c.unreadCount > 0) {
                <span class="wa-unread text-meta font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0">
                  {{ c.unreadCount }}
                </span>
              }
            </span>
            @if (c.partnerName && c.displayName && c.displayName !== c.partnerName) {
              <span class="text-meta truncate block" style="color: var(--color-text-tertiary)">~ {{ c.displayName }}</span>
            } @else if (!c.partnerId) {
              <span class="text-meta block" style="color: var(--color-text-tertiary)">{{ phone(c.phone) }}</span>
            }
          </span>
        </button>
      } @empty {
        @if (!loading()) {
          <div class="p-8 text-center text-sm wa-muted">
            <mat-icon class="!text-[32px] !w-8 !h-8 mb-2 opacity-50">forum</mat-icon>
            <p>{{ (filter() === 'all' && !query() ? 'inbox.empty' : 'inbox.emptyFiltered') | translate }}</p>
          </div>
        }
      }
      @if (loading()) {
        <div class="p-4 text-center text-xs wa-muted">{{ 'inbox.loading' | translate }}</div>
      } @else if (hasMore()) {
        <button type="button" class="w-full py-3 text-xs font-semibold" style="color: var(--color-accent-text)" (click)="loadMore.emit()">
          {{ 'inbox.loadMore' | translate }}
        </button>
      }
    </div>
  `
})
export class WaConversationListComponent {
  private i18n = inject(TranslationService);

  conversations = input.required<WaConversation[]>();
  selectedId = input<string | null>(null);
  filter = input<InboxFilter>('all');
  query = input('');
  loading = input(false);
  hasMore = input(false);

  selectConversation = output<string>();
  filterChange = output<InboxFilter>();
  queryChange = output<string>();
  loadMore = output<void>();

  readonly filters: InboxFilter[] = ['all', 'unread', 'unanswered', 'mine'];
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private locale = computed(() => this.i18n.currentLang());
  protected pendingQuery = signal('');

  onQuery(value: string): void {
    this.pendingQuery.set(value);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.queryChange.emit(value.trim()), 300);
  }

  title(c: WaConversation): string { return conversationTitle(c); }
  avatar(c: WaConversation): string { return initials(conversationTitle(c)); }
  phone(p: string): string { return formatPhone(p); }
  time(iso?: string): string { return listTime(iso, this.locale()); }
}
