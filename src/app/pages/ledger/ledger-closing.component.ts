import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { BankApi } from '../../services/domains/bank.service';
import { LedgerApi } from '../../services/domains/ledger.service';
import { AssetsApi } from '../../services/domains/assets.service';
import {
  ClosingApi, FiscalYear, LedgerSettings, StockChange, VatPeriod, VatRegime, lastMonthEnd, vatPeriodOf,
} from '../../services/domains/closing.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from './ledger-labels';

/** done: the step is posted for the date; todo: it is not; na: nothing to do; unknown: it could not be read. */
type ItemStatus = 'done' | 'todo' | 'na' | 'unknown';
type ItemKey = 'bank' | 'depreciation' | 'stock' | 'cutoff' | 'vat';

interface CheckItem {
  key: ItemKey;
  icon: string;
  status: ItemStatus;
  /** A count or amount shown next to the status. */
  detail?: string;
}

const ITEM_ICONS: Record<ItemKey, string> = {
  bank: 'fact_check', depreciation: 'trending_down', stock: 'inventory_2', cutoff: 'content_cut', vat: 'percent',
};

/**
 * General Ledger → Closing: the ledger settings (lock date, VAT regime and period), a checklist of
 * the optional closing steps for a chosen date (each with its own button), the stock change of the
 * periodic method, and year-end close and reopen.
 */
