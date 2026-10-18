import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ChecklistApi, ChecklistSummary } from '../../services/domains/checklist.service';
import { shortDate } from '../../shared/bank.util';
import { checklistProgress } from '../../portal/portal.util';

/** A client's document checklists, compact, on the client's page; links to the Checklists page. */
@Component({
  selector: 'app-client-checklists',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    <section class="card p-5 space-y-4">
      <div class="flex items-center justify-between gap-2 pb-3 border-b border-line-soft">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="icon-chip"><mat-icon class="icon-md">checklist</mat-icon></div>
          <h3 class="card-title truncate">{{ 'checklists.title' | translate }}</h3>
        </div>
        <a class="btn-secondary btn-sm shrink-0" routerLink="/checklists" [queryParams]="{ partnerId: partnerId() }">{{ 'checklists.seeAll' | translate }}</a>
      </div>
      @if (failed()) {
        <p class="text-sm text-ink-3">{{ 'checklists.loadFailed' | translate }}</p>
      }
      @for (c of lists(); track c.id) {
        <a class="flex items-center gap-3 min-w-0 hover:bg-subtle rounded-lg -mx-2 px-2 py-1.5" routerLink="/checklists" [queryParams]="{ partnerId: partnerId(), open: c.id }">
          <div class="min-w-0 flex-1">
            <div class="text-sm text-ink truncate">{{ c.title }}@if (c.period) { <span class="text-ink-3"> · {{ c.period }}</span> }</div>
            <div class="text-xs text-ink-3 num">
              {{ 'checklists.acceptedOf' | translate: { done: c.accepted, total: c.items } }}
              @if (c.missing > 0) { · <span class="text-warning-ink">{{ 'checklists.missingN' | translate: { n: c.missing } }}</span> }
              @if (c.toCheck > 0) { · <span class="text-info-ink">{{ 'checklists.toCheckN' | translate: { n: c.toCheck } }}</span> }
              @if (c.dueDate) { · <span [class.text-danger-ink]="c.overdue">{{ date(c.dueDate) }}</span> }
            </div>
          </div>
          <div class="w-20 shrink-0 hidden sm:block"><div class="progress" [class.is-success]="c.items > 0 && c.accepted === c.items"><span [style.width.%]="progress(c)"></span></div></div>
          <span class="badge shrink-0" [class]="c.status === 'COMPLETE' ? 'badge-success' : c.status === 'CANCELLED' ? 'badge-neutral' : 'badge-info'">{{ ('checklists.status.' + c.status) | translate }}</span>
        </a>
      } @empty {
        @if (!failed()) { <p class="text-sm text-ink-3">{{ 'checklists.noneForClient' | translate }}</p> }
      }
    </section>
  `,
})
export class ClientChecklistsComponent {
  private api = inject(ChecklistApi);

  partnerId = input.required<string>();
  lists = signal<ChecklistSummary[]>([]);
  failed = signal(false);

  constructor() {
    effect(() => {
      const id = this.partnerId();
      untracked(() => {
        if (!id) return;
        this.api.list(id).subscribe({
          next: l => { this.lists.set(l ?? []); this.failed.set(false); },
          error: () => this.failed.set(true),
        });
      });
    });
  }

  progress(c: ChecklistSummary): number { return checklistProgress(c); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
}
