import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Invoice } from '../crm-state.service';

export type { Invoice };

@Injectable({
  providedIn: 'root'
})
export class InvoicesService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  invoices = signal<Invoice[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allInvoices = computed(() => this.invoices());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(params?: Record<string, string | number | boolean>, force = false): void {
    if (this.isLoaded() && !params && !force) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getInvoices(params).subscribe({
      next: (invoices) => {
        if (invoices) {
          this.invoices.set(invoices);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load invoices from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load invoices from the server.');
      }
    });
  }

  addInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createInvoice(invoice as unknown).subscribe({
      next: (created) => {
        this.invoices.update(invoices => [...invoices, created]);
        this.toast.show(`Invoice <strong>${created.invoiceNumber}</strong> created`);
      },
      error: () => this.toast.show('Failed to create invoice', { type: 'error' })
    });
  }

  updateInvoice(id: string, invoice: Partial<Invoice>): void {
    this.api.updateInvoice(id, invoice as unknown).subscribe({
      next: (updated) => {
        this.invoices.update(invoices =>
          invoices.map(i => i.id === id ? updated : i)
        );
        this.toast.show(`Invoice updated`);
      },
      error: () => this.toast.show('Failed to update invoice', { type: 'error' })
    });
  }

  deleteInvoice(id: string): void {
    const deleted = this.invoices().find(i => i.id === id);
    this.api.deleteInvoice(id).subscribe({
      next: () => {
        this.invoices.update(invoices => invoices.filter(i => i.id !== id));
        this.toast.show(`Invoice <strong>${deleted?.invoiceNumber || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.invoices.update(invoices => [...invoices, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete invoice', { type: 'error' })
    });
  }

  getInvoiceById(id: string): Invoice | undefined {
    return this.invoices().find(i => i.id === id);
  }
}