@Component({
  selector: 'app-ledger-closing',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="space-y-6">
      <!-- Settings -->
      <section class="card">
        <div class="card-header"><div>
          <h3 class="card-title">{{ 'ledger.closing.settings' | translate }}</h3>
          <p class="text-xs text-ink-3">{{ 'ledger.closing.settingsHint' | translate }}</p>
        </div></div>
        <div class="card-body">
          <fieldset class="grid gap-4 sm:grid-cols-4 items-end" [disabled]="!canClose() || busy()">
            <label class="block"><span class="field-label">{{ 'ledger.closing.lockDate' | translate }}</span>
              <input type="date" class="input-field" [ngModel]="lockDate()" (ngModelChange)="lockDate.set($event)" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.closing.vatRegime' | translate }}</span>
              <select class="input-field" [ngModel]="vatRegime()" (ngModelChange)="vatRegime.set($event)">
                @for (r of regimes; track r) { <option [value]="r">{{ ('ledger.closing.regime.' + r) | translate }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'ledger.closing.vatPeriod' | translate }}</span>
              <select class="input-field" [ngModel]="vatPeriod()" (ngModelChange)="vatPeriod.set($event)">
                @for (p of periods; track p) { <option [value]="p">{{ ('ledger.closing.period.' + p) | translate }}</option> }
              </select></label>
            @if (canClose()) {
              <div class="flex gap-2">
                <button class="btn-primary" [disabled]="busy() || !settingsDirty()" (click)="saveSettings()">{{ 'ledger.closing.save' | translate }}</button>
                @if (settings()?.lockDate) {
                  <button class="btn-ghost" [disabled]="busy()" (click)="lockDate.set(''); saveSettings()">{{ 'ledger.closing.unlock' | translate }}</button>
                }
              </div>
            }
          </fieldset>
          <p class="text-xs text-ink-3 mt-3">
            @if (settings()?.lockDate) { {{ 'ledger.closing.lockedUntil' | translate: { date: date(settings()?.lockDate) } }} }
            @else { {{ 'ledger.closing.noLock' | translate }} }
          </p>
        </div>
      </section>

      <!-- Checklist -->
      <section class="card">
        <div class="card-header flex flex-wrap items-end gap-3">
          <div class="me-auto">
            <h3 class="card-title">{{ 'ledger.closing.checklist' | translate }}</h3>
            <p class="text-xs text-ink-3">{{ 'ledger.closing.checklistHint' | translate }}</p>
          </div>
          <label class="block"><span class="field-label">{{ 'ledger.closing.date' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="checkDate()" (ngModelChange)="setDate($event)" /></label>
        </div>
        <ul class="divide-y divide-line">
          @for (it of items(); track it.key) {
            <li class="flex flex-wrap items-center gap-3 px-5 py-3">
              <mat-icon class="text-ink-3">{{ it.icon }}</mat-icon>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-ink">{{ ('ledger.closing.item.' + it.key) | translate }}</div>
                <div class="text-xs text-ink-3">{{ ('ledger.closing.itemHint.' + it.key) | translate }}@if (it.detail) { · {{ it.detail }} }</div>
              </div>
              <span class="badge" [class.badge-success]="it.status === 'done'" [class.badge-warning]="it.status === 'todo'"
                    [class.badge-neutral]="it.status === 'na' || it.status === 'unknown'">{{ ('ledger.closing.status.' + it.status) | translate }}</span>
              @switch (it.key) {
                @case ('bank') {
                  <a class="btn-secondary btn-sm" routerLink="/bank" [queryParams]="{ tab: 'journal' }">{{ 'ledger.closing.openBankJournal' | translate }}</a>
                }
                @case ('depreciation') {
                  @if (canWrite()) {
                    <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="runDepreciation()">{{ 'ledger.closing.runDepreciation' | translate }}</button>
                  }
                }
                @case ('stock') {
                  @if (canClose() && !stock()?.entryId) {
                    <button class="btn-secondary btn-sm" [disabled]="busy() || !stock()" (click)="postStock()">{{ 'ledger.closing.postStock' | translate }}</button>
                  }
                }
                @case ('cutoff') {
                  <button class="btn-secondary btn-sm" (click)="openTab('cutoff')">{{ 'ledger.closing.openCutoff' | translate }}</button>
                }
                @case ('vat') {
                  <button class="btn-secondary btn-sm" (click)="openTab('vat')">{{ 'ledger.closing.openVat' | translate }}</button>
                }
              }
            </li>
          }
        </ul>
      </section>

      <!-- Stock change -->
      <section class="card">
        <div class="card-header"><div>
          <h3 class="card-title">{{ 'ledger.closing.stockTitle' | translate }}</h3>
          <p class="text-xs text-ink-3">{{ 'ledger.closing.stockHint' | translate: { date: date(checkDate()) } }}</p>
        </div></div>
        <div class="card-body">
          @if (stock(); as s) {
            <div class="grid gap-4 sm:grid-cols-4 items-end text-sm">
              <div><div class="text-ink-3 text-xs">{{ 'ledger.closing.stockOpening' | translate }}</div><div class="text-lg num text-ink">{{ money(s.opening) }}</div></div>
              <div><div class="text-ink-3 text-xs">{{ 'ledger.closing.stockClosing' | translate }}</div><div class="text-lg num text-ink">{{ money(s.closing) }}</div></div>
              <div><div class="text-ink-3 text-xs">{{ 'ledger.closing.stockChange' | translate }}</div>
                <div class="text-lg num" [class.text-success-ink]="s.change > 0" [class.text-danger-ink]="s.change < 0">{{ money(s.change) }}</div>
                <div class="text-xs text-ink-3">{{ (s.change >= 0 ? 'ledger.closing.stockIncrease' : 'ledger.closing.stockDecrease') | translate }}</div></div>
              <div class="flex flex-wrap gap-2 justify-end">
                @if (s.entryId) {
                  <a class="btn-ghost btn-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: s.entryId }"><mat-icon>menu_book</mat-icon>{{ 'ledger.viewEntry' | translate }}</a>
                  @if (canClose()) {
                    <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="deleteStock()"><mat-icon>undo</mat-icon>{{ 'ledger.closing.cancelPosting' | translate }}</button>
                  }
                } @else if (canClose()) {
                  <button class="btn-primary btn-sm" [disabled]="busy()" (click)="postStock()">{{ 'ledger.closing.postStock' | translate }}</button>
                }
              </div>
            </div>
          } @else {
            <p class="text-sm text-ink-3">{{ 'ledger.closing.stockUnavailable' | translate }}</p>
          }
        </div>
      </section>

      <!-- Year-end -->
      <section class="table-card">
        <div class="px-5 py-3 border-b border-line">
          <h3 class="card-title">{{ 'ledger.closing.yearEnd' | translate }}</h3>
          <p class="text-xs text-ink-3">{{ 'ledger.closing.yearEndHint' | translate }}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'ledger.closing.year' | translate }}</th>
              <th>{{ 'ledger.closing.yearStatus' | translate }}</th>
              <th>{{ 'ledger.closing.closedAt' | translate }}</th>
              <th>{{ 'ledger.closing.entries' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (y of years(); track y.year) {
                <tr>
                  <td class="num cell-title">{{ y.year }}</td>
                  <td><span class="badge" [class.badge-success]="y.status === 'CLOSED'" [class.badge-neutral]="y.status !== 'CLOSED'">{{ ('ledger.closing.yearStatusName.' + y.status) | translate }}</span></td>
                  <td class="cell-muted">{{ date(y.closedAt) }}</td>
                  <td class="text-sm">
                    @if (y.resultEntryId) { <a class="text-accent-ink hover:underline me-3" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: y.resultEntryId }">{{ 'ledger.closing.resultEntry' | translate }}</a> }
                    @if (y.openingEntryId) { <a class="text-accent-ink hover:underline" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: y.openingEntryId }">{{ 'ledger.closing.openingEntry' | translate }}</a> }
                    @if (!y.resultEntryId && !y.openingEntryId) { <span class="cell-muted">—</span> }
                  </td>
                  <td class="col-actions">
                    @if (canClose()) {
                      @if (y.status === 'CLOSED') {
                        <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="reopenYear(y)"><mat-icon>lock_open</mat-icon>{{ 'ledger.closing.reopen' | translate }}</button>
                      } @else {
                        <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="closeYear(y)"><mat-icon>lock</mat-icon>{{ 'ledger.closing.close' | translate }}</button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class LedgerClosingComponent implements OnInit {
  private api = inject(ClosingApi);
  private ledger = inject(LedgerApi);
  private bank = inject(BankApi);
  private assets = inject(AssetsApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  readonly regimes: VatRegime[] = ['ENCAISSEMENT', 'DEBIT'];
  readonly periods: VatPeriod[] = ['MONTHLY', 'QUARTERLY'];

  settings = signal<LedgerSettings | null>(null);
  lockDate = signal('');
  vatRegime = signal<VatRegime>('ENCAISSEMENT');
  vatPeriod = signal<VatPeriod>('MONTHLY');

  checkDate = signal(lastMonthEnd());
  items = signal<CheckItem[]>([]);
  stock = signal<StockChange | null>(null);
  years = signal<FiscalYear[]>([]);
  busy = signal(false);

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }
  canClose(): boolean { return this.state.hasAuthority('LEDGER_CLOSE'); }

  settingsDirty(): boolean {
    const s = this.settings();
    return !s || (s.lockDate ?? '') !== this.lockDate() || s.vatRegime !== this.vatRegime() || s.vatPeriod !== this.vatPeriod();
  }

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: s => { this.applySettings(s); this.loadChecklist(); },
      error: e => { this.fail(e); this.loadChecklist(); },
    });
    this.loadYears();
  }

  private applySettings(s: LedgerSettings | null): void {
    this.settings.set(s);
    this.lockDate.set(s?.lockDate ?? '');
    this.vatRegime.set(s?.vatRegime ?? 'ENCAISSEMENT');
    this.vatPeriod.set(s?.vatPeriod ?? 'MONTHLY');
  }

  saveSettings(): void {
    this.busy.set(true);
    this.api.updateSettings({ lockDate: this.lockDate() || null, vatRegime: this.vatRegime(), vatPeriod: this.vatPeriod() }).subscribe({
      next: s => {
        this.busy.set(false);
        this.applySettings(s);
        this.toast.show(this.i18n.t('ledger.closing.saved'), { type: 'success' });
        this.loadChecklist();
      },
      error: e => this.fail(e),
    });
  }

  setDate(d: string): void {
    if (!d) return;
    this.checkDate.set(d);
    this.loadChecklist();
  }

  /** Reads each step's state for the date; a step that cannot be read shows "unknown". */
  loadChecklist(): void {
    const date = this.checkDate();
    const monthStart = date.slice(0, 8) + '01';
    const period = vatPeriodOf(date, this.settings()?.vatPeriod ?? 'MONTHLY');
    const safe = <T>(o: Observable<T>) => o.pipe(catchError(() => of(null)));

    const bank$: Observable<number | null> = this.state.hasAuthority('PAYMENTS_READ')
      ? this.bank.accounts().pipe(
          switchMap(list => {
            const active = (list ?? []).filter(a => a.active !== false);
            return active.length
              ? forkJoin(active.map(a => this.bank.journal({ bankAccountId: a.id, status: 'TO_VALIDATE', to: date }, 0, 1)
                  .pipe(map(p => p?.total_elements ?? (p?.content ?? []).length))))
              : of([] as number[]);
          }),
          map(ns => ns.reduce((s, x) => s + x, 0)),
          catchError(() => of(null)),
        )
      : of(null);

    forkJoin({
      bank: bank$,
      depreciation: safe(this.ledger.entries({ sourceType: 'DEPRECIATION', from: monthStart, to: date }, 0, 1)),
      activeAssets: safe(this.assets.list().pipe(map(l => (l ?? []).filter(a => a.status === 'ACTIVE').length))),
      stock: safe(this.api.stockChange(date)),
      cutoff: safe(this.api.cutoff(date)),
      vat: safe(this.api.vat(period.from, period.to)),
    }).subscribe(r => {
      this.stock.set(r.stock);
      const depPosted = (r.depreciation?.total_elements ?? (r.depreciation?.content ?? []).length) > 0;
      const items: CheckItem[] = [
        { key: 'bank', icon: ITEM_ICONS.bank,
          status: r.bank === null ? 'unknown' : r.bank === 0 ? 'done' : 'todo',
          detail: r.bank ? this.i18n.t('ledger.closing.linesToValidate', { n: r.bank }) : undefined },
        { key: 'depreciation', icon: ITEM_ICONS.depreciation,
          status: r.depreciation === null ? 'unknown' : depPosted ? 'done' : r.activeAssets === 0 ? 'na' : 'todo' },
        { key: 'stock', icon: ITEM_ICONS.stock,
          status: r.stock === null ? 'unknown' : r.stock.entryId ? 'done' : 'todo',
          detail: r.stock ? this.money(r.stock.change) : undefined },
        { key: 'cutoff', icon: ITEM_ICONS.cutoff,
          status: r.cutoff === null ? 'unknown' : r.cutoff?.entryId ? 'done' : 'todo' },
        { key: 'vat', icon: ITEM_ICONS.vat,
          status: r.vat === null ? 'unknown' : r.vat.settlementEntryId ? 'done' : 'todo',
          detail: `${this.date(period.from)} – ${this.date(period.to)}` },
      ];
      this.items.set(items);
    });
  }

  async runDepreciation(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('assets.depreciateTitle'),
      message: this.i18n.t('assets.depreciateText', { date: this.date(this.checkDate()) }),
      confirmLabel: this.i18n.t('assets.depreciate'),
    });
    if (!ok) return;
    this.busy.set(true);
    this.assets.depreciate(this.checkDate()).subscribe({
      next: r => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('assets.depreciated', { months: r?.months ?? 0, entries: r?.entries ?? 0, total: this.money(r?.total) }), { type: 'success' });
        this.loadChecklist();
      },
      error: e => this.fail(e),
    });
  }

  postStock(): void {
    this.busy.set(true);
    this.api.postStockChange(this.checkDate()).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ledger.closing.stockPosted'), { type: 'success' }); this.loadChecklist(); },
      error: e => this.fail(e),
    });
  }

  async deleteStock(): Promise<void> {
    const ok = await this.confirm.ask({ title: this.i18n.t('ledger.closing.cancelStockTitle'), message: this.i18n.t('ledger.closing.reverseText'), danger: true });
    if (!ok) return;
    this.busy.set(true);
    this.api.deleteStockChange(this.checkDate()).subscribe({
      next: () => { this.busy.set(false); this.loadChecklist(); },
      error: e => this.fail(e),
    });
  }

  openTab(tab: 'cutoff' | 'vat'): void {
    this.router.navigate(['/ledger'], { queryParams: { tab, date: this.checkDate() } });
  }

  loadYears(): void {
    this.api.years().subscribe({
      next: list => {
        const rows = [...(list ?? [])];
        // The current and previous years are always offered, so the first close is one click.
        const now = new Date().getFullYear();
        for (const y of [now, now - 1]) {
          if (!rows.some(r => r.year === y)) rows.push({ year: y, status: 'OPEN' });
        }
        this.years.set(rows.sort((a, b) => b.year - a.year));
      },
      error: e => this.fail(e),
    });
  }

  async closeYear(y: FiscalYear): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.closing.closeTitle', { year: y.year }),
      message: this.i18n.t('ledger.closing.closeText', { year: y.year, next: y.year + 1 }),
      confirmLabel: this.i18n.t('ledger.closing.close'),
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.closeYear(y.year).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('ledger.closing.closed', { year: y.year }), { type: 'success' });
        this.loadYears();
        this.api.settings().subscribe({ next: s => this.applySettings(s), error: () => undefined });
      },
      error: e => this.fail(e),
    });
  }

  async reopenYear(y: FiscalYear): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.closing.reopenTitle', { year: y.year }),
      message: this.i18n.t('ledger.closing.reopenText'),
      confirmLabel: this.i18n.t('ledger.closing.reopen'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.reopenYear(y.year).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ledger.closing.reopened', { year: y.year }), { type: 'success' }); this.loadYears(); },
      error: e => this.fail(e),
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return iso ? shortDate(iso) : '—'; }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.closing.error'), { type: 'error' });
  }
}
