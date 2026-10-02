import { Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { CrmStateService } from '../services/crm-state.service';
import { WhatsAppInboxStore } from '../services/domains/whatsapp-inbox.service';
import { WaConversationListComponent } from '../shared/whatsapp/wa-conversation-list.component';
import { WaConversationHeaderComponent } from '../shared/whatsapp/wa-conversation-header.component';
import { WaThreadComponent } from '../shared/whatsapp/wa-thread.component';
import { WaComposerComponent } from '../shared/whatsapp/wa-composer.component';
import { formatPhone } from '../shared/whatsapp/wa-format';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { ConfirmService } from '../shared/ui/confirm.service';

/**
 * WhatsApp inbox: conversation list on the left, the open thread on the right. The open
 * conversation lives in the URL (`/inbox?c=<id>`) so notifications and links can deep-link to it.
 * On phones only one pane shows at a time.
 */
@Component({
  selector: 'app-inbox',
  imports: [MatIconModule, TranslatePipe, WaConversationListComponent, WaConversationHeaderComponent,
    WaThreadComponent, WaComposerComponent, PageHeaderComponent],
  styles: [`
    .wa-shell { background: var(--color-surface); border: 1px solid var(--color-border); }
    .wa-list { border-inline-end: 1px solid var(--color-border); }
    .wa-empty { background: var(--color-bg); color: var(--color-text-secondary); }
    .wa-live { background: var(--color-success); }
    .wa-offline { background: var(--color-text-tertiary); }
  `],
  template: `
    <div class="page">
    <app-page-header [title]="'inbox.title' | translate" subtitle="WhatsApp conversations with your leads and customers">
      <span actions class="flex items-center gap-2 text-xs text-ink-3">
        <span class="h-2 w-2 rounded-full" [class.wa-live]="store.connected()" [class.wa-offline]="!store.connected()"></span>
        {{ (store.connected() ? 'inbox.live' : 'inbox.reconnecting') | translate }}
      </span>
    </app-page-header>

    <div class="wa-shell rounded-xl overflow-hidden flex h-[calc(100dvh-14rem)] min-h-[420px]">
      <aside class="wa-list w-full md:w-[340px] shrink-0 flex-col min-h-0" [class.hidden]="!!store.selectedId()" [class.flex]="!store.selectedId()" [class.md:flex]="true">
        <app-wa-conversation-list
          class="flex-1 min-h-0"
          [conversations]="store.conversations()"
          [selectedId]="store.selectedId()"
          [filter]="store.filter()"
          [query]="store.query()"
          [loading]="store.loadingConversations()"
          [hasMore]="!!store.conversationsCursor()"
          (selectConversation)="open($event)"
          (filterChange)="store.setFilter($event)"
          (queryChange)="store.setQuery($event)"
          (loadMore)="store.loadMoreConversations()"
        />
      </aside>

      <section class="flex-1 min-w-0 flex-col min-h-0" [class.hidden]="!store.selectedId()" [class.flex]="!!store.selectedId()" [class.md:flex]="true">
        @if (store.selected(); as c) {
          <app-wa-conversation-header
            [conversation]="c"
            [showBack]="true"
            [canLink]="canSend()"
            [canCreateLead]="canCreateLead()"
            [canIgnore]="canIgnore()"
            (back)="open(null)"
            (createLead)="store.createLead()"
            (linkPartner)="store.linkPartner($event)"
            (ignore)="ignore()"
          />
          <app-wa-thread
            class="flex-1 min-h-0"
            [messages]="store.messages()"
            [loading]="store.loadingMessages()"
            [hasOlder]="!!store.olderCursor()"
            [canApprove]="canSend()"
            (loadOlder)="store.loadOlder()"
            (approve)="store.approve($event.id, $event.text)"
            (discard)="store.discard($event)"
          />
          <app-wa-composer
            [canSend]="canSend() && !blockedReason()"
            [sending]="store.sending()"
            [blockedReason]="blockedReason()"
            (send)="store.send($event)"
          />
        } @else {
          <div class="wa-empty flex-1 flex flex-col items-center justify-center text-center p-8">
            <mat-icon class="icon-xl opacity-40 mb-3">forum</mat-icon>
            <p class="text-base font-semibold">{{ 'inbox.selectConversation' | translate }}</p>
            <p class="text-sm mt-1 max-w-xs text-ink-3">{{ 'inbox.selectConversationHint' | translate }}</p>
          </div>
        }
      </section>
    </div>
    </div>
  `
})
export class InboxComponent implements OnInit, OnDestroy {
  private confirmDialog = inject(ConfirmService);
  protected store = inject(WhatsAppInboxStore);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected canSend = computed(() => this.state.hasAuthority('WHATSAPP_SEND'));
  protected canCreateLead = computed(() => this.state.hasAuthority('PARTNERS_CREATE'));
  protected canIgnore = computed(() => this.state.hasAuthority('WHATSAPP_READ_ALL'));

  /** Why the composer cannot send to the open conversation, as an i18n key. */
  protected blockedReason = computed<string | null>(() => {
    const c = this.store.selected();
    if (!c) return null;
    if (c.optedOut && !c.windowOpen) return 'inbox.composer.optedOut';
    return null;
  });

  private querySub = this.route.queryParamMap.subscribe(params => this.store.select(params.get('c')));

  constructor() {
    // Keep the URL in step when the store drops the selection itself (e.g. the conversation was
    // ignored from another tab).
    effect(() => {
      const id = this.store.selectedId();
      if (id === null && this.route.snapshot.queryParamMap.get('c')) {
        this.router.navigate([], { queryParams: { c: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
  }

  ngOnInit(): void {
    this.store.start();
    this.store.reloadConversations();
  }

  ngOnDestroy(): void {
    this.querySub.unsubscribe();
    this.store.select(null);
  }

  open(conversationId: string | null): void {
    this.router.navigate([], { queryParams: { c: conversationId }, queryParamsHandling: 'merge' });
  }

  async ignore(): Promise<void> {
    const c = this.store.selected();
    if (!c) return;
    if (!(await this.confirmDialog.ask({ title: this.i18n.t('inbox.header.ignore'), message: this.i18n.t('inbox.header.ignoreConfirm', { phone: formatPhone(c.phone) }), danger: true, confirmLabel: this.i18n.t('inbox.header.ignore') }))) return;
    if (await this.store.ignore()) this.open(null);
  }
}
