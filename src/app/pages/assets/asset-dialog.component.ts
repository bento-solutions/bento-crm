import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { Invoice } from '../../services/crm-state.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import {
  AssetCategory, AssetPaidFrom, AssetRequest, AssetsApi, DepreciationMethod, FALLBACK_ASSET_CATEGORIES, FixedAsset,
} from '../../services/domains/assets.service';
import { isoDay } from '../../services/domains/closing.service';
import { round2 } from '../../services/domains/vat';
import { formatMoney } from '../../shared/bank.util';
import { errorDetail } from '../ledger/ledger-labels';
import { assetCategoryLabel } from './asset-labels';

interface Form {
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  startDate: string;
  acquisitionCost: number;
  residualValue: number;
  method: DepreciationMethod;
  usefulLifeMonths: number;
  paidFrom: 'BANK' | 'SUSPENSE';
  costCenterId: string;
}

/**
 * Creates or edits a fixed asset: from scratch (an acquisition entry posts against the bank or
 * 4497), or from a supplier bill line (the bill is re-posted with that line on the asset account).
 */
@Component({
  selector: 'app-asset-dialog',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="modal-backdrop">
      <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title">
        <div class="modal-header">
          <div class="min-w-0">
            <h3 id="asset-dialog-title" class="modal-title">{{ (asset() ? 'assets.editTitle' : 'assets.newTitle') | translate }}</h3>
            @if (bill(); as b) {
              <p class="text-xs text-ink-3">{{ 'assets.fromBill' | translate: { number: b.invoiceNumber || b.id.slice(0, 8) } }}</p>
            }
          </div>
          <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'assets.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </div>

        <fieldset class="space-y-4" [disabled]="busy()">
          @if (bill(); as b) {
            <div>
              <p class="field-label">{{ 'assets.billLine' | translate }}</p>
              <div class="rounded-lg border border-line divide-y divide-line">
                @for (l of b.lines ?? []; track $index; let i = $index) {
                  <label class="choice-row px-3 py-2">
                    <input type="radio" name="asset-bill-line" [checked]="lineIndex() === i" (change)="pickLine(i)" />
                    <span class="flex-1 min-w-0 text-sm text-ink truncate">{{ l.item || l.description || '—' }}</span>
                    <span class="text-xs text-ink-3 num whitespace-nowrap">{{ l.qty }} × {{ money(l.unitPrice) }}</span>
                  </label>
                } @empty {
                  <p class="px-3 py-2 text-sm text-ink-3">{{ 'assets.noBillLines' | translate }}</p>
                }
              </div>
            </div>
          }

          <div class="grid gap-3 sm:grid-cols-3">
            <label class="block sm:col-span-2"><span class="field-label">{{ 'assets.name' | translate }} *</span>
              <input class="input-field" maxlength="160" [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" /></label>
            <label class="block"><span class="field-label">{{ 'assets.code' | translate }}</span>
              <input class="input-field" maxlength="30" [placeholder]="'assets.codeAuto' | translate" [ngModel]="form().code" (ngModelChange)="patch({ code: $event })" /></label>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <label class="block"><span class="field-label">{{ 'assets.category' | translate }} *</span>
              <select class="input-field" [ngModel]="form().category" (ngModelChange)="setCategory($event)">
                @for (c of categories(); track c.code) { <option [value]="c.code">{{ catLabel(c.code) }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'assets.acquisitionDate' | translate }} *</span>
              <input type="date" class="input-field" [ngModel]="form().acquisitionDate" (ngModelChange)="patch({ acquisitionDate: $event })" /></label>
            <label class="block"><span class="field-label">{{ 'assets.startDate' | translate }}</span>
              <input type="date" class="input-field" [ngModel]="form().startDate" (ngModelChange)="patch({ startDate: $event })" /></label>
          </div>
          @if (category(); as c) {
            <p class="text-xs text-ink-3 -mt-2">{{ 'assets.accountsHint' | translate: { asset: c.assetAccountCode || '—', depreciation: c.depreciationAccountCode || '—', expense: c.expenseAccountCode || '—' } }}</p>
          }

          <div class="grid gap-3 sm:grid-cols-4">
            <label class="block"><span class="field-label">{{ 'assets.cost' | translate }} *</span>
              <input type="number" min="0" step="0.01" class="input-field" [ngModel]="form().acquisitionCost" (ngModelChange)="patch({ acquisitionCost: +$event || 0 })" /></label>
            <label class="block"><span class="field-label">{{ 'assets.residual' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field" [ngModel]="form().residualValue" (ngModelChange)="patch({ residualValue: +$event || 0 })" /></label>
            <label class="block"><span class="field-label">{{ 'assets.method' | translate }}</span>
              <select class="input-field" [ngModel]="form().method" (ngModelChange)="patch({ method: $event })">
                <option value="LINEAR">{{ 'assets.methodName.LINEAR' | translate }}</option>
                <option value="DECLINING">{{ 'assets.methodName.DECLINING' | translate }}</option>
              </select></label>
            <label class="block"><span class="field-label">{{ 'assets.lifeMonths' | translate }}</span>
              <input type="number" min="1" step="1" class="input-field" [ngModel]="form().usefulLifeMonths" (ngModelChange)="patch({ usefulLifeMonths: +$event || 0 })" /></label>
          </div>
          <p class="text-xs text-ink-3 -mt-2">{{ rateHint() }}</p>

          <div class="grid gap-3 sm:grid-cols-2">
            @if (!bill() && !asset()) {
              <label class="block"><span class="field-label">{{ 'assets.paidFrom' | translate }}</span>
                <select class="input-field" [ngModel]="form().paidFrom" (ngModelChange)="patch({ paidFrom: $event })">
                  <option value="BANK">{{ 'assets.paidFromName.BANK' | translate }}</option>
                  <option value="SUSPENSE">{{ 'assets.paidFromName.SUSPENSE' | translate }}</option>
                </select></label>
            }
            @if (groups.costCenters().length) {
              <label class="block"><span class="field-label">{{ 'assets.costCenter' | translate }}</span>
                <select class="input-field" [ngModel]="form().costCenterId" (ngModelChange)="patch({ costCenterId: $event })">
                  <option value="">—</option>
                  @for (c of groups.costCenters(); track c.id) { <option [value]="c.id">{{ c.code }} · {{ c.name }}</option> }
                </select></label>
            }
          </div>
          @if (bill()) {
            <p class="text-xs text-ink-3">{{ 'assets.fromBillHint' | translate }}</p>
          } @else if (!asset()) {
            <p class="text-xs text-ink-3">{{ 'assets.acquisitionHint' | translate }}</p>
          }
        </fieldset>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="closed.emit()">{{ 'assets.cancel' | translate }}</button>
          <button class="btn-primary" [disabled]="busy() || !valid()" (click)="save()">{{ 'assets.save' | translate }}</button>
        </div>
      </div>
    </div>
  `,
})
export class AssetDialogComponent implements OnInit {
  private api = inject(AssetsApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  groups = inject(LedgerGroupsStore);

  /** The asset to edit; null to create one. */
  asset = input<FixedAsset | null>(null);
  /** A supplier bill: the asset is created from one of its lines. */
  bill = input<Invoice | null>(null);
  /** The bill line to start with. */
  billLine = input<number | null>(null);
  saved = output<FixedAsset>();
  closed = output<void>();

  categories = signal<AssetCategory[]>(FALLBACK_ASSET_CATEGORIES);
  lineIndex = signal<number | null>(null);
  busy = signal(false);
  form = signal<Form>({
    code: '', name: '', category: 'IT_EQUIPMENT', acquisitionDate: isoDay(new Date()), startDate: '',
    acquisitionCost: 0, residualValue: 0, method: 'LINEAR', usefulLifeMonths: 60, paidFrom: 'BANK', costCenterId: '',
  });

  category = computed(() => this.categories().find(c => c.code === this.form().category) ?? null);

  rateHint = computed(() => {
    const f = this.form();
    const years = f.usefulLifeMonths / 12;
    if (!(years > 0)) return '';
    const linear = 100 / years;
    if (f.method === 'LINEAR') return this.i18n.t('assets.rateLinear', { rate: linear.toFixed(2) });
    const coef = years < 5 ? 1.5 : years <= 6 ? 2 : 3;
    return this.i18n.t('assets.rateDeclining', { coef, rate: (linear * coef).toFixed(2) });
  });

  ngOnInit(): void {
    this.groups.ensure(true);
    this.api.categories().subscribe({ next: c => { if (c?.length) this.categories.set(c); }, error: () => undefined });
    const a = this.asset();
    if (a) {
      this.form.set({
        code: a.code ?? '', name: a.name, category: a.category, acquisitionDate: a.acquisitionDate, startDate: a.startDate ?? '',
        acquisitionCost: Number(a.acquisitionCost) || 0, residualValue: Number(a.residualValue) || 0, method: a.method,
        usefulLifeMonths: a.usefulLifeMonths, paidFrom: 'BANK', costCenterId: a.costCenterId ?? '',
      });
      return;
    }
    const b = this.bill();
    if (b) {
      this.patch({ acquisitionDate: b.invoiceDate || this.form().acquisitionDate });
      const lines = b.lines ?? [];
      const start = this.billLine() ?? (lines.length === 1 ? 0 : null);
      if (start !== null && lines[start]) this.pickLine(start);
    }
  }

  patch(change: Partial<Form>): void {
    this.form.update(f => ({ ...f, ...change }));
  }

  setCategory(code: string): void {
    const c = this.categories().find(x => x.code === code);
    this.patch({ category: code, ...(c?.defaultLifeMonths ? { usefulLifeMonths: c.defaultLifeMonths } : {}) });
  }

  pickLine(i: number): void {
    const l = this.bill()?.lines?.[i];
    if (!l) return;
    this.lineIndex.set(i);
    this.patch({
      name: this.form().name || l.item || l.description || '',
      acquisitionCost: round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)),
    });
  }

  valid(): boolean {
    const f = this.form();
    return !!f.name.trim() && !!f.category && !!f.acquisitionDate && f.acquisitionCost > 0 && f.usefulLifeMonths > 0
      && f.residualValue >= 0 && f.residualValue < f.acquisitionCost && (!this.bill() || this.lineIndex() !== null);
  }

  save(): void {
    if (!this.valid()) return;
    const f = this.form();
    const body: AssetRequest = {
      name: f.name.trim(), category: f.category, acquisitionDate: f.acquisitionDate,
      acquisitionCost: round2(f.acquisitionCost), method: f.method, usefulLifeMonths: Math.round(f.usefulLifeMonths),
    };
    if (f.code.trim()) body.code = f.code.trim();
    if (f.startDate) body.startDate = f.startDate;
    if (f.residualValue) body.residualValue = round2(f.residualValue);
    if (f.costCenterId) body.costCenterId = f.costCenterId;
    const b = this.bill();
    if (b) {
      body.supplierInvoiceId = b.id;
      body.supplierInvoiceLineIndex = this.lineIndex();
      body.paidFrom = 'SUPPLIER_BILL' as AssetPaidFrom;
    } else if (!this.asset()) {
      body.paidFrom = f.paidFrom;
    }
    const a = this.asset();
    if (a) {
      // Edits keep how the asset was acquired.
      if (a.supplierInvoiceId) { body.supplierInvoiceId = a.supplierInvoiceId; body.supplierInvoiceLineIndex = a.supplierInvoiceLineIndex ?? null; }
    }
    this.busy.set(true);
    (a ? this.api.update(a.id, body) : this.api.create(body)).subscribe({
      next: saved => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('assets.saved', { code: saved?.code ?? '' }), { type: 'success' });
        this.saved.emit(saved);
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('assets.error'), { type: 'error' });
      },
    });
  }

  catLabel(code: string): string { return assetCategoryLabel(this.i18n, code, this.categories()); }
  money(v: number | null | undefined): string { return formatMoney(v); }
}
