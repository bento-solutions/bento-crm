import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LedgerApi, TrialBalance } from '../../services/domains/ledger.service';
import { formatMoney } from '../../shared/bank.util';
import { csvAmount, defaultPeriod, downloadCsv, trialBalanced } from '../../shared/ledger.util';
import { ACCOUNT_CLASSES, errorDetail, sideAmount } from './ledger-labels';

interface TrialFilter {
  from: string | null;
  to: string | null;
  accountClass: number | null;
}

/** General Ledger → Trial balance (balance générale): opening, period and closing debit / credit per account. */
@Component({
  selector: 'app-ledger-trial',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().from ?? ''" (ngModelChange)="setFilter({ from: $event || null })" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().to ?? ''" (ngModelChange)="setFilter({ to: $event || null })" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.class' | translate }}</span>
          <select class="input-field" [ngModel]="filter().accountClass" (ngModelChange)="setFilter({ accountClass: $event })">
            <option [ngValue]="null">{{ 'ledger.allClasses' | translate }}</option>
            @for (c of classes; track c) { <option [ngValue]="c">{{ c }} · {{ ('ledger.className.' + c) | translate }}</option> }
          </select></label>
        <div class="flex gap-2 ms-auto">
          <button class="btn-ghost" (click)="resetFilter()">{{ 'ledger.reset' | translate }}</button>
          <button class="btn-secondary" [disabled]="!rows().length" (click)="exportCsv()"><mat-icon>download</mat-icon>{{ 'ledger.exportCsv' | translate }}</button>
        </div>
      </div>

      @if (rows().length && !balanced()) {
        <div class="alert alert-danger text-sm"><mat-icon>error</mat-icon><span>{{ 'ledger.trial.unbalanced' | translate }}</span></div>
      }

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table is-dense">
            <thead>
              <tr>
                <th rowspan="2">{{ 'ledger.code' | translate }}</th>
                <th rowspan="2">{{ 'ledger.accounts.name' | translate }}</th>
                <th colspan="2" class="text-center">{{ 'ledger.trial.opening' | translate }}</th>
                <th colspan="2" class="text-center">{{ 'ledger.trial.period' | translate }}</th>
                <th colspan="2" class="text-center">{{ 'ledger.trial.closing' | translate }}</th>
              </tr>
              <tr>
                <th class="col-num">{{ 'ledger.debit' | translate }}</th><th class="col-num">{{ 'ledger.credit' | translate }}</th>
                <th class="col-num">{{ 'ledger.debit' | translate }}</th><th class="col-num">{{ 'ledger.credit' | translate }}</th>
                <th class="col-num">{{ 'ledger.debit' | translate }}</th><th class="col-num">{{ 'ledger.credit' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.accountId) {
                <tr>
                  <td class="num cell-title whitespace-nowrap">{{ r.code }}</td>
                  <td class="min-w-48 text-ink">{{ r.name }}</td>
                  <td class="col-num num whitespace-nowrap">{{ side(r.openingDebit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ side(r.openingCredit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ side(r.periodDebit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ side(r.periodCredit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ side(r.closingDebit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ side(r.closingCredit) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="row-empty">
                  <app-empty-state icon="balance" [title]="(loading() ? 'ledger.loading' : 'ledger.trial.emptyTitle') | translate"
                                   [text]="loading() ? '' : ('ledger.trial.emptyText' | translate)" />
                </td></tr>
              }
              @if (rows().length && report()?.totals; as t) {
                <tr class="bg-subtle font-medium" [class.text-danger-ink]="!balanced()">
                  <td colspan="2" [class.text-ink]="balanced()">{{ 'ledger.total' | translate }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(t.openingDebit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(t.openingCredit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(t.periodDebit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(t.periodCredit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(t.closingDebit) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(t.closingCredit) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class LedgerTrialComponent implements OnInit {
  private api = inject(LedgerApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  readonly classes = ACCOUNT_CLASSES;

  filter = signal<TrialFilter>({ ...defaultPeriod(), accountClass: null });
  report = signal<TrialBalance | null>(null);
  loading = signal(true);

  rows = computed(() => this.report()?.rows ?? []);
  balanced = computed(() => trialBalanced(this.report()?.totals));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.trialBalance(this.filter()).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: e => { this.loading.set(false); this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' }); },
    });
  }

  setFilter(patch: Partial<TrialFilter>): void {
    this.filter.update(f => ({ ...f, ...patch }));
    this.load();
  }

  resetFilter(): void {
    this.filter.set({ ...defaultPeriod(), accountClass: null });
    this.load();
  }

  exportCsv(): void {
    const r = this.report();
    if (!r) return;
    const t = (k: string) => this.i18n.t(k);
    const pair = (label: string) => [`${label} ${t('ledger.debit')}`, `${label} ${t('ledger.credit')}`];
    const rows: unknown[][] = [[
      t('ledger.code'), t('ledger.accounts.name'),
      ...pair(t('ledger.trial.opening')), ...pair(t('ledger.trial.period')), ...pair(t('ledger.trial.closing')),
    ]];
    for (const x of r.rows ?? []) {
      rows.push([x.code, x.name, csvAmount(x.openingDebit), csvAmount(x.openingCredit), csvAmount(x.periodDebit),
        csvAmount(x.periodCredit), csvAmount(x.closingDebit), csvAmount(x.closingCredit)]);
    }
    const s = r.totals;
    if (s) {
      rows.push(['', t('ledger.total'), csvAmount(s.openingDebit), csvAmount(s.openingCredit), csvAmount(s.periodDebit),
        csvAmount(s.periodCredit), csvAmount(s.closingDebit), csvAmount(s.closingCredit)]);
    }
    downloadCsv(`balance-generale_${r.from}_${r.to}.csv`, rows);
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  side(v: number | null | undefined): string { return sideAmount(v); }
}
