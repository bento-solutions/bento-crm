import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { AgingBucketKey, AgingReport, PayablesApi } from '../services/domains/payables.service';

const BUCKET_COLOURS: Record<AgingBucketKey, string> = {
  CURRENT: 'var(--color-success)',
  D1_30: 'var(--color-warning)',
  D31_60: 'var(--color-warning-text)',
  D61_90: 'var(--color-danger)',
  D90_PLUS: 'var(--color-danger-text)',
};

/**
 * Finance → Aging: what customers still owe, or what is owed to suppliers, split by how many
 * days past due it is, with one row per customer or supplier.
 */
@Component({
  selector: 'app-finance-aging',
  imports: [MatIconModule, TranslatePipe, StatCardComponent, EmptyStateComponent],
  styles: [`
    .aging-bar { display: flex; height: 10px; border-radius: 9999px; overflow: hidden; background: var(--color-surface-active); }
    .aging-bar > span { display: block; height: 100%; }
    .aging-dot { display: inline-block; width: 8px; height: 8px; border-radius: 9999px; }
  `],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        @if (!side()) {
        <div class="segmented" role="group" [attr.aria-label]="'aging.side' | translate">
          <button type="button" class="segmented__item" [attr.aria-pressed]="type() === 'CUSTOMER'" (click)="select('CUSTOMER')">
            {{ 'aging.receivables' | translate }}
          </button>
          <button type="button" class="segmented__item" [attr.aria-pressed]="type() === 'VENDOR'" (click)="select('VENDOR')">
            {{ 'aging.payables' | translate }}
          </button>
        </div>
        }
        @if (report(); as r) {
          <span class="text-xs text-ink-3">{{ 'aging.asOf' | translate: { date: date(r.asOf) } }}</span>
        }
      </div>

      @if (report(); as r) {
        <div class="stat-grid">
          <app-stat-card [label]="'aging.paid' | translate" [value]="money(r.paid)" icon="task_alt" tone="emerald"
                         [hint]="'aging.ofInvoiced' | translate: { amount: money(r.invoiced) }" />
          <app-stat-card [label]="'aging.pending' | translate" [value]="money(r.pending)" icon="schedule" tone="slate"
                         [hint]="'aging.notYetDue' | translate" />
          <app-stat-card [label]="'aging.late' | translate" [value]="money(r.late)" icon="running_with_errors" tone="rose"
                         [hint]="'aging.pastDue' | translate" />
        </div>

        <section class="card">
          <div class="card-body space-y-4">
            <div class="aging-bar" role="img" [attr.aria-label]="'aging.breakdown' | translate">
              @for (b of r.buckets; track b.key) {
                @if (b.amount > 0) {
                  <span [style.width.%]="share(b.amount)" [style.background]="colour(b.key)"></span>
                }
              }
            </div>
            <div class="grid gap-3 grid-cols-2 sm:grid-cols-5">
              @for (b of r.buckets; track b.key) {
                <div>
                  <div class="flex items-center gap-1.5 text-xs text-ink-2">
                    <span class="aging-dot" [style.background]="colour(b.key)"></span>
                    {{ ('aging.bucket.' + b.key) | translate }}
                  </div>
                  <div class="num text-base font-medium text-ink mt-1">{{ money(b.amount) }}</div>
                  <div class="text-xs text-ink-3">{{ 'aging.invoices' | translate: { n: b.count } }}</div>
                </div>
              }
            </div>
          </div>
        </section>

        <div class="table-card">
          @if (r.partners.length) {
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ (type() === 'CUSTOMER' ? 'aging.customer' : 'aging.supplier') | translate }}</th>
                    <th class="col-num">{{ 'aging.bucket.CURRENT' | translate }}</th>
                    <th class="col-num">{{ 'aging.bucket.D1_30' | translate }}</th>
                    <th class="col-num">{{ 'aging.bucket.D31_60' | translate }}</th>
                    <th class="col-num">{{ 'aging.bucket.D61_90' | translate }}</th>
                    <th class="col-num">{{ 'aging.bucket.D90_PLUS' | translate }}</th>
                    <th class="col-num">{{ 'aging.total' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of r.partners; track p.partnerId) {
                    <tr>
                      <td>
                        <div class="cell-title">{{ p.name }}</div>
                        <div class="cell-sub">
                          {{ 'aging.invoices' | translate: { n: p.openInvoices } }}
                          @if (p.oldestDaysLate > 0) { · {{ 'aging.oldestLate' | translate: { n: p.oldestDaysLate } }} }
                          @if (p.nextScheduledPayment) { · {{ 'aging.payOn' | translate: { date: date(p.nextScheduledPayment) } }} }
                        </div>
                      </td>
                      <td class="col-num num">{{ cell(p.current) }}</td>
                      <td class="col-num num">{{ cell(p.d1to30) }}</td>
                      <td class="col-num num">{{ cell(p.d31to60) }}</td>
                      <td class="col-num num">{{ cell(p.d61to90) }}</td>
                      <td class="col-num num" [class.text-danger-ink]="p.d90plus > 0">{{ cell(p.d90plus) }}</td>
                      <td class="col-num num font-medium text-ink">{{ money(p.total) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <app-empty-state icon="task_alt" [title]="'aging.emptyTitle' | translate"
                             [text]="(type() === 'CUSTOMER' ? 'aging.emptyCustomers' : 'aging.emptySuppliers') | translate" />
          }
        </div>
      } @else if (loading()) {
        <p class="text-sm text-ink-3">{{ 'aging.loading' | translate }}</p>
      }
    </div>
  `
})
export class FinanceAgingComponent implements OnInit {
  private api = inject(PayablesApi);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  /** Set when the page already belongs to one side (Receivables or Payables): no side switch then. */
  side = input<'CUSTOMER' | 'VENDOR' | null>(null);
  protected type = signal<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  protected report = signal<AgingReport | null>(null);
  protected loading = signal(false);
  private outstanding = computed(() => (this.report()?.buckets ?? []).reduce((s, b) => s + Number(b.amount), 0));

  ngOnInit(): void {
    const side = this.side();
    if (side) this.type.set(side);
    this.load();
  }

  select(type: 'CUSTOMER' | 'VENDOR'): void {
    if (this.type() === type) return;
    this.type.set(type);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.report.set(null);
    this.api.aging(this.type()).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: e => {
        this.loading.set(false);
        this.toast.show(((e as { error?: { detail?: string } })?.error?.detail ?? (e as { detail?: string })?.detail) || this.i18n.t('aging.error'), { type: 'error' });
      },
    });
  }

  protected share(amount: number): number {
    const total = this.outstanding();
    return total > 0 ? (Number(amount) / total) * 100 : 0;
  }

  protected colour(key: AgingBucketKey): string {
    return BUCKET_COLOURS[key];
  }

  protected cell(amount: number): string {
    return Number(amount) > 0 ? this.money(amount) : '—';
  }

  protected money(amount?: number | null): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })
      .format(Number(amount) || 0);
  }

  protected date(iso?: string | null): string {
    return iso ? new Date(iso + 'T00:00:00').toLocaleDateString(this.i18n.currentLang(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }
}
