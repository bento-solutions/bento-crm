import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { CrmStateService, Invoice } from '../../services/crm-state.service';
import { AdvancesApi } from '../../services/domains/advances.service';
import { InvoicesService } from '../../services/domains/invoices.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { AdvanceInvoiceDialogComponent } from './advance-invoice-dialog.component';

/**
 * The advance invoices of a deal or a quote, with their paid status, and "Create advance invoice".
 * Reads GET /invoices?dealId= (or ?proposalId=) and keeps the ADVANCE ones.
 */
@Component({
  selector: 'app-advances-panel',
  imports: [MatIconModule, RouterLink, TranslatePipe, AdvanceInvoiceDialogComponent],
  template: `
    @if (canRead()) {
      <section class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold text-ink">{{ 'advances.title' | translate }}</h3>
          @if (advances().length) {
            <span class="text-xs text-ink-3">{{ 'advances.summary' | translate: { total: money(total()), paid: money(paid()) } }}</span>
          }
          @if (canCreate() && partnerId()) {
            <button class="btn-secondary btn-sm ms-auto" (click)="open.set(true)"><mat-icon>request_quote</mat-icon>{{ 'advances.create' | translate }}</button>
          }
        </div>
        @for (a of advances(); track a.id) {
          <div class="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <div class="min-w-0">
              <div class="text-sm text-ink truncate">
                <span class="badge badge-info me-1">{{ 'advances.badge' | translate }}</span>{{ a.invoiceNumber || ('advances.draftNumber' | translate) }}
              </div>
              <div class="text-meta text-ink-3">{{ date(a.invoiceDate || a.createdAt) }}</div>
            </div>
            <div class="text-end shrink-0">
              <div class="num text-sm text-ink">{{ money(a.amount) }}</div>
              <span class="badge" [class]="statusBadge(a)">{{ ('advances.status.' + a.status) | translate }}</span>
            </div>
          </div>
        } @empty {
          <p class="text-xs text-ink-3">{{ 'advances.none' | translate }}</p>
        }
        @if (advances().length) {
          <a class="text-xs text-accent-ink hover:underline" routerLink="/finance">{{ 'advances.openInvoices' | translate }}</a>
        }
      </section>

      @if (open()) {
        <app-advance-invoice-dialog [partnerId]="partnerId()" [dealId]="dealId()" [proposalId]="proposalId()"
                                    [baseAmount]="baseAmount()" [sourceLabel]="sourceLabel()"
                                    (created)="onCreated()" (closed)="open.set(false)" />
      }
    }
  `,
})
export class AdvancesPanelComponent {
  private api = inject(AdvancesApi);
  private state = inject(CrmStateService);
  private invoices = inject(InvoicesService);

  partnerId = input<string>('');
  dealId = input<string | null>(null);
  proposalId = input<string | null>(null);
  baseAmount = input<number>(0);
  sourceLabel = input<string>('');

  advances = signal<Invoice[]>([]);
  open = signal(false);

  total = computed(() => this.advances().reduce((s, a) => s + (a.amount || 0), 0));
  paid = computed(() => this.advances().reduce((s, a) => s + (a.status === 'Paid' ? (a.amount || 0) : (a.amountPaid || 0)), 0));

  constructor() {
    effect(() => {
      const dealId = this.dealId();
      const proposalId = this.proposalId();
      untracked(() => this.load(dealId, proposalId));
    });
  }

  canRead(): boolean { return this.state.hasAuthority('INVOICES_READ'); }
  canCreate(): boolean { return this.state.hasAuthority('INVOICES_CREATE'); }

  private load(dealId: string | null, proposalId: string | null): void {
    this.advances.set([]);
    if ((!dealId && !proposalId) || !this.canRead()) return;
    this.api.invoicesOf({ dealId, proposalId }).subscribe({
      next: list => {
        if (this.dealId() !== dealId || this.proposalId() !== proposalId) return;
        this.advances.set(list.filter(i => i.kind === 'ADVANCE'));
      },
      error: () => { /* no advance to show */ },
    });
  }

  onCreated(): void {
    this.open.set(false);
    this.load(this.dealId(), this.proposalId());
    // The invoices list picks the new draft up.
    this.invoices.load(undefined, true);
  }

  statusBadge(a: Invoice): string {
    switch (a.status) {
      case 'Paid': return 'badge-success';
      case 'Overdue': return 'badge-danger';
      case 'Pending': return (a.amountPaid || 0) > 0 ? 'badge-warning' : 'badge-neutral';
      default: return 'badge-neutral';
    }
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(v: string | null | undefined): string { return shortDate(v); }
}
