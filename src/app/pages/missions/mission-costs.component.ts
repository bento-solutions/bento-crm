import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ContactOption, DriveApi } from '../../services/domains/drive.service';
import {
  DISBURSEMENT_VAT_RATES, Disbursement, DisbursementQuery, MissionApi, MissionSummary,
} from '../../services/domains/mission.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { isoDate, totalWithVat, vatPercent } from '../../shared/practice.util';
import { errorDetail } from '../bank/bank-labels';

interface CostForm {
  id?: string;
  partnerId: string | null;
  missionId: string | null;
  spentOn: string;
  description: string;
  amount: number | null;
  vatRate: number;
  rebillable: boolean;
}

interface BillForm {
  partnerId: string | null;
  costs: Disbursement[];
  picked: Set<string>;
  loading: boolean;
}

/**
 * Missions → Costs: money paid on a client's behalf (stamp duty, registry fees, travel), and
 * "Bill to client", which puts a client's unbilled rebillable costs on one draft invoice at cost.
 */
@Component({
  selector: 'app-mission-costs',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <label class="block min-w-0"><span class="field-label">{{ 'missions.client' | translate }}</span>
          <select class="input-field" [ngModel]="partnerId()" (ngModelChange)="setClient($event)">
            <option value="">{{ 'missions.allClients' | translate }}</option>
            @for (c of clients(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
          </select></label>
        <label class="block min-w-0"><span class="field-label">{{ 'missions.mission' | translate }}</span>
          <select class="input-field" [ngModel]="missionId()" (ngModelChange)="missionId.set($event); load()">
            <option value="">{{ 'missions.allMissions' | translate }}</option>
            @for (m of filterMissions(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }
          </select></label>
        <label class="col-span-2 inline-flex items-center gap-2 cursor-pointer sm:self-end sm:h-9">
          <input type="checkbox" [ngModel]="unbilled()" (ngModelChange)="unbilled.set($event); load()" />
          <span class="text-sm text-ink">{{ 'missions.unbilledOnly' | translate }}</span>
        </label>
        <div class="col-span-2 flex flex-wrap gap-2 sm:ms-auto">
          @if (canBill()) {
            <button class="btn-secondary" (click)="openBill()"><mat-icon>request_quote</mat-icon>{{ 'missions.bill.action' | translate }}</button>
          }
          @if (canWrite()) {
            <button class="btn-primary" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'missions.cost.add' | translate }}</button>
          }
        </div>
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th class="hidden sm:table-cell">{{ 'missions.cost.date' | translate }}</th>
              <th>{{ 'missions.cost.description' | translate }}</th>
              <th class="hidden md:table-cell">{{ 'missions.client' | translate }}</th>
              <th class="hidden lg:table-cell">{{ 'missions.mission' | translate }}</th>
              <th class="col-num">{{ 'missions.cost.amount' | translate }}</th>
              <th class="hidden md:table-cell">{{ 'missions.cost.invoice' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (c of costs(); track c.id) {
                <tr>
                  <td class="hidden sm:table-cell cell-muted whitespace-nowrap">{{ date(c.spentOn) }}</td>
                  <td class="max-w-40 sm:max-w-64">
                    <div class="cell-title break-words">{{ c.description }}</div>
                    <div class="cell-sub truncate"><span class="sm:hidden">{{ date(c.spentOn) }} · </span><span class="md:hidden">{{ c.partnerName || '—' }}</span>@if (c.missionName) { <span class="lg:hidden"> · {{ c.missionName }}</span> }</div>
                    <div class="md:hidden mt-1">
                      @if (c.invoiceNumber) { <span class="badge badge-success">{{ c.invoiceNumber }}</span> }
                      @else if (!c.rebillable) { <span class="badge badge-neutral">{{ 'missions.notRebillable' | translate }}</span> }
                    </div>
                  </td>
                  <td class="hidden md:table-cell max-w-48 truncate">{{ c.partnerName || '—' }}</td>
                  <td class="hidden lg:table-cell max-w-48 truncate cell-muted">{{ c.missionName || '—' }}</td>
                  <td class="col-num whitespace-nowrap">
                    <div class="num">{{ money(c.amount) }}</div>
                    <div class="text-xs text-ink-3">{{ 'missions.vatN' | translate: { n: vat(c.vatRate) } }}</div>
                  </td>
                  <td class="hidden md:table-cell whitespace-nowrap">
                    @if (c.invoiceNumber) { <span class="badge badge-success">{{ c.invoiceNumber }}</span> }
                    @else if (c.rebillable) { <span class="badge badge-warning">{{ 'missions.toBill' | translate }}</span> }
                    @else { <span class="badge badge-neutral">{{ 'missions.notRebillable' | translate }}</span> }
                  </td>
                  <td class="col-actions whitespace-nowrap">
                    @if (canWrite()) {
                      <button class="btn-icon btn-sm" [disabled]="busy() || !!c.invoiceId" (click)="openForm(c)"
                              [attr.aria-label]="'bank.edit' | translate" [title]="c.invoiceId ? ('missions.cost.invoicedHint' | translate: { number: c.invoiceNumber || '' }) : ('bank.edit' | translate)"><mat-icon class="icon-sm">edit</mat-icon></button>
                      <button class="btn-icon btn-sm" [disabled]="busy() || !!c.invoiceId" (click)="remove(c)"
                              [attr.aria-label]="'bank.delete' | translate" [title]="c.invoiceId ? ('missions.cost.invoicedHint' | translate: { number: c.invoiceNumber || '' }) : ('bank.delete' | translate)"><mat-icon class="icon-sm">delete</mat-icon></button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty">
                  <app-empty-state icon="receipt" [title]="'missions.cost.emptyTitle' | translate" [text]="'missions.cost.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (costs().length) {
          <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 px-5 py-3 border-t border-line text-sm">
            <span class="text-ink-3">{{ 'missions.cost.count' | translate: { n: costs().length } }}</span>
            <span class="text-ink">{{ 'missions.cost.unbilledTotal' | translate }} <span class="num font-medium">{{ money(unbilledTotal()) }}</span></span>
          </div>
        }
      </div>
    </div>

    <!-- Add / edit a cost -->
    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="cost-form-title">
          <div class="modal-header">
            <h3 id="cost-form-title" class="modal-title">{{ (f.id ? 'missions.cost.editTitle' : 'missions.cost.add') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'missions.client' | translate }}</span>
              <select class="input-field" [ngModel]="f.partnerId" (ngModelChange)="formClient(f, $event)">
                <option [ngValue]="null">{{ 'missions.pickClient' | translate }}</option>
                @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'missions.missionOptional' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.missionId" [disabled]="!f.partnerId">
                <option [ngValue]="null">{{ 'missions.noMission' | translate }}</option>
                @for (m of formMissions(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
              </select></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'missions.cost.description' | translate }}</span>
              <input class="input-field" maxlength="255" [(ngModel)]="f.description" [placeholder]="'missions.cost.descriptionPlaceholder' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'missions.cost.date' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.spentOn" /></label>
            <label class="block"><span class="field-label">{{ 'missions.cost.amountHt' | translate }}</span>
              <input type="number" min="0.01" step="0.01" class="input-field num" [(ngModel)]="f.amount" /></label>
            <label class="block"><span class="field-label">{{ 'missions.cost.vat' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.vatRate">
                @for (r of vatRates; track r) { <option [ngValue]="r">{{ vat(r) }} %</option> }
              </select>
              <span class="field-hint">{{ 'missions.cost.vatHint' | translate }}</span></label>
            <label class="choice-row self-end sm:pb-6">
              <input type="checkbox" [(ngModel)]="f.rebillable" />
              <span class="text-sm text-ink">{{ 'missions.cost.rebillable' | translate }}</span>
            </label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.partnerId || !f.description.trim() || !(Number(f.amount) > 0)" (click)="save(f)">{{ 'bank.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Bill to client -->
    @if (bill(); as b) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="bill-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="bill-title" class="modal-title">{{ 'missions.bill.title' | translate }}</h3>
              <p class="modal-subtitle">{{ 'missions.bill.subtitle' | translate }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="bill.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <div class="space-y-3">
            <label class="block"><span class="field-label">{{ 'missions.client' | translate }}</span>
              <select class="input-field" [ngModel]="b.partnerId" (ngModelChange)="billClient($event)" [disabled]="busy()">
                <option [ngValue]="null">{{ 'missions.pickClient' | translate }}</option>
                @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select></label>

            @if (b.partnerId) {
              @if (b.loading) {
                <p class="text-sm text-ink-3">{{ 'bank.loading' | translate }}</p>
              } @else if (!b.costs.length) {
                <p class="text-sm text-ink-3">{{ 'missions.bill.nothing' | translate }}</p>
              } @else {
                <div class="flex items-center justify-between gap-2">
                  <label class="choice-row">
                    <input type="checkbox" [checked]="b.picked.size === b.costs.length" (change)="toggleAll(b)" />
                    <span class="text-sm text-ink">{{ 'missions.bill.all' | translate }}</span>
                  </label>
                  <span class="text-xs text-ink-3">{{ 'missions.bill.picked' | translate: { n: b.picked.size, total: b.costs.length } }}</span>
                </div>
                <ul class="border border-line rounded-lg divide-y divide-line max-h-72 overflow-y-auto">
                  @for (c of b.costs; track c.id) {
                    <li>
                      <label class="flex items-start gap-3 px-3 py-2 cursor-pointer">
                        <input type="checkbox" class="mt-1" [checked]="b.picked.has(c.id)" (change)="toggle(b, c.id)" />
                        <span class="flex-1 min-w-0">
                          <span class="block text-sm text-ink break-words">{{ c.description }}</span>
                          <span class="block text-xs text-ink-3 truncate">{{ date(c.spentOn) }}@if (c.missionName) { · {{ c.missionName }} } · {{ 'missions.vatN' | translate: { n: vat(c.vatRate) } }}</span>
                        </span>
                        <span class="num text-sm text-ink whitespace-nowrap">{{ money(c.amount) }}</span>
                      </label>
                    </li>
                  }
                </ul>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-ink-2">{{ 'missions.bill.total' | translate }}</span>
                  <span class="num font-semibold text-ink">{{ money(billTotal()) }}</span>
                </div>
                <p class="text-xs text-ink-3">{{ 'missions.bill.hint' | translate }}</p>
              }
            }
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="bill.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !b.partnerId || !b.picked.size" (click)="confirmBill(b)"><mat-icon>request_quote</mat-icon>{{ 'missions.bill.confirm' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MissionCostsComponent implements OnInit {
  private api = inject(MissionApi);
  private drive = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  /** Filter to open with (from a mission's panel). */
  initialFilter = input<DisbursementQuery | null>(null);

  readonly vatRates = DISBURSEMENT_VAT_RATES;
  readonly Number = Number;

  costs = signal<Disbursement[]>([]);
  clients = signal<ContactOption[]>([]);
  missions = signal<MissionSummary[]>([]);
  partnerId = signal('');
  missionId = signal('');
  unbilled = signal(false);
  busy = signal(false);
  form = signal<CostForm | null>(null);
  formMissions = signal<MissionSummary[]>([]);
  bill = signal<BillForm | null>(null);

  /** The mission filter only offers the chosen client's missions. */
  filterMissions = computed(() => {
    const p = this.partnerId();
    return p ? this.missions().filter(m => m.partnerId === p) : this.missions();
  });
  unbilledTotal = computed(() => this.costs().filter(c => c.rebillable && !c.invoiceId).reduce((s, c) => s + (Number(c.amount) || 0), 0));
  billTotal = computed(() => {
    const b = this.bill();
    return b ? totalWithVat(b.costs.filter(c => b.picked.has(c.id))) : 0;
  });

  canWrite(): boolean { return this.state.hasAuthority('PARTNERS_WRITE'); }
  canBill(): boolean { return this.canWrite() && this.state.hasAuthority('INVOICES_CREATE'); }

  ngOnInit(): void {
    const initial = this.initialFilter();
    if (initial) {
      this.partnerId.set(initial.partnerId ?? '');
      this.missionId.set(initial.missionId ?? '');
      this.unbilled.set(!!initial.unbilled);
    }
    this.drive.contacts('CUSTOMER').subscribe({ next: c => this.clients.set(c), error: () => { /* the filter stays empty */ } });
    this.api.list().subscribe({ next: m => this.missions.set(m ?? []), error: () => { /* mission filter stays empty */ } });
    this.load();
  }

  load(): void {
    this.api.disbursements({ partnerId: this.partnerId() || null, missionId: this.missionId() || null, unbilled: this.unbilled() }).subscribe({
      next: c => this.costs.set(c ?? []),
      error: e => this.fail(e),
    });
  }

  setClient(id: string): void {
    this.partnerId.set(id);
    if (this.missionId() && !this.filterMissions().some(m => m.id === this.missionId())) this.missionId.set('');
    this.load();
  }

  // Cost form
  openForm(c?: Disbursement): void {
    const f: CostForm = c ? {
      id: c.id, partnerId: c.partnerId, missionId: c.missionId ?? null, spentOn: c.spentOn, description: c.description,
      amount: c.amount, vatRate: this.closestRate(c.vatRate), rebillable: c.rebillable,
    } : {
      partnerId: this.partnerId() || null, missionId: this.missionId() || null, spentOn: isoDate(new Date()),
      description: '', amount: null, vatRate: 0, rebillable: true,
    };
    this.form.set(f);
    this.loadFormMissions(f.partnerId);
  }

  formClient(f: CostForm, partnerId: string | null): void {
    f.partnerId = partnerId;
    f.missionId = null;
    this.loadFormMissions(partnerId);
  }

  private loadFormMissions(partnerId: string | null): void {
    this.formMissions.set(partnerId ? this.missions().filter(m => m.partnerId === partnerId) : []);
    if (!partnerId) return;
    this.api.list(partnerId).subscribe({ next: m => this.formMissions.set(m ?? []), error: () => { /* keep the cached ones */ } });
  }

  save(f: CostForm): void {
    this.busy.set(true);
    this.api.saveDisbursement({
      partnerId: f.partnerId, missionId: f.missionId, spentOn: f.spentOn || null, description: f.description.trim(),
      amount: Number(f.amount), vatRate: f.vatRate, rebillable: f.rebillable,
    }, f.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('missions.cost.saved'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async remove(c: Disbursement): Promise<void> {
    if (c.invoiceId) return;
    if (!(await this.confirm.ask({ title: this.i18n.t('missions.cost.confirmDelete', { description: c.description }), danger: true }))) return;
    this.busy.set(true);
    this.api.deleteDisbursement(c.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('missions.cost.deleted'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  // Billing
  openBill(): void {
    this.bill.set({ partnerId: null, costs: [], picked: new Set(), loading: false });
    if (this.partnerId()) this.billClient(this.partnerId());
  }

  billClient(partnerId: string | null): void {
    this.bill.set({ partnerId, costs: [], picked: new Set(), loading: !!partnerId });
    if (!partnerId) return;
    this.api.disbursements({ partnerId, unbilled: true }).subscribe({
      next: rows => {
        if (this.bill()?.partnerId !== partnerId) return;
        const costs = (rows ?? []).filter(c => c.rebillable && !c.invoiceId);
        this.bill.set({ partnerId, costs, picked: new Set(costs.map(c => c.id)), loading: false });
      },
      error: e => { this.bill.update(b => (b ? { ...b, loading: false } : b)); this.fail(e); },
    });
  }

  toggle(b: BillForm, id: string): void {
    const picked = new Set(b.picked);
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    this.bill.set({ ...b, picked });
  }

  toggleAll(b: BillForm): void {
    const all = b.picked.size === b.costs.length;
    this.bill.set({ ...b, picked: new Set(all ? [] : b.costs.map(c => c.id)) });
  }

  confirmBill(b: BillForm): void {
    if (!b.partnerId || !b.picked.size) return;
    this.busy.set(true);
    this.api.bill(b.partnerId, b.costs.filter(c => b.picked.has(c.id)).map(c => c.id)).subscribe({
      next: r => {
        this.busy.set(false);
        this.bill.set(null);
        this.toast.show(this.i18n.t('missions.bill.done', { number: r.invoiceNumber || '', n: r.lines, total: this.money(r.total) }), {
          type: 'success',
          duration: 10000,
          action: { label: this.i18n.t('missions.bill.openFinance'), onClick: () => this.openFinance() },
        });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  /** The draft invoice is under Finance → Customer invoices. */
  openFinance(): void {
    this.state.navigateTab.set('Customer');
    this.router.navigate(['/finance']);
  }

  // Display
  private closestRate(rate: number | null | undefined): number {
    const r = Number(rate) || 0;
    return this.vatRates.reduce((best, v) => (Math.abs(v - r) < Math.abs(best - r) ? v : best), 0);
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  vat(rate: number | null | undefined): number { return vatPercent(rate); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
