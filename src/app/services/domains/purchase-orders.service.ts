import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { PurchaseOrder } from '../crm-state.service';

export type { PurchaseOrder };

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrdersService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  purchaseOrders = signal<PurchaseOrder[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allPurchaseOrders = computed(() => this.purchaseOrders());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getPurchaseOrders().subscribe({
      next: (pos) => {
        if (pos && pos.length > 0) {
          this.purchaseOrders.set(pos);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load purchase orders from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load purchase orders from the server.');
      }
    });
  }

  addPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createPurchaseOrder(po as unknown).subscribe({
      next: (created) => {
        this.purchaseOrders.update(pos => [...pos, created]);
        this.toast.show(`Purchase order <strong>${created.orderNumber}</strong> created`);
      },
      error: () => this.toast.show('Failed to create purchase order', { type: 'error' })
    });
  }

  updatePurchaseOrder(id: string, po: Partial<PurchaseOrder>): void {
    this.api.updatePurchaseOrder(id, po as unknown).subscribe({
      next: (updated) => {
        this.purchaseOrders.update(pos =>
          pos.map(p => p.id === id ? updated : p)
        );
        this.toast.show(`Purchase order updated`);
      },
      error: () => this.toast.show('Failed to update purchase order', { type: 'error' })
    });
  }

  deletePurchaseOrder(id: string): void {
    const deleted = this.purchaseOrders().find(p => p.id === id);
    this.api.deletePurchaseOrder(id).subscribe({
      next: () => {
        this.purchaseOrders.update(pos => pos.filter(p => p.id !== id));
        this.toast.show(`Purchase order <strong>${deleted?.orderNumber || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.purchaseOrders.update(pos => [...pos, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete purchase order', { type: 'error' })
    });
  }

  getPurchaseOrderById(id: string): PurchaseOrder | undefined {
    return this.purchaseOrders().find(p => p.id === id);
  }

  updateStatus(id: string, status: string, deliveryDate?: string): void {
    const po = this.getPurchaseOrderById(id);
    if (po) {
      const updates: Record<string, unknown> = { status: status as PurchaseOrder['status'] };
      if (deliveryDate) {
        updates['deliveryDate'] = deliveryDate;
      }
      this.updatePurchaseOrder(id, { ...po, ...updates });
    }
  }
}
