import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { errorDetail } from '../../pages/bank/bank-labels';
import { shortDate } from '../../shared/bank.util';
import { ChecklistSummary } from '../../services/domains/checklist.service';
import { PortalApi } from '../portal-api.service';
import { checklistProgress } from '../portal.util';

/** The lists of documents the firm asked the client for, open ones first. */
@Component({
  selector: 'app-portal-checklists',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="space-y-4">
      <h1 class="t-title">{{ 'portal.checklists.title' | translate }}</h1>
      @if (error()) { <div class="alert alert-danger text-sm">{{ error() }}</div> }
      @if (loaded() && lists().length === 0) {
        <div class="card p-8 text-center text-sm text-ink-3">{{ 'portal.checklists.empty' | translate }}</div>
      }
      <div class="space-y-2">
        @for (c of lists(); track c.id) {
          <a [routerLink]="['/portal/checklists', c.id]" class="card card-interactive p-4 block space-y-2">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-medium text-ink break-words">{{ c.title }}</div>
                <div class="text-xs text-ink-3">
                  @if (c.period) { {{ c.period }} · }
                  @if (c.dueDate) { <span [class.text-danger-ink]="c.overdue">{{ 'portal.checklists.dueOn' | translate: { date: date(c.dueDate) } }}</span> }
                </div>
              </div>
              @if (c.status !== 'OPEN') {
                <span class="badge shrink-0" [class]="c.status === 'COMPLETE' ? 'badge-success' : 'badge-neutral'">{{ ('checklists.status.' + c.status) | translate }}</span>
              } @else if (c.missing > 0) {
                <span class="badge badge-warning shrink-0">{{ 'portal.checklists.toSend' | translate: { n: c.missing } }}</span>
              } @else {
                <span class="badge badge-info shrink-0">{{ 'portal.checklists.beingChecked' | translate }}</span>
              }
            </div>
            <div class="progress" [class.is-success]="c.items > 0 && c.accepted === c.items"><span [style.width.%]="progress(c)"></span></div>
            <div class="text-xs text-ink-3 num">{{ 'checklists.acceptedOf' | translate: { done: c.accepted, total: c.items } }}</div>
          </a>
        }
      </div>
    </div>
  `,
})
export class PortalChecklistsComponent implements OnInit {
  private api = inject(PortalApi);
  private i18n = inject(TranslationService);

  lists = signal<ChecklistSummary[]>([]);
  loaded = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.checklists().subscribe({
      next: l => {
        const order = { OPEN: 0, COMPLETE: 1, CANCELLED: 2 };
        this.lists.set([...(l ?? [])].sort((a, b) => order[a.status] - order[b.status]));
        this.loaded.set(true);
      },
      error: e => this.error.set(errorDetail(e) || this.i18n.t('portal.error')),
    });
  }

  progress(c: ChecklistSummary): number { return checklistProgress(c); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
}
