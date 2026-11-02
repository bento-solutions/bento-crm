import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { Invoice } from '../../services/crm-state.service';
import { AdvancesApi, CreditNoteRequest } from '../../services/domains/advances.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { round2, vatFraction } from '../../services/domains/vat';
import { formatMoney } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * "Issue credit note" (avoir) on a sent invoice or bill: the full amount, or some of its lines,
 * with a reason. POST /invoices/{id}/credit-note answers the new CREDIT_NOTE invoice (status SENT).
 */
@Component({
  selector: 'app-credit-note-dialog',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="modal-backdrop">
      <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="credit-note-title">
        <div class="modal-header">
          <div class="min-w-0">
            <h3 id="credit-note-title" class="modal-title">{{ 'creditNotes.title' | translate }}</h3>
            <p class="text-xs text-ink-3">{{ 'creditNotes.for' | translate: { number: invoice().invoiceNumber || invoice().id.slice(0, 8), amount: money(invoice().amount) } }}</p>
          </div>
          <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'advances.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </div>

        <fieldset class="space-y-3" [disabled]="busy()">
          <div class="segmented" role="group" [attr.aria-label]="'creditNotes.scope' | translate">
            <button type="button" class="segmented__item" [class.is-active]="mode() === 'full'" [attr.aria-pressed]="mode() === 'full'" (click)="mode.set('full')">{{ 'creditNotes.full' | translate }}</button>
            <button type="button" class="segmented__item" [class.is-active]="mode() === 'lines'" [attr.aria-pressed]="mode() === 'lines'"
                    [disabled]="!lines().length" (click)="mode.set('lines')">{{ 'creditNotes.selectedLines' | translate }}</button>
          </div>

          @if (mode() === 'lines') {
            <div class="rounded-lg border border-line divide-y divide-line">
              @for (l of lines(); track $index; let i = $index) {
                <label class="choice-row px-3 py-2">
                  <input type="checkbox" [checked]="picked().has(i)" (change)="toggle(i)" />
                  <span class="flex-1 min-w-0 text-sm text-ink truncate">{{ l.item || l.description || '—' }}</span>
                  <span class="text-xs text-ink-3 num whitespace-nowrap">{{ l.qty }} × {{ money(l.unitPrice) }}</span>
                  @if (l.vatCode) { <span class="badge badge-neutral">{{ groups.vatLabel(l.vatCode) }}</span> }
                </label>
              }
            </div>
          }

          <div class="grid grid-cols-3 gap-3">
            <label class="block col-span-2"><span class="field-label">{{ 'creditNotes.reason' | translate }} *</span>
              <input class="input-field" maxlength="255" [ngModel]="reason()" (ngModelChange)="reason.set($event)" [placeholder]="'creditNotes.reasonHint' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'advances.date' | translate }}</span>
              <input type="date" class="input-field" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
          </div>

          <div class="rounded-lg border border-line bg-subtle px-3 py-2 text-sm flex justify-between">
            <span class="text-ink-2">{{ 'creditNotes.amount' | translate }}</span>
            <span class="num font-semibold text-ink">{{ money(total()) }}</span>
          </div>
        </fieldset>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="closed.emit()">{{ 'advances.cancel' | translate }}</button>
          <button class="btn-primary" [disabled]="busy() || !valid()" (click)="save()"><mat-icon>undo</mat-icon>{{ 'creditNotes.issue' | translate }}</button>
        </div>
      </div>
    </div>
  `,
})
export class CreditNoteDialogComponent implements OnInit {
  private api = inject(AdvancesApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  groups = inject(LedgerGroupsStore);

  invoice = input.required<Invoice>();
  created = output<Invoice>();
  closed = output<void>();

  mode = signal<'full' | 'lines'>('full');
  picked = signal<Set<number>>(new Set());
  reason = signal('');
  date = signal(isoDate(new Date()));
  busy = signal(false);

  lines = computed(() => this.invoice().lines ?? []);

  /** The amount credited, VAT included: the invoice total, or the picked lines at their VAT rate. */
  total = computed(() => {
    if (this.mode() === 'full') return this.invoice().amount || 0;
    const codes = this.groups.vatCodes();
    return round2(this.lines().reduce((s, l, i) => {
      if (!this.picked().has(i)) return s;
      const base = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
      const r = l.vatRate !== null && l.vatRate !== undefined ? Number(l.vatRate) : vatFraction(codes, l.vatCode);
      return s + base * (1 + r);
    }, 0));
  });

  ngOnInit(): void {
    this.groups.ensure();
  }

  toggle(i: number): void {
    this.picked.update(set => {
      const next = new Set(set);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  valid(): boolean {
    return !!this.reason().trim() && (this.mode() === 'full' || this.picked().size > 0);
  }

  save(): void {
    if (!this.valid()) return;
    const body: CreditNoteRequest = { reason: this.reason().trim() };
    if (this.date()) body.date = this.date();
    if (this.mode() === 'lines') body.lines = this.lines().filter((_, i) => this.picked().has(i));
    this.busy.set(true);
    this.api.creditNote(this.invoice().id, body).subscribe({
      next: cn => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('creditNotes.issued', { number: cn.invoiceNumber || '' }), { type: 'success' });
        this.created.emit(cn);
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('creditNotes.error'), { type: 'error' });
      },
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
}
