import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { BankApi, CashDashboard, ForecastItem, TransactionFilter } from '../../services/domains/bank.service';
import {
  amountClass, balanceDomain, barPercent, formatMoney, maskAccountNumber, maxAbs, shortDate, spanFor, zeroLine,
} from '../../shared/bank.util';
import { bankLabel, categoryLabel, errorDetail } from './bank-labels';

/**
 * Bank → Cash: what is in the bank now, what is expected to come in and go out over the next
 * weeks (from open invoices, bills, recurring invoices and monthly costs), and where money went.
 */
@Component({
  selector: 'app-bank-cash',
  imports: [MatIconModule, TranslatePipe, StatCardComponent, EmptyStateComponent],
  template: `
    @if (data(); as d) {
      <div class="space-y-6">
        <div class="stat-grid">
          <app-stat-card [label]="'bank.cash.totalBalance' | translate" [value]="money(d.totalBalance)" icon="account_balance" tone="slate"
                         [hint]="'bank.cash.accountsCount' | translate: { n: (d.accounts ?? []).length }" />
          <button type="button" class="text-start" (click)="openLines.emit({ status: 'UNMATCHED' })">
            <app-stat-card class="card-interactive h-full" [label]="'bank.cash.unmatched' | translate" [value]="d.unmatched ?? 0" icon="link_off" tone="amber"
                           [hint]="'bank.cash.unmatchedHint' | translate" />
          </button>
          <button type="button" class="text-start" (click)="openLines.emit({ category: 'NONE' })">
            <app-stat-card class="card-interactive h-full" [label]="'bank.cash.uncategorized' | translate" [value]="d.uncategorized ?? 0" icon="label_off" tone="violet"
                           [hint]="'bank.cash.uncategorizedHint' | translate" />
          </button>
        </div>

        <!-- Accounts -->
        @if ((d.accounts ?? []).length) {
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (a of d.accounts ?? []; track a.id) {
              <div class="card card-body space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-ink truncate">{{ a.name }}</div>
                    <div class="text-xs text-ink-3 truncate">{{ bank(a.bank) }} · <span class="num">{{ mask(a.accountNumber) }}</span></div>
                  </div>
                  @if (!a.active) { <span class="badge badge-neutral">{{ 'bank.accounts.inactive' | translate }}</span> }
                </div>
                <div class="text-xl font-semibold num" [class]="amountClass(a.balance)">{{ money(a.balance, a.currency) }}</div>
                <div class="text-xs text-ink-3">{{ 'bank.cash.lastLine' | translate: { date: date(a.lastTransactionDate) } }}
                  @if (a.unmatched) { · {{ 'bank.cash.toReconcile' | translate: { n: a.unmatched } }} }</div>
              </div>
            }
          </div>
        } @else {
          <div class="card">
            <app-empty-state icon="account_balance" [title]="'bank.cash.noAccountsTitle' | translate" [text]="'bank.cash.noAccountsText' | translate" />
          </div>
        }

        <!-- Forecast -->
        <section class="space-y-3">
          <div>
            <h2 class="section-title">{{ 'bank.cash.forecast' | translate }}</h2>
            <p class="text-xs text-ink-3">{{ 'bank.cash.forecastNote' | translate }}</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            @for (h of d.forecast?.horizons ?? []; track h.days) {
              <div class="card card-body space-y-1">
                <div class="eyebrow">{{ 'bank.cash.horizon' | translate: { n: h.days } }}</div>
                <div class="flex justify-between text-sm"><span class="text-ink-2">{{ 'bank.cash.in' | translate }}</span><span class="num text-success-ink">{{ money(h.inflow) }}</span></div>
                <div class="flex justify-between text-sm"><span class="text-ink-2">{{ 'bank.cash.out' | translate }}</span><span class="num text-danger-ink">{{ money(-h.outflow) }}</span></div>
                <div class="flex justify-between text-sm border-t border-line pt-1"><span class="text-ink">{{ 'bank.cash.endBalance' | translate }}</span>
                  <span class="num font-semibold" [class]="amountClass(h.endBalance)">{{ money(h.endBalance) }}</span></div>
              </div>
            }
          </div>

          @if (weeks().length) {
            <div class="card">
              <div class="card-header flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-ink">{{ 'bank.cash.weeks' | translate }}</h3>
                @if (d.forecast?.lowestWeek) {
                  <span class="text-xs" [class]="(d.forecast?.lowestBalance ?? 0) < 0 ? 'text-danger-ink font-medium' : 'text-ink-2'">
                    @if ((d.forecast?.lowestBalance ?? 0) < 0) { <mat-icon class="icon-xs align-middle">warning</mat-icon> }
                    {{ 'bank.cash.lowest' | translate: { amount: money(d.forecast?.lowestBalance), date: date(d.forecast?.lowestWeek) } }}
                  </span>
                }
              </div>
              <div class="card-body overflow-x-auto">
                <div class="min-w-[520px] space-y-1">
                  <div class="text-meta text-ink-3">{{ 'bank.cash.runningBalance' | translate }}</div>
                  <div class="relative h-32">
                    <div class="absolute inset-x-0 border-t border-line-strong" [style.top.%]="weekZero()"></div>
                    <div class="absolute inset-0 flex gap-1">
                      @for (w of weeks(); track w.weekStart) {
                        <div class="relative flex-1" [attr.title]="date(w.weekStart) + ' · ' + money(w.balance)">
                          <div class="absolute inset-x-1 rounded-sm" [style.top.%]="w.span.top" [style.height.%]="w.span.height"
                               [class]="w.balance < 0 ? 'bg-danger' : w.lowest ? 'bg-warning' : 'bg-primary'"></div>
                          @if (w.lowest) {
                            <mat-icon class="icon-xs absolute inset-x-0 mx-auto -top-1" [class]="w.balance < 0 ? 'text-danger-ink' : 'text-warning-ink'"
                                      [attr.aria-label]="'bank.cash.lowestShort' | translate">arrow_drop_down</mat-icon>
                          }
                        </div>
                      }
                    </div>
                  </div>
                  <div class="text-meta text-ink-3 pt-2">{{ 'bank.cash.inOut' | translate }}</div>
                  <div class="relative h-24">
                    <div class="absolute inset-x-0 top-1/2 border-t border-line-strong"></div>
                    <div class="absolute inset-0 flex gap-1">
                      @for (w of weeks(); track w.weekStart) {
                        <div class="relative flex-1" [attr.title]="date(w.weekStart) + ' · +' + money(w.inflow) + ' / -' + money(w.outflow)">
                          <div class="absolute bottom-1/2 inset-x-1 rounded-t-sm bg-success" [style.height.%]="w.inH / 2"></div>
                          <div class="absolute top-1/2 inset-x-1 rounded-b-sm bg-danger" [style.height.%]="w.outH / 2"></div>
                        </div>
                      }
                    </div>
                  </div>
                  <div class="flex gap-1">
                    @for (w of weeks(); track w.weekStart) {
                      <div class="flex-1 text-center text-meta text-ink-3 num truncate">{{ dayMonth(w.weekStart) }}</div>
                    }
                  </div>
                  <div class="flex flex-wrap gap-4 pt-2 text-xs text-ink-2">
                    <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm bg-primary"></span>{{ 'bank.cash.balance' | translate }}</span>
                    <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm bg-success"></span>{{ 'bank.cash.in' | translate }}</span>
                    <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm bg-danger"></span>{{ 'bank.cash.out' | translate }}</span>
                    <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm bg-warning"></span>{{ 'bank.cash.lowestShort' | translate }}</span>
                  </div>
                </div>
              </div>
            </div>
          }

          <div class="card">
            <div class="card-header"><h3 class="text-sm font-semibold text-ink">{{ 'bank.cash.upcoming' | translate }}</h3></div>
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead><tr>
                  <th>{{ 'bank.tx.date' | translate }}</th>
                  <th>{{ 'bank.cash.kindLabel' | translate }}</th>
                  <th>{{ 'bank.tx.label' | translate }}</th>
                  <th class="col-num">{{ 'bank.tx.amount' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (it of d.forecast?.items ?? []; track $index) {
                    <tr>
                      <td class="cell-muted whitespace-nowrap">{{ date(it.date) }}</td>
                      <td class="whitespace-nowrap"><span class="badge" [class]="kindBadge(it.kind)">{{ ('bank.cash.kind.' + it.kind) | translate }}</span></td>
                      <td class="max-w-80">
                        @if (it.invoiceId) {
                          <button type="button" class="btn-link text-start" (click)="openInvoice(it)">{{ it.label || '—' }}</button>
                        } @else {
                          <span class="text-ink">{{ it.label || '—' }}</span>
                        }
                      </td>
                      <td class="col-num num whitespace-nowrap" [class]="amountClass(it.amount)">{{ money(it.amount) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="row-empty text-sm text-ink-3">{{ 'bank.cash.noUpcoming' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- History -->
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="card">
            <div class="card-header"><h3 class="text-sm font-semibold text-ink">{{ 'bank.cash.months' | translate }}</h3></div>
            <div class="card-body">
              @if (months().length) {
                <div class="relative h-40">
                  <div class="absolute inset-0 flex items-end gap-3">
                    @for (m of months(); track m.month) {
                      <div class="flex-1 h-full flex items-end justify-center gap-1" [attr.title]="monthLabel(m.month) + ' · +' + money(m.inflow) + ' / -' + money(m.outflow)">
                        <div class="w-1/3 rounded-t-sm bg-success" [style.height.%]="m.inH"></div>
                        <div class="w-1/3 rounded-t-sm bg-danger" [style.height.%]="m.outH"></div>
                      </div>
                    }
                  </div>
                </div>
                <div class="flex gap-3 border-t border-line pt-1">
                  @for (m of months(); track m.month) {
                    <div class="flex-1 text-center text-meta text-ink-3 truncate">{{ monthLabel(m.month) }}</div>
                  }
                </div>
                <div class="flex flex-wrap gap-4 pt-3 text-xs text-ink-2">
                  <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm bg-success"></span>{{ 'bank.cash.inflow' | translate }}</span>
                  <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm bg-danger"></span>{{ 'bank.cash.outflow' | translate }}</span>
                </div>
              } @else {
                <p class="text-sm text-ink-3">{{ 'bank.cash.noData' | translate }}</p>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3 class="text-sm font-semibold text-ink">{{ 'bank.cash.byCategory' | translate }}</h3></div>
            <div class="card-body space-y-3">
              @for (row of categories(); track row.category) {
                <div>
                  <div class="flex justify-between gap-2 text-sm">
                    <span class="text-ink truncate">{{ category(row.category) }}</span>
                    <span class="num text-ink whitespace-nowrap">{{ money(row.amount) }}</span>
                  </div>
                  <div class="progress mt-1"><span [style.width.%]="row.pct"></span></div>
                </div>
              } @empty {
                <p class="text-sm text-ink-3">{{ 'bank.cash.noData' | translate }}</p>
              }
            </div>
          </div>
        </div>
      </div>
    } @else if (loading()) {
      <div class="flex justify-center py-12"><div class="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin"></div></div>
    }
  `,
})
export class BankCashComponent implements OnInit {
  private api = inject(BankApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private router = inject(Router);

  /** Asks the page to show the Transactions tab with this filter. */
  openLines = output<TransactionFilter>();

  data = signal<CashDashboard | null>(null);
  loading = signal(true);

  weeks = computed(() => {
    const f = this.data()?.forecast;
    const weeks = f?.weeks ?? [];
    const domain = balanceDomain(weeks.map(w => w.balance));
    const flowMax = maxAbs(weeks.flatMap(w => [w.inflow, w.outflow]));
    return weeks.map(w => ({
      ...w,
      span: spanFor(w.balance, domain),
      inH: barPercent(w.inflow, flowMax),
      outH: barPercent(w.outflow, flowMax),
      lowest: !!f?.lowestWeek && f.lowestWeek === w.weekStart,
    }));
  });

  weekZero = computed(() => zeroLine(balanceDomain((this.data()?.forecast?.weeks ?? []).map(w => w.balance))));

  months = computed(() => {
    const months = this.data()?.months ?? [];
    const max = maxAbs(months.flatMap(m => [m.inflow, m.outflow]));
    return months.map(m => ({ ...m, inH: barPercent(m.inflow, max), outH: barPercent(m.outflow, max) }));
  });

  categories = computed(() => {
    const rows = this.data()?.outflowByCategory ?? [];
    const max = maxAbs(rows.map(r => r.amount));
    return rows.map(r => ({ ...r, pct: barPercent(r.amount, max) }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.dashboard().subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => {
        this.loading.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
      },
    });
  }

  /** Receivables live under Finance → Customer invoices, payables under Vendor invoices. */
  openInvoice(it: ForecastItem): void {
    this.state.navigateTab.set(it.kind === 'PAYABLE' ? 'Vendor' : 'Customer');
    this.router.navigate(['/finance']);
  }

  kindBadge(kind: string): string {
    switch (kind) {
      case 'RECEIVABLE': return 'badge-success';
      case 'PAYABLE': return 'badge-warning';
      case 'RECURRING_INVOICE': return 'badge-info';
      default: return 'badge-neutral';
    }
  }

  money(v: number | null | undefined, currency?: string | null): string { return formatMoney(v, currency); }
  amountClass(v: number | null | undefined): string { return amountClass(v); }
  mask(n: string | null | undefined): string { return maskAccountNumber(n); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  bank(b: string | null | undefined): string { return bankLabel(this.i18n, b); }
  category(c: string | null | undefined): string { return categoryLabel(this.i18n, c); }

  dayMonth(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  monthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    return new Date(y, m - 1, 1).toLocaleDateString(this.i18n.currentLang(), { month: 'short', year: '2-digit' });
  }
}
