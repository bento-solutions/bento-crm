import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ApiService } from '../../services/api.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  AGING_KEYS, PartnerBalance, PartnerBalanceFilter, PartnerBalanceTotals, PartnerSide, StatementsApi,
} from '../../services/domains/statements.service';
import { formatMoney } from '../../shared/bank.util';
import { defaultPeriod } from '../../shared/ledger.util';
import { errorDetail, sideAmount } from '../ledger/ledger-labels';

const PAGE_SIZE = 50;

/**
 * Accounts Receivable → Customer balances, and Accounts Payable → Supplier balances (route data
 * `type`): each partner's opening balance, the period's debits and credits, the closing balance,
 * the advances, what is overdue and its aging, from the ledger's partner lines. A row opens the
 * partner's statement.
 */
@Component({
  selector: 'app-partner-balances',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header [title]="(isCustomer() ? 'partnerBalances.customersTitle' : 'partnerBalances.suppliersTitle') | translate"
                       [subtitle]="(isCustomer() ? 'partnerBalances.customersSubtitle' : 'partnerBalances.suppliersSubtitle') | translate">
        <button actions class="btn-secondary" [disabled]="busy()" (click)="exportXlsx()"><mat-icon>download</mat-icon>{{ 'partnerBalances.exportExcel' | translate }}</button>
      </app-page-header>

      <div class="space-y-4">
        <div class="flex flex-wrap items-end gap-3">
          <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="filter().from ?? ''" (ngModelChange)="setFilter({ from: $event || null })" /></label>
          <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="filter().to ?? ''" (ngModelChange)="setFilter({ to: $event || null })" /></label>
          <label class="block w-64 max-w-full"><span class="field-label">{{ 'partnerBalances.search' | translate }}</span>
            <input type="search" class="input-field" [ngModel]="search()" (ngModelChange)="onSearch($event)"
                   [placeholder]="(isCustomer() ? 'partnerBalances.searchCustomer' : 'partnerBalances.searchSupplier') | translate" /></label>
          <label class="flex items-center gap-2 text-sm text-ink h-9">
            <input type="checkbox" [ngModel]="filter().onlyOpen" (ngModelChange)="setFilter({ onlyOpen: $event })" />
            {{ 'partnerBalances.onlyOpen' | translate }}
          </label>
        </div>

        <div class="table-card">
          <div class="overflow-x-auto">
            <table class="data-table is-dense">
              <thead>
                <tr>
                  <th rowspan="2">{{ (isCustomer() ? 'partnerBalances.customer' : 'partnerBalances.supplier') | translate }}</th>
                  <th rowspan="2" class="col-num">{{ 'partnerBalances.opening' | translate }}</th>
                  <th rowspan="2" class="col-num">{{ 'ledger.debit' | translate }}</th>
                  <th rowspan="2" class="col-num">{{ 'ledger.credit' | translate }}</th>
                  <th rowspan="2" class="col-num">{{ 'partnerBalances.closing' | translate }}</th>
                  <th rowspan="2" class="col-num">{{ 'partnerBalances.advances' | translate }}</th>
                  <th rowspan="2" class="col-num">{{ 'partnerBalances.overdue' | translate }}</th>
                  <th colspan="5" class="text-center">{{ 'partnerBalances.agingTitle' | translate }}</th>
                </tr>
                <tr>
                  @for (k of agingKeys; track k) { <th class="col-num">{{ ('partnerBalances.aging.' + k) | translate }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.partnerId) {
                  <tr>
                    <td class="min-w-48">
                      <button type="button" class="table-name-link text-start text-ink font-medium hover:underline" (click)="open(r)"
                              [title]="'partnerBalances.openStatement' | translate">{{ r.partnerName }}</button>
                    </td>
                    <td class="col-num num whitespace-nowrap">{{ money(r.opening) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ side(r.debit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ side(r.credit) }}</td>
                    <td class="col-num num whitespace-nowrap font-medium" [class.text-danger-ink]="r.closing < 0">{{ money(r.closing) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ side(r.advances) }}</td>
                    <td class="col-num num whitespace-nowrap" [class.text-danger-ink]="r.overdue > 0">{{ side(r.overdue) }}</td>
                    @for (k of agingKeys; track k) {
                      <td class="col-num num whitespace-nowrap" [class.text-ink-3]="k === 'current'">{{ side(r.aging?.[k]) }}</td>
                    }
                  </tr>
                } @empty {
                  <tr><td colspan="12" class="row-empty">
                    <app-empty-state icon="account_balance_wallet" [title]="(loading() ? 'ledger.loading' : 'partnerBalances.emptyTitle') | translate"
                                     [text]="loading() ? '' : ('partnerBalances.emptyText' | translate)" />
                  </td></tr>
                }
                @if (rows().length && totals(); as t) {
                  <tr class="bg-subtle font-medium">
                    <td class="text-ink">{{ 'ledger.total' | translate }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(t.opening) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(t.debit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(t.credit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(t.closing) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(t.advances) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(t.overdue) }}</td>
                    @for (k of agingKeys; track k) { <td class="col-num num whitespace-nowrap">{{ side(t.aging?.[k]) }}</td> }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (totalPages() > 1) {
            <div class="flex items-center justify-end gap-3 px-5 py-3 border-t border-line text-sm text-ink-2">
              <span>{{ 'partnerBalances.page' | translate: { page: page() + 1, pages: totalPages() } }}</span>
              <button class="btn-icon btn-sm" [disabled]="page() === 0" (click)="goTo(page() - 1)" [attr.aria-label]="'partnerBalances.previous' | translate"><mat-icon class="icon-sm rtl-flip">chevron_left</mat-icon></button>
              <button class="btn-icon btn-sm" [disabled]="page() + 1 >= totalPages()" (click)="goTo(page() + 1)" [attr.aria-label]="'partnerBalances.next' | translate"><mat-icon class="icon-sm rtl-flip">chevron_right</mat-icon></button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class PartnerBalancesComponent implements OnInit {
  private api = inject(StatementsApi);
  private files = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly agingKeys = AGING_KEYS;
  readonly type: PartnerSide = this.route.snapshot.data['type'] === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';

  filter = signal<PartnerBalanceFilter>({ type: this.type, ...defaultPeriod(), onlyOpen: true });
  search = signal('');
  page = signal(0);
  rows = signal<PartnerBalance[]>([]);
  totals = signal<PartnerBalanceTotals | null>(null);
  totalPages = signal(0);
  loading = signal(true);
  busy = signal(false);

  isCustomer = computed(() => this.type === 'CUSTOMER');

  private search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(q => this.setFilter({ search: q.trim() || null }));
  }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t(this.isCustomer() ? 'partnerBalances.customersTitle' : 'partnerBalances.suppliersTitle'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.partnerBalances(this.filter(), this.page(), PAGE_SIZE).subscribe({
      next: r => {
        this.rows.set(r?.items ?? r?.content ?? []);
        this.totals.set(r?.totals ?? null);
        this.totalPages.set(r?.total_pages ?? r?.totalPages ?? 0);
        this.loading.set(false);
      },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  setFilter(patch: Partial<PartnerBalanceFilter>): void {
    this.filter.update(f => ({ ...f, ...patch }));
    this.page.set(0);
    this.load();
  }

  onSearch(q: string): void {
    this.search.set(q ?? '');
    this.search$.next(q ?? '');
  }

  goTo(p: number): void {
    this.page.set(Math.max(0, p));
    this.load();
  }

  open(r: PartnerBalance): void {
    const f = this.filter();
    this.router.navigate([r.partnerId], { relativeTo: this.route, queryParams: { from: f.from, to: f.to } });
  }

  exportXlsx(): void {
    this.busy.set(true);
    const f = this.filter();
    this.api.partnerBalancesXlsx(f).subscribe({
      next: blob => {
        this.busy.set(false);
        this.files.downloadBlob(blob, `${this.isCustomer() ? 'balance-clients' : 'balance-fournisseurs'}-${f.from ?? ''}-${f.to ?? ''}.xlsx`);
      },
      error: e => { this.busy.set(false); this.fail(e); },
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  side(v: number | null | undefined): string { return sideAmount(v); }

  private fail(e: unknown): void {
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
