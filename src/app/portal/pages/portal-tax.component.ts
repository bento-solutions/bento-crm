import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { errorDetail } from '../../pages/bank/bank-labels';
import { shortDate } from '../../shared/bank.util';
import { daysLeft, isoDate } from '../../shared/practice.util';
import { PortalApi, PortalTaxDeadline } from '../portal-api.service';

/** The client's tax filing deadlines (TVA, IS, IR, CNSS) as the firm tracks them. */
@Component({
  selector: 'app-portal-tax',
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="space-y-4">
      <div>
        <h1 class="t-title">{{ 'portal.tax.title' | translate }}</h1>
        <p class="text-sm text-ink-3">{{ 'portal.tax.subtitle' | translate }}</p>
      </div>
      @if (error()) { <div class="alert alert-danger text-sm">{{ error() }}</div> }
      @if (loaded() && deadlines().length === 0) {
        <div class="card p-8 text-center text-sm text-ink-3">{{ 'portal.tax.empty' | translate }}</div>
      }
      <div class="space-y-2">
        @for (d of deadlines(); track d.id) {
          <div class="card p-4 flex items-start justify-between gap-3" [class.border-danger]="d.overdue">
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink">{{ ('tax.kind.' + d.kind) | translate }}</div>
              <div class="text-xs text-ink-3">{{ d.periodLabel || '' }}</div>
              <div class="text-xs mt-1" [class.text-danger-ink]="d.overdue" [class.text-ink-2]="!d.overdue">
                {{ date(d.dueDate) }}
                @if (d.status === 'TODO' || d.overdue) { · {{ left(d).key | translate: { n: left(d).n } }} }
              </div>
            </div>
            <span class="badge shrink-0" [class]="badge(d)">{{ ('tax.status.' + (d.overdue ? 'OVERDUE' : d.status)) | translate }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class PortalTaxComponent implements OnInit {
  private api = inject(PortalApi);
  private i18n = inject(TranslationService);
  private readonly today = isoDate(new Date());

  deadlines = signal<PortalTaxDeadline[]>([]);
  loaded = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.taxDeadlines().subscribe({
      next: d => { this.deadlines.set(d ?? []); this.loaded.set(true); },
      error: e => this.error.set(errorDetail(e) || this.i18n.t('portal.error')),
    });
  }

  left(d: PortalTaxDeadline) { return daysLeft(d.dueDate, this.today); }

  badge(d: PortalTaxDeadline): string {
    if (d.overdue) return 'badge-danger';
    return d.status === 'DONE' ? 'badge-success' : d.status === 'NOT_APPLICABLE' ? 'badge-neutral' : 'badge-warning';
  }

  date(iso: string | null | undefined): string { return shortDate(iso); }
}
