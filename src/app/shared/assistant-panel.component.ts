import { Component, ElementRef, HostListener, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import {
  AssistantApi, AssistantProposal, ChatMessage, ReminderProposalParams, TaskProposalParams,
} from '../services/domains/assistant.service';

type ProposalState = 'pending' | 'busy' | 'done' | 'dismissed';

interface ProposalCard {
  proposal: AssistantProposal;
  state: ProposalState;
}

interface Turn extends ChatMessage {
  proposals?: ProposalCard[];
  lookedUp?: string[];
  failed?: boolean;
}

const STARTERS = ['assistant.starter.owed', 'assistant.starter.supplierBills', 'assistant.starter.toCheck'];

/**
 * The AI assistant: a side panel opened from the top bar. The whole conversation is sent on each
 * question (it lives only in this session). The assistant never acts by itself: anything it
 * proposes (a task, payment reminders) shows as a card the person confirms or dismisses here.
 */
@Component({
  selector: 'app-assistant-panel',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    @if (open()) {
      <aside class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
        <header class="flex items-center justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
          <h2 id="assistant-title" class="section-title flex items-center gap-2">
            <mat-icon class="icon-md text-ink-3">auto_awesome</mat-icon>{{ 'assistant.title' | translate }}
          </h2>
          <div class="flex items-center gap-1">
            @if (turns().length) {
              <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="reset()">{{ 'assistant.newChat' | translate }}</button>
            }
            <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'assistant.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
        </header>

        <div #scroller class="flex-1 overflow-y-auto px-5 py-4 space-y-4" aria-live="polite">
          @if (enabled() === false) {
            <div class="alert alert-info text-sm">{{ 'assistant.notSetUp' | translate }}</div>
          } @else if (enabled() === null) {
            <div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin"></div></div>
          } @else {
            @if (!turns().length) {
              <p class="text-sm text-ink-2">{{ 'assistant.intro' | translate }}</p>
              <div class="flex flex-col gap-2">
                @for (s of starters; track s) {
                  <button class="btn-secondary justify-start text-start" [disabled]="busy()" (click)="sendStarter(s)">{{ s | translate }}</button>
                }
              </div>
            }
            @for (t of turns(); track $index) {
              @if (t.role === 'user') {
                <div class="flex justify-end">
                  <div class="max-w-[85%] rounded-xl px-3 py-2 bg-accent-soft text-sm text-ink whitespace-pre-wrap break-words">{{ t.content }}</div>
                </div>
              } @else {
                <div class="space-y-2">
                  <div class="max-w-[95%] rounded-xl px-3 py-2 bg-subtle text-sm text-ink whitespace-pre-wrap break-words" [class.text-danger-ink]="t.failed">{{ t.content }}</div>
                  @if (t.lookedUp?.length) {
                    <p class="text-meta text-ink-3">{{ 'assistant.lookedUp' | translate: { what: t.lookedUp!.join(', ') } }}</p>
                  }
                  @for (c of t.proposals ?? []; track $index) {
                    <div class="card p-3 space-y-2">
                      @if (c.proposal.kind === 'task') {
                        <div class="flex items-center gap-2 text-sm font-medium text-ink"><mat-icon class="icon-sm text-ink-3">task_alt</mat-icon>{{ 'assistant.proposeTask' | translate }}</div>
                        <p class="text-sm text-ink">{{ taskParams(c).title }}</p>
                        <p class="text-xs text-ink-3">
                          {{ 'assistant.priority' | translate }}: {{ ('assistant.priorityValue.' + taskPriority(c)) | translate }}
                          @if (taskParams(c).due_date) { · {{ 'assistant.due' | translate: { date: shortDate(taskParams(c).due_date!) } }} }
                          @if (contactName(taskParams(c).contact_id); as name) { · {{ name }} }
                        </p>
                      } @else {
                        <div class="flex items-center gap-2 text-sm font-medium text-ink"><mat-icon class="icon-sm text-ink-3">notifications_active</mat-icon>{{ 'assistant.proposeReminders' | translate }}</div>
                        <p class="text-sm text-ink">{{ 'assistant.remindersText' | translate: { n: reminderParams(c).invoice_ids?.length ?? 0, channel: reminderParams(c).channel || 'email' } }}</p>
                      }
                      @switch (c.state) {
                        @case ('done') { <span class="badge badge-success">{{ 'assistant.done' | translate }}</span> }
                        @case ('dismissed') { <span class="badge badge-neutral">{{ 'assistant.dismissed' | translate }}</span> }
                        @default {
                          @if (allowed(c)) {
                            <div class="flex gap-2">
                              <button class="btn-primary btn-sm" [disabled]="c.state === 'busy'" (click)="confirmProposal(c)">{{ 'assistant.confirm' | translate }}</button>
                              <button class="btn-ghost btn-sm" [disabled]="c.state === 'busy'" (click)="dismiss(c)">{{ 'assistant.dismiss' | translate }}</button>
                            </div>
                          } @else {
                            <p class="text-xs text-ink-3">{{ 'assistant.noRight' | translate }}</p>
                          }
                        }
                      }
                    </div>
                  }
                </div>
              }
            }
            @if (busy()) {
              <div class="flex items-center gap-1 px-3 py-2" [attr.aria-label]="'assistant.thinking' | translate">
                <span class="w-2 h-2 rounded-full bg-muted-strong animate-pulse"></span>
                <span class="w-2 h-2 rounded-full bg-muted-strong animate-pulse [animation-delay:150ms]"></span>
                <span class="w-2 h-2 rounded-full bg-muted-strong animate-pulse [animation-delay:300ms]"></span>
                <span class="text-xs text-ink-3 ms-2">{{ 'assistant.thinking' | translate }}</span>
              </div>
            }
          }
        </div>

        @if (enabled()) {
          <form class="flex items-end gap-2 px-5 py-4 border-t border-line shrink-0" (ngSubmit)="send(draft)">
            <textarea #box class="input-field resize-none" rows="2" name="message" [(ngModel)]="draft" maxlength="4000"
                      [placeholder]="'assistant.placeholder' | translate" [attr.aria-label]="'assistant.placeholder' | translate"
                      (keydown.enter)="onEnter($event)"></textarea>
            <button type="submit" class="btn-primary shrink-0" [disabled]="busy() || !draft.trim()" [attr.aria-label]="'assistant.send' | translate">
              <mat-icon>send</mat-icon>
            </button>
          </form>
        }
      </aside>
    }
  `,
})
export class AssistantPanelComponent {
  private api = inject(AssistantApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  open = input(false);
  closed = output<void>();

  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly starters = STARTERS;
  /** null while the status is being checked. */
  enabled = signal<boolean | null>(null);
  turns = signal<Turn[]>([]);
  busy = signal(false);
  draft = '';
  private statusChecked = false;

  constructor() {
    effect(() => {
      if (this.open() && !this.statusChecked) {
        this.statusChecked = true;
        this.api.status().subscribe({
          next: s => this.enabled.set(!!s?.enabled),
          error: () => this.enabled.set(false),
        });
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    this.send(this.draft);
  }

  sendStarter(key: string): void {
    this.send(this.i18n.t(key));
  }

  reset(): void {
    this.turns.set([]);
    this.draft = '';
  }

  send(text: string): void {
    const content = (text ?? '').trim();
    if (!content || this.busy()) return;
    this.draft = '';
    this.turns.update(t => [...t, { role: 'user', content }]);
    const messages: ChatMessage[] = this.turns().filter(t => !t.failed).map(t => ({ role: t.role, content: t.content }));
    this.busy.set(true);
    this.scrollDown();
    this.api.chat(messages).subscribe({
      next: r => {
        this.busy.set(false);
        this.turns.update(t => [...t, {
          role: 'assistant', content: r.reply ?? '',
          lookedUp: r.lookedUp ?? [],
          proposals: (r.proposals ?? []).filter(p => p.kind === 'task' || p.kind === 'invoice_reminders')
            .map(p => ({ proposal: p, state: 'pending' as ProposalState })),
        }]);
        this.scrollDown();
      },
      error: (e: { status?: number; error?: { detail?: string } }) => {
        this.busy.set(false);
        if (e?.status === 409) {
          this.enabled.set(false);
          return;
        }
        this.turns.update(t => [...t, { role: 'assistant', content: e?.error?.detail || this.i18n.t('assistant.error'), failed: true }]);
        this.scrollDown();
      },
    });
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // Proposals
  taskParams(c: ProposalCard): TaskProposalParams {
    return c.proposal.params as TaskProposalParams;
  }

  reminderParams(c: ProposalCard): ReminderProposalParams {
    return c.proposal.params as ReminderProposalParams;
  }

  taskPriority(c: ProposalCard): string {
    const p = (this.taskParams(c).priority ?? 'MEDIUM').toUpperCase();
    return ['URGENT', 'MEDIUM', 'LOW'].includes(p) ? p : 'MEDIUM';
  }

  contactName(id?: string | null): string | null {
    return id ? this.state.partners().find(p => p.id === id)?.name ?? null : null;
  }

  allowed(c: ProposalCard): boolean {
    return c.proposal.kind === 'task' ? this.state.hasAuthority('TASKS_CREATE') : this.state.hasAuthority('INVOICES_WRITE');
  }

  dismiss(c: ProposalCard): void {
    this.setState(c, 'dismissed');
  }

  confirmProposal(c: ProposalCard): void {
    this.setState(c, 'busy');
    const done = (key: string, params?: Record<string, string | number>) => {
      this.setState(c, 'done');
      this.toast.show(this.i18n.t(key, params), { type: 'success' });
    };
    const fail = (e: { error?: { detail?: string } }) => {
      this.setState(c, 'pending');
      this.toast.show(e?.error?.detail || this.i18n.t('assistant.actionError'), { type: 'error' });
    };
    if (c.proposal.kind === 'task') {
      const p = this.taskParams(c);
      const me = this.state.currentUserId();
      const body: Record<string, unknown> = {
        title: p.title, priority: this.taskPriority(c), status: 'TODO',
        // The API needs who assigned it; the person confirming takes it on.
        assignedByUserId: me, assignedToUserId: me,
      };
      if (p.due_date) body['dueDate'] = p.due_date;
      if (p.contact_id) {
        body['relatedEntityType'] = 'PARTNER';
        body['relatedEntityId'] = p.contact_id;
      }
      this.api.createTask(body).subscribe({ next: () => done('assistant.taskCreated'), error: fail });
    } else {
      const p = this.reminderParams(c);
      this.api.sendReminders(p.invoice_ids ?? [], p.channel).subscribe({
        next: r => done('assistant.remindersSent', { n: r?.sent ?? p.invoice_ids?.length ?? 0 }),
        error: fail,
      });
    }
  }

  private setState(c: ProposalCard, state: ProposalState): void {
    c.state = state;
    // New array references so the view refreshes (zoneless, signal-driven).
    this.turns.update(t => t.map(turn => turn.proposals?.includes(c) ? { ...turn, proposals: [...turn.proposals] } : turn));
  }

  shortDate(iso: string): string {
    const d = new Date(iso.slice(0, 10) + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
  }
}
