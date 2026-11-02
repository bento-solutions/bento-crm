import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService, Invoice } from '../../services/crm-state.service';
import { AdvanceInvoiceRequest, AdvancesApi } from '../../services/domains/advances.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { determineVatCode, round2, vatFraction } from '../../services/domains/vat';
import { formatMoney } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * "Create advance invoice" (facture d'acompte) on a quote or a deal: an amount or a percentage of
 * the amount before VAT, read before VAT (default) or VAT included, its VAT code, date and due date,
 * with a live "5 000 + TVA 1 000 = 6 000" preview. POST /invoices/advance makes a DRAFT invoice.
 */
@Component({
  selector: 'app-advance-invoice-dialog',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="modal-backdrop">
      <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="advance-dialog-title">
        <div class="modal-header">
          <div class="min-w-0">
            <h3 id="advance-dialog-title" class="modal-title">{{ 'advances.createTitle' | translate }}</h3>
            @if (sourceLabel()) { <p class="text-xs text-ink-3 truncate">{{ sourceLabel() }}</p> }
          </div>
          <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'advances.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </div>

        <fieldset class="space-y-3" [disabled]="busy()">
          <div class="segmented" role="group" [attr.aria-label]="'advances.mode' | translate">
            <button type="button" class="segmented__item" [class.is-active]="mode() === 'amount'" [attr.aria-pressed]="mode() === 'amount'" (click)="mode.set('amount')">{{ 'advances.byAmount' | translate }}</button>
            <button type="button" class="segmented__item" [class.is-active]="mode() === 'percent'" [attr.aria-pressed]="mode() === 'percent'" (click)="mode.set('percent')">{{ 'advances.byPercent' | translate }}</button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="field-label">{{ (mode() === 'amount' ? 'advances.amount' : 'advances.percent') | translate }}</span>
              <input type="number" class="input-field num" min="0" [step]="mode() === 'amount' ? 0.01 : 1" [max]="mode() === 'percent' ? 100 : null"
                     [ngModel]="value()" (ngModelChange)="value.set($event === '' || $event === null ? null : +$event)" /></label>
            <label class="block"><span class="field-label">{{ 'advances.vatCode' | translate }}</span>
              <select class="input-field" [ngModel]="vatCode()" (ngModelChange)="vatCode.set($event)">
                <option [ngValue]="null">{{ 'advances.vatAuto' | translate: { code: groups.vatLabel(autoCode()) } }}</option>
                @for (c of groups.vatCodes(); track c.code) { <option [ngValue]="c.code">{{ groups.vatLabel(c.code) }}</option> }
              </select></label>
          </div>

          @if (mode() === 'amount') {
            <div class="segmented" role="group" [attr.aria-label]="'advances.amountBasis' | translate">
              <button type="button" class="segmented__item" [class.is-active]="!includesVat()" [attr.aria-pressed]="!includesVat()" (click)="includesVat.set(false)">{{ 'advances.beforeVat' | translate }}</button>
              <button type="button" class="segmented__item" [class.is-active]="includesVat()" [attr.aria-pressed]="includesVat()" (click)="includesVat.set(true)">{{ 'advances.vatIncluded' | translate }}</button>
            </div>
          } @else if (baseAmount()) {
            <p class="text-xs text-ink-3">{{ 'advances.percentOf' | translate: { amount: money(baseAmount()) } }}</p>
          }

          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="field-label">{{ 'advances.date' | translate }}</span>
              <input type="date" class="input-field" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
            <label class="block"><span class="field-label">{{ 'advances.dueDate' | translate }}</span>
              <input type="date" class="input-field" [ngModel]="dueDate()" (ngModelChange)="dueDate.set($event)" /></label>
          </div>
          <label class="block"><span class="field-label">{{ 'advances.label' | translate }}</span>
            <input class="input-field" maxlength="255" [placeholder]="'advances.labelHint' | translate" [ngModel]="label()" (ngModelChange)="label.set($event)" /></label>

          @if (preview(); as p) {
            <div class="rounded-lg border border-line bg-subtle px-3 py-2 text-sm" aria-live="polite">
              <span class="num text-ink">{{ money(p.base) }}</span>
              <span class="text-ink-3"> + {{ groups.vatLabel(p.code) }} </span>
              <span class="num text-ink">{{ money(p.vat) }}</span>
              <span class="text-ink-3"> = </span>
              <span class="num font-semibold text-ink">{{ money(p.total) }}</span>
              @if (mode() === 'percent') { <div class="text-meta text-ink-3 mt-0.5">{{ 'advances.previewEstimate' | translate }}</div> }
            </div>
          }
        </fieldset>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="closed.emit()">{{ 'advances.cancel' | translate }}</button>
          <button class="btn-primary" [disabled]="busy() || !valid()" (click)="save()"><mat-icon>request_quote</mat-icon>{{ 'advances.create' | translate }}</button>
        </div>
      </div>
    </div>
  `,
})
export class AdvanceInvoiceDialogComponent implements OnInit {
  private api = inject(AdvancesApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  groups = inject(LedgerGroupsStore);

  partnerId = input.required<string>();
  dealId = input<string | null>(null);
  proposalId = input<string | null>(null);
  /** The quote or deal amount before VAT, for the percentage preview. */
  baseAmount = input<number>(0);
  sourceLabel = input<string>('');

  created = output<Invoice>();
  closed = output<void>();

  mode = signal<'amount' | 'percent'>('percent');
  value = signal<number | null>(30);
  includesVat = signal(false);
  /** null = let the server pick the code (partner, then the quote's lines). */
  vatCode = signal<string | null>(null);
  date = signal(isoDate(new Date()));
  dueDate = signal(isoDate(new Date(Date.now() + 30 * 86_400_000)));
  label = signal('');
  busy = signal(false);

  /** The code the server is expected to pick, for the preview: the partner's business group, else the default product group. */
  autoCode = computed(() => {
    const partner = this.state.partners().find(p => p.id === this.partnerId());
    return determineVatCode(this.groups.vatContext(), { businessGroupId: partner?.businessGroupId ?? null });
  });

  preview = computed(() => {
    const v = Number(this.value());
    if (!(v > 0)) return null;
    const code = this.vatCode() ?? this.autoCode();
    const r = vatFraction(this.groups.vatCodes(), code);
    let base: number;
    if (this.mode() === 'percent') {
      if (!this.baseAmount()) return null;
      base = round2(this.baseAmount() * v / 100);
    } else {
      base = this.includesVat() ? round2(v / (1 + r)) : round2(v);
    }
    const vat = this.mode() === 'amount' && this.includesVat() ? round2(v - base) : round2(base * r);
    return { code, base, vat, total: round2(base + vat) };
  });

  ngOnInit(): void {
    this.groups.ensure();
    if (!this.baseAmount()) this.mode.set('amount');
    if (this.mode() === 'amount') this.value.set(null);
  }

  valid(): boolean {
    const v = Number(this.value());
    if (!(v > 0) || !this.partnerId()) return false;
    return this.mode() === 'amount' || v <= 100;
  }

  save(): void {
    if (!this.valid()) return;
    this.busy.set(true);
    const v = Number(this.value());
    // Only the fields that are set: exactly one of amount and percent goes out.
    const body: AdvanceInvoiceRequest = { partnerId: this.partnerId(), amountIncludesVat: this.mode() === 'amount' && this.includesVat() };
    if (this.dealId()) body.dealId = this.dealId();
    if (this.proposalId()) body.proposalId = this.proposalId();
    if (this.mode() === 'amount') body.amount = v; else body.percent = v;
    if (this.vatCode()) body.vatCode = this.vatCode();
    if (this.date()) body.date = this.date();
    if (this.dueDate()) body.dueDate = this.dueDate();
    if (this.label().trim()) body.label = this.label().trim();
    this.api.createAdvance(body).subscribe({
      next: inv => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('advances.created'), { type: 'success' });
        this.created.emit(inv);
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('advances.error'), { type: 'error' });
      },
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
}
