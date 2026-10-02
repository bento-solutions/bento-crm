import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';
import { PartnerLedger } from './partner-ledger.model';
import { formatCurrency, formatSignedCurrency, formatDate } from './format';

type LedgerTab = 'open' | 'closed' | 'transactions';

/**
 * The three account views for one partner: open invoices, closed invoices, and the signed
 * movement list ("le grand livre").
 *
 * `mode` only changes wording — which side money is owed from, and the legend explaining the
 * signs. The amounts themselves arrive already signed from the server, so the customer and
 * supplier views are the same data path and cannot drift apart.
 */
@Component({
  selector: 'app-partner-ledger',
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="card overflow-hidden">
      <div class="p-6 pb-0 flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-muted-strong text-ink flex items-center justify-center">
          <mat-icon class="icon-md">account_balance</mat-icon>
        </div>
        <h3 class="card-title">
          {{ mode() === 'supplier' ? 'Supplier Account' : 'Customer Account' }}
        </h3>
      </div>

      @if (ledger(); as data) {
        <!-- Summary strip -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6 pb-4">
          <div class="bg-surface rounded-xl p-3">
            <span class="eyebrow block">Total Invoiced</span>
            <span class="text-lg font-semibold text-ink">{{ money(data.totals.totalInvoiced) }}</span>
          </div>
          <div class="bg-surface rounded-xl p-3">
            <span class="eyebrow block">Total Paid</span>
            <span class="text-lg font-semibold text-ink">{{ money(data.totals.totalPaid) }}</span>
          </div>
          <div class="bg-surface rounded-xl p-3">
            <span class="eyebrow block">Outstanding</span>
            <span class="text-lg font-semibold text-ink">{{ money(data.totals.totalOpen) }}</span>
          </div>
          <div class="bg-surface rounded-xl p-3">
            <span class="eyebrow block">Overdue</span>
            <span class="text-lg font-semibold" [class]="data.totals.totalOverdue > 0 ? 'text-danger-ink' : 'text-ink'">
              {{ money(data.totals.totalOverdue) }}
            </span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 flex gap-6 border-b border-line-soft">
          <button (click)="activeTab.set('open')" (keydown.escape)="activeTab.set('open')"
            [class.is-active]="activeTab() === 'open'"
            class="tab">
            Open Invoices
            <span class="text-xs bg-muted-strong text-ink-2 rounded-full px-1.5">{{ data.openInvoices.length }}</span>
          </button>
          <button (click)="activeTab.set('closed')" (keydown.escape)="activeTab.set('closed')"
            [class.is-active]="activeTab() === 'closed'"
            class="tab">
            Closed Invoices
            <span class="text-xs bg-muted-strong text-ink-2 rounded-full px-1.5">{{ data.closedInvoices.length }}</span>
          </button>
          <button (click)="activeTab.set('transactions')" (keydown.escape)="activeTab.set('transactions')"
            [class.is-active]="activeTab() === 'transactions'"
            class="tab">
            Transactions
            <span class="text-xs bg-muted-strong text-ink-2 rounded-full px-1.5">{{ data.transactions.length }}</span>
          </button>
        </div>

        <!-- 1. Open invoices -->
        @if (activeTab() === 'open') {
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Invoice Date</th>
                  <th scope="col">Due Date</th>
                  <th scope="col" class="text-right">Total</th>
                  <th scope="col" class="text-right">Paid</th>
                  <th scope="col" class="text-right">Remaining</th>
                  <th scope="col" class="text-right">VAT</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of data.openInvoices; track inv.id) {
                  <tr [class.bg-danger-soft/40]="inv.overdue">
                    <td class="font-mono text-ink-2">
                      {{ inv.invoiceNumber }}
                      @if (inv.overdue) {
                        <span class="badge ml-2 badge-danger">Overdue</span>
                      }
                    </td>
                    <td class="text-ink-2">{{ date(inv.invoiceDate) }}</td>
                    <td [class]="inv.overdue ? 'text-danger-ink font-semibold' : 'text-ink-2'">{{ date(inv.dueDate) }}</td>
                    <td class="text-right text-ink">{{ money(inv.totalAmount) }}</td>
                    <td class="text-right text-ink-2">{{ money(inv.paidAmount) }}</td>
                    <td class="text-right text-ink">{{ money(inv.remainingAmount) }}</td>
                    <td class="text-right text-ink-3">{{ money(inv.vatAmount) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-center text-ink-3">No open invoices.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- 2. Closed invoices -->
        @if (activeTab() === 'closed') {
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Payment Date</th>
                  <th scope="col">Invoice Date</th>
                  <th scope="col">Due Date</th>
                  <th scope="col" class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of data.closedInvoices; track inv.id) {
                  <tr>
                    <td class="font-mono text-ink-2">{{ inv.invoiceNumber }}</td>
                    <td class="text-ink">{{ date(inv.paymentDate) }}</td>
                    <td class="text-ink-2">{{ date(inv.invoiceDate) }}</td>
                    <td class="text-ink-2">{{ date(inv.dueDate) }}</td>
                    <td class="text-right text-ink">{{ money(inv.totalAmount) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-ink-3">No closed invoices.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- 3. Transactions (grand livre) -->
        @if (activeTab() === 'transactions') {
          <div class="px-6 pt-4 text-xs text-ink-3">
            {{ mode() === 'supplier'
              ? 'Payments made to this supplier are positive; invoices received are negative.'
              : 'Invoices raised are positive; payments received are negative.' }}
          </div>
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Document</th>
                  <th scope="col" class="text-right">Amount</th>
                  <th scope="col" class="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                @for (row of runningLedger(); track $index) {
                  <tr>
                    <td class="text-ink-2">{{ date(row.date) }}</td>
                    <td>
                      <span class="badge"
                        [class]="row.type === 'PAYMENT' ? 'badge-success' : 'badge-info'">
                        {{ row.type === 'PAYMENT' ? 'Payment' : 'Invoice' }}
                      </span>
                    </td>
                    <td class="font-mono text-ink-2">{{ row.documentNumber || '—' }}</td>
                    <td class="text-right"
                      [class]="row.amount < 0 ? 'text-danger-ink' : 'text-ink'">
                      {{ signedMoney(row.amount) }}
                    </td>
                    <td class="text-right text-ink-3">{{ signedMoney(row.balance) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-ink-3">No transactions recorded.</td></tr>
                }
              </tbody>
              @if (data.transactions.length > 0) {
                <tfoot class="bg-subtle">
                  <tr>
                    <td colspan="4" class="text-right uppercase tracking-wider">Closing balance</td>
                    <td class="text-right">{{ signedMoney(data.totals.balance) }}</td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        }
      } @else if (error()) {
        <div class="p-6 text-sm text-danger-ink">{{ error() }}</div>
      } @else {
        <div class="p-6 text-sm text-ink-3">Loading account…</div>
      }
    </section>
  `,
})
export class PartnerLedgerComponent {
  private api = inject(ApiService);

  partnerId = input.required<string>();
  mode = input<'customer' | 'supplier'>('customer');

  ledger = signal<PartnerLedger | null>(null);
  error = signal<string | null>(null);
  activeTab = signal<LedgerTab>('open');

  constructor() {
    effect(() => {
      const id = this.partnerId();
      if (!id) return;
      this.ledger.set(null);
      this.error.set(null);
      this.api.getPartnerLedger(id).subscribe({
        next: (data) => this.ledger.set(data as PartnerLedger),
        error: () => this.error.set('Could not load this account. Try again in a moment.'),
      });
    });
  }

  /**
   * The transaction list with a running balance attached. Computed here rather than served,
   * because the balance only makes sense in the order the table happens to be showing.
   */
  runningLedger = computed(() => {
    let balance = 0;
    return (this.ledger()?.transactions ?? []).map(t => {
      balance += t.amount ?? 0;
      return { ...t, balance };
    });
  });

  money = formatCurrency;
  signedMoney = formatSignedCurrency;
  date = formatDate;
}
