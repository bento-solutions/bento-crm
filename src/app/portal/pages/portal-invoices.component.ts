import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { errorDetail } from '../../pages/bank/bank-labels';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { isoDate } from '../../shared/practice.util';
import { PortalApi, PortalInvoice, saveBlob } from '../portal-api.service';
import { invoiceBadge } from '../portal.util';

/** The client's invoices: what is owed, the PDF, and a Pay button when the firm takes online payment. */
@Component({
  selector: 'app-portal-invoices',
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="space-y-4">
      <h1 class="t-title">{{ 'portal.invoices.title' | translate }}</h1>
      @if (error()) { <div class="alert alert-danger text-sm">{{ error() }}</div> }

      @if (loaded() && invoices().length === 0) {
        <div class="card p-8 text-center text-sm text-ink-3">{{ 'portal.invoices.empty' | translate }}</div>
      }

      <div class="space-y-2">
        @for (inv of invoices(); track inv.id) {
          <div class="card p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-medium text-ink truncate">{{ 'portal.invoices.number' | translate: { number: inv.invoiceNumber || '—' } }}</div>
                <div class="text-xs text-ink-3">
                  {{ date(inv.invoiceDate) }}
                  @if (inv.dueDate) { · <span [class.text-danger-ink]="isLate(inv)">{{ 'portal.invoices.due' | translate: { date: date(inv.dueDate) } }}</span> }
                </div>
              </div>
              <span class="badge shrink-0" [class]="badge(inv)">{{ ('portal.invoiceStatus.' + statusOf(inv)) | translate }}</span>
            </div>
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div class="text-xs text-ink-3">{{ ((inv.owed ?? 0) > 0 ? 'portal.invoices.owed' : 'portal.invoices.total') | translate }}</div>
                <div class="text-lg text-ink num">{{ money((inv.owed ?? 0) > 0 ? inv.owed : inv.total, inv.currency) }}</div>
                @if ((inv.owed ?? 0) > 0 && inv.total !== inv.owed) {
                  <div class="text-xs text-ink-3 num">{{ 'portal.invoices.ofTotal' | translate: { total: money(inv.total, inv.currency) } }}</div>
                }
              </div>
              <div class="flex gap-2">
                <button class="btn-secondary btn-sm" [disabled]="busy() === inv.id" (click)="pdf(inv)"><mat-icon>download</mat-icon>{{ 'portal.invoices.pdf' | translate }}</button>
                @if (inv.payUrl) {
                  <a class="btn-primary btn-sm" [href]="inv.payUrl" target="_blank" rel="noopener"><mat-icon>credit_card</mat-icon>{{ 'portal.invoices.pay' | translate }}</a>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class PortalInvoicesComponent implements OnInit {
  private api = inject(PortalApi);
  private i18n = inject(TranslationService);
  private readonly today = isoDate(new Date());

  invoices = signal<PortalInvoice[]>([]);
  loaded = signal(false);
  busy = signal<string | null>(null);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.invoices().subscribe({
      next: list => { this.invoices.set(list ?? []); this.loaded.set(true); },
      error: e => this.fail(e),
    });
  }

  pdf(inv: PortalInvoice): void {
    this.busy.set(inv.id);
    this.api.invoicePdf(inv.id).subscribe({
      next: blob => {
        this.busy.set(null);
        saveBlob(blob, `facture-${(inv.invoiceNumber || inv.id.slice(0, 8)).replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`);
      },
      error: e => { this.busy.set(null); this.fail(e); },
    });
  }

  /** Unpaid past the due date reads as overdue, whatever status the invoice was saved with. */
  isLate(inv: PortalInvoice): boolean {
    return (inv.owed ?? 0) > 0 && !!inv.dueDate && inv.dueDate < this.today;
  }

  statusOf(inv: PortalInvoice): string {
    return this.isLate(inv) && inv.status !== 'PAID' ? 'OVERDUE' : inv.status;
  }

  badge(inv: PortalInvoice): string { return invoiceBadge(this.statusOf(inv)); }
  money(v: number | null | undefined, currency?: string | null): string { return formatMoney(v, currency); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.error.set(errorDetail(e) || this.i18n.t('portal.error'));
  }
}
