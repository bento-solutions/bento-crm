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
    <section class="card rounded-2xl overflow-hidden">
      <div class="p-6 pb-0 flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
          <mat-icon class="text-[18px]">account_balance</mat-icon>
        </div>
        <h3 class="text-base font-bold text-zinc-800">
          {{ mode() === 'supplier' ? 'Supplier Account' : 'Customer Account' }}
        </h3>
      </div>

      @if (ledger(); as data) {
        <!-- Summary strip -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6 pb-4">
          <div class="bg-white/60 rounded-xl p-3">
            <span class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Invoiced</span>
            <span class="text-lg font-bold text-zinc-900 font-sans">{{ money(data.totals.totalInvoiced) }}</span>
          </div>
          <div class="bg-white/60 rounded-xl p-3">
            <span class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Paid</span>
            <span class="text-lg font-bold text-zinc-900 font-sans">{{ money(data.totals.totalPaid) }}</span>
          </div>
          <div class="bg-white/60 rounded-xl p-3">
            <span class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Outstanding</span>
            <span class="text-lg font-bold text-zinc-900 font-sans">{{ money(data.totals.totalOpen) }}</span>
          </div>
          <div class="bg-white/60 rounded-xl p-3">
            <span class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Overdue</span>
            <span class="text-lg font-bold font-sans" [class]="data.totals.totalOverdue > 0 ? 'text-red-600' : 'text-zinc-900'">
              {{ money(data.totals.totalOverdue) }}
            </span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 flex gap-6 border-b border-white/30">
          <button (click)="activeTab.set('open')" (keydown.escape)="activeTab.set('open')"
            [class]="activeTab() === 'open' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'"
            class="py-3 border-b-2 text-sm font-semibold transition-all flex items-center gap-2">
            Open Invoices
            <span class="text-xs bg-zinc-200/70 text-zinc-700 rounded-full px-1.5">{{ data.openInvoices.length }}</span>
          </button>
          <button (click)="activeTab.set('closed')" (keydown.escape)="activeTab.set('closed')"
            [class]="activeTab() === 'closed' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'"
            class="py-3 border-b-2 text-sm font-semibold transition-all flex items-center gap-2">
            Closed Invoices
            <span class="text-xs bg-zinc-200/70 text-zinc-700 rounded-full px-1.5">{{ data.closedInvoices.length }}</span>
          </button>
          <button (click)="activeTab.set('transactions')" (keydown.escape)="activeTab.set('transactions')"
            [class]="activeTab() === 'transactions' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'"
            class="py-3 border-b-2 text-sm font-semibold transition-all flex items-center gap-2">
            Transactions
            <span class="text-xs bg-zinc-200/70 text-zinc-700 rounded-full px-1.5">{{ data.transactions.length }}</span>
          </button>
        </div>

        <!-- 1. Open invoices -->
        @if (activeTab() === 'open') {
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-zinc-50/50">
                <tr class="text-xs uppercase tracking-wider text-zinc-500">
                  <th scope="col" class="px-4 py-3 text-left font-medium">Invoice</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Invoice Date</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Due Date</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">Paid</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">Remaining</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">VAT</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                @for (inv of data.openInvoices; track inv.id) {
                  <tr [class.bg-red-50/40]="inv.overdue">
                    <td class="px-4 py-3 font-mono text-xs text-zinc-700">
                      {{ inv.invoiceNumber }}
                      @if (inv.overdue) {
                        <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">Overdue</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-zinc-600">{{ date(inv.invoiceDate) }}</td>
                    <td class="px-4 py-3" [class]="inv.overdue ? 'text-red-600 font-semibold' : 'text-zinc-600'">{{ date(inv.dueDate) }}</td>
                    <td class="px-4 py-3 text-right font-sans text-zinc-900">{{ money(inv.totalAmount) }}</td>
                    <td class="px-4 py-3 text-right font-sans text-zinc-600">{{ money(inv.paidAmount) }}</td>
                    <td class="px-4 py-3 text-right font-sans font-bold text-zinc-900">{{ money(inv.remainingAmount) }}</td>
                    <td class="px-4 py-3 text-right font-sans text-zinc-500">{{ money(inv.vatAmount) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="px-4 py-8 text-center text-zinc-500">No open invoices.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- 2. Closed invoices -->
        @if (activeTab() === 'closed') {
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-zinc-50/50">
                <tr class="text-xs uppercase tracking-wider text-zinc-500">
                  <th scope="col" class="px-4 py-3 text-left font-medium">Invoice</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Payment Date</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Invoice Date</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Due Date</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                @for (inv of data.closedInvoices; track inv.id) {
                  <tr>
                    <td class="px-4 py-3 font-mono text-xs text-zinc-700">{{ inv.invoiceNumber }}</td>
                    <td class="px-4 py-3 text-zinc-900 font-semibold">{{ date(inv.paymentDate) }}</td>
                    <td class="px-4 py-3 text-zinc-600">{{ date(inv.invoiceDate) }}</td>
                    <td class="px-4 py-3 text-zinc-600">{{ date(inv.dueDate) }}</td>
                    <td class="px-4 py-3 text-right font-sans text-zinc-900">{{ money(inv.totalAmount) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-4 py-8 text-center text-zinc-500">No closed invoices.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- 3. Transactions (grand livre) -->
        @if (activeTab() === 'transactions') {
          <div class="px-6 pt-4 text-xs text-zinc-500">
            {{ mode() === 'supplier'
              ? 'Payments made to this supplier are positive; invoices received are negative.'
              : 'Invoices raised are positive; payments received are negative.' }}
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-zinc-50/50">
                <tr class="text-xs uppercase tracking-wider text-zinc-500">
                  <th scope="col" class="px-4 py-3 text-left font-medium">Date</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Type</th>
                  <th scope="col" class="px-4 py-3 text-left font-medium">Document</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">Amount</th>
                  <th scope="col" class="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                @for (row of runningLedger(); track $index) {
                  <tr>
                    <td class="px-4 py-3 text-zinc-600">{{ date(row.date) }}</td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        [class]="row.type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'">
                        {{ row.type === 'PAYMENT' ? 'Payment' : 'Invoice' }}
                      </span>
                    </td>
                    <td class="px-4 py-3 font-mono text-xs text-zinc-700">{{ row.documentNumber || '—' }}</td>
                    <td class="px-4 py-3 text-right font-sans font-semibold"
                      [class]="row.amount < 0 ? 'text-red-600' : 'text-zinc-900'">
                      {{ signedMoney(row.amount) }}
                    </td>
                    <td class="px-4 py-3 text-right font-sans text-zinc-500">{{ signedMoney(row.balance) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-4 py-8 text-center text-zinc-500">No transactions recorded.</td></tr>
                }
              </tbody>
              @if (data.transactions.length > 0) {
                <tfoot class="bg-zinc-50/50">
                  <tr class="font-bold text-zinc-900">
                    <td colspan="4" class="px-4 py-3 text-right uppercase text-xs tracking-wider">Closing balance</td>
                    <td class="px-4 py-3 text-right font-sans">{{ signedMoney(data.totals.balance) }}</td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        }
      } @else if (error()) {
        <div class="p-6 text-sm text-red-600">{{ error() }}</div>
      } @else {
        <div class="p-6 text-sm text-zinc-500">Loading account…</div>
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
