import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { AdvancesApi, OpenAdvance, OpenAdvancePayment } from '../../services/domains/advances.service';
import { InvoicesService } from '../../services/domains/invoices.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';

/**
 * Partner page → "Open advances": advance invoices not yet deducted from a final invoice, and
 * payments received or paid as advances that no invoice uses yet (with "Apply to an invoice").
 * Hidden when the partner has none.
 */
@Component({
  selector: 'app-open-advances',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    @if (invoices().length || payments().length) {
      <section class="card p-5 space-y-4">
        <div class="flex flex-wrap items-center gap-2 border-b border-line pb-3">
          <mat-icon class="text-ink-2">request_quote</mat-icon>
          <h3 class="card-title">{{ 'advances.openTitle' | translate }}</h3>
          <span class="ms-auto text-sm num text-ink">{{ 'advances.openTotal' | translate: { amount: money(total()) } }}</span>
        </div>

        @if (invoices().length) {
          <div class="overflow-x-auto">
            <table class="data-table is-dense">
              <thead><tr>
                <th>{{ 'advances.invoice' | translate }}</th>
                <th>{{ 'advances.date' | translate }}</th>
                <th class="col-num">{{ 'advances.base' | translate }}</th>
                <th class="col-num">{{ 'advances.vat' | translate }}</th>
                <th class="col-num">{{ 'advances.remaining' | translate }}</th>
                <th>{{ 'advances.statusLabel' | translate }}</th>
              </tr></thead>
              <tbody>
                @for (a of invoices(); track a.id) {
                  <tr>
                    <td class="cell-title whitespace-nowrap">{{ a.number || '—' }}</td>
                    <td class="cell-muted whitespace-nowrap">{{ date(a.date) }}</td>
                    <td class="col-num num">{{ money(a.base) }}</td>
                    <td class="col-num num">{{ money(a.vat) }}</td>
                    <td class="col-num num">{{ money(a.remainingBase + a.remainingVat) }}</td>
                    <td><span class="badge" [class]="a.status === 'PAID' ? 'badge-success' : 'badge-neutral'">{{ ('advances.apiStatus.' + a.status) | translate }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (payments().length) {
          <div class="space-y-2">
            <h4 class="text-sm font-semibold text-ink">{{ 'advances.payments' | translate }}</h4>
            @for (p of payments(); track p.id) {
              <div class="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2">
                <div class="min-w-0 me-auto">
                  <div class="text-sm text-ink">{{ money(p.amount) }} · {{ date(p.paymentDate || p.date) }}</div>
                  @if (p.reference) { <div class="text-meta text-ink-3 truncate">{{ p.reference }}</div> }
                </div>
                @if (canApply()) {
                  @if (applying() === p.id) {
                    <select class="input-field w-auto" [attr.aria-label]="'advances.applyTo' | translate" [ngModel]="applyInvoiceId()" (ngModelChange)="applyInvoiceId.set($event)">
                      <option value="">{{ 'advances.pickInvoice' | translate }}</option>
                      @for (i of openInvoices(); track i.id) { <option [value]="i.id">{{ i.invoiceNumber || i.id.slice(0, 8) }} · {{ money(i.amount) }}</option> }
                    </select>
                    <button class="btn-primary btn-sm" [disabled]="busy() || !applyInvoiceId()" (click)="apply(p)">{{ 'advances.apply' | translate }}</button>
                    <button class="btn-ghost btn-sm" (click)="applying.set(null)">{{ 'advances.cancel' | translate }}</button>
                  } @else {
                    <button class="btn-ghost btn-sm" (click)="startApply(p)"><mat-icon>link</mat-icon>{{ 'advances.applyTo' | translate }}</button>
                  }
                }
              </div>
            }
          </div>
        }
      </section>
    }
  `,
})
export class OpenAdvancesComponent {
  private api = inject(AdvancesApi);
  private state = inject(CrmStateService);
  private invoicesService = inject(InvoicesService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  partnerId = input<string>('');

  invoices = signal<OpenAdvance[]>([]);
  payments = signal<OpenAdvancePayment[]>([]);
  applying = signal<string | null>(null);
  applyInvoiceId = signal('');
  busy = signal(false);

  total = computed(() =>
    this.invoices().reduce((s, a) => s + (Number(a.remainingBase) || 0) + (Number(a.remainingVat) || 0), 0)
    + this.payments().reduce((s, p) => s + (Number(p.amount) || 0), 0));

  /** The partner's unpaid final invoices and bills, which an advance payment can be applied to. */
  openInvoices = computed(() => this.invoicesService.allInvoices().filter(i =>
    i.partnerId === this.partnerId() && (i.kind ?? 'INVOICE') === 'INVOICE' && i.status !== 'Draft' && i.status !== 'Paid' && i.status !== 'Credited'));

  constructor() {
    effect(() => {
      const id = this.partnerId();
      untracked(() => this.load(id));
    });
  }

  canApply(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }

  private load(partnerId: string): void {
    this.invoices.set([]);
    this.payments.set([]);
    if (!partnerId) return;
    if (this.state.hasAuthority('INVOICES_READ')) {
      this.api.openAdvances(partnerId).subscribe({ next: l => this.invoices.set(l ?? []), error: () => { /* none to show */ } });
    }
    if (this.state.hasAuthority('PAYMENTS_READ')) {
      this.api.openAdvancePayments(partnerId).subscribe({ next: l => this.payments.set(l ?? []), error: () => { /* none to show */ } });
    }
  }

  startApply(p: OpenAdvancePayment): void {
    this.invoicesService.load();
    this.applying.set(p.id);
    this.applyInvoiceId.set('');
  }

  apply(p: OpenAdvancePayment): void {
    const invoiceId = this.applyInvoiceId();
    if (!invoiceId) return;
    this.busy.set(true);
    this.api.applyPayment(p.id, invoiceId).subscribe({
      next: () => {
        this.busy.set(false);
        this.applying.set(null);
        this.toast.show(this.i18n.t('advances.applied'), { type: 'success' });
        this.load(this.partnerId());
        this.invoicesService.load(undefined, true);
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('advances.error'), { type: 'error' });
      },
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(v: string | null | undefined): string { return shortDate(v); }
}
