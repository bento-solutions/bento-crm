import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import {
  AssetCategory, AssetRegister, AssetStatus, AssetsApi, DepreciationResult, FALLBACK_ASSET_CATEGORIES, FixedAsset,
  RegisterRow, RegisterTotals, ScheduleRow,
} from '../../services/domains/assets.service';
import { isoDay, lastMonthEnd } from '../../services/domains/closing.service';
import { round2 } from '../../services/domains/vat';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from '../ledger/ledger-labels';
import { AssetDialogComponent } from './asset-dialog.component';
import { assetCategoryLabel } from './asset-labels';

type View = 'list' | 'register';
type StatusFilter = 'ALL' | AssetStatus;

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Fixed assets (immobilisations): the list with its totals, a drawer per asset with its
 * depreciation schedule, create / edit / dispose, the monthly depreciation run, and the fixed-asset
 * register of a year (the tax return table), which can be printed.
 */
@Component({
  selector: 'app-assets',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, PageHeaderComponent, EmptyStateComponent, StatCardComponent, AssetDialogComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'assets.title' | translate" [subtitle]="'assets.subtitle' | translate">
        <div actions class="flex flex-wrap gap-2">
          @if (canWrite()) {
            <button class="btn-secondary" (click)="openDepreciate()"><mat-icon>trending_down</mat-icon>{{ 'assets.depreciate' | translate }}</button>
            <button class="btn-primary" (click)="creating.set(true)"><mat-icon>add</mat-icon>{{ 'assets.new' | translate }}</button>
          }
        </div>
      </app-page-header>

      <div class="segmented mb-4" role="group" [attr.aria-label]="'assets.title' | translate">
        <button type="button" class="segmented__item" [class.is-active]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="view.set('list')">{{ 'assets.viewList' | translate }}</button>
        <button type="button" class="segmented__item" [class.is-active]="view() === 'register'" [attr.aria-pressed]="view() === 'register'" (click)="showRegister()">{{ 'assets.viewRegister' | translate }}</button>
      </div>

      @if (view() === 'list') {
        <div class="space-y-4">
          <div class="stat-grid">
            <app-stat-card [label]="'assets.count' | translate" [value]="filtered().length" icon="inventory" tone="slate" />
            <app-stat-card [label]="'assets.totalCost' | translate" [value]="money(totals().cost)" icon="payments" tone="slate" />
            <app-stat-card [label]="'assets.totalDepreciation' | translate" [value]="money(totals().accumulated)" icon="trending_down" tone="amber" />
            <app-stat-card [label]="'assets.totalNbv' | translate" [value]="money(totals().nbv)" icon="account_balance_wallet" tone="violet" />
          </div>

          <div class="segmented" role="group" [attr.aria-label]="'assets.status' | translate">
            @for (s of statuses; track s) {
              <button type="button" class="segmented__item" [class.is-active]="status() === s" [attr.aria-pressed]="status() === s" (click)="status.set(s)">
                {{ ('assets.statusName.' + s) | translate }}</button>
            }
          </div>

          <div class="table-card">
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead><tr>
                  <th>{{ 'assets.code' | translate }}</th>
                  <th>{{ 'assets.name' | translate }}</th>
                  <th>{{ 'assets.acquisitionDate' | translate }}</th>
                  <th>{{ 'assets.method' | translate }}</th>
                  <th class="col-num">{{ 'assets.cost' | translate }}</th>
                  <th class="col-num">{{ 'assets.accumulated' | translate }}</th>
                  <th class="col-num">{{ 'assets.nbv' | translate }}</th>
                  <th>{{ 'assets.status' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (a of filtered(); track a.id) {
                    <tr class="cursor-pointer" [class.is-selected]="selected()?.id === a.id" (click)="open(a)">
                      <td class="num cell-title whitespace-nowrap">{{ a.code }}</td>
                      <td class="max-w-72"><div class="cell-title truncate">{{ a.name }}</div><div class="cell-sub">{{ cat(a.category) }}</div></td>
                      <td class="cell-muted whitespace-nowrap">{{ date(a.acquisitionDate) }}</td>
                      <td class="text-sm whitespace-nowrap">{{ ('assets.methodName.' + a.method) | translate }} · {{ years(a.usefulLifeMonths) }}</td>
                      <td class="col-num num">{{ money(a.acquisitionCost) }}</td>
                      <td class="col-num num">{{ money(a.accumulatedDepreciation) }}</td>
                      <td class="col-num num font-medium">{{ money(a.netBookValue) }}</td>
                      <td><span class="badge" [class]="statusClass(a.status)">{{ ('assets.statusName.' + a.status) | translate }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="8" class="row-empty">
                      <app-empty-state icon="inventory" [title]="'assets.emptyTitle' | translate" [text]="'assets.emptyText' | translate" />
                    </td></tr>
                  }
                  @if (filtered().length) {
                    <tr class="font-semibold">
                      <td colspan="4">{{ 'assets.total' | translate }}</td>
                      <td class="col-num num">{{ money(totals().cost) }}</td>
                      <td class="col-num num">{{ money(totals().accumulated) }}</td>
                      <td class="col-num num">{{ money(totals().nbv) }}</td>
                      <td></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      } @else {
        <!-- Register -->
        <div class="space-y-4">
          <div class="flex flex-wrap items-end gap-3">
            <label class="block"><span class="field-label">{{ 'assets.year' | translate }}</span>
              <select class="input-field" [ngModel]="registerYear()" (ngModelChange)="registerYear.set(+$event); loadRegister()">
                @for (y of yearOptions; track y) { <option [ngValue]="y">{{ y }}</option> }
              </select></label>
            <button class="btn-secondary" [disabled]="!register()" (click)="printRegister()"><mat-icon>print</mat-icon>{{ 'assets.print' | translate }}</button>
          </div>
          @if (register(); as r) {
            <div class="table-card">
              <div class="overflow-x-auto">
                <table class="data-table is-dense">
                  <thead><tr>
                    <th>{{ 'assets.code' | translate }}</th>
                    <th>{{ 'assets.name' | translate }}</th>
                    <th>{{ 'assets.acquisitionDate' | translate }}</th>
                    <th class="col-num">{{ 'assets.cost' | translate }}</th>
                    <th>{{ 'assets.method' | translate }}</th>
                    <th class="col-num">{{ 'assets.rate' | translate }}</th>
                    <th class="col-num">{{ 'assets.accumulatedStart' | translate }}</th>
                    <th class="col-num">{{ 'assets.depreciationYear' | translate }}</th>
                    <th class="col-num">{{ 'assets.accumulatedEnd' | translate }}</th>
                    <th class="col-num">{{ 'assets.nbv' | translate }}</th>
                    <th>{{ 'assets.disposal' | translate }}</th>
                  </tr></thead>
                  <tbody>
                    @for (g of registerGroups(); track g.category) {
                      <tr class="bg-subtle"><td colspan="11" class="text-xs font-semibold text-ink-2 uppercase">{{ cat(g.category) }}</td></tr>
                      @for (row of g.rows; track row.code) {
                        <tr>
                          <td class="num whitespace-nowrap">{{ row.code }}</td>
                          <td class="max-w-64 truncate text-ink">{{ row.name }}</td>
                          <td class="cell-muted whitespace-nowrap">{{ date(row.acquisitionDate) }}</td>
                          <td class="col-num num">{{ money(row.cost) }}</td>
                          <td class="text-sm">{{ ('assets.methodName.' + row.method) | translate }}</td>
                          <td class="col-num num">{{ pct(row.rate) }}</td>
                          <td class="col-num num">{{ money(row.accumulatedStart) }}</td>
                          <td class="col-num num">{{ money(row.depreciationYear) }}</td>
                          <td class="col-num num">{{ money(row.accumulatedEnd) }}</td>
                          <td class="col-num num">{{ money(row.netBookValue) }}</td>
                          <td class="text-xs text-ink-2 whitespace-nowrap">
                            @if (row.disposal; as d) { {{ date(d.date) }} · {{ money(d.price) }} } @else { — }
                          </td>
                        </tr>
                      }
                      @if (g.totals; as t) {
                        <tr class="font-medium">
                          <td colspan="3">{{ 'assets.subtotal' | translate }}</td>
                          <td class="col-num num">{{ money(t.cost) }}</td><td></td><td></td>
                          <td class="col-num num">{{ money(t.accumulatedStart) }}</td>
                          <td class="col-num num">{{ money(t.depreciationYear) }}</td>
                          <td class="col-num num">{{ money(t.accumulatedEnd) }}</td>
                          <td class="col-num num">{{ money(t.netBookValue) }}</td><td></td>
                        </tr>
                      }
                    } @empty {
                      <tr><td colspan="11" class="row-empty text-sm text-ink-3">{{ 'assets.registerEmpty' | translate }}</td></tr>
                    }
                    @if (r.totals; as t) {
                      <tr class="font-semibold">
                        <td colspan="3">{{ 'assets.total' | translate }}</td>
                        <td class="col-num num">{{ money(t.cost) }}</td><td></td><td></td>
                        <td class="col-num num">{{ money(t.accumulatedStart) }}</td>
                        <td class="col-num num">{{ money(t.depreciationYear) }}</td>
                        <td class="col-num num">{{ money(t.accumulatedEnd) }}</td>
                        <td class="col-num num">{{ money(t.netBookValue) }}</td><td></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- One asset -->
    @if (selected(); as a) {
      <aside class="drawer-panel asset-drawer" role="dialog" aria-modal="false" aria-labelledby="asset-drawer-title">
        <header class="flex items-start justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
          <div class="min-w-0">
            <h2 id="asset-drawer-title" class="section-title truncate">{{ a.name }}</h2>
            <p class="text-xs text-ink-3"><span class="num">{{ a.code }}</span> · {{ cat(a.category) }}</p>
          </div>
          <button class="btn-icon btn-sm shrink-0" (click)="selected.set(null)" [attr.aria-label]="'ledger.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </header>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt class="text-ink-3">{{ 'assets.status' | translate }}</dt>
            <dd><span class="badge" [class]="statusClass(a.status)">{{ ('assets.statusName.' + a.status) | translate }}</span></dd>
            <dt class="text-ink-3">{{ 'assets.acquisitionDate' | translate }}</dt><dd class="text-ink">{{ date(a.acquisitionDate) }}</dd>
            <dt class="text-ink-3">{{ 'assets.startDate' | translate }}</dt><dd class="text-ink">{{ date(a.startDate || a.acquisitionDate) }}</dd>
            <dt class="text-ink-3">{{ 'assets.method' | translate }}</dt>
            <dd class="text-ink">{{ ('assets.methodName.' + a.method) | translate }} · {{ years(a.usefulLifeMonths) }}@if (a.coefficient) { · ×{{ a.coefficient }} }</dd>
            <dt class="text-ink-3">{{ 'assets.cost' | translate }}</dt><dd class="text-ink num">{{ money(a.acquisitionCost) }}</dd>
            @if (a.residualValue) { <dt class="text-ink-3">{{ 'assets.residual' | translate }}</dt><dd class="text-ink num">{{ money(a.residualValue) }}</dd> }
            <dt class="text-ink-3">{{ 'assets.accumulated' | translate }}</dt><dd class="text-ink num">{{ money(a.accumulatedDepreciation) }}</dd>
            <dt class="text-ink-3">{{ 'assets.nbv' | translate }}</dt><dd class="text-ink num font-semibold">{{ money(a.netBookValue) }}</dd>
            <dt class="text-ink-3">{{ 'assets.accounts' | translate }}</dt>
            <dd class="text-ink num">{{ a.assetAccountCode || '—' }} / {{ a.depreciationAccountCode || '—' }} / {{ a.expenseAccountCode || '—' }}</dd>
            @if (a.status === 'DISPOSED') {
              <dt class="text-ink-3">{{ 'assets.disposedOn' | translate }}</dt><dd class="text-ink">{{ date(a.disposedAt) }} · {{ money(a.disposalPrice) }}</dd>
            }
            @if (a.supplierInvoiceId) {
              <dt class="text-ink-3">{{ 'assets.supplierBill' | translate }}</dt>
              <dd><a class="text-accent-ink hover:underline" routerLink="/finance" [queryParams]="{ tab: 'Vendor' }">{{ 'assets.openBills' | translate }}</a></dd>
            }
          </dl>

          @if (canWrite()) {
            <div class="flex flex-wrap gap-2">
              @if (a.status !== 'DISPOSED') {
                <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="openDispose(a)"><mat-icon>sell</mat-icon>{{ 'assets.dispose' | translate }}</button>
              }
              @if (editable()) {
                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="editing.set(a)"><mat-icon>edit</mat-icon>{{ 'assets.edit' | translate }}</button>
                <button class="btn-ghost btn-sm btn-danger-hover" [disabled]="busy()" (click)="remove(a)"><mat-icon>delete</mat-icon>{{ 'assets.delete' | translate }}</button>
              }
            </div>
          }

          <div>
            <h3 class="card-title mb-2">{{ 'assets.schedule' | translate }}</h3>
            <div class="table-card">
              <div class="overflow-x-auto">
                <table class="data-table is-dense">
                  <thead><tr>
                    <th>{{ 'assets.month' | translate }}</th>
                    <th class="col-num">{{ 'assets.amount' | translate }}</th>
                    <th class="col-num">{{ 'assets.cumulated' | translate }}</th>
                    <th class="col-num">{{ 'assets.nbv' | translate }}</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    @for (s of schedule(); track s.year * 100 + s.month) {
                      <tr>
                        <td class="num whitespace-nowrap">{{ pad(s.month) }}/{{ s.year }}</td>
                        <td class="col-num num">{{ money(s.amount) }}</td>
                        <td class="col-num num">{{ money(s.cumulated) }}</td>
                        <td class="col-num num">{{ money(s.netBookValue) }}</td>
                        <td>
                          @if (s.entryId) {
                            <a class="btn-icon btn-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: s.entryId }"
                               [attr.title]="'ledger.viewEntry' | translate" [attr.aria-label]="'ledger.viewEntry' | translate"><mat-icon class="icon-sm text-success-ink">check_circle</mat-icon></a>
                          }
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="row-empty text-sm text-ink-3">{{ 'assets.noSchedule' | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </aside>
    }

    @if (creating()) {
      <app-asset-dialog (saved)="onSaved($event)" (closed)="creating.set(false)" />
    }
    @if (editing(); as a) {
      <app-asset-dialog [asset]="a" (saved)="onSaved($event)" (closed)="editing.set(null)" />
    }

    @if (depreciateOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="depreciate-title">
          <div class="modal-header">
            <h3 id="depreciate-title" class="modal-title">{{ 'assets.depreciateTitle' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="depreciateOpen.set(false)" [attr.aria-label]="'assets.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <p class="text-sm text-ink-2">{{ 'assets.depreciateHint' | translate }}</p>
          <label class="block"><span class="field-label">{{ 'assets.upTo' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="upTo()" (ngModelChange)="upTo.set($event)" /></label>
          @if (depResult(); as r) {
            <div class="alert alert-success text-sm">{{ 'assets.depreciated' | translate: { months: r.months, entries: r.entries, total: money(r.total) } }}</div>
          }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="depreciateOpen.set(false)">{{ (depResult() ? 'ledger.close' : 'assets.cancel') | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !upTo()" (click)="depreciate()">{{ 'assets.depreciate' | translate }}</button>
          </div>
        </div>
      </div>
    }

    @if (disposing(); as a) {
      <div class="modal-backdrop">
        <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="dispose-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="dispose-title" class="modal-title">{{ 'assets.disposeTitle' | translate }}</h3>
              <p class="text-xs text-ink-3">{{ a.code }} · {{ a.name }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="disposing.set(null)" [attr.aria-label]="'assets.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <div class="grid grid-cols-2 gap-3">
              <label class="block"><span class="field-label">{{ 'assets.disposeDate' | translate }}</span>
                <input type="date" class="input-field" [ngModel]="disposeDate()" (ngModelChange)="disposeDate.set($event)" /></label>
              <label class="block"><span class="field-label">{{ 'assets.price' | translate }}</span>
                <input type="number" min="0" step="0.01" class="input-field" [ngModel]="disposePrice()" (ngModelChange)="disposePrice.set(+$event || 0)" /></label>
            </div>
            <label class="block"><span class="field-label">{{ 'assets.paidTo' | translate }}</span>
              <select class="input-field" [ngModel]="disposePaidTo()" (ngModelChange)="disposePaidTo.set($event)">
                <option value="BANK">{{ 'assets.paidFromName.BANK' | translate }}</option>
                <option value="SUSPENSE">{{ 'assets.paidFromName.SUSPENSE' | translate }}</option>
              </select></label>
            <p class="text-xs text-ink-3">{{ 'assets.disposeHint' | translate: { nbv: money(a.netBookValue) } }}</p>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="disposing.set(null)">{{ 'assets.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !disposeDate()" (click)="dispose(a)">{{ 'assets.dispose' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`.asset-drawer { width: min(560px, 100vw); }`],
})
export class AssetsComponent implements OnInit {
  private api = inject(AssetsApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly statuses: StatusFilter[] = ['ALL', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED'];
  readonly yearOptions = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

  view = signal<View>('list');
  assets = signal<FixedAsset[]>([]);
  categories = signal<AssetCategory[]>(FALLBACK_ASSET_CATEGORIES);
  status = signal<StatusFilter>('ALL');
  selected = signal<FixedAsset | null>(null);
  schedule = signal<ScheduleRow[]>([]);
  creating = signal(false);
  editing = signal<FixedAsset | null>(null);
  busy = signal(false);

  depreciateOpen = signal(false);
  upTo = signal(lastMonthEnd());
  depResult = signal<DepreciationResult | null>(null);

  disposing = signal<FixedAsset | null>(null);
  disposeDate = signal(isoDay(new Date()));
  disposePrice = signal(0);
  disposePaidTo = signal<'BANK' | 'SUSPENSE'>('BANK');

  registerYear = signal(new Date().getFullYear() - 1);
  register = signal<AssetRegister | null>(null);

  filtered = computed(() => {
    const s = this.status();
    return s === 'ALL' ? this.assets() : this.assets().filter(a => a.status === s);
  });

  totals = computed(() => this.filtered().reduce((t, a) => ({
    cost: round2(t.cost + (Number(a.acquisitionCost) || 0)),
    accumulated: round2(t.accumulated + (Number(a.accumulatedDepreciation) || 0)),
    nbv: round2(t.nbv + (Number(a.netBookValue) || 0)),
  }), { cost: 0, accumulated: 0, nbv: 0 }));

  /** Edit and delete only while no depreciation is posted. */
  editable = computed(() => {
    const a = this.selected();
    return !!a && a.status !== 'DISPOSED' && !this.schedule().some(s => !!s.entryId) && !(Number(a.accumulatedDepreciation) > 0);
  });

  registerGroups = computed(() => {
    const r = this.register();
    if (!r) return [];
    const by = new Map<string, RegisterRow[]>();
    for (const row of r.assets ?? []) {
      const k = row.category || '';
      by.set(k, [...(by.get(k) ?? []), row]);
    }
    return [...by.entries()].map(([category, rows]) => ({
      category, rows, totals: (r.categories ?? []).find(c => (c.category || '') === category) ?? null as RegisterTotals | null,
    }));
  });

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('assets.title'));
    this.api.categories().subscribe({ next: c => { if (c?.length) this.categories.set(c); }, error: () => undefined });
    this.load();
  }

  load(): void {
    this.api.list().subscribe({
      next: list => {
        this.assets.set(list ?? []);
        const sel = this.selected();
        if (sel) {
          const fresh = (list ?? []).find(a => a.id === sel.id) ?? null;
          this.selected.set(fresh);
          if (fresh) this.loadSchedule(fresh.id);
        }
      },
      error: e => this.fail(e),
    });
  }

  open(a: FixedAsset): void {
    this.selected.set(a);
    this.loadSchedule(a.id);
  }

  private loadSchedule(id: string): void {
    this.schedule.set([]);
    this.api.schedule(id).subscribe({ next: s => this.schedule.set(s ?? []), error: e => this.fail(e) });
  }

  onSaved(a: FixedAsset): void {
    this.creating.set(false);
    this.editing.set(null);
    this.load();
    if (a?.id) this.open(a);
  }

  async remove(a: FixedAsset): Promise<void> {
    const ok = await this.confirm.ask({ title: this.i18n.t('assets.deleteTitle', { code: a.code }), message: this.i18n.t('assets.deleteText'), danger: true });
    if (!ok) return;
    this.busy.set(true);
    this.api.remove(a.id).subscribe({
      next: () => { this.busy.set(false); this.selected.set(null); this.load(); },
      error: e => this.fail(e),
    });
  }

  openDepreciate(): void {
    this.depResult.set(null);
    this.depreciateOpen.set(true);
  }

  depreciate(): void {
    this.busy.set(true);
    this.api.depreciate(this.upTo()).subscribe({
      next: r => {
        this.busy.set(false);
        this.depResult.set({ months: r?.months ?? 0, entries: r?.entries ?? 0, total: r?.total ?? 0 });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  openDispose(a: FixedAsset): void {
    this.disposeDate.set(isoDay(new Date()));
    this.disposePrice.set(0);
    this.disposePaidTo.set('BANK');
    this.disposing.set(a);
  }

  dispose(a: FixedAsset): void {
    this.busy.set(true);
    this.api.dispose(a.id, { date: this.disposeDate(), price: round2(this.disposePrice()), paidTo: this.disposePaidTo() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.disposing.set(null);
        this.toast.show(this.i18n.t('assets.disposed', { code: a.code }), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  showRegister(): void {
    this.view.set('register');
    if (!this.register()) this.loadRegister();
  }

  loadRegister(): void {
    this.register.set(null);
    this.api.register(this.registerYear()).subscribe({ next: r => this.register.set(r ?? null), error: e => this.fail(e) });
  }

  /** Opens the register alone in a new window and prints it. */
  printRegister(): void {
    const r = this.register();
    if (!r) return;
    const t = (k: string, p?: Record<string, string | number>) => esc(this.i18n.t(k, p));
    const m = (v: number | null | undefined) => esc(this.money(v));
    const head = ['assets.code', 'assets.name', 'assets.acquisitionDate', 'assets.cost', 'assets.method', 'assets.rate',
      'assets.accumulatedStart', 'assets.depreciationYear', 'assets.accumulatedEnd', 'assets.nbv', 'assets.disposal']
      .map((k, i) => `<th${i >= 3 && i !== 4 && i !== 10 ? ' class="n"' : ''}>${t(k)}</th>`).join('');
    const totalRow = (label: string, x: RegisterTotals) =>
      `<tr class="tot"><td colspan="3">${label}</td><td class="n">${m(x.cost)}</td><td></td><td></td><td class="n">${m(x.accumulatedStart)}</td>`
      + `<td class="n">${m(x.depreciationYear)}</td><td class="n">${m(x.accumulatedEnd)}</td><td class="n">${m(x.netBookValue)}</td><td></td></tr>`;
    let body = '';
    for (const g of this.registerGroups()) {
      body += `<tr class="grp"><td colspan="11">${esc(this.cat(g.category))}</td></tr>`;
      for (const row of g.rows) {
        body += `<tr><td>${esc(row.code)}</td><td>${esc(row.name)}</td><td>${esc(this.date(row.acquisitionDate))}</td><td class="n">${m(row.cost)}</td>`
          + `<td>${t('assets.methodName.' + row.method)}</td><td class="n">${esc(this.pct(row.rate))}</td><td class="n">${m(row.accumulatedStart)}</td>`
          + `<td class="n">${m(row.depreciationYear)}</td><td class="n">${m(row.accumulatedEnd)}</td><td class="n">${m(row.netBookValue)}</td>`
          + `<td>${row.disposal ? esc(this.date(row.disposal.date)) + ' · ' + m(row.disposal.price) : ''}</td></tr>`;
      }
      if (g.totals) body += totalRow(t('assets.subtotal'), g.totals);
    }
    if (r.totals) body += totalRow(t('assets.total'), r.totals);
    const dir = document.documentElement.dir || 'ltr';
    const html = `<!doctype html><html dir="${esc(dir)}"><head><meta charset="utf-8"><title>${t('assets.registerTitle', { year: r.year })}</title>
<style>body{font:11px/1.4 system-ui,sans-serif;margin:16px;color:#111}h1{font-size:16px;margin:0 0 12px}table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ccc;padding:3px 5px;text-align:start}th{background:#f3f3f3}.n{text-align:end;white-space:nowrap}
.grp td{background:#fafafa;font-weight:600}.tot td{font-weight:600}@page{size:landscape;margin:12mm}</style></head>
<body><h1>${t('assets.registerTitle', { year: r.year })}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  statusClass(s: AssetStatus): string {
    return s === 'ACTIVE' ? 'badge-success' : s === 'FULLY_DEPRECIATED' ? 'badge-neutral' : 'badge-warning';
  }

  years(months: number): string {
    const y = (Number(months) || 0) / 12;
    return this.i18n.t('assets.lifeYears', { n: Number.isInteger(y) ? y : y.toFixed(1) });
  }

  cat(code: string | null | undefined): string { return assetCategoryLabel(this.i18n, code, this.categories()); }
  pct(v: number | null | undefined): string { return `${(Number(v) || 0).toLocaleString('fr-MA', { maximumFractionDigits: 2 })} %`; }
  pad(n: number): string { return String(n).padStart(2, '0'); }
  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return iso ? shortDate(iso) : '—'; }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('assets.error'), { type: 'error' });
  }
}
