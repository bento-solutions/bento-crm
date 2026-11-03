import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  CostCenter, GeneralLedger, GeneralLedgerFilter, LedgerAccount, LedgerApi,
} from '../../services/domains/ledger.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { csvAmount, defaultPeriod, downloadCsv } from '../../shared/ledger.util';
import { LedgerPickerComponent, PickerOption } from './ledger-picker.component';
import { balanceText, errorDetail, sideAmount } from './ledger-labels';

/**
 * General Ledger → General ledger (grand livre): for each account with activity, its opening
 * balance, the period's lines with a running balance, the totals and the closing balance.
 */
@Component({
  selector: 'app-ledger-general',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent, LedgerPickerComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().from ?? ''" (ngModelChange)="setFilter({ from: $event || null })" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().to ?? ''" (ngModelChange)="setFilter({ to: $event || null })" /></label>
        <div class="block w-64 max-w-full"><span class="field-label">{{ 'ledger.account' | translate }}</span>
          <app-ledger-picker [items]="accountOptions()" [value]="filter().accountId ?? null" (valueChange)="setFilter({ accountId: $event })"
                             [allowClear]="true" [clearLabel]="'ledger.allAccounts' | translate" [placeholder]="'ledger.allAccounts' | translate"
                             [emptyLabel]="'ledger.noMatch' | translate" [ariaLabel]="'ledger.account' | translate" /></div>
        <label class="block"><span class="field-label">{{ 'ledger.gl.accountFrom' | translate }}</span>
          <input class="input-field num w-28" inputmode="numeric" maxlength="10" [disabled]="!!filter().accountId" [ngModel]="rangeFrom()"
                 (ngModelChange)="rangeFrom.set($event)" (keyup.enter)="applyRange()" (blur)="applyRange()" placeholder="6" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.gl.accountTo' | translate }}</span>
          <input class="input-field num w-28" inputmode="numeric" maxlength="10" [disabled]="!!filter().accountId" [ngModel]="rangeTo()"
                 (ngModelChange)="rangeTo.set($event)" (keyup.enter)="applyRange()" (blur)="applyRange()" placeholder="7" /></label>
        <div class="block w-56 max-w-full"><span class="field-label">{{ 'ledger.partner' | translate }}</span>
          <app-ledger-picker [items]="partnerOptions()" [value]="filter().partnerId ?? null" (valueChange)="setFilter({ partnerId: $event })"
                             [allowClear]="true" [clearLabel]="'ledger.allPartners' | translate" [placeholder]="'ledger.allPartners' | translate"
                             [emptyLabel]="'ledger.noMatch' | translate" [ariaLabel]="'ledger.partner' | translate" /></div>
        <label class="block"><span class="field-label">{{ 'ledger.costCenter' | translate }}</span>
          <select class="input-field" [ngModel]="filter().costCenterId ?? null" (ngModelChange)="setFilter({ costCenterId: $event })">
            <option [ngValue]="null">{{ 'ledger.allCostCenters' | translate }}</option>
            @for (c of costCenters(); track c.id) { <option [ngValue]="c.id">{{ c.code }} · {{ c.name }}</option> }
          </select></label>
        <div class="flex gap-2 ms-auto">
          <button class="btn-ghost" (click)="resetFilter()">{{ 'ledger.reset' | translate }}</button>
          <button class="btn-secondary" [disabled]="!blocks().length" (click)="exportCsv()"><mat-icon>download</mat-icon>{{ 'ledger.exportCsv' | translate }}</button>
        </div>
      </div>

      @for (a of blocks(); track a.accountId) {
        <div class="table-card">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 border-b border-line">
            <h3 class="text-sm font-semibold text-ink"><span class="num">{{ a.code }}</span> · {{ a.name }}</h3>
            <span class="text-xs text-ink-3 ms-auto">{{ 'ledger.gl.closing' | translate }} <span class="num text-ink font-medium">{{ balance(a.closingBalance) }}</span></span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table is-dense">
              <thead><tr>
                <th>{{ 'ledger.date' | translate }}</th>
                <th>{{ 'ledger.entries.number' | translate }}</th>
                <th>{{ 'ledger.journalShort' | translate }}</th>
                <th>{{ 'ledger.label' | translate }}</th>
                <th class="col-num">{{ 'ledger.debit' | translate }}</th>
                <th class="col-num">{{ 'ledger.credit' | translate }}</th>
                <th class="col-num">{{ 'ledger.balance' | translate }}</th>
              </tr></thead>
              <tbody>
                <tr class="bg-subtle">
                  <td class="cell-muted whitespace-nowrap">{{ date(report()?.from) }}</td>
                  <td colspan="3" class="text-ink-2">{{ 'ledger.gl.opening' | translate }}</td>
                  <td class="col-num"></td><td class="col-num"></td>
                  <td class="col-num num whitespace-nowrap">{{ balance(a.openingBalance) }}</td>
                </tr>
                @for (l of a.lines ?? []; track $index) {
                  <tr>
                    <td class="cell-muted whitespace-nowrap">{{ date(l.entryDate) }}</td>
                    <td class="whitespace-nowrap"><button type="button" class="num text-ink hover:underline" (click)="openEntry.emit(l.entryId)">{{ l.entryNumber }}</button></td>
                    <td class="whitespace-nowrap"><span class="chip">{{ l.journalCode }}</span></td>
                    <td class="min-w-48">
                      <div class="text-ink">{{ l.label || '—' }}</div>
                      @if (l.partnerName || l.costCenterCode) {
                        <div class="cell-sub">{{ l.partnerName }}@if (l.partnerName && l.costCenterCode) { · }@if (l.costCenterCode) { {{ 'ledger.costCenterShort' | translate }} {{ l.costCenterCode }} }</div>
                      }
                    </td>
                    <td class="col-num num whitespace-nowrap">{{ side(l.debit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ side(l.credit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ balance(l.balance) }}</td>
                  </tr>
                }
                <tr class="bg-subtle">
                  <td colspan="4" class="font-medium text-ink">{{ 'ledger.gl.totals' | translate }}</td>
                  <td class="col-num num whitespace-nowrap font-medium">{{ money(a.totalDebit) }}</td>
                  <td class="col-num num whitespace-nowrap font-medium">{{ money(a.totalCredit) }}</td>
                  <td class="col-num num whitespace-nowrap font-medium">{{ balance(a.closingBalance) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      } @empty {
        <div class="table-card">
          <app-empty-state icon="menu_book" [title]="(loading() ? 'ledger.loading' : 'ledger.gl.emptyTitle') | translate"
                           [text]="loading() ? '' : ('ledger.gl.emptyText' | translate)" />
        </div>
      }
    </div>
  `,
})
export class LedgerGeneralComponent implements OnInit {
  private api = inject(LedgerApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  /** An entry number was clicked: the page opens it in the Journal entries tab. */
  openEntry = output<string>();
  /** Filters to open with, over the default period (e.g. an account range from the financial statements). */
  preset = input<Partial<GeneralLedgerFilter> | null>(null);

  filter = signal<GeneralLedgerFilter>({ ...defaultPeriod() });
  rangeFrom = signal('');
  rangeTo = signal('');
  accounts = signal<LedgerAccount[]>([]);
  costCenters = signal<CostCenter[]>([]);
  report = signal<GeneralLedger | null>(null);
  loading = signal(true);

  blocks = computed(() => this.report()?.accounts ?? []);
  accountOptions = computed<PickerOption[]>(() => this.accounts().map(a => ({ id: a.id, code: a.code, label: a.name })));
  partnerOptions = computed<PickerOption[]>(() =>
    this.state.partners().map(p => ({ id: p.id, label: p.name, hint: p.type })).sort((a, b) => a.label.localeCompare(b.label)));

  ngOnInit(): void {
    this.state.loadPartners();
    this.api.accounts(true).subscribe({ next: a => this.accounts.set(a ?? []), error: e => this.fail(e) });
    this.api.costCenters(true).subscribe({ next: c => this.costCenters.set(c ?? []), error: () => { /* the filter stays empty */ } });
    const p = this.preset();
    if (p) {
      this.filter.update(f => ({ ...f, ...p }));
      this.rangeFrom.set(p.accountFrom ?? '');
      this.rangeTo.set(p.accountTo ?? '');
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const f = this.filter();
    // One account wins over a code range.
    const q: GeneralLedgerFilter = f.accountId ? { ...f, accountFrom: null, accountTo: null } : f;
    this.api.generalLedger(q).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  setFilter(patch: Partial<GeneralLedgerFilter>): void {
    this.filter.update(f => ({ ...f, ...patch }));
    this.load();
  }

  applyRange(): void {
    const from = this.rangeFrom().trim() || null;
    const to = this.rangeTo().trim() || null;
    const f = this.filter();
    if (from !== (f.accountFrom ?? null) || to !== (f.accountTo ?? null)) this.setFilter({ accountFrom: from, accountTo: to });
  }

  resetFilter(): void {
    this.filter.set({ ...defaultPeriod() });
    this.rangeFrom.set('');
    this.rangeTo.set('');
    this.load();
  }

  exportCsv(): void {
    const r = this.report();
    if (!r) return;
    const t = (k: string) => this.i18n.t(k);
    const rows: unknown[][] = [[
      t('ledger.code'), t('ledger.accounts.name'), t('ledger.date'), t('ledger.entries.number'), t('ledger.journalShort'),
      t('ledger.label'), t('ledger.partner'), t('ledger.costCenter'), t('ledger.debit'), t('ledger.credit'), t('ledger.balance'),
    ]];
    for (const a of r.accounts ?? []) {
      rows.push([a.code, a.name, r.from, '', '', t('ledger.gl.opening'), '', '', '', '', csvAmount(a.openingBalance)]);
      for (const l of a.lines ?? []) {
        rows.push([a.code, a.name, l.entryDate, l.entryNumber, l.journalCode, l.label ?? '', l.partnerName ?? '', l.costCenterCode ?? '',
          csvAmount(l.debit), csvAmount(l.credit), csvAmount(l.balance)]);
      }
      rows.push([a.code, a.name, r.to, '', '', t('ledger.gl.totals'), '', '', csvAmount(a.totalDebit), csvAmount(a.totalCredit), csvAmount(a.closingBalance)]);
    }
    downloadCsv(`grand-livre_${r.from}_${r.to}.csv`, rows);
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  side(v: number | null | undefined): string { return sideAmount(v); }
  balance(v: number | null | undefined): string { return balanceText(this.i18n, v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
